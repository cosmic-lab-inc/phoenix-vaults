use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::constraints::{
    is_authority_for_investor, is_usdc_token_for_vault, is_vault_for_investor,
};
use crate::state::{Investor, MarketMapProvider, MarketRegistry, Vault};

/// If the investor can't withdraw their equity from the vault's USDC token account,
/// then the investor is granted authority to sign for liquidation of the vault position on Phoenix markets.
/// The investor can liquidate assets into USDC by calling `liquidate_usdc_market` or `liquidate_sol_market`,
/// depending on whether the Phoenix market is denominated in USDC or SOL.
pub fn appoint_investor_liquidator<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, AppointInvestorLiquidator<'info>>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let mut vault = ctx.accounts.vault.load_mut()?;
    let investor = ctx.accounts.investor.load()?;
    let registry = ctx.accounts.market_registry.load()?;
    let vault_usdc = &ctx.accounts.vault_quote_token_account;

    // 1. Check the vault depositor has waited the redeem period since the last withdraw request
    investor
        .last_withdraw_request
        .check_redeem_period_finished(&vault, now)?;
    // 2. Check that the depositor is unable to withdraw
    ctx.check_cant_withdraw(&investor.last_withdraw_request, vault_usdc, &registry)?;
    // 3. Check that the vault is not already in liquidation for another investor
    vault.check_delegate_available_for_liquidation(&ctx.accounts.authority, now)?;

    vault.set_liquidation_delegate(investor.authority, now);

    drop(vault);

    Ok(())
}

#[derive(Accounts)]
pub struct AppointInvestorLiquidator<'info> {
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
        constraint = is_usdc_token_for_vault(&vault, &vault_quote_token_account)?,
        token::mint = vault.load()?.usdc_mint
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,
}
