use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use phoenix::program::deposit::DepositParams;
use solana_program::program::invoke_signed;

use crate::constraints::*;
use crate::cpis::{PhoenixDepositCPI, TokenTransferCPI};
use crate::declare_vault_seeds;
use crate::error::ErrorCode;
use crate::state::{
    Investor, MarketMapProvider, MarketRegistry, MarketTransferParams, PhoenixProgram, Vault,
};
// use crate::math::quote_atoms_to_quote_lots_rounded_down;

pub fn investor_deposit<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InvestorDeposit<'info>>,
    amount: u64,
) -> Result<()> {
    let clock = &Clock::get()?;

    let mut vault = ctx.accounts.vault.load_mut()?;
    let mut investor = ctx.accounts.investor.load_mut()?;

    let registry = ctx.accounts.market_registry.load()?;

    let vault_usdc = &ctx.accounts.vault_quote_token_account;
    let vault_equity = ctx.equity(&vault, vault_usdc, &registry)?;

    investor.deposit(amount, vault_equity, &mut vault, clock.unix_timestamp)?;

    drop(vault);

    ctx.token_transfer(amount)?;

    Ok(())
}

/// Investor deposits USDC into vault.
/// The funds will add to the vault's SOL/USDC market position on Phoenix.
/// The token transfers to the vault token accounts as an intermediate step since
/// the market position can only be deposited by the trader's associated token accounts.
/// The investor can't deposit directly to the vault's market position since the token accounts
/// are associated with the investor.
#[derive(Accounts)]
pub struct InvestorDeposit<'info> {
    #[account(mut)]
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
        constraint = is_usdc_mint(&vault, &investor_quote_token_account.mint)?,
        token::authority = authority,
    )]
    pub investor_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = is_usdc_token_for_vault(&vault, &vault_quote_token_account)?
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> TokenTransferCPI for Context<'_, '_, '_, 'info, InvestorDeposit<'info>> {
    fn token_transfer(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self
                .accounts
                .investor_quote_token_account
                .to_account_info()
                .clone(),
            to: self
                .accounts
                .vault_quote_token_account
                .to_account_info()
                .clone(),
            authority: self.accounts.authority.to_account_info().clone(),
        };
        let token_program = self.accounts.token_program.to_account_info().clone();
        let cpi_context = CpiContext::new(token_program, cpi_accounts);
        token::transfer(cpi_context, amount)?;
        Ok(())
    }
}
