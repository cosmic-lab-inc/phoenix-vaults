use anchor_lang::prelude::*;
use solana_program::program::invoke_signed;

use crate::constraints::is_delegate_for_vault;
use crate::declare_vault_seeds;
use crate::state::{PhoenixProgram, PhoenixSeatManagerProgram, Vault};

pub fn claim_seat<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, ClaimSeat<'info>>,
) -> Result<()> {
    declare_vault_seeds!(ctx.accounts.vault, seeds);

    let mut ix = phoenix_seat_manager::instruction_builders::create_claim_seat_instruction(
        &ctx.accounts.vault.key(),
        &ctx.accounts.market.key(),
    );
    ix.accounts[5].is_signer = true;
    ix.accounts[6].pubkey = ctx.accounts.payer.key();

    msg!(
        "cpi trader: {:?}, signer: {}",
        ix.accounts[5].pubkey,
        ix.accounts[5].is_signer
    );
    msg!(
        "cpi payer: {:?}, signer: {}",
        ix.accounts[6].pubkey,
        ix.accounts[6].is_signer
    );

    // #[account(0, name = "phoenix_program", desc = "Phoenix program")]
    // #[account(1, name = "log_authority", desc = "Phoenix log authority")]
    // #[account(2, writable, name = "market", desc = "This account holds the market state")]
    // #[account(3, writable, name = "seat_manager", desc = "The seat manager account is the market authority")]
    // #[account(4, writable, name = "seat_deposit_collector", desc = "Collects deposits for claiming new seats and refunds for evicting seats")]
    // #[account(5, signer, name = "trader")]
    // #[account(6, writable, signer, name = "payer")]
    // #[account(7, writable, name = "seat")]
    // #[account(8, name = "system_program", desc = "System program")]
    let accounts = [
        ctx.accounts.phoenix.to_account_info(),
        ctx.accounts.log_authority.to_account_info(),
        ctx.accounts.market.to_account_info(),
        ctx.accounts.seat_manager.to_account_info(),
        ctx.accounts.seat_deposit_collector.to_account_info(),
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.seat.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    ];

    invoke_signed(&ix, &accounts, seeds)?;
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimSeat<'info> {
    /// If delegate has authority to sign for vault, then any Phoenix CPI is valid.
    /// Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],
    /// so this is safe since any Phoenix CPI is secure.
    #[account(
        constraint = is_delegate_for_vault(&vault, &delegate)?
    )]
    pub vault: AccountLoader<'info, Vault>,
    /// Is manager by default, but can be delegated to another pubkey using `update_delegate`
    pub delegate: Signer<'info>,

    pub phoenix: Program<'info, PhoenixProgram>,
    /// CHECK: validated in Phoenix CPI
    pub log_authority: UncheckedAccount<'info>,
    /// CHECK: validated in Phoenix CPI
    #[account(mut)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: validated in Phoenix CPI
    #[account(mut)]
    pub seat_manager: UncheckedAccount<'info>,
    /// CHECK: validated in Phoenix CPI
    #[account(mut)]
    pub seat_deposit_collector: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: validated in Phoenix CPI
    #[account(mut)]
    pub seat: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,

    pub phoenix_seat_manager: Program<'info, PhoenixSeatManagerProgram>,
}
