use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::constraints::*;
use crate::math::Cast;
use crate::state::{MarketMapProvider, MarketRegistry, Vault, WithdrawUnit};

pub fn manager_request_withdraw<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, ManagerRequestWithdraw<'info>>,
    withdraw_amount: u64,
    withdraw_unit: WithdrawUnit,
) -> Result<()> {
    let clock = &Clock::get()?;
    let vault = &mut ctx.accounts.vault.load_mut()?;

    let registry = ctx.accounts.market_registry.load()?;

    let vault_usdc = &ctx.accounts.vault_usdc_token_account;
    let vault_equity = ctx.equity(vault, vault_usdc, &registry)?;

    vault.manager_request_withdraw(
        withdraw_amount.cast()?,
        withdraw_unit,
        vault_equity,
        clock.unix_timestamp,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct ManagerRequestWithdraw<'info> {
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
        constraint = is_usdc_token_for_vault(&vault, &vault_usdc_token_account)?,
    )]
    pub vault_usdc_token_account: Account<'info, TokenAccount>,
}
