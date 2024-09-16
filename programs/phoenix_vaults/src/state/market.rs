use crate::constants::PRICE_PRECISION_U64;
use crate::error::ErrorCode;
use crate::math::{
    base_lots_to_raw_base_units_precision, quote_atoms_to_quote_lots_rounded_down,
    quote_lots_to_quote_units_precision, sol_to_usdc_denom, ticks_to_price_precision,
};
use crate::state::{Investor, MarketRegistry};
use crate::validate;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use heapless::LinearMap;
use phoenix::program::{load_with_dispatch, MarketHeader};
use phoenix::quantities::WrapperU64;
use sokoban::ZeroCopy;
use solana_program::address_lookup_table::state::AddressLookupTable;
use std::cell::{Ref, RefMut};

const SOL_USDC_MARKET_INDEX: usize = 0;

pub trait MarketMapProvider<'a> {
    fn load_markets(
        &self,
        registry: RefMut<MarketRegistry>,
        market_lut: MarketLookupTable,
    ) -> Result<LinearMap<Pubkey, u64, 32>>;

    fn load_sol_usdc_market(
        &self,
        registry: RefMut<MarketRegistry>,
        lut: &AddressLookupTable,
    ) -> Result<(Pubkey, u64)>;

    fn equity(
        &self,
        vault_key: &Pubkey,
        registry: RefMut<MarketRegistry>,
        market_lut: MarketLookupTable,
    ) -> Result<u64>;

    fn check_cant_withdraw(
        &self,
        investor: &Investor,
        vault_usdc_token_account: &Account<TokenAccount>,
        registry: &RefMut<MarketRegistry>,
        lut: &AddressLookupTable,
    ) -> Result<()>;
}

pub struct MarketLookupTable<'a> {
    pub lut_key: Pubkey,
    pub lut: &'a AddressLookupTable<'a>,
}

// todo: validate remaining accounts against keys in MarketRegistry to prevent invalid accounts from being passed in.
impl<'a: 'info, 'info, T: anchor_lang::Bumps> MarketMapProvider<'a>
    for Context<'_, '_, 'a, 'info, T>
{
    /// The [`MarketRegistry`] references an [`AddressLookupTable`] which contains a list of all markets on Phoenix.
    /// The remaining accounts in this Context should directly correspond to the addresses in the lookup table.
    fn load_markets(
        &self,
        registry: RefMut<MarketRegistry>,
        market_lut: MarketLookupTable,
    ) -> Result<LinearMap<Pubkey, u64, 32>> {
        let MarketLookupTable { lut_key, lut } = market_lut;
        validate!(
            registry.lut == lut_key,
            ErrorCode::MarketRegistryLookupTableMismatch,
            "MarketRegistry lookup table key mismatch"
        )?;

        let mut market_prices = LinearMap::new();

        let sol_mint = registry.sol_mint;
        let usdc_mint = registry.usdc_mint;
        let (_, sol_price) = self.load_sol_usdc_market(registry, &lut)?;

        let remaining_accounts_iter = &mut self.remaining_accounts.iter().peekable();
        for (account, lut_key) in remaining_accounts_iter.zip(lut.addresses.iter()) {
            // assert this key in the remaining accounts matches the key in the lookup table
            validate!(
                account.key == lut_key,
                ErrorCode::MarketRegistryMismatch,
                &format!("MarketRegistryMismatch: {:?} != {:?}", account.key, lut_key)
            )?;

            let market_key = account.key();
            let account = account.to_account_info();
            let account_data = account.try_borrow_data()?;
            let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
            let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
                anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
            )?);
            let market = load_with_dispatch(&header.market_size_params, bytes)?;
            let tick_price = market
                .inner
                .get_ladder(1)
                .asks
                .first()
                .map_or(0, |ask| ask.price_in_ticks);
            let price = ticks_to_price_precision(&header, tick_price);

            let quote_mint = header.quote_params.mint_key;
            if quote_mint == usdc_mint {
                market_prices
                    .insert(market_key, price)
                    .map_err(|_| anchor_lang::error::Error::from(ErrorCode::MarketMapFull))?;
            } else if quote_mint == sol_mint {
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

    /// Process the SOL/USDC to cover all quote mints (SOL and USDC) on Phoenix.
    /// This enables equity calculation in either SOL or USDC denomination.
    fn load_sol_usdc_market(
        &self,
        registry: RefMut<MarketRegistry>,
        lut: &AddressLookupTable,
    ) -> Result<(Pubkey, u64)> {
        let lut_key_at_index = lut
            .addresses
            .get(SOL_USDC_MARKET_INDEX)
            .map_or(Pubkey::default(), |key| *key);

        let account = self
            .remaining_accounts
            .get(SOL_USDC_MARKET_INDEX)
            .ok_or(anchor_lang::error::Error::from(ErrorCode::SolMarketMissing))?;

        validate!(
            *account.key == lut_key_at_index,
            ErrorCode::MarketRegistryMismatch,
            &format!(
                "SOL/USDC MarketRegistryMismatch: {:?} != {:?}",
                account.key, lut_key_at_index
            )
        )?;

        let account = account.to_account_info();
        let account_data = account.try_borrow_data()?;

        let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
        let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
            anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
        )?);
        if header.quote_params.mint_key != registry.usdc_mint
            || header.base_params.mint_key != registry.sol_mint
        {
            return Err(anchor_lang::error::Error::from(ErrorCode::SolMarketMissing));
        }
        let market = load_with_dispatch(&header.market_size_params, bytes)?;
        let ladder = market.inner.get_ladder(1);
        let tick_price = ladder.asks.first().map_or(0, |ask| ask.price_in_ticks);
        let price = ticks_to_price_precision(&header, tick_price);
        msg!("sol ask price: {}/1_000_000", price);
        Ok((account.key(), price))
    }

    fn equity(
        &self,
        vault_key: &Pubkey,
        registry: RefMut<MarketRegistry>,
        market_lut: MarketLookupTable,
    ) -> Result<u64> {
        let MarketLookupTable { lut_key, lut } = market_lut;
        validate!(
            registry.lut == lut_key,
            ErrorCode::MarketRegistryLookupTableMismatch,
            "MarketRegistry lookup table key mismatch"
        )?;

        let mut equity = 0;

        let sol_mint = registry.sol_mint;
        let usdc_mint = registry.usdc_mint;
        let (_, sol_price) = self.load_sol_usdc_market(registry, &lut)?;

        let remaining_accounts_iter = &mut self.remaining_accounts.iter().peekable();
        for (account, lut_key) in remaining_accounts_iter.zip(lut.addresses.iter()) {
            // assert this key in the remaining accounts matches the key in the lookup table
            validate!(
                account.key == lut_key,
                ErrorCode::MarketRegistryMismatch,
                &format!("MarketRegistryMismatch: {:?} != {:?}", account.key, lut_key)
            )?;

            let account = account.to_account_info();
            let account_data = account.try_borrow_data()?;
            let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
            let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
                anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
            )?);
            let market = load_with_dispatch(&header.market_size_params, bytes)?;
            let tick_price = market
                .inner
                .get_ladder(1)
                .asks
                .first()
                .map_or(0, |ask| ask.price_in_ticks);
            let price = ticks_to_price_precision(&header, tick_price);

            if let Some(trader_state) = market.inner.get_trader_state(vault_key) {
                let quote_mint = header.quote_params.mint_key;
                let usdc_price_precision = if quote_mint == usdc_mint {
                    price
                } else if quote_mint == sol_mint {
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

    fn check_cant_withdraw(
        &self,
        investor: &Investor,
        vault_usdc_token_account: &Account<TokenAccount>,
        registry: &RefMut<MarketRegistry>,
        lut: &AddressLookupTable,
    ) -> Result<()> {
        let lut_key_at_index = lut
            .addresses
            .get(SOL_USDC_MARKET_INDEX)
            .map_or(Pubkey::default(), |key| *key);

        let account = self
            .remaining_accounts
            .get(SOL_USDC_MARKET_INDEX)
            .ok_or(anchor_lang::error::Error::from(ErrorCode::SolMarketMissing))?;

        validate!(
            *account.key == lut_key_at_index,
            ErrorCode::MarketRegistryMismatch,
            &format!(
                "SOL/USDC MarketRegistryMismatch: {:?} != {:?}",
                account.key, lut_key_at_index
            )
        )?;

        let account = account.to_account_info();
        let account_data = account.try_borrow_data()?;

        let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
        let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
            anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
        )?);
        if header.quote_params.mint_key != registry.usdc_mint
            || header.base_params.mint_key != registry.sol_mint
        {
            return Err(anchor_lang::error::Error::from(ErrorCode::SolMarketMissing));
        }

        let quote_lots_available =
            quote_atoms_to_quote_lots_rounded_down(&header, vault_usdc_token_account.amount);
        let quote_lots_requested =
            quote_atoms_to_quote_lots_rounded_down(&header, investor.last_withdraw_request.value);
        let cant_withdraw = quote_lots_available < quote_lots_requested;

        validate!(
            cant_withdraw,
            ErrorCode::InvestorCanWithdraw,
            "Investor does not require liquidation to fulfill withdraw request"
        )?;

        Ok(())
    }
}
