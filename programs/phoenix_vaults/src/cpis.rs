use crate::state::MarketTransferParams;
use anchor_lang::prelude::*;
use phoenix::state::OrderPacket;

pub trait TokenTransferCPI {
    fn token_transfer(&self, amount: u64) -> Result<()>;
}

pub trait PhoenixDepositCPI {
    fn phoenix_deposit(&self, params: MarketTransferParams) -> Result<()>;
}

pub trait PhoenixTradeCPI {
    fn phoenix_trade(&self, order: OrderPacket) -> Result<()>;
}

pub trait PhoenixWithdrawCPI {
    fn phoenix_withdraw(&self, params: MarketTransferParams) -> Result<()>;
}

pub trait PhoenixWithdrawSolUsdcMarketCPI {
    fn phoenix_withdraw_sol_usdc_market(&self, params: MarketTransferParams) -> Result<()>;
}

pub trait PhoenixDepositSolUsdcMarketCPI {
    fn phoenix_deposit_sol_usdc_market(&self, params: MarketTransferParams) -> Result<()>;
}
