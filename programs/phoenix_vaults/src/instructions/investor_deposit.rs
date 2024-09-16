use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constraints::{
    is_authority_for_investor, is_lut_for_registry, is_sol_mint, is_sol_token_for_vault,
    is_usdc_mint, is_usdc_token_for_vault, is_vault_for_investor,
};
use crate::cpis::TokenTransferCPI;
use crate::state::{Investor, MarketLookupTable, MarketMapProvider, MarketRegistry, Vault};

pub fn investor_deposit<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InvestorDeposit<'info>>,
    amount: u64,
) -> Result<()> {
    let clock = &Clock::get()?;

    let vault_key = ctx.accounts.vault.key();
    let mut vault = ctx.accounts.vault.load_mut()?;
    let mut investor = ctx.accounts.investor.load_mut()?;

    let registry = ctx.accounts.market_registry.load_mut()?;

    let lut_acct_info = ctx.accounts.lut.to_account_info();
    let lut_data = lut_acct_info.data.borrow();
    let lut = MarketRegistry::deserialize_lookup_table(registry.lut_auth, lut_data.as_ref())?;
    let market_lut = MarketLookupTable {
        lut_key: ctx.accounts.lut.key(),
        lut: &lut,
    };
    let vault_equity = ctx.equity(&vault_key, registry, market_lut)?;

    investor.deposit(amount, vault_equity, &mut vault, clock.unix_timestamp)?;

    drop(vault);

    ctx.token_transfer(amount)?;

    Ok(())
}

/// Investor may deposit USDC or SOL into vault.
/// The funds will add to the vault's SOL/USDC market position on Phoenix.
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
        mut,
        seeds = [b"market_registry"],
        bump,
        constraint = is_lut_for_registry(&market_registry, &lut)?
    )]
    pub market_registry: AccountLoader<'info, MarketRegistry>,

    /// CHECK: Deserialized into [`AddressLookupTable`] within instruction
    pub lut: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = is_usdc_token_for_vault(&vault, &vault_token_account)? || is_sol_token_for_vault(&vault, &vault_token_account)?,
        token::mint = investor_token_account.mint,
    )]
    pub vault_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = is_usdc_mint(&vault, &investor_token_account.mint)? || is_sol_mint(&vault, &investor_token_account.mint)?,
        token::authority = authority,
    )]
    pub investor_token_account: Box<Account<'info, TokenAccount>>,

    //
    // Programs needed for token transfer
    //
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

impl<'info> TokenTransferCPI for Context<'_, '_, '_, 'info, InvestorDeposit<'info>> {
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
