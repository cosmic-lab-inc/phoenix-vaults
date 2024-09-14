mod constants;
mod cpis;
mod error;
mod instructions;
pub mod macros;
mod math;
mod state;

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
        ctx: Context<'_, '_, 'c, 'info, InitializeInvestor<'info>>,
    ) -> Result<()> {
        instructions::initialize_investor(ctx)
    }

    pub fn initialize_market_registry<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InitializeMarketRegistry<'info>>,
        params: MarketLookupTableParams,
    ) -> Result<()> {
        instructions::initialize_market_registry(ctx, params)
    }

    pub fn deposit<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, Deposit<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::deposit(ctx, amount)
    }

    pub fn claim_seat<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ClaimSeat<'info>>,
    ) -> Result<()> {
        instructions::claim_seat(ctx)
    }

    pub fn place_limit_order<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, PlaceLimitOrder<'info>>,
        params: PlaceLimitOrderParams,
    ) -> Result<()> {
        instructions::place_limit_order(ctx, params)
    }
}
