use anchor_lang::prelude::*;
use phoenix::program::deposit::DepositParams;

pub trait TokenTransferCPI {
    fn token_transfer(&self, amount: u64) -> Result<()>;
}

pub trait PhoenixDepositCPI {
    fn phoenix_deposit(&self, params: DepositParams) -> Result<()>;
}
