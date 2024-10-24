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

declare_id!("VLt8tiD4iUGVuxFRr1NiN63BYJGKua5rNpEcsEGzdBq");

#[program]
pub mod phoenix_vaults {
    use super::*;

    /// The wallet that signs this instruction becomes the manager and therefore profits the management fee and profit share.
    /// The manager can NOT be updated, so be careful who creates the vault.
    ///
    /// By default, the manager is also the delegate who has permission to trade on behalf of the vault.
    ///
    /// The delegate can be updated at anytime by calling `update_vault`.
    pub fn initialize_vault<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InitializeVault<'info>>,
        params: VaultParams,
    ) -> Result<()> {
        instructions::initialize_vault(ctx, params)
    }

    /// User creates an [`Investor`] account to invest with a [`Vault`].
    pub fn initialize_investor<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InitializeInvestor<'info>>,
    ) -> Result<()> {
        instructions::initialize_investor(ctx)
    }

    /// Admin function to create an on-chain source of truth for list of Phoenix markets.
    /// This is called once after the first deploy of this program to a network.
    pub fn initialize_market_registry<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InitializeMarketRegistry<'info>>,
        params: MarketLookupTableParams,
    ) -> Result<()> {
        instructions::initialize_market_registry(ctx, params)
    }

    /// Investor deposits funds to the vault USDC token account.
    pub fn investor_deposit<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InvestorDeposit<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::investor_deposit(ctx, amount)
    }

    /// Investor withdraws funds from the vault, assuming funds are in the vault USDC token account.
    ///
    /// If insufficient USDC in the vault_usdc_token_account, then the investor must call `appoint_liquidator` to
    /// acquire permission to liquidate the vault market positions.
    ///
    /// Then call `liquidate_usdc_market` or `liquidate_sol_market` to forcefully swap a vault market position back to USDC,
    /// and then withdraw back to the investor.
    pub fn investor_withdraw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InvestorWithdraw<'info>>,
    ) -> Result<()> {
        instructions::investor_withdraw(ctx)
    }

    /// Vault delegate claims a seat on a Phoenix market to enable trading.
    /// Call this before `place_limit_order`.
    pub fn claim_seat<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ClaimSeat<'info>>,
    ) -> Result<()> {
        instructions::claim_seat(ctx)
    }

    /// Vault delegate places a limit order on behalf of the vault.
    pub fn place_limit_order<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, PlaceLimitOrder<'info>>,
        params: PlaceOrderParams,
    ) -> Result<()> {
        instructions::place_limit_order(ctx, params)
    }

    /// Investor request withdrawal of funds from the vault.
    pub fn investor_request_withdraw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InvestorRequestWithdraw<'info>>,
        withdraw_amount: u64,
        withdraw_unit: WithdrawUnit,
    ) -> Result<()> {
        instructions::investor_request_withdraw(ctx, withdraw_amount, withdraw_unit)
    }

    pub fn cancel_withdraw_request<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InvestorCancelWithdrawRequest<'info>>,
    ) -> Result<()> {
        instructions::investor_cancel_withdraw_request(ctx)
    }

    /// Vault delegate deposits vault assets from the USDC or SOL token account to a Phoenix market.
    pub fn market_deposit<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, MarketDeposit<'info>>,
        params: MarketTransferParams,
    ) -> Result<()> {
        instructions::market_deposit(ctx, params)
    }

    /// Vault delegate withdraws vault Phoenix market back to the vault USDC or SOL token accounts.
    pub fn market_withdraw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, MarketWithdraw<'info>>,
        params: MarketTransferParams,
    ) -> Result<()> {
        instructions::market_withdraw(ctx, params)
    }

    /// Assign an investor as delegate to enable liquidation of market positions.
    pub fn appoint_investor_liquidator<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, AppointInvestorLiquidator<'info>>,
    ) -> Result<()> {
        instructions::appoint_investor_liquidator(ctx)
    }

    /// Assign a vault manager as delegate to enable liquidation of market positions.
    pub fn appoint_manager_liquidator<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, AppointManagerLiquidator<'info>>,
    ) -> Result<()> {
        instructions::appoint_manager_liquidator(ctx)
    }

    /// Assign a vault protocol as delegate to enable liquidation of market positions.
    pub fn appoint_protocol_liquidator<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, AppointProtocolLiquidator<'info>>,
    ) -> Result<()> {
        instructions::appoint_protocol_liquidator(ctx)
    }

    /// After `appoint_investor_liquidator` the investor can liquidate a USDC denominated market position
    /// to fulfill their withdrawal request.
    pub fn investor_liquidate_usdc_market<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InvestorLiquidateUsdcMarket<'info>>,
    ) -> Result<()> {
        instructions::investor_liquidate_usdc_market(ctx)
    }

    /// After `appoint_investor_liquidator` the investor can liquidate a SOL denominated market position
    /// to fulfill their withdrawal request.
    pub fn investor_liquidate_sol_market<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, InvestorLiquidateSolMarket<'info>>,
    ) -> Result<()> {
        instructions::investor_liquidate_sol_market(ctx)
    }

    /// After `appoint_manager_liquidator` the manager can liquidate a USDC denominated market position
    /// to fulfill their withdrawal request.
    pub fn manager_liquidate_usdc_market<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ManagerLiquidateUsdcMarket<'info>>,
    ) -> Result<()> {
        instructions::manager_liquidate_usdc_market(ctx)
    }

    /// After `appoint_manager_liquidator` the manager can liquidate a SOL denominated market position
    /// to fulfill their withdrawal request.
    pub fn manager_liquidate_sol_market<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ManagerLiquidateSolMarket<'info>>,
    ) -> Result<()> {
        instructions::manager_liquidate_sol_market(ctx)
    }

    /// After `appoint_protocol_liquidator` the protocol can liquidate a SOL denominated market position
    /// to fulfill their withdrawal request.
    pub fn protocol_liquidate_sol_market<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ProtocolLiquidateSolMarket<'info>>,
    ) -> Result<()> {
        instructions::protocol_liquidate_sol_market(ctx)
    }

    /// After `appoint_protocol_liquidator` the protocol can liquidate a USDC denominated market position
    /// to fulfill their withdrawal request.
    pub fn protocol_liquidate_usdc_market<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ProtocolLiquidateUsdcMarket<'info>>,
    ) -> Result<()> {
        instructions::protocol_liquidate_usdc_market(ctx)
    }

    /// Update the fees, profit share, min deposit, max capacity, delegate, and more.
    pub fn update_vault<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, UpdateVault<'info>>,
        params: UpdateVaultParams,
    ) -> Result<()> {
        instructions::update_vault(ctx, params)
    }

    pub fn manager_withdraw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ManagerWithdraw<'info>>,
    ) -> Result<()> {
        instructions::manager_withdraw(ctx)
    }

    pub fn manager_deposit<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ManagerDeposit<'info>>,
        amount: u64,
    ) -> Result<()> {
        instructions::manager_deposit(ctx, amount)
    }

    pub fn manager_request_withdraw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ManagerRequestWithdraw<'info>>,
        withdraw_amount: u64,
        withdraw_unit: WithdrawUnit,
    ) -> Result<()> {
        instructions::manager_request_withdraw(ctx, withdraw_amount, withdraw_unit)
    }

    pub fn manager_cancel_withdraw_request<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ManagerCancelWithdrawRequest<'info>>,
    ) -> Result<()> {
        instructions::manager_cancel_withdraw_request(ctx)
    }

    pub fn protocol_withdraw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ProtocolWithdraw<'info>>,
    ) -> Result<()> {
        instructions::protocol_withdraw(ctx)
    }

    pub fn protocol_request_withdraw<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ProtocolRequestWithdraw<'info>>,
        withdraw_amount: u64,
        withdraw_unit: WithdrawUnit,
    ) -> Result<()> {
        instructions::protocol_request_withdraw(ctx, withdraw_amount, withdraw_unit)
    }

    pub fn protocol_cancel_withdraw_request<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, ProtocolCancelWithdrawRequest<'info>>,
    ) -> Result<()> {
        instructions::protocol_cancel_withdraw_request(ctx)
    }

    pub fn cancel_all_orders<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, CancelAllOrders<'info>>,
    ) -> Result<()> {
        instructions::cancel_all_orders(ctx)
    }

    pub fn cancel_multiple_orders_by_id<'c: 'info, 'info>(
        ctx: Context<'_, '_, 'c, 'info, CancelMultipleOrdersById<'info>>,
        params: CancelMultipleOrdersParams,
    ) -> Result<()> {
        instructions::cancel_multiple_orders_by_id(ctx, params)
    }
}
