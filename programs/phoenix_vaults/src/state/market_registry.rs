use anchor_lang::prelude::*;
use drift_macros::assert_no_slop;
use static_assertions::const_assert_eq;

use crate::Size;

/// DriftVaults validates vault user positions against the remaining accounts provided for those markets.
/// If the remaining accounts do not contain every market the user has a position in, then the instruction errors.
/// For Phoenix, we use our MarketRegistry as the official source of truth for the "list of markets",
/// and we can get the TraderState for the vault within each market to determine the vault's positions.
/// If the remaining accounts do not contain every market in the MarketRegistry that the vault has a position in,
/// then the instruction will error.
#[assert_no_slop]
#[account(zero_copy(unsafe))]
#[derive(Default, Eq, PartialEq, Debug)]
#[repr(C)]
pub struct MarketRegistry {
    /// Authority over this account. This is a program admin-level keypair.
    pub authority: Pubkey,
    /// Phoenix SOL/USDC market
    pub sol_usdc_market: Pubkey,
    /// Phoenix markets are denominated in USDC or SOL, so we must pre-define this
    pub usdc_mint: Pubkey,
    /// Phoenix markets are denominated in USDC or SOL, so we must pre-define this
    pub sol_mint: Pubkey,
}

impl Size for MarketRegistry {
    const SIZE: usize = 32 * 4 + 8;
}
const_assert_eq!(
    MarketRegistry::SIZE,
    std::mem::size_of::<MarketRegistry>() + 8
);
