use anchor_lang::prelude::*;

use crate::constraints::is_authority_for_investor;
use crate::instructions::MarketLookupTableParams;
use crate::math::Cast;
use crate::state::{Investor, MarketMapProvider, MarketRegistry, Vault, WithdrawUnit};

pub fn request_withdraw<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, RequestWithdraw<'info>>,
    withdraw_amount: u64,
    withdraw_unit: WithdrawUnit,
) -> Result<()> {
    let clock = &Clock::get()?;
    let vault_key = ctx.accounts.vault.key();
    let vault = &mut ctx.accounts.vault.load_mut()?;
    let mut investor = ctx.accounts.investor.load_mut()?;

    let registry = ctx.accounts.market_registry.load()?;
    let params = MarketLookupTableParams {
        usdc_mint: registry.usdc_mint,
        sol_mint: registry.sol_mint,
        sol_usdc_market_index: 0,
    };
    let vault_equity = ctx.equity(&vault_key, params)?;

    investor.request_withdraw(
        withdraw_amount.cast()?,
        withdraw_unit,
        vault_equity,
        vault,
        clock.unix_timestamp,
    )?;

    Ok(())
}

#[derive(Accounts)]
pub struct RequestWithdraw<'info> {
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
}
