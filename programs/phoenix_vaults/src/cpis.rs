use anchor_lang::prelude::*;

pub trait TokenTransferCPI {
    fn token_transfer(&self, amount: u64) -> Result<()>;
}

pub trait PhoenixDepositCPI {
    fn phoenix_deposit(&self, amount: u64) -> Result<()>;
}

pub trait PhoenixWithdrawCPI {
    fn phoenix_withdraw(&self, amount: u64) -> Result<()>;
}