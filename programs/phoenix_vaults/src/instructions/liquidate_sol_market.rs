use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use phoenix::program::deposit::DepositParams;
use phoenix::program::{load_with_dispatch, MarketHeader};
use phoenix::quantities::WrapperU64;
use phoenix::state::{OrderPacket, OrderPacketMetadata, SelfTradeBehavior, Side};
use sokoban::ZeroCopy;
use solana_program::program::invoke_signed;

use crate::constraints::*;
use crate::cpis::*;
use crate::error::ErrorCode;
use crate::math::{
    base_atoms_to_base_lots_rounded_down, base_lots_to_quote_lots,
    quote_atoms_to_quote_lots_rounded_down, quote_lots_to_base_lots, quote_lots_to_quote_atoms,
};
use crate::state::{
    Investor, MarketMap, MarketMapProvider, MarketRegistry, MarketTransferParams, PhoenixProgram,
    Vault,
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
pub fn liquidate_sol_market<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, LiquidateSolMarket<'info>>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let mut vault = ctx.accounts.vault.load_mut()?;
    let mut investor = ctx.accounts.investor.load_mut()?;

    if let Err(e) = vault.check_liquidator(&investor, now) {
        vault.reset_liquidation_delegate();
        return Err(e.into());
    }

    let registry = ctx.accounts.market_registry.load()?;
    let vault_usdc_ata = &ctx.accounts.vault_usdc_token_account;

    if let Err(e) = ctx.check_cant_withdraw(&investor, vault_usdc_ata, &registry) {
        vault.reset_liquidation_delegate();
        return Err(e);
    }

    let vault_key = ctx.accounts.vault.key();

    let account = MarketMap::find(
        &registry.sol_usdc_market,
        &mut ctx.remaining_accounts.iter().peekable(),
    )?;
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

    let (_, sol_usdc_tick_price, sol_usdc_header) = ctx.load_sol_usdc_market(&registry)?;

    if let Some(trader_state) = market.inner.get_trader_state(&vault_key) {
        let quote_mint = header.quote_params.mint_key;
        if quote_mint == registry.sol_mint {
            return Err(ErrorCode::UnrecognizedQuoteMint.into());
        }

        let base_lots = trader_state.base_lots_free.as_u64();
        let sol_lots = trader_state.quote_lots_free.as_u64();

        let withdraw_usdc_lots =
            quote_atoms_to_quote_lots_rounded_down(&header, investor.last_withdraw_request.value);
        let withdraw_sol_lots =
            quote_lots_to_base_lots(&sol_usdc_header, withdraw_usdc_lots, sol_usdc_tick_price);

        let sol_quote_lots_to_withdraw = if sol_lots >= withdraw_sol_lots {
            // withdraw from market to `vault_sol_token_account`
            ctx.phoenix_withdraw(MarketTransferParams {
                base_lots: 0,
                quote_lots: withdraw_sol_lots,
            })?;
            withdraw_sol_lots
        } else {
            // sell base lots into sol/quote lots
            let ql_to_sell = withdraw_sol_lots - sol_lots;
            let bl_to_sell =
                quote_lots_to_base_lots(&header, ql_to_sell, tick_price).min(base_lots);
            let params = LiquidateSolMarket::build_swap_params(bl_to_sell)?;
            ctx.phoenix_trade(params)?;

            // withdraw liquidated base_lots and existing sol_lots to `vault_sol_token_account`
            // todo: account for taker fee
            let ql_to_withdraw = sol_lots + ql_to_sell;
            ctx.phoenix_withdraw(MarketTransferParams {
                base_lots: 0,
                quote_lots: ql_to_withdraw,
            })?;
            ql_to_withdraw
        };

        //  * deposit sol_quote_atoms from `vault_sol_token_account` to SOL/USDC market
        //  * swap SOL into USDC
        //  * withdraw quote USDC to `vault_usdc_token_account`
        //  * transfer quote USDC to `investor_usdc_token_account`

        // deposit sol_quote_atoms from `vault_sol_token_account` to SOL/USDC market
        ctx.phoenix_deposit_sol_usdc_market(MarketTransferParams {
            quote_lots: 0,
            // sol is quote on withdrawing market, but base on depositing market (SOL/USDC market)
            base_lots: sol_quote_lots_to_withdraw,
        })?;
        // swap SOL into USDC
        let sol_atoms = quote_lots_to_quote_atoms(&header, sol_quote_lots_to_withdraw);
        let sol_base_lots_on_sol_usdc_market =
            base_atoms_to_base_lots_rounded_down(&sol_usdc_header, sol_atoms);
        let usdc_lots = base_lots_to_quote_lots(
            &sol_usdc_header,
            sol_base_lots_on_sol_usdc_market,
            sol_usdc_tick_price,
        );
        let params = LiquidateSolMarket::build_swap_params(sol_base_lots_on_sol_usdc_market)?;
        ctx.phoenix_trade(params)?;

        // withdraw quote USDC to `vault_usdc_token_account`
        // todo: factor taker fee after SOL/USDC swap
        ctx.phoenix_withdraw(MarketTransferParams {
            base_lots: 0,
            quote_lots: usdc_lots,
        })?;
        let usdc_atoms = quote_lots_to_quote_atoms(&sol_usdc_header, usdc_lots);

        // transfer quote USDC to `investor_usdc_token_account`
        ctx.token_transfer(usdc_atoms)?;
        investor.last_withdraw_request.reduce_by_value(usdc_atoms)?;
    }

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
pub struct LiquidateSolMarket<'info> {
    #[account(
        mut,
        constraint = is_liquidator_for_vault(&vault, &authority)?
    )]
    pub vault: AccountLoader<'info, Vault>,

    #[account(
        mut,
        seeds = [b"investor", vault.key().as_ref(), authority.key().as_ref()],
        bump,
        constraint = is_authority_for_investor(&investor, &authority)?,
        constraint = is_vault_for_investor(&investor, &vault)?
    )]
    pub investor: AccountLoader<'info, Investor>,
    pub authority: Signer<'info>,

    #[account(
        seeds = [b"market_registry"],
        bump
    )]
    pub market_registry: AccountLoader<'info, MarketRegistry>,

    #[account(
        mut,
        constraint = is_usdc_mint(&vault, &investor_usdc_token_account.mint)?,
        token::authority = authority,
    )]
    pub investor_usdc_token_account: Account<'info, TokenAccount>,

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

impl<'info> LiquidateSolMarket<'info> {
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

impl<'info> PhoenixWithdrawCPI for Context<'_, '_, '_, 'info, LiquidateSolMarket<'info>> {
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
    for Context<'_, '_, '_, 'info, LiquidateSolMarket<'info>>
{
    fn phoenix_withdraw_sol_usdc_market(&self, params: MarketTransferParams) -> Result<()> {
        let trader_index = 3;
        let mut ix = phoenix::program::instruction_builders::create_withdraw_funds_with_custom_amounts_instruction(
            &self.accounts.market.key(),
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
            self.accounts.market.to_account_info(),
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

impl<'info> PhoenixTradeCPI for Context<'_, '_, '_, 'info, LiquidateSolMarket<'info>> {
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
    for Context<'_, '_, '_, 'info, LiquidateSolMarket<'info>>
{
    fn phoenix_deposit_sol_usdc_market(&self, params: MarketTransferParams) -> Result<()> {
        let trader_index = 3;
        let mut ix = phoenix::program::instruction_builders::create_deposit_funds_instruction(
            &self.accounts.market.key(),
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
            self.accounts.market.to_account_info(),
            self.accounts.vault.to_account_info(),
            self.accounts.seat.to_account_info(),
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

impl<'info> TokenTransferCPI for Context<'_, '_, '_, 'info, LiquidateSolMarket<'info>> {
    fn token_transfer(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self
                .accounts
                .vault_usdc_token_account
                .to_account_info()
                .clone(),
            to: self
                .accounts
                .investor_usdc_token_account
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
