use anchor_lang::prelude::*;
use anchor_spl::token::{Token, Transfer};
use solana_program::instruction::Instruction;
use solana_program::program::{invoke, invoke_signed};

use crate::constraints::is_delegate_for_vault;
use crate::cpis::PhoenixCPI;
use crate::declare_vault_seeds;
use crate::state::{PhoenixProgram, PhoenixSeatManagerProgram, Vault};

pub fn phoenix<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, Phoenix<'info>>,
    params: PhoenixParams,
) -> Result<()> {
    ctx.phoenix_cpi(&params.cpi_ix_data)?;
    Ok(())
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct PhoenixParams {
    pub cpi_ix_data: Vec<u8>,
}

#[derive(Accounts)]
#[instruction(params: PhoenixParams)]
pub struct Phoenix<'info> {
    /// If delegate has authority to sign for vault, then any Phoenix CPI is valid.
    /// Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],
    /// so this is safe since any Phoenix CPI is secure.
    #[account(
        constraint = is_delegate_for_vault(&vault, &delegate)?
    )]
    pub vault: AccountLoader<'info, Vault>,
    /// Is manager by default, but can be delegated to another pubkey using `update_delegate`
    pub delegate: Signer<'info>,
    pub phoenix: Option<Program<'info, PhoenixProgram>>,
    pub phoenix_seat_manager: Option<Program<'info, PhoenixSeatManagerProgram>>,
}

impl<'info> PhoenixCPI for Context<'_, '_, '_, 'info, Phoenix<'info>> {
    fn phoenix_cpi(&self, ix_data: &[u8]) -> Result<()> {
        let cpi_program_id = match (&self.accounts.phoenix, &self.accounts.phoenix_seat_manager) {
            (None, None) => Err(crate::error::ErrorCode::MissingBothPhoenixPrograms),
            (Some(phoenix), None) => Ok(phoenix.key()),
            (None, Some(psm)) => Ok(psm.key()),
            (Some(_), Some(_)) => Err(crate::error::ErrorCode::BothPhoenixProgramsProvided),
        }?;

        declare_vault_seeds!(self.accounts.vault, seeds);

        let metas: Vec<AccountMeta> = self.remaining_accounts.to_owned().to_account_metas(None);
        let ix = Instruction::new_with_bytes(cpi_program_id, ix_data, metas);
        invoke_signed(&ix, self.remaining_accounts, seeds)?;

        Ok(())
    }
}
