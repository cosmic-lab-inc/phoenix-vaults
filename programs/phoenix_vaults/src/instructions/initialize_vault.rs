use crate::constants::PERCENTAGE_PRECISION_U64;
use crate::math::Cast;
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::ONE_DAY;
use crate::state::Vault;
use crate::{error::ErrorCode, validate, Size};

pub fn initialize_vault<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InitializeVault<'info>>,
    params: VaultParams,
) -> Result<()> {
    let bump = ctx.bumps.vault;

    let mut vault = ctx.accounts.vault.load_init()?;
    vault.name = params.name;
    vault.pubkey = *ctx.accounts.vault.to_account_info().key;
    vault.manager = *ctx.accounts.manager.key;
    vault.protocol = params.protocol;
    vault.token_account = *ctx.accounts.token_account.to_account_info().key;
    vault.mint = *ctx.accounts.mint.to_account_info().key;
    vault.init_ts = Clock::get()?.unix_timestamp;
    vault.bump = bump;
    vault.permissioned = params.permissioned;

    validate!(
        params.redeem_period < ONE_DAY * 90,
        ErrorCode::InvalidVaultInitialization,
        "redeem period must be < 90 days"
    )?;
    vault.redeem_period = params.redeem_period;

    vault.max_tokens = params.max_tokens;
    vault.min_deposit_amount = params.min_deposit_amount;

    validate!(
        params
            .management_fee
            .saturating_add(params.protocol_fee.cast::<i64>()?)
            < PERCENTAGE_PRECISION_U64.cast()?,
        ErrorCode::InvalidVaultInitialization,
        "management fee plus protocol fee must be < 100%"
    )?;
    vault.management_fee = params.management_fee;
    vault.protocol_fee = params.protocol_fee;

    validate!(
        params
            .profit_share
            .saturating_add(params.protocol_profit_share)
            < PERCENTAGE_PRECISION_U64.cast()?,
        ErrorCode::InvalidVaultInitialization,
        "manager profit share plus protocol profit share must be < 100%"
    )?;
    vault.profit_share = params.profit_share;
    vault.protocol_profit_share = params.protocol_profit_share;

    validate!(
        params.hurdle_rate == 0,
        ErrorCode::InvalidVaultInitialization,
        "hurdle rate not implemented"
    )?;
    vault.hurdle_rate = params.hurdle_rate;

    drop(vault);

    Ok(())
}

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct VaultParams {
    pub name: [u8; 32],
    pub redeem_period: i64,
    pub max_tokens: u64,
    pub management_fee: i64,
    pub min_deposit_amount: u64,
    pub profit_share: u32,
    pub hurdle_rate: u32,
    pub spot_market_index: u16,
    pub permissioned: bool,
    pub protocol: Pubkey,
    pub protocol_fee: u64,
    pub protocol_profit_share: u32,
}

#[derive(Accounts)]
#[instruction(params: VaultParams)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        seeds = [b"vault", params.name.as_ref()],
        space = Vault::SIZE,
        bump,
        payer = payer
    )]
    pub vault: AccountLoader<'info, Vault>,
    #[account(
        init,
        seeds = [b"vault_token_account".as_ref(), vault.key().as_ref()],
        bump,
        payer = payer,
        token::mint = mint,
        token::authority = vault
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,
    pub mint: Box<Account<'info, Mint>>,
    pub manager: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}
