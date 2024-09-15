use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constraints::{is_authority_for_investor, is_token_for_vault};
use crate::cpis::TokenTransferCPI;
use crate::instructions::MarketLookupTableParams;
use crate::state::{Investor, MarketMapProvider, MarketRegistry, Vault};

pub fn deposit<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, Deposit<'info>>,
    amount: u64,
) -> Result<()> {
    let clock = &Clock::get()?;

    let vault_key = ctx.accounts.vault.key();
    let mut vault = ctx.accounts.vault.load_mut()?;
    let mut investor = ctx.accounts.investor.load_mut()?;

    let registry = ctx.accounts.market_registry.load()?;
    let params = MarketLookupTableParams {
        usdc_mint: registry.usdc_mint,
        sol_mint: registry.sol_mint,
        sol_usdc_market_index: 0,
    };
    let vault_equity = ctx.equity(&vault_key, params)?;

    investor.deposit(amount, vault_equity, &mut vault, clock.unix_timestamp)?;

    drop(vault);

    ctx.token_transfer(amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,

    #[account(
        mut,
        seeds = [b"investor", vault.key().as_ref(), authority.key().as_ref()],
        bump,
        constraint = is_authority_for_investor(&investor, &authority)?
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
        constraint = is_token_for_vault(&vault, &vault_token_account)?,
    )]
    pub vault_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::authority = authority,
        token::mint = vault_token_account.mint,
    )]
    pub investor_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

impl<'info> TokenTransferCPI for Context<'_, '_, '_, 'info, Deposit<'info>> {
    fn token_transfer(&self, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: self
                .accounts
                .investor_token_account
                .to_account_info()
                .clone(),
            to: self.accounts.vault_token_account.to_account_info().clone(),
            authority: self.accounts.authority.to_account_info().clone(),
        };
        let token_program = self.accounts.token_program.to_account_info().clone();
        let cpi_context = CpiContext::new(token_program, cpi_accounts);
        token::transfer(cpi_context, amount)?;
        Ok(())
    }
}
