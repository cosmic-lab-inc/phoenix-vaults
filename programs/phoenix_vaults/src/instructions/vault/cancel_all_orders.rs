use anchor_lang::prelude::*;
use solana_program::program::invoke_signed;

use crate::constraints::is_delegate_for_vault;
use crate::cpis::PhoenixCancelAllOrders;
use crate::declare_vault_seeds;
use crate::state::{MarketMapProvider, PhoenixProgram, Vault};

pub fn cancel_all_orders<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, CancelAllOrders<'info>>,
) -> Result<()> {
    ctx.phoenix_cancel_all_orders()?;

    let mut vault = ctx.accounts.vault.load_mut()?;
    let market = ctx.accounts.market.key();
    let pos = ctx.market_position(&vault, market)?;
    let index = vault.force_get_market_position_index(market)?;
    vault.update_market_position(index, pos)?;
    drop(vault);

    Ok(())
}

#[derive(Accounts)]
pub struct CancelAllOrders<'info> {
    /// If delegate has authority to sign for vault, then any Phoenix CPI is valid.
    /// Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],
    /// so this is safe since any Phoenix CPI is secure.
    #[account(
        mut,
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
}

impl<'info> PhoenixCancelAllOrders for Context<'_, '_, '_, 'info, CancelAllOrders<'info>> {
    fn phoenix_cancel_all_orders(&self) -> Result<()> {
        let trader_index = 3;
        let mut ix =
            phoenix::program::instruction_builders::create_cancel_all_order_with_free_funds_instruction(
                &self.accounts.market.key(),
                &self.accounts.vault.key(),
            );
        ix.accounts[trader_index].is_signer = true;

        // #[account(0, name = "phoenix_program", desc = "Phoenix program")]
        // #[account(1, name = "log_authority", desc = "Phoenix log authority")]
        // #[account(2, writable, name = "market", desc = "This account holds the market state")]
        // #[account(3, signer, name = "trader")]
        let accounts = [
            self.accounts.phoenix.to_account_info(),
            self.accounts.log_authority.to_account_info(),
            self.accounts.market.to_account_info(),
            self.accounts.vault.to_account_info(),
        ];
        declare_vault_seeds!(self.accounts.vault, seeds);
        invoke_signed(&ix, &accounts, seeds)?;

        Ok(())
    }
}
