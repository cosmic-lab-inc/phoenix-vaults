use crate::state::MarketTransferParams;
use anchor_lang::prelude::*;
use phoenix::program::CancelMultipleOrdersByIdParams;
use phoenix::state::OrderPacket;

pub trait TokenTransfer {
    fn token_transfer(&self, amount: u64) -> Result<()>;
}

pub trait PhoenixDeposit {
    fn phoenix_deposit(&self, params: MarketTransferParams) -> Result<()>;
}

pub trait PhoenixTrade {
    fn phoenix_trade(&self, order: OrderPacket) -> Result<()>;
}

pub trait PhoenixTradeSolUsdcMarket {
    fn phoenix_trade_sol_usdc_market(&self, order: OrderPacket) -> Result<()>;
}

pub trait PhoenixWithdraw {
    fn phoenix_withdraw(&self, params: MarketTransferParams) -> Result<()>;
}

pub trait PhoenixWithdrawSolUsdcMarket {
    fn phoenix_withdraw_sol_usdc_market(&self, params: MarketTransferParams) -> Result<()>;
}

pub trait PhoenixDepositSolUsdcMarket {
    fn phoenix_deposit_sol_usdc_market(&self, params: MarketTransferParams) -> Result<()>;
}

pub trait PhoenixCancelAllOrders {
    fn phoenix_cancel_all_orders(&self) -> Result<()>;
}

pub trait PhoenixCancelMultipleOrdersById {
    fn phoenix_cancel_multiple_orders_by_id(
        &self,
        params: CancelMultipleOrdersByIdParams,
    ) -> Result<()>;
}
