use anchor_lang::prelude::*;
use phoenix::program::{assert_with_msg, PhoenixInstruction};
use solana_program::instruction::Instruction;
use solana_program::program::{invoke, invoke_signed};

use crate::constraints::is_delegate_for_vault;
use crate::cpis::PhoenixCPI;
use crate::state::{PhoenixProgram, PhoenixVaultsProgram, Vault};

pub fn phoenix<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, Phoenix<'info>>,
    params: PhoenixParams,
) -> Result<()> {
    ctx.phoenix_cpi(&params.phoenix_ix_data)?;
    Ok(())
}

#[derive(Debug, Clone, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct PhoenixParams {
    pub phoenix_ix_data: Vec<u8>,
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
    pub phoenix: Program<'info, PhoenixProgram>,
    pub phoenix_vaults: Program<'info, PhoenixVaultsProgram>,
}

impl<'info> PhoenixCPI for Context<'_, '_, '_, 'info, Phoenix<'info>> {
    fn phoenix_cpi(&self, ix_data: &[u8]) -> Result<()> {
        let vault = self.accounts.vault.load()?;
        let name = vault.name;
        let bump = vault.bump;
        let vault_signer_seeds = &[&Vault::get_vault_signer_seeds(&name, &bump)[..]];

        drop(vault);

        let metas: Vec<AccountMeta> = self.remaining_accounts.to_owned().to_account_metas(None);

        // let (program_accounts, _) = self.remaining_accounts.split_at(4);
        // let accounts_iter = &mut program_accounts.iter();
        // let info = next_account_info(accounts_iter)?;
        // assert_with_msg(
        //     info.is_signer,
        //     ProgramError::MissingRequiredSignature,
        //     &format!("{:?} missing required signature", info.key),
        // )?;

        let ix = Instruction::new_with_bytes(self.accounts.phoenix.key(), ix_data, metas);
        // invoke_signed(&ix, self.remaining_accounts, vault_signer_seeds)?;

        invoke(&ix, self.remaining_accounts)?;

        Ok(())
    }
}
