use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::state::Vault;
use crate::{validate, Size, Investor};

pub fn initialize_investor(ctx: Context<InitializeInvestor>) -> Result<()> {
    let mut investor = ctx.accounts.investor.load_init()?;
    investor.vault = ctx.accounts.vault.key();
    investor.pubkey = ctx.accounts.investor.key();
    investor.authority = *ctx.accounts.authority.key;

    let vault = ctx.accounts.vault.load()?;
    if vault.permissioned {
        validate!(
            vault.manager == *ctx.accounts.payer.key,
            ErrorCode::PermissionedVault,
            "Investor can only be created by vault manager"
        )?;
    } else {
        validate!(
            investor.authority == *ctx.accounts.payer.key,
            ErrorCode::Default,
            "Investor authority must pay to create account"
        )?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeInvestor<'info> {
    pub vault: AccountLoader<'info, Vault>,
    #[account(
        init,
        seeds = [b"investor", vault.key().as_ref(), authority.key().as_ref()],
        space = Investor::SIZE,
        bump,
        payer = payer
    )]
    pub investor: AccountLoader<'info, Investor>,
    /// CHECK: don't need to sign if vault is permissioned
    pub authority: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}
