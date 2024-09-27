use crate::constants::{PERCENTAGE_PRECISION, PRICE_PRECISION_U64};
use crate::error::ErrorCode;
use crate::math::*;
use crate::state::{Investor, MarketPosition, MarketRegistry, Vault};
use crate::validate;
use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use phoenix::program::{load_with_dispatch, MarketHeader};
use phoenix::quantities::WrapperU64;
use sokoban::ZeroCopy;
use std::collections::BTreeMap;
use std::iter::Peekable;
use std::slice::Iter;

pub trait MarketMapProvider<'a> {
    fn load_sol_usdc_market(
        &self,
        registry: &MarketRegistry,
    ) -> Result<(Pubkey, u64, Box<MarketHeader>)>;

    fn equity(
        &self,
        vault: &Vault,
        vault_usdc: &Account<TokenAccount>,
        registry: &MarketRegistry,
    ) -> Result<u64>;

    fn check_cant_withdraw(
        &self,
        investor: &Investor,
        vault_usdc_token_account: &Account<TokenAccount>,
        registry: &MarketRegistry,
    ) -> Result<()>;

    fn market_position(&self, vault: &Vault, market: Pubkey) -> Result<MarketPosition>;
}

impl<'a: 'info, 'info, T: anchor_lang::Bumps> MarketMapProvider<'a>
    for Context<'_, '_, 'a, 'info, T>
{
    /// Process the SOL/USDC to cover all quote mints (SOL and USDC) on Phoenix.
    /// This enables equity calculation in either SOL or USDC denomination.
    fn load_sol_usdc_market(
        &self,
        registry: &MarketRegistry,
    ) -> Result<(Pubkey, u64, Box<MarketHeader>)> {
        let account = MarketMap::find(
            &registry.sol_usdc_market,
            &mut self.remaining_accounts.iter().peekable(),
        )?;

        let account_data = account.try_borrow_data()?;
        let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
        let header = Box::new(
            MarketHeader::load_bytes(header_bytes)
                .ok_or(anchor_lang::error::Error::from(
                    ErrorCode::MarketDeserializationError,
                ))?
                .to_owned(),
        );
        if header.quote_params.mint_key != registry.usdc_mint
            || header.base_params.mint_key != registry.sol_mint
        {
            return Err(ErrorCode::SolMarketMissing.into());
        }
        let market = load_with_dispatch(&header.market_size_params, bytes)?;
        let ladder = market.inner.get_ladder(1);
        let tick_price = ladder.bids.first().map_or(0, |bid| bid.price_in_ticks);

        Ok((account.key(), tick_price, header))
    }

    fn equity(
        &self,
        vault: &Vault,
        vault_usdc: &Account<TokenAccount>,
        registry: &MarketRegistry,
    ) -> Result<u64> {
        let mut equity = 0;

        let sol_mint = registry.sol_mint;
        let usdc_mint = registry.usdc_mint;

        let (_, sol_tick_price, sol_header) = self.load_sol_usdc_market(registry)?;
        let sol_price = ticks_to_price_precision(&sol_header, sol_tick_price);

        // usdc has 6 decimals which is the same as PRICE_PRECISION
        let vault_usdc_units_precision = vault_usdc.amount;
        equity += vault_usdc_units_precision;

        let remaining_accounts_iter = &mut self.remaining_accounts.iter().peekable();
        for position in vault.positions {
            if position.is_available() {
                continue;
            }
            // assert this key in the remaining accounts matches the vault's MarketPosition
            let account_info = MarketMap::find(&position.market, remaining_accounts_iter)?;

            let account_data = account_info.try_borrow_data()?;
            let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
            let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
                anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
            )?);
            let market = load_with_dispatch(&header.market_size_params, bytes)?;
            let tick_price = market
                .inner
                .get_ladder(1)
                .bids
                .first()
                .map_or(0, |bid| bid.price_in_ticks);
            let price = ticks_to_price_precision(&header, tick_price);

            if let Some(trader_state) = market.inner.get_trader_state(&vault.pubkey) {
                let quote_mint = header.quote_params.mint_key;
                let usdc_price_precision = if quote_mint == usdc_mint {
                    price
                } else if quote_mint == sol_mint {
                    sol_to_usdc_denom(price, sol_price)
                } else {
                    return Err(ErrorCode::UnrecognizedQuoteMint.into());
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
                equity += total_quote_units_precision;
            }
        }
        Ok(equity)
    }

    fn check_cant_withdraw(
        &self,
        investor: &Investor,
        vault_usdc_token_account: &Account<TokenAccount>,
        registry: &MarketRegistry,
    ) -> Result<()> {
        let account = MarketMap::find(
            &registry.sol_usdc_market,
            &mut self.remaining_accounts.iter().peekable(),
        )?;

        let account_data = account.try_borrow_data()?;
        let (header_bytes, _) = account_data.split_at(std::mem::size_of::<MarketHeader>());
        let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
            anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
        )?);
        if header.quote_params.mint_key != registry.usdc_mint
            || header.base_params.mint_key != registry.sol_mint
        {
            return Err(ErrorCode::SolMarketMissing.into());
        }

        let quote_lots_available =
            quote_atoms_to_quote_lots_rounded_down(&header, vault_usdc_token_account.amount);
        let quote_lots_requested =
            quote_atoms_to_quote_lots_rounded_down(&header, investor.last_withdraw_request.value);
        let cant_withdraw = quote_lots_available < quote_lots_requested;

        validate!(
            cant_withdraw,
            ErrorCode::InvestorCanWithdraw,
            "Investor can withdraw without liquidating the vault"
        )?;

        Ok(())
    }

    fn market_position(&self, vault: &Vault, market: Pubkey) -> Result<MarketPosition> {
        let account_info =
            MarketMap::find(&market, &mut self.remaining_accounts.iter().peekable())?;
        let account_data = account_info.try_borrow_data()?;
        let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
        let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
            anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
        )?);
        let market_wrapper = load_with_dispatch(&header.market_size_params, bytes)?;
        let trader_state = market_wrapper.inner.get_trader_state(&vault.pubkey).ok_or(
            anchor_lang::error::Error::from(ErrorCode::TraderStateNotFound),
        )?;
        Ok(MarketPosition {
            market,
            quote_lots_free: trader_state.quote_lots_free.as_u64(),
            quote_lots_locked: trader_state.quote_lots_locked.as_u64(),
            base_lots_free: trader_state.base_lots_free.as_u64(),
            base_lots_locked: trader_state.base_lots_locked.as_u64(),
        })
    }
}

pub struct MarketMap<'a>(pub BTreeMap<Pubkey, &'a AccountInfo<'a>>);

impl<'a> MarketMap<'a> {
    pub fn find<'c>(
        key: &Pubkey,
        account_info_iter: &'c mut Peekable<Iter<'a, AccountInfo<'a>>>,
    ) -> Result<&'a AccountInfo<'a>> {
        while let Some(account_info) = account_info_iter.peek() {
            if account_info.key == key {
                return Ok(account_info);
            }
        }
        Err(ErrorCode::MarketMissingInRemainingAccounts.into())
    }
}
