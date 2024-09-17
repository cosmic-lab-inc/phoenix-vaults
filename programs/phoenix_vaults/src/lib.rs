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

    pub fn investor_deposit<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InvestorDeposit<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::investor_deposit(ctx, amount)
    }

    pub fn investor_withdraw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InvestorWithdraw<'info>>,
    ) -> Result<()> {
        instructions::investor_withdraw(ctx)
    }

    pub fn claim_seat<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ClaimSeat<'info>>,
    ) -> Result<()> {
        instructions::claim_seat(ctx)
    }

    pub fn place_limit_order<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, PlaceLimitOrder<'info>>,
        params: PlaceOrderParams,
    ) -> Result<()> {
        instructions::place_limit_order(ctx, params)
    }

    pub fn request_withdraw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, RequestWithdraw<'info>>,
        withdraw_amount: u64,
        withdraw_unit: WithdrawUnit,
    ) -> Result<()> {
        instructions::request_withdraw(ctx, withdraw_amount, withdraw_unit)
    }

    pub fn market_deposit<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, MarketDeposit<'info>>,
        params: MarketTransferParams,
    ) -> Result<()> {
        instructions::market_deposit(ctx, params)
    }

    pub fn market_withdraw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, MarketWithdraw<'info>>,
        params: MarketTransferParams,
    ) -> Result<()> {
        instructions::market_withdraw(ctx, params)
    }

    pub fn appoint_liquidator<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, AppointLiquidator<'info>>,
    ) -> Result<()> {
        instructions::appoint_liquidator(ctx)
    }

    pub fn liquidate_usdc_market<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, LiquidateUsdcMarket<'info>>,
        market_index: u8,
    ) -> Result<()> {
        instructions::liquidate_usdc_market(ctx, market_index)
    }

    pub fn liquidate_sol_market<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, LiquidateSolMarket<'info>>,
        market_index: u8,
    ) -> Result<()> {
        instructions::liquidate_sol_market(ctx, market_index)
    }
}
