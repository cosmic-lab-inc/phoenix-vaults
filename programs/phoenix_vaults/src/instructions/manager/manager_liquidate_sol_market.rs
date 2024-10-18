use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use phoenix::program::deposit::DepositParams;
use phoenix::program::{load_with_dispatch, MarketHeader};
use phoenix::quantities::WrapperU64;
use phoenix::state::{OrderPacket, OrderPacketMetadata, SelfTradeBehavior, Side};
use sokoban::ZeroCopy;
use solana_program::program::invoke_signed;

use crate::constants::PERCENTAGE_PRECISION;
use crate::constraints::*;
use crate::cpis::*;
use crate::error::ErrorCode;
use crate::math::*;
use crate::state::{
    MarketMap, MarketMapProvider, MarketRegistry, MarketTransferParams, PhoenixProgram, Vault,
};
use crate::{declare_vault_seeds, validate};

/// Investor has authority to liquidate vault position in any market if they can't withdraw their equity.
/// This instruction liquidates up to the amount the investor has unfulfilled in its last withdraw request.
/// If the market is SOL denominated:
///     * if not enough quote SOL to fulfill withdraw request, swap base to SOL as needed
///     * withdraw quote SOL to `vault_sol_token_account`
/// * deposit to the SOL/USDC market
///     * swap SOL into USDC
///     * withdraw quote USDC `vault_quote_token_account`
/// * transfer quote USDC to `investor_quote_token_account`
pub fn manager_liquidate_sol_market<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, ManagerLiquidateSolMarket<'info>>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

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
    msg!("vault_equity: {}", vault_equity);
    let amount = shares_to_amount(
        vault.last_manager_withdraw_request.shares,
        vault.total_shares,
        vault_equity,
    )?;
    let withdraw_request_amount = amount.min(vault.last_manager_withdraw_request.value);
    msg!("withdraw_request_amount: {}", withdraw_request_amount);

    drop(vault);

    let vault_key = ctx.accounts.vault.key();
    let market_key = ctx.accounts.market.key();

    let sol_usdc_market_account = MarketMap::find(
        &registry.sol_usdc_market,
        &mut ctx.remaining_accounts.iter().peekable(),
    )?;
    msg!(
        "found SOL/USDC market {:?} in rem accts",
        &registry.sol_usdc_market
    );

    //
    // XXX/SOL market
    //
    let account = MarketMap::find(&market_key, &mut ctx.remaining_accounts.iter().peekable())?;
    msg!("found XXX/SOL market {:?} in rem accts", &market_key);
    let account_data = account.try_borrow_data()?;
    let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
    let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
        anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
    )?);
    let market_wrapper = load_with_dispatch(&header.market_size_params, bytes)?;
    let tick_price = market_wrapper
        .inner
        .get_ladder(1)
        .bids
        .first()
        .map_or(0, |bid| bid.price_in_ticks);
    // let quote_atoms_per_quote_lot = header.get_quote_lot_size().as_u64();

    //
    // SOL/USDC market
    //
    // let sol_usdc_market_account = MarketMap::find(&registry.sol_usdc_market, &mut ctx.remaining_accounts.iter().peekable())?;
    // msg!(
    //     "found SOL/USDC market {:?} in rem accts",
    //     &registry.sol_usdc_market
    // );
    let sol_usdc_market_account_data = sol_usdc_market_account.try_borrow_data()?;
    let (sol_usdc_header_bytes, sol_usdc_bytes) =
        sol_usdc_market_account_data.split_at(std::mem::size_of::<MarketHeader>());
    let sol_usdc_header = Box::new(
        MarketHeader::load_bytes(sol_usdc_header_bytes)
            .ok_or(anchor_lang::error::Error::from(
                ErrorCode::MarketDeserializationError,
            ))?
            .to_owned(),
    );
    if sol_usdc_header.quote_params.mint_key != registry.usdc_mint
        || sol_usdc_header.base_params.mint_key != registry.sol_mint
    {
        return Err(ErrorCode::SolMarketMissing.into());
    }
    let sol_usdc_market_wrapper =
        load_with_dispatch(&sol_usdc_header.market_size_params, sol_usdc_bytes)?;
    let sol_usdc_ladder = sol_usdc_market_wrapper.inner.get_ladder(1);
    let sol_usdc_tick_price = sol_usdc_ladder
        .bids
        .first()
        .map_or(0, |bid| bid.price_in_ticks);
    let sol_usdc_fee_bps = sol_usdc_market_wrapper
        .inner
        .get_taker_fee_bps()
        .safe_mul(100)?;

    let trader_state = market_wrapper.inner.get_trader_state(&vault_key).ok_or(
        anchor_lang::error::Error::from(ErrorCode::TraderStateNotFound),
    )?;

    let quote_mint = header.quote_params.mint_key;
    validate!(
        quote_mint == registry.sol_mint,
        ErrorCode::UnrecognizedQuoteMint,
        &format!(
            "Unrecognized quote mint {:?} != {:?}",
            quote_mint, registry.sol_mint
        )
    )?;

    let base_lots_available = trader_state.base_lots_free.as_u64();
    let sol_lots_available = trader_state.quote_lots_free.as_u64();

    // factor in fee to swap liquidated SOL into USDC
    let withdraw_request_fee = withdraw_request_amount
        .cast::<u128>()?
        .safe_mul(sol_usdc_fee_bps.cast()?)?
        .safe_div(PERCENTAGE_PRECISION)?
        .cast::<u64>()?;
    // add fee to withdraw request amount to be able to withdraw the requested amount after swapping
    let withdraw_request_amount = withdraw_request_amount.safe_add(withdraw_request_fee)?;
    msg!(
        "withdraw_request_amount_with_fee: {}",
        withdraw_request_amount
    );
    // convert withdraw request from USDC to SOL using SOL/USDC market terms
    let sol_lots_in_sol_usdc_market_terms_to_withdraw = quote_atoms_and_price_to_base_lots(
        &sol_usdc_header,
        withdraw_request_amount,
        sol_usdc_tick_price,
    );
    let sol_atoms = base_lots_to_base_atoms(
        &sol_usdc_header,
        sol_lots_in_sol_usdc_market_terms_to_withdraw,
    );
    msg!("sol atoms to withdraw: {}", sol_atoms);
    // convert the SOL from SOL/USDC market terms to XXX/SOL market terms
    let sol_lots_in_sol_market_terms_to_withdraw =
        quote_atoms_to_quote_lots_rounded_up(&header, sol_atoms);

    let sol_atoms_to_withdraw = if sol_lots_in_sol_market_terms_to_withdraw > sol_lots_available {
        // sell XXX base lots into SOL quote lots
        let ql_to_sell = sol_lots_in_sol_market_terms_to_withdraw - sol_lots_available;

        let fee_bps = market_wrapper.inner.get_taker_fee_bps().safe_mul(100)?;
        let ql_fee = ql_to_sell
            .cast::<u128>()?
            .safe_mul(fee_bps.cast()?)?
            .safe_div(PERCENTAGE_PRECISION)?
            .cast::<u64>()?;
        let ql_to_sell = ql_to_sell.safe_add(ql_fee)?;

        msg!(
            "liquidating {} SOL atoms",
            quote_lots_to_quote_atoms(&header, ql_to_sell)
        );

        let bl_to_sell =
            quote_lots_to_base_lots(&header, ql_to_sell, tick_price).min(base_lots_available);
        let params = ManagerLiquidateSolMarket::build_swap_params(bl_to_sell)?;

        let ql_to_withdraw = sol_lots_available + ql_to_sell;
        let sol_atoms_to_withdraw = quote_lots_to_quote_atoms(&header, ql_to_withdraw);
        msg!("withdrawing {} SOL atoms", sol_atoms_to_withdraw);

        drop(header);
        drop(account_data);
        ctx.phoenix_trade(params)?;

        // withdraw liquidated base_lots and existing sol_lots to `vault_sol_token_account`
        ctx.phoenix_withdraw(MarketTransferParams {
            base_lots: 0,
            quote_lots: ql_to_withdraw,
        })?;
        sol_atoms_to_withdraw
    } else {
        let sol_atoms_to_withdraw =
            quote_lots_to_quote_atoms(&header, sol_lots_in_sol_market_terms_to_withdraw);
        msg!(
            "liquidation not required, withdrawing {} SOL atoms",
            sol_atoms_to_withdraw
        );

        drop(header);
        drop(account_data);
        // withdraw from market to `vault_sol_token_account`
        ctx.phoenix_withdraw(MarketTransferParams {
            base_lots: 0,
            quote_lots: sol_lots_in_sol_market_terms_to_withdraw,
        })?;
        sol_atoms_to_withdraw
    };

    // convert liquidated SOL to SOL/USDC market terms
    let sol_base_lots_on_sol_usdc_market_to_withdraw =
        base_atoms_to_base_lots_rounded_down(&sol_usdc_header, sol_atoms_to_withdraw);
    msg!(
        "sol_base_lots_on_sol_usdc_market_to_withdraw: {}",
        sol_base_lots_on_sol_usdc_market_to_withdraw
    );
    let usdc_lots_on_sol_usdc_market_to_withdraw = base_lots_to_quote_lots(
        &sol_usdc_header,
        sol_base_lots_on_sol_usdc_market_to_withdraw,
        sol_usdc_tick_price,
    );
    msg!(
        "usdc_lots_on_sol_usdc_market_to_withdraw: {}",
        usdc_lots_on_sol_usdc_market_to_withdraw
    );

    drop(sol_usdc_header);
    drop(sol_usdc_market_account_data);

    // deposit SOL from `vault_sol_token_account` to SOL/USDC market
    ctx.phoenix_deposit_sol_usdc_market(MarketTransferParams {
        quote_lots: 0,
        // sol is quote on withdrawing market (XXX/SOL), but base on depositing market (SOL/USDC)
        base_lots: sol_base_lots_on_sol_usdc_market_to_withdraw,
    })?;

    // sell SOL into USDC
    let params =
        ManagerLiquidateSolMarket::build_swap_params(sol_base_lots_on_sol_usdc_market_to_withdraw)?;
    ctx.phoenix_trade_sol_usdc_market(params)?;

    // withdraw quote USDC to `vault_usdc_token_account`
    ctx.phoenix_withdraw_sol_usdc_market(MarketTransferParams {
        base_lots: 0,
        quote_lots: usdc_lots_on_sol_usdc_market_to_withdraw,
    })?;

    let mut vault = ctx.accounts.vault.load_mut()?;
    let pos = ctx.market_position(&vault, ctx.accounts.market.key())?;
    vault.force_update_market_position(pos)?;

    let sol_usdc_pos = ctx.market_position(&vault, registry.sol_usdc_market)?;
    vault.force_update_market_position(sol_usdc_pos)?;

    drop(vault);

    Ok(())
}

#[derive(Accounts)]
pub struct ManagerLiquidateSolMarket<'info> {
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
        constraint = is_sol_mint(&vault, &sol_mint.key())?,
    )]
    pub sol_mint: Account<'info, Mint>,
    #[account(
        constraint = is_usdc_mint(&vault, &usdc_mint.key())?,
    )]
    pub usdc_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = base_mint
    )]
    pub vault_base_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = is_sol_token_for_vault(&vault, &vault_sol_token_account)?,
        token::mint = sol_mint
    )]
    pub vault_sol_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = is_usdc_token_for_vault(&vault, &vault_usdc_token_account)?,
    )]
    pub vault_usdc_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = base_mint
    )]
    pub market_base_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = is_sol_mint(&vault, &market_sol_token_account.mint)?,
        token::mint = sol_mint
    )]
    pub market_sol_token_account: Account<'info, TokenAccount>,

    /// CHECK: validated in Phoenix CPI
    #[account(mut)]
    pub sol_usdc_market: UncheckedAccount<'info>,
    /// CHECK: validated in Phoenix CPI
    pub sol_usdc_market_seat: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = is_sol_mint(&vault, &sol_usdc_market_sol_token_account.mint)?,
        token::mint = sol_mint
    )]
    pub sol_usdc_market_sol_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = is_usdc_mint(&vault, &sol_usdc_market_usdc_token_account.mint)?,
        token::mint = usdc_mint
    )]
    pub sol_usdc_market_usdc_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> ManagerLiquidateSolMarket<'info> {
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

impl<'info> PhoenixWithdrawCPI for Context<'_, '_, '_, 'info, ManagerLiquidateSolMarket<'info>> {
    fn phoenix_withdraw(&self, params: MarketTransferParams) -> Result<()> {
        let trader_index = 3;
        let mut ix = phoenix::program::instruction_builders::create_withdraw_funds_with_custom_amounts_instruction(
            &self.accounts.market.key(),
            &self.accounts.vault.key(),
            &self.accounts.base_mint.key(),
            &self.accounts.sol_mint.key(),
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
            self.accounts.vault_sol_token_account.to_account_info(),
            self.accounts.market_base_token_account.to_account_info(),
            self.accounts.market_sol_token_account.to_account_info(),
            self.accounts.token_program.to_account_info(),
        ];
        declare_vault_seeds!(self.accounts.vault, seeds);
        invoke_signed(&ix, &accounts, seeds)?;

        Ok(())
    }
}

impl<'info> PhoenixWithdrawSolUsdcMarketCPI
    for Context<'_, '_, '_, 'info, ManagerLiquidateSolMarket<'info>>
{
    fn phoenix_withdraw_sol_usdc_market(&self, params: MarketTransferParams) -> Result<()> {
        let trader_index = 3;
        let mut ix = phoenix::program::instruction_builders::create_withdraw_funds_with_custom_amounts_instruction(
            &self.accounts.sol_usdc_market.key(),
            &self.accounts.vault.key(),
            &self.accounts.sol_mint.key(),
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
            self.accounts.sol_usdc_market.to_account_info(),
            self.accounts.vault.to_account_info(),
            self.accounts.vault_sol_token_account.to_account_info(),
            self.accounts.vault_usdc_token_account.to_account_info(),
            self.accounts
                .sol_usdc_market_sol_token_account
                .to_account_info(),
            self.accounts
                .sol_usdc_market_usdc_token_account
                .to_account_info(),
            self.accounts.token_program.to_account_info(),
        ];
        declare_vault_seeds!(self.accounts.vault, seeds);
        invoke_signed(&ix, &accounts, seeds)?;

        Ok(())
    }
}

impl<'info> PhoenixTradeSolUsdcMarketCPI
    for Context<'_, '_, '_, 'info, ManagerLiquidateSolMarket<'info>>
{
    fn phoenix_trade_sol_usdc_market(&self, order: OrderPacket) -> Result<()> {
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
                &self.accounts.sol_usdc_market.key(),
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
            self.accounts.sol_usdc_market.to_account_info(),
            self.accounts.vault.to_account_info(),
            self.accounts.sol_usdc_market_seat.to_account_info(),
            self.accounts.vault_sol_token_account.to_account_info(),
            self.accounts.vault_usdc_token_account.to_account_info(),
            self.accounts
                .sol_usdc_market_sol_token_account
                .to_account_info(),
            self.accounts
                .sol_usdc_market_usdc_token_account
                .to_account_info(),
            self.accounts.token_program.to_account_info(),
        ];
        declare_vault_seeds!(self.accounts.vault, seeds);
        invoke_signed(&ix, &accounts, seeds)?;
        Ok(())
    }
}

impl<'info> PhoenixTradeCPI for Context<'_, '_, '_, 'info, ManagerLiquidateSolMarket<'info>> {
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
            self.accounts.vault_sol_token_account.to_account_info(),
            self.accounts.market_base_token_account.to_account_info(),
            self.accounts.market_sol_token_account.to_account_info(),
            self.accounts.token_program.to_account_info(),
        ];
        declare_vault_seeds!(self.accounts.vault, seeds);
        invoke_signed(&ix, &accounts, seeds)?;
        Ok(())
    }
}

impl<'info> PhoenixDepositSolUsdcMarketCPI
    for Context<'_, '_, '_, 'info, ManagerLiquidateSolMarket<'info>>
{
    fn phoenix_deposit_sol_usdc_market(&self, params: MarketTransferParams) -> Result<()> {
        let trader_index = 3;
        let mut ix = phoenix::program::instruction_builders::create_deposit_funds_instruction(
            &self.accounts.sol_usdc_market.key(),
            &self.accounts.vault.key(),
            &self.accounts.sol_mint.key(),
            &self.accounts.usdc_mint.key(),
            &DepositParams {
                quote_lots_to_deposit: params.quote_lots,
                base_lots_to_deposit: params.base_lots,
            },
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
            self.accounts.sol_usdc_market.to_account_info(),
            self.accounts.vault.to_account_info(),
            self.accounts.sol_usdc_market_seat.to_account_info(),
            self.accounts.vault_sol_token_account.to_account_info(),
            self.accounts.vault_usdc_token_account.to_account_info(),
            self.accounts
                .sol_usdc_market_sol_token_account
                .to_account_info(),
            self.accounts
                .sol_usdc_market_usdc_token_account
                .to_account_info(),
            self.accounts.token_program.to_account_info(),
        ];
        declare_vault_seeds!(self.accounts.vault, seeds);
        invoke_signed(&ix, &accounts, seeds)?;

        Ok(())
    }
}

impl<'info> TokenTransferCPI for Context<'_, '_, '_, 'info, ManagerLiquidateSolMarket<'info>> {
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
