use anchor_lang::prelude::*;

pub trait TokenTransferCPI {
    fn token_transfer(&self, amount: u64) -> Result<()>;
}

pub trait PhoenixCPI {
    fn phoenix_cpi(&self, ix_data: &[u8]) -> Result<()>;
}
