use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, Token, TokenAccount, Transfer};
use phoenix::program::{load_with_dispatch, MarketHeader};
use phoenix::quantities::WrapperU64;
use phoenix::state::{OrderPacket, OrderPacketMetadata, SelfTradeBehavior, Side};
use sokoban::ZeroCopy;
use solana_program::program::invoke_signed;

use crate::constraints::*;
use crate::cpis::{PhoenixTradeCPI, PhoenixWithdrawCPI, TokenTransferCPI};
use crate::error::ErrorCode;
use crate::math::{
    quote_atoms_to_quote_lots_rounded_down, quote_lots_to_base_lots, quote_lots_to_quote_atoms,
    SafeMath,
};
use crate::state::{
    Investor, MarketMapProvider, MarketRegistry, MarketTransferParams, PhoenixProgram, Vault,
};
use crate::{declare_vault_seeds, validate};

/// Investor has authority to liquidate vault position in any market if they can't withdraw their equity.
/// This instruction liquidates up to the amount the investor has unfulfilled in its last withdraw request.
/// If the market is USDC denominated:
///     * if not enough quote USDC to fulfill withdraw request, swap base to USDC as needed
///     * withdraw quote USDC to `vault_usdc_token_account`
/// * transfer quote USDC to `investor_quote_token_account`
pub fn liquidate_usdc_market<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, LiquidateUsdcMarket<'info>>,
    market_index: u8,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let vault_key = ctx.accounts.vault.key();
    let mut vault = ctx.accounts.vault.load_mut()?;
    let mut investor = ctx.accounts.investor.load_mut()?;

    if let Err(e) = vault.check_liquidator(&investor, now) {
        vault.reset_liquidation_delegate();
        return Err(e.into());
    }

    let registry = ctx.accounts.market_registry.load()?;
    let lut_acct_info = ctx.accounts.lut.to_account_info();
    let lut_data = lut_acct_info.data.borrow();
    let lut = MarketRegistry::deserialize_lookup_table(registry.lut_auth, lut_data.as_ref())?;
    let vault_usdc_ata = &ctx.accounts.vault_usdc_token_account;

    if let Err(e) = ctx.check_cant_withdraw(&investor, vault_usdc_ata, &registry, &lut) {
        vault.reset_liquidation_delegate();
        return Err(e);
    }

    drop(vault);

    let lut_key_at_index = lut
        .addresses
        .get(market_index as usize)
        .map_or(Pubkey::default(), |key| *key);
    let account = ctx
        .remaining_accounts
        .get(market_index as usize)
        .ok_or(anchor_lang::error::Error::from(ErrorCode::SolMarketMissing))?;
    validate!(
        *account.key == lut_key_at_index,
        ErrorCode::MarketRegistryMismatch,
        &format!(
            "SOL/USDC MarketRegistryMismatch: {:?} != {:?}",
            account.key, lut_key_at_index
        )
    )?;
    // drop lut account data borrow in reverse order it was borrowed
    drop(lut);
    drop(lut_data);
    drop(lut_acct_info);

    let account_data = account.try_borrow_data()?;
    let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
    let header = Box::new(MarketHeader::load_bytes(header_bytes).ok_or(
        anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError),
    )?);
    let quote_mint = header.quote_params.mint_key;
    if quote_mint != registry.usdc_mint {
        return Err(ErrorCode::UnrecognizedQuoteMint.into());
    }
    let market = load_with_dispatch(&header.market_size_params, bytes)?;
    let tick_price = market
        .inner
        .get_ladder(1)
        .asks
        .first()
        .map_or(0, |ask| ask.price_in_ticks);

    let trader_state =
        market
            .inner
            .get_trader_state(&vault_key)
            .ok_or(anchor_lang::error::Error::from(
                ErrorCode::TraderStateNotFound,
            ))?;

    let vault_bl = trader_state.base_lots_free.as_u64();
    let vault_ql = trader_state.quote_lots_free.as_u64();
    let withdraw_ql =
        quote_atoms_to_quote_lots_rounded_down(&header, investor.last_withdraw_request.value);

    let quote_atoms_to_withdraw = if withdraw_ql > vault_ql {
        // sell base lots to quote lots
        let ql_to_sell = withdraw_ql - vault_ql;
        let bl_to_sell = quote_lots_to_base_lots(&header, ql_to_sell, tick_price).min(vault_bl);
        let ql_to_withdraw = vault_ql + ql_to_sell;
        let quote_atoms = quote_lots_to_quote_atoms(&header, ql_to_withdraw);
        drop(header);
        drop(account_data);
        let params = LiquidateUsdcMarket::build_swap_params(bl_to_sell)?;
        ctx.phoenix_trade(params)?;

        // withdraw existing quote_lots plus liquidated quote lots from market to vault
        // todo: account for taker fee
        ctx.phoenix_withdraw(MarketTransferParams {
            base_lots: 0,
            quote_lots: ql_to_withdraw,
        })?;
        msg!(
            "liquidated USDC quote atoms to fulfill withdraw request: {}",
            quote_atoms
        );
        quote_atoms
    } else {
        let quote_atoms = quote_lots_to_quote_atoms(&header, withdraw_ql);
        drop(header);
        drop(account_data);
        // withdraw available quote lots from market to vault
        ctx.phoenix_withdraw(MarketTransferParams {
            base_lots: 0,
            quote_lots: withdraw_ql,
        })?;
        msg!(
            "sufficient USDC quote atoms to fulfill withdraw request: {}",
            quote_atoms
        );
        quote_atoms
    };

    // withdraw quote lots from vault to investor
    ctx.token_transfer(quote_atoms_to_withdraw)?;
    investor
        .last_withdraw_request
        .reduce_by_value(quote_atoms_to_withdraw)?;

    Ok(())
}

#[derive(Accounts)]
pub struct LiquidateUsdcMarket<'info> {
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
        bump,
        constraint = is_lut_for_registry(&market_registry, &lut)?
    )]
    pub market_registry: AccountLoader<'info, MarketRegistry>,
    /// CHECK: Deserialized into [`AddressLookupTable`] within instruction
    pub lut: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = is_usdc_mint(&vault, &investor_usdc_token_account.mint)?,
        token::mint = usdc_mint,
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

impl<'info> LiquidateUsdcMarket<'info> {
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

impl<'info> PhoenixWithdrawCPI for Context<'_, '_, '_, 'info, LiquidateUsdcMarket<'info>> {
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

impl<'info> PhoenixTradeCPI for Context<'_, '_, '_, 'info, LiquidateUsdcMarket<'info>> {
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

impl<'info> TokenTransferCPI for Context<'_, '_, '_, 'info, LiquidateUsdcMarket<'info>> {
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
