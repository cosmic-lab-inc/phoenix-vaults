use crate::error::ErrorCode;
use crate::instructions::MarketLookupTableParams;
use anchor_lang::prelude::*;
use heapless::LinearMap;
use phoenix::program::{load_with_dispatch, MarketHeader};
use sokoban::ZeroCopy;

pub trait MarketMapProvider<'a> {
    fn load_markets(&self, params: MarketLookupTableParams) -> Result<LinearMap<Pubkey, u64, 32>>;
    fn load_sol_usdc_market(&self, params: MarketLookupTableParams) -> Result<(Pubkey, u64)>;
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
            let price = ticks_to_u64_price(&header, tick_price);

            let base_mint = header.base_params.mint_key;
            let quote_mint = header.quote_params.mint_key;
            if quote_mint == params.usdc_mint {
                market_prices
                    .insert(base_mint, price)
                    .map_err(|_| anchor_lang::error::Error::from(ErrorCode::MarketMapFull))?;
            } else if quote_mint == params.sol_mint {
                market_prices
                    .insert(base_mint, sol_price * price)
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
        msg!("sol usdc: {:?}", account.key());
        msg!("sol usdc data: {}", account_data.len());
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
        let price = ticks_to_u64_price(&header, tick_price);
        Ok((account.key(), price))
    }
}

fn ticks_to_u64_price(header: &MarketHeader, ticks: u64) -> u64 {
    let raw_base_units_per_base_unit = header.raw_base_units_per_base_unit.max(1);
    // 10^6 for USDC, 10^9 for SOL
    let quote_atoms_per_quote_unit = 10u64.pow(header.quote_params.decimals);
    let tick_size_in_quote_atoms_per_base_unit: u64 =
        header.get_tick_size_in_quote_atoms_per_base_unit().into();
    (ticks * tick_size_in_quote_atoms_per_base_unit)
        / (quote_atoms_per_quote_unit * raw_base_units_per_base_unit as u64)
}
