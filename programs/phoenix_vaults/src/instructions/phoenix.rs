use anchor_lang::prelude::*;

use crate::constraints::is_delegate_for_vault;
use crate::cpis::PhoenixCPI;
use crate::state::{PhoenixProgram, Vault};

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
}

impl<'info> PhoenixCPI for Context<'_, '_, '_, 'info, Phoenix<'info>> {
    fn phoenix_cpi(&self, ix_data: &[u8]) -> Result<()> {
        phoenix::process_instruction(
            &self.accounts.phoenix.key(),
            self.remaining_accounts,
            ix_data,
        )?;
        Ok(())
    }
}
