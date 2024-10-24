use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use phoenix::program::{load_with_dispatch, MarketHeader};
use phoenix::quantities::WrapperU64;
use phoenix::state::{OrderPacket, OrderPacketMetadata, SelfTradeBehavior, Side};
use sokoban::ZeroCopy;
use solana_program::program::invoke_signed;

use crate::constants::PERCENTAGE_PRECISION;
use crate::constraints::*;
use crate::cpis::{PhoenixTrade, PhoenixWithdraw, TokenTransfer};
use crate::error::ErrorCode;
use crate::math::*;
use crate::state::{
    MarketMap, MarketMapProvider, MarketRegistry, MarketTransferParams, PhoenixProgram, Vault,
};
use crate::{declare_vault_seeds, validate};

/// Manager has authority to liquidate vault position in any market if they can't withdraw their equity.
/// This instruction liquidates up to the amount the investor has unfulfilled in its last withdraw request.
/// If the market is USDC denominated:
///     * if not enough quote USDC to fulfill withdraw request, swap base to USDC as needed
///     * withdraw quote USDC to `vault_usdc_token_account`
///     * transfer quote USDC to `investor_quote_token_account`
pub fn manager_liquidate_usdc_market<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, ManagerLiquidateUsdcMarket<'info>>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let vault_key = ctx.accounts.vault.key();
    let mut vault = ctx.accounts.vault.load_mut()?;

    if let Err(e) = vault.check_liquidator(&ctx.accounts.manager, now) {
        vault.reset_liquidation_delegate();
        return Err(e.into());
    }

    let registry = ctx.accounts.market_registry.load()?;
    let vault_usdc = &ctx.accounts.vault_usdc_token_account;
    if let Err(e) =
        ctx.check_cant_withdraw(&vault.last_manager_withdraw_request, vault_usdc, &registry)
    {
        vault.reset_liquidation_delegate();
        return Err(e);
    }

    let vault_equity = ctx.equity(&vault, vault_usdc, &registry)?;
    let amount = shares_to_amount(
        vault.last_manager_withdraw_request.shares,
        vault.total_shares,
        vault_equity,
    )?;
    let withdraw_request_amount = amount.min(vault.last_manager_withdraw_request.value);
    msg!("withdraw_request_amount: {}", withdraw_request_amount);

    drop(vault);

    let market_key = ctx.accounts.market.key();
    let account = MarketMap::find(&market_key, &mut ctx.remaining_accounts.iter().peekable())?;
    let account_data = account.try_borrow_data()?;
    let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
    let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
        anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
    )?);
    let quote_mint = header.quote_params.mint_key;
    validate!(
        quote_mint == registry.usdc_mint,
        ErrorCode::UnrecognizedQuoteMint,
        &format!(
            "Unrecognized quote mint {:?} != {:?}",
            quote_mint, registry.usdc_mint
        )
    )?;

    let market_wrapper = load_with_dispatch(&header.market_size_params, bytes)?;
    let tick_price = market_wrapper
        .inner
        .get_ladder(1)
        .bids
        .first()
        .map_or(0, |bid| bid.price_in_ticks);

    let trader_state = market_wrapper.inner.get_trader_state(&vault_key).ok_or(
        anchor_lang::error::Error::from(ErrorCode::TraderStateNotFound),
    )?;

    let vault_bl = trader_state.base_lots_free.as_u64();
    let vault_ql = trader_state.quote_lots_free.as_u64();
    let withdraw_ql = quote_atoms_to_quote_lots_rounded_up(&header, withdraw_request_amount);

    if withdraw_ql > vault_ql {
        // sell base lots to quote lots
        let ql_to_sell = withdraw_ql - vault_ql;
        let fee_bps = market_wrapper.inner.get_taker_fee_bps().safe_mul(100)?;
        let ql_fee = ql_to_sell
            .cast::<u128>()?
            .safe_mul(fee_bps.cast()?)?
            .safe_div(PERCENTAGE_PRECISION)?
            .cast::<u64>()?;
        let ql_to_sell = ql_to_sell.safe_add(ql_fee)?;
        let bl_to_sell = quote_lots_to_base_lots(&header, ql_to_sell, tick_price).min(vault_bl);
        let ql_to_withdraw = vault_ql + ql_to_sell;

        msg!(
            "liquidating {} USDC quote atoms to fulfill withdraw request",
            quote_lots_to_quote_atoms(&header, ql_to_withdraw)
        );

        drop(header);
        drop(account_data);
        let params = ManagerLiquidateUsdcMarket::build_swap_params(bl_to_sell)?;
        ctx.phoenix_trade(params)?;
        // withdraw existing quote_lots plus liquidated quote lots from market to vault
        ctx.phoenix_withdraw(MarketTransferParams {
            base_lots: 0,
            quote_lots: ql_to_withdraw,
        })?;
    } else {
        msg!(
            "liquidation not required, withdrawing {} USDC quote atoms to vault to fulfill withdraw request",
            quote_lots_to_quote_atoms(&header, withdraw_ql)
        );
        drop(header);
        drop(account_data);
        // withdraw available quote lots from market to vault
        ctx.phoenix_withdraw(MarketTransferParams {
            base_lots: 0,
            quote_lots: withdraw_ql,
        })?;
    };

    let mut vault = ctx.accounts.vault.load_mut()?;
    let market = ctx.accounts.market.key();
    let pos = ctx.market_position(&vault, market)?;
    vault.force_update_market_position(pos)?;

    let sol_usdc_market = registry.sol_usdc_market;
    let sol_usdc_pos = ctx.market_position(&vault, sol_usdc_market)?;
    vault.force_update_market_position(sol_usdc_pos)?;

    drop(vault);

    Ok(())
}

#[derive(Accounts)]
pub struct ManagerLiquidateUsdcMarket<'info> {
    #[account(
        mut,
        constraint = is_liquidator_for_vault(&vault, &manager)?,
        constraint = is_manager_for_vault(&vault, &manager)?
    )]
    pub vault: AccountLoader<'info, Vault>,

    pub manager: Signer<'info>,

    #[account(
        seeds = [b"market_registry"],
        bump
    )]
    pub market_registry: AccountLoader<'info, MarketRegistry>,

    #[account(
        mut,
        constraint = is_usdc_mint(&vault, &manager_usdc_token_account.mint)?,
        token::mint = usdc_mint,
        token::authority = manager,
    )]
    pub manager_usdc_token_account: Account<'info, TokenAccount>,

    //
    // Phoenix CPI accounts
    //
    pub phoenix: Program<'info, PhoenixProgram>,
    /// CHECK: validated in Phoenix CPI
    pub log_authority: UncheckedAccount<'info>,
    /// CHECK: validated in Phoenix CPI
    #[account(mut)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: validated in Phoenix CPI
    pub seat: UncheckedAccount<'info>,

    pub base_mint: Account<'info, Mint>,
    #[account(
        constraint = is_usdc_mint(&vault, &usdc_mint.key())?
    )]
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = base_mint
    )]
    pub vault_base_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = is_usdc_token_for_vault(&vault, &vault_usdc_token_account)?,
        token::mint = usdc_mint
    )]
    pub vault_usdc_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = base_mint
    )]
    pub market_base_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = is_usdc_mint(&vault, &market_usdc_token_account.mint)?,
        token::mint = usdc_mint
    )]
    pub market_usdc_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> ManagerLiquidateUsdcMarket<'info> {
    pub fn build_swap_params(bl_to_sell: u64) -> Result<OrderPacket> {
        Ok(OrderPacket::new_ioc(
            Side::Ask,
            None,
            bl_to_sell,
            0,
            bl_to_sell,
            0,
            SelfTradeBehavior::CancelProvide,
            None,
            0,
            true,
            None,
            None,
        ))
    }
}

impl<'info> PhoenixWithdraw for Context<'_, '_, '_, 'info, ManagerLiquidateUsdcMarket<'info>> {
    fn phoenix_withdraw(&self, params: MarketTransferParams) -> Result<()> {
        declare_vault_seeds!(self.accounts.vault, seeds);

        let trader_index = 3;
        let mut ix = phoenix::program::instruction_builders::create_withdraw_funds_with_custom_amounts_instruction(
            &self.accounts.market.key(),
            &self.accounts.vault.key(),
            &self.accounts.base_mint.key(),
            &self.accounts.usdc_mint.key(),
            params.base_lots,
            params.quote_lots
        );
        ix.accounts[trader_index].is_signer = true;

        // #[account(0, name = "phoenix_program", desc = "Phoenix program")]
        // #[account(1, name = "log_authority", desc = "Phoenix log authority")]
        // #[account(2, writable, name = "market", desc = "This account holds the market state")]
        // #[account(3, signer, name = "trader")]
        // #[account(4, writable, name = "base_account", desc = "Trader base token account")]
        // #[account(5, writable, name = "quote_account", desc = "Trader quote token account")]
        // #[account(6, writable, name = "base_vault", desc = "Base vault PDA, seeds are [b'vault', market_address, base_mint_address]")]
        // #[account(7, writable, name = "quote_vault", desc = "Quote vault PDA, seeds are [b'vault', market_address, quote_mint_address]")]
        // #[account(8, name = "token_program", desc = "Token program")]
        let accounts = [
            self.accounts.phoenix.to_account_info(),
            self.accounts.log_authority.to_account_info(),
            self.accounts.market.to_account_info(),
            self.accounts.vault.to_account_info(),
            self.accounts.vault_base_token_account.to_account_info(),
            self.accounts.vault_usdc_token_account.to_account_info(),
            self.accounts.market_base_token_account.to_account_info(),
            self.accounts.market_usdc_token_account.to_account_info(),
            self.accounts.token_program.to_account_info(),
        ];
        invoke_signed(&ix, &accounts, seeds)?;

        Ok(())
    }
}

impl<'info> PhoenixTrade for Context<'_, '_, '_, 'info, ManagerLiquidateUsdcMarket<'info>> {
    fn phoenix_trade(&self, order: OrderPacket) -> Result<()> {
        validate!(
            order.is_take_only(),
            ErrorCode::OrderPacketMustBeTakeOnly,
            "OrderPacket must be take-only"
        )?;
        validate!(
            order.no_deposit_or_withdrawal(),
            ErrorCode::OrderPacketMustUseDepositedFunds,
            "OrderPacket must use deposited funds"
        )?;

        let trader_index = 3;
        let mut ix =
            phoenix::program::instruction_builders::create_new_order_with_free_funds_instruction(
                &self.accounts.market.key(),
                &self.accounts.vault.key(),
                &order,
            );
        ix.accounts[trader_index].is_signer = true;

        // #[account(0, name = "phoenix_program", desc = "Phoenix program")]
        // #[account(1, name = "log_authority", desc = "Phoenix log authority")]
        // #[account(2, writable, name = "market", desc = "This account holds the market state")]
        // #[account(3, signer, name = "trader")]
        // #[account(4, name = "seat")]
        // #[account(5, writable, name = "base_account", desc = "Trader base token account")]
        // #[account(6, writable, name = "quote_account", desc = "Trader quote token account")]
        // #[account(7, writable, name = "base_vault", desc = "Base vault PDA, seeds are [b'vault', market_address, base_mint_address]")]
        // #[account(8, writable, name = "quote_vault", desc = "Quote vault PDA, seeds are [b'vault', market_address, quote_mint_address]")]
        // #[account(9, name = "token_program", desc = "Token program")]
        let accounts = [
            self.accounts.phoenix.to_account_info(),
            self.accounts.log_authority.to_account_info(),
            self.accounts.market.to_account_info(),
            self.accounts.vault.to_account_info(),
            self.accounts.seat.to_account_info(),
            self.accounts.vault_base_token_account.to_account_info(),
            self.accounts.vault_usdc_token_account.to_account_info(),
            self.accounts.market_base_token_account.to_account_info(),
            self.accounts.market_usdc_token_account.to_account_info(),
            self.accounts.token_program.to_account_info(),
        ];
        declare_vault_seeds!(self.accounts.vault, seeds);
        invoke_signed(&ix, &accounts, seeds)?;
        Ok(())
    }
}

impl<'info> TokenTransfer for Context<'_, '_, '_, 'info, ManagerLiquidateUsdcMarket<'info>> {
    fn token_transfer(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self
                .accounts
                .vault_usdc_token_account
                .to_account_info()
                .clone(),
            to: self
                .accounts
                .manager_usdc_token_account
                .to_account_info()
                .clone(),
            authority: self.accounts.vault.to_account_info().clone(),
        };
        let token_program = self.accounts.token_program.to_account_info().clone();
        declare_vault_seeds!(self.accounts.vault, seeds);
        let cpi_context = CpiContext::new_with_signer(token_program, cpi_accounts, seeds);
        token::transfer(cpi_context, amount)?;
        Ok(())
    }
}
