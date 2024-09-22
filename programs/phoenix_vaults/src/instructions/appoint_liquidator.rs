use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::constraints::{
    is_authority_for_investor, is_lut_for_registry, is_usdc_token_for_vault, is_vault_for_investor,
};
use crate::state::{Investor, MarketMapProvider, MarketRegistry, Vault};

/// If the investor can't withdraw their equity from the vault's USDC token account,
/// then the investor is granted authority to sign for liquidation of the vault.
pub fn appoint_liquidator<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, AppointLiquidator<'info>>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let mut vault = ctx.accounts.vault.load_mut()?;
    let investor = ctx.accounts.investor.load()?;
    let registry = ctx.accounts.market_registry.load()?;
    let vault_usdc_ata = &ctx.accounts.vault_quote_token_account;

    let lut_acct_info = ctx.accounts.lut.to_account_info();
    let lut_data = lut_acct_info.data.borrow();
    let lut = MarketRegistry::deserialize_lookup_table(registry.lut_auth, lut_data.as_ref())?;

    // 1. Check the vault depositor has waited the redeem period since the last withdraw request
    investor
        .last_withdraw_request
        .check_redeem_period_finished(&vault, now)?;
    // 2. Check that the depositor is unable to withdraw
    ctx.check_cant_withdraw(&investor, vault_usdc_ata, &registry, &lut)?;
    // 3. Check that the vault is not already in liquidation for another investor
    vault.check_delegate_available_for_liquidation(&investor, now)?;

    vault.set_liquidation_delegate(investor.authority, now);

    drop(vault);

    Ok(())
}

#[derive(Accounts)]
pub struct AppointLiquidator<'info> {
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
        bump,
        constraint = is_lut_for_registry(&market_registry, &lut)?
    )]
    pub market_registry: AccountLoader<'info, MarketRegistry>,

    /// CHECK: Deserialized into [`AddressLookupTable`] within instruction
    pub lut: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = is_usdc_token_for_vault(&vault, &vault_quote_token_account)?,
        token::mint = vault.load()?.usdc_mint
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,
}
