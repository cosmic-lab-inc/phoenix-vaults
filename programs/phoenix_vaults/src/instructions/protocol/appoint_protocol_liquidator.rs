use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::constraints::{is_protocol_for_vault, is_usdc_token_for_vault};
use crate::state::{MarketMapProvider, MarketRegistry, Vault};

pub fn appoint_protocol_liquidator<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, AppointProtocolLiquidator<'info>>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let mut vault = ctx.accounts.vault.load_mut()?;
    let registry = ctx.accounts.market_registry.load()?;
    let vault_usdc = &ctx.accounts.vault_quote_token_account;

    // 1. Check the vault depositor has waited the redeem period since the last withdraw request
    vault
        .last_protocol_withdraw_request
        .check_redeem_period_finished(&vault, now)?;
    // 2. Check that the depositor is unable to withdraw
    ctx.check_cant_withdraw(&vault.last_protocol_withdraw_request, vault_usdc, &registry)?;
    // 3. Check that the vault is not already in liquidation for another investor
    vault.check_delegate_available_for_liquidation(&ctx.accounts.protocol, now)?;

    vault.set_liquidation_delegate(ctx.accounts.protocol.key(), now);

    drop(vault);

    Ok(())
}

#[derive(Accounts)]
pub struct AppointProtocolLiquidator<'info> {
    #[account(
        mut,
        constraint = is_protocol_for_vault(&vault, &protocol)?,
    )]
    pub vault: AccountLoader<'info, Vault>,

    pub protocol: Signer<'info>,

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
