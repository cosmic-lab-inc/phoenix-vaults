use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::constraints::{
    is_authority_for_investor, is_liquidation_delegate_for_vault, is_lut_for_registry,
    is_usdc_token_for_vault, is_vault_for_investor,
};
use crate::error::ErrorCode;
use crate::state::{Investor, MarketMapProvider, MarketRegistry, Vault};
use crate::validate;

/// Investor has authority to liquidate vault position in any market if they can't withdraw their equity.
/// This instruction liquidates up to the amount the investor has unfulfilled in its last withdraw request.
pub fn liquidate_market<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, LiquidateMarket<'info>>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    let mut vault = ctx.accounts.vault.load_mut()?;

    let investor = ctx.accounts.investor.load()?;
    if let Err(e) = vault.check_liquidator(&investor, now) {
        vault.reset_liquidation_delegate();
        return Err(e.into());
    }

    let registry = ctx.accounts.market_registry.load_mut()?;
    let lut_acct_info = ctx.accounts.lut.to_account_info();
    let lut_data = lut_acct_info.data.borrow();
    let lut = MarketRegistry::deserialize_lookup_table(registry.lut_auth, lut_data.as_ref())?;
    let vault_usdc_ata = &ctx.accounts.vault_quote_token_account;

    if let Err(e) = ctx.check_cant_withdraw(&investor, vault_usdc_ata, &registry, &lut) {
        vault.reset_liquidation_delegate();
        return Err(e);
    }

    /* todo
       Instruction executes:
       * debits quote lots from vault position in market
       * if quote lots are insufficient to fulfill investor withdraw request,
           then market swap base lots into quote lots as needed until zero or investor withdraw request is fulfilled,
           whichever comes first.
    */

    drop(vault);

    Ok(())
}

#[derive(Accounts)]
pub struct LiquidateMarket<'info> {
    #[account(
        mut,
        constraint = is_liquidation_delegate_for_vault(&vault, &authority)?
    )]
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
        constraint = is_usdc_token_for_vault(&vault, &vault_quote_token_account)?,
        token::mint = vault.load()?.usdc_mint
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,
}
