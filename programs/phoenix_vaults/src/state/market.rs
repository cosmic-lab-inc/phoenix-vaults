use crate::constants::PRICE_PRECISION_U64;
use crate::error::ErrorCode;
use crate::instructions::MarketLookupTableParams;
use crate::math::{
    base_lots_to_raw_base_units_precision, quote_lots_to_quote_units_precision, sol_to_usdc_denom,
    ticks_to_price_precision,
};
use anchor_lang::prelude::*;
use heapless::LinearMap;
use phoenix::program::{load_with_dispatch, MarketHeader};
use phoenix::quantities::WrapperU64;
use sokoban::ZeroCopy;

pub trait MarketMapProvider<'a> {
    fn load_markets(&self, params: MarketLookupTableParams) -> Result<LinearMap<Pubkey, u64, 32>>;
    fn load_sol_usdc_market(&self, params: MarketLookupTableParams) -> Result<(Pubkey, u64)>;
    fn equity(&self, trader: &Pubkey, params: MarketLookupTableParams) -> Result<u64>;
}

impl<'a: 'info, 'info, T: anchor_lang::Bumps> MarketMapProvider<'a>
    for Context<'_, '_, 'a, 'info, T>
{
    /// Process all markets on Phoenix
    fn load_markets(&self, params: MarketLookupTableParams) -> Result<LinearMap<Pubkey, u64, 32>> {
        let mut market_prices = LinearMap::new();

        let (_, sol_price) = self.load_sol_usdc_market(params)?;

        let remaining_accounts_iter = &mut self.remaining_accounts.iter().peekable();
        for account in remaining_accounts_iter {
            let market_key = account.key();
            let account = account.to_account_info();
            let account_data = account.try_borrow_data()?;
            let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
            let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
                anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
            )?);
            let market = load_with_dispatch(&header.market_size_params, bytes)?;
            let ladder = market.inner.get_ladder(1);
            let tick_price = match ladder.asks.first() {
                Some(ask) => ask.price_in_ticks,
                None => 0,
            };
            let price = ticks_to_price_precision(&header, tick_price);

            let quote_mint = header.quote_params.mint_key;
            if quote_mint == params.usdc_mint {
                market_prices
                    .insert(market_key, price)
                    .map_err(|_| anchor_lang::error::Error::from(ErrorCode::MarketMapFull))?;
            } else if quote_mint == params.sol_mint {
                market_prices
                    .insert(market_key, sol_price * price)
                    .map_err(|_| anchor_lang::error::Error::from(ErrorCode::MarketMapFull))?;
            } else {
                return Err(anchor_lang::error::Error::from(
                    ErrorCode::UnrecognizedQuoteMint,
                ));
            }
        }
        Ok(market_prices)
    }

    /// Process a single market, usually SOL/USDC to cover all quote mints (SOL and USDC) on Phoenix.
    /// This allows for a realized pnl and equity calculation for all assets not actively in a trade.
    fn load_sol_usdc_market(&self, params: MarketLookupTableParams) -> Result<(Pubkey, u64)> {
        let account = self
            .remaining_accounts
            .get(params.sol_usdc_market_index as usize)
            .ok_or(anchor_lang::error::Error::from(ErrorCode::SolMarketMissing))?;
        let account = account.to_account_info();
        let account_data = account.try_borrow_data()?;

        let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
        let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
            anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
        )?);
        if header.quote_params.mint_key != params.usdc_mint
            || header.base_params.mint_key != params.sol_mint
        {
            return Err(anchor_lang::error::Error::from(ErrorCode::SolMarketMissing));
        }
        let market = load_with_dispatch(&header.market_size_params, bytes)?;
        let ladder = market.inner.get_ladder(1);
        let tick_price = match ladder.asks.first() {
            Some(ask) => ask.price_in_ticks,
            None => 0,
        };
        let price = ticks_to_price_precision(&header, tick_price);
        Ok((account.key(), price))
    }

    fn equity(&self, trader: &Pubkey, params: MarketLookupTableParams) -> Result<u64> {
        let mut equity = 0;
        let (_, sol_price) = self.load_sol_usdc_market(params)?;

        let remaining_accounts_iter = &mut self.remaining_accounts.iter().peekable();
        for account in remaining_accounts_iter {
            let account = account.to_account_info();
            let account_data = account.try_borrow_data()?;
            let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
            let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
                anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
            )?);
            let market = load_with_dispatch(&header.market_size_params, bytes)?;
            let ladder = market.inner.get_ladder(1);
            let tick_price = match ladder.asks.first() {
                Some(ask) => ask.price_in_ticks,
                None => 0,
            };
            let price = ticks_to_price_precision(&header, tick_price);

            if let Some(trader_state) = market.inner.get_trader_state(trader) {
                let quote_mint = header.quote_params.mint_key;
                let usdc_price_precision = if quote_mint == params.usdc_mint {
                    price
                } else if quote_mint == params.sol_mint {
                    sol_to_usdc_denom(price, sol_price)
                } else {
                    return Err(anchor_lang::error::Error::from(
                        ErrorCode::UnrecognizedQuoteMint,
                    ));
                };
                let base_lots =
                    trader_state.base_lots_locked.as_u64() + trader_state.base_lots_free.as_u64();
                let quote_lots =
                    trader_state.quote_lots_locked.as_u64() + trader_state.quote_lots_free.as_u64();

                let base_units_precision =
                    base_lots_to_raw_base_units_precision(&header, base_lots);
                // both are multiplied by PRICE_PRECISION so multiply by one to make it multiplied once in total.
                let base_quote_units_precision =
                    base_units_precision * usdc_price_precision / PRICE_PRECISION_U64;
                let quote_units_precision =
                    quote_lots_to_quote_units_precision(&header, quote_lots);
                let total_quote_units_precision =
                    base_quote_units_precision + quote_units_precision;
                // both are multiplied by PRICE_PRECISION so divide once to make it multiplied once in total.
                equity += total_quote_units_precision * usdc_price_precision / PRICE_PRECISION_U64;
            }
        }
        Ok(equity)
    }
}
