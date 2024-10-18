use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::constraints::{is_manager_for_vault, is_usdc_token_for_vault};
use crate::state::{MarketMapProvider, MarketRegistry, Vault};

/// If the investor can't withdraw their equity from the vault's USDC token account,
/// then the investor is granted authority to sign for liquidation of the vault position on Phoenix markets.
/// The investor can liquidate assets into USDC by calling `liquidate_usdc_market` or `liquidate_sol_market`,
/// depending on whether the Phoenix market is denominated in USDC or SOL.
pub fn appoint_manager_liquidator<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, AppointManagerLiquidator<'info>>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let mut vault = ctx.accounts.vault.load_mut()?;
    let registry = ctx.accounts.market_registry.load()?;
    let vault_usdc = &ctx.accounts.vault_quote_token_account;

    // 1. Check the vault depositor has waited the redeem period since the last withdraw request
    vault
        .last_manager_withdraw_request
        .check_redeem_period_finished(&vault, now)?;
    // 2. Check that the depositor is unable to withdraw
    ctx.check_cant_withdraw(&vault.last_manager_withdraw_request, vault_usdc, &registry)?;
    // 3. Check that the vault is not already in liquidation for another investor
    vault.check_delegate_available_for_liquidation(&ctx.accounts.manager, now)?;

    vault.set_liquidation_delegate(ctx.accounts.manager.key(), now);

    drop(vault);

    Ok(())
}

#[derive(Accounts)]
pub struct AppointManagerLiquidator<'info> {
    #[account(
        mut,
        constraint = is_manager_for_vault(&vault, &manager)?,
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
        constraint = is_usdc_token_for_vault(&vault, &vault_quote_token_account)?,
        token::mint = vault.load()?.usdc_mint
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,
}
