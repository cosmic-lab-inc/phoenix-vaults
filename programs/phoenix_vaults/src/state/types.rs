use anchor_lang::prelude::*;

pub struct VaultFee {
    pub management_fee_payment: i64,
    pub management_fee_shares: i64,
    pub protocol_fee_payment: i64,
    pub protocol_fee_shares: i64,
}

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct MarketTransferParams {
    pub quote_lots: u64,
    pub base_lots: u64,
}
