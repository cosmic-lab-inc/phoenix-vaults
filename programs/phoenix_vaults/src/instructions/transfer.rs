use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Transfer};

use crate::constraints::{is_delegate_for_vault, is_token_for_vault};
use crate::cpis::TokenTransferCPI;
use crate::declare_vault_seeds;
use crate::state::Vault;

pub fn token_transfer<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, TokenTransfer<'info>>,
    params: TransferParams,
) -> Result<()> {
    ctx.token_transfer(params.amount)?;
    Ok(())
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct TransferParams {
    pub amount: u64,
}

#[derive(Accounts)]
#[instruction(params: TransferParams)]
pub struct TokenTransfer<'info> {
    /// If delegate has authority to sign for vault, then any Phoenix CPI is valid.
    /// Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],
    /// so this is safe since any Phoenix CPI is secure.
    #[account(
        constraint = is_delegate_for_vault(&vault, &delegate)?
    )]
    pub vault: AccountLoader<'info, Vault>,
    /// Is manager by default, but can be delegated to another pubkey using `update_delegate`
    pub delegate: Signer<'info>,
    #[account(
        mut,
        constraint = is_token_for_vault(&vault, &from)?
    )]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

impl<'info> TokenTransferCPI for Context<'_, '_, '_, 'info, TokenTransfer<'info>> {
    fn token_transfer(&self, amount: u64) -> Result<()> {
        declare_vault_seeds!(self.accounts.vault, seeds);

        let cpi_accounts = Transfer {
            from: self.accounts.from.to_account_info().clone(),
            to: self.accounts.to.to_account_info().clone(),
            authority: self.accounts.vault.to_account_info().clone(),
        };
        let token_program = self.accounts.token_program.to_account_info().clone();
        let cpi_context = CpiContext::new_with_signer(token_program, cpi_accounts, seeds);

        anchor_spl::token::transfer(cpi_context, amount)?;

        Ok(())
    }
}
