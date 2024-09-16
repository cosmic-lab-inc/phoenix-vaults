use anchor_lang::prelude::*;

use crate::constraints::{is_authority_for_investor, is_lut_for_registry};
use crate::math::Cast;
use crate::state::{
    Investor, MarketLookupTable, MarketMapProvider, MarketRegistry, Vault, WithdrawUnit,
};

/// The investor deposits funds to the vault token accounts.
/// The vault then deposits those funds to various Phoenix markets.
/// If the vault has insufficient funds in the token accounts, this instruction will
/// forcefully withdraw any free funds from Phoenix markets to the vault token accounts.
/// Then it will flag that balance within the vault token accounts as pending withdrawal,
/// and therefore unusable by the vault to trade.
/// Once the withdrawal is finalized, the pending withdrawal will be nullified.
pub fn request_withdraw<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, RequestWithdraw<'info>>,
    withdraw_amount: u64,
    withdraw_unit: WithdrawUnit,
) -> Result<()> {
    let clock = &Clock::get()?;
    let vault_key = ctx.accounts.vault.key();
    let vault = &mut ctx.accounts.vault.load_mut()?;
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
        mut,
        seeds = [b"market_registry"],
        bump,
        constraint = is_lut_for_registry(&market_registry, &lut)?
    )]
    pub market_registry: AccountLoader<'info, MarketRegistry>,

    /// CHECK: Deserialized into [`AddressLookupTable`] within instruction
    pub lut: UncheckedAccount<'info>,
}
