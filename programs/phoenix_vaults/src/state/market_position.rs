use anchor_lang::prelude::*;
use bytemuck::Zeroable;
use drift_macros::assert_no_slop;
use static_assertions::const_assert_eq;

#[assert_no_slop]
#[derive(
    Default, AnchorSerialize, AnchorDeserialize, Copy, Clone, Eq, PartialEq, Debug, Zeroable,
)]
pub struct MarketPosition {
    pub market: Pubkey,
    pub quote_lots_locked: u64,
    pub quote_lots_free: u64,
    pub base_lots_locked: u64,
    pub base_lots_free: u64,
}

impl MarketPosition {
    pub fn is_available(&self) -> bool {
        self.quote_lots_locked == 0
            && self.quote_lots_free == 0
            && self.base_lots_locked == 0
            && self.base_lots_free == 0
    }
}
