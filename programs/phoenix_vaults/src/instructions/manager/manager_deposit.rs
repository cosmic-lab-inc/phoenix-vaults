use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constraints::*;
use crate::cpis::TokenTransferCPI;

use crate::state::{MarketMapProvider, MarketRegistry, Vault};

pub fn manager_deposit<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, ManagerDeposit<'info>>,
    amount: u64,
) -> Result<()> {
    let clock = &Clock::get()?;

    let mut vault = ctx.accounts.vault.load_mut()?;

    let registry = ctx.accounts.market_registry.load()?;

    let vault_usdc = &ctx.accounts.vault_quote_token_account;
    let vault_equity = ctx.equity(&vault, vault_usdc, &registry)?;

    vault.manager_deposit(amount, vault_equity, clock.unix_timestamp)?;

    drop(vault);

    ctx.token_transfer(amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct ManagerDeposit<'info> {
    #[account(
        mut,
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
        constraint = is_usdc_mint(&vault, &manager_quote_token_account.mint)?,
        token::authority = manager,
    )]
    pub manager_quote_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = is_usdc_token_for_vault(&vault, &vault_quote_token_account)?
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> TokenTransferCPI for Context<'_, '_, '_, 'info, ManagerDeposit<'info>> {
    fn token_transfer(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self
                .accounts
                .manager_quote_token_account
                .to_account_info()
                .clone(),
            to: self
                .accounts
                .vault_quote_token_account
                .to_account_info()
                .clone(),
            authority: self.accounts.manager.to_account_info().clone(),
        };
        let token_program = self.accounts.token_program.to_account_info().clone();
        let cpi_context = CpiContext::new(token_program, cpi_accounts);
        token::transfer(cpi_context, amount)?;
        Ok(())
    }
}
