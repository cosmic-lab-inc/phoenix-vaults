mod constants;
mod error;
mod instructions;
pub mod macros;
mod math;
mod state;
mod tests;
mod cpis;

use anchor_lang::prelude::*;
use instructions::*;
use state::*;

declare_id!("VAULT8EhRg1mduZJYCab7xkNq7ieXMQ1Tqec2LPU6jv");

#[program]
pub mod phoenix_vaults {
    use super::*;

    pub fn initialize_vault<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InitializeVault<'info>>,
        params: VaultParams,
    ) -> Result<()> {
        instructions::initialize_vault(ctx, params)
    }

    pub fn initialize_investor<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InitializeInvestor<'info>>
    ) -> Result<()> {
        instructions::initialize_investor(ctx)
    }

    pub fn initialize_market_lookup_table<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InitializeMarketLookupTable<'info>>
    ) -> Result<()> {
        instructions::initialize_market_lookup_table(ctx)
    }
}
