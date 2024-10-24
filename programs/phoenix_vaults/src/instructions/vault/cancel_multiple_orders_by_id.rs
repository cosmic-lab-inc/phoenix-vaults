use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};
use phoenix::program::CancelMultipleOrdersByIdParams as PhoenixCancelMultipleOrdersByIdParams;
use phoenix::program::CancelOrderParams as PhoenixCancelOrderParams;
use phoenix::state::Side as PhoenixSide;
use solana_program::program::invoke_signed;

use crate::constraints::is_delegate_for_vault;
use crate::cpis::PhoenixCancelMultipleOrdersById;
use crate::declare_vault_seeds;
use crate::state::{MarketMapProvider, PhoenixProgram, Vault};

pub fn cancel_multiple_orders_by_id<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, CancelMultipleOrdersById<'info>>,
    params: CancelMultipleOrdersParams,
) -> Result<()> {
    ctx.phoenix_cancel_multiple_orders_by_id(params.into())?;

    let mut vault = ctx.accounts.vault.load_mut()?;
    let market = ctx.accounts.market.key();
    let pos = ctx.market_position(&vault, market)?;
    let index = vault.force_get_market_position_index(market)?;
    vault.update_market_position(index, pos)?;
    drop(vault);

    Ok(())
}

#[derive(AnchorDeserialize, AnchorSerialize, Clone, PartialEq, Eq, Debug)]
pub struct CancelMultipleOrdersParams {
    pub orders: Vec<CancelOrderParams>,
}
#[derive(Clone, Copy, BorshSerialize, BorshDeserialize, PartialEq, Debug, Eq, Default)]
pub enum Side {
    #[default]
    Bid,
    Ask,
}

#[derive(AnchorDeserialize, AnchorSerialize, Copy, Clone, PartialEq, Eq, Debug)]
pub struct CancelOrderParams {
    pub side: Side,
    pub price_in_ticks: u64,
    pub order_sequence_number: u64,
}

impl From<CancelMultipleOrdersParams> for PhoenixCancelMultipleOrdersByIdParams {
    fn from(params: CancelMultipleOrdersParams) -> Self {
        Self {
            orders: params
                .orders
                .into_iter()
                .map(|order| PhoenixCancelOrderParams {
                    side: match order.side {
                        Side::Bid => PhoenixSide::Bid,
                        Side::Ask => PhoenixSide::Ask,
                    },
                    price_in_ticks: order.price_in_ticks,
                    order_sequence_number: order.order_sequence_number,
                })
                .collect(),
        }
    }
}

#[derive(Accounts)]
pub struct CancelMultipleOrdersById<'info> {
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

impl<'info> PhoenixCancelMultipleOrdersById
    for Context<'_, '_, '_, 'info, CancelMultipleOrdersById<'info>>
{
    fn phoenix_cancel_multiple_orders_by_id(
        &self,
        params: PhoenixCancelMultipleOrdersByIdParams,
    ) -> Result<()> {
        let trader_index = 3;
        let mut ix =
            phoenix::program::instruction_builders::create_cancel_multiple_orders_by_id_with_free_funds_instruction(
                &self.accounts.market.key(),
                &self.accounts.vault.key(),
                &params
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
