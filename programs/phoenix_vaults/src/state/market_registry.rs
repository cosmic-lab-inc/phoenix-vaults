use anchor_lang::prelude::*;
use drift_macros::assert_no_slop;
use solana_program::address_lookup_table::state::AddressLookupTable;
use static_assertions::const_assert_eq;

use crate::Size;

#[assert_no_slop]
#[account(zero_copy(unsafe))]
#[derive(Default, Eq, PartialEq, Debug)]
#[repr(C)]
pub struct MarketRegistry {
    /// [`AddressLookupTable`] that contains a list of Phoenix markets
    pub lut: Pubkey,
    /// Phoenix markets are denominated in USDC or SOL, so we must pre-define this
    pub usdc_mint: Pubkey,
    /// Phoenix markets are denominated in USDC or SOL, so we must pre-define this
    pub sol_mint: Pubkey,
}

impl Size for MarketRegistry {
    const SIZE: usize = 32 * 3 + 8;
}
const_assert_eq!(
    MarketRegistry::SIZE,
    std::mem::size_of::<MarketRegistry>() + 8
);

impl MarketRegistry {
    pub fn deserialize_lookup_table(auth: Pubkey, lut_data: &[u8]) -> Result<AddressLookupTable> {
        let lookup_table = AddressLookupTable::deserialize(lut_data).map_err(|_| {
            anchor_lang::error::Error::from(crate::error::ErrorCode::InvalidAddressLookupTableData)
        })?;
        if lookup_table.meta.authority.is_none() {
            return Err(anchor_lang::error::Error::from(
                crate::error::ErrorCode::AddressLookupTableAuthorityMissing,
            ));
        }
        let lut_auth = lookup_table.meta.authority.unwrap();
        if lut_auth != auth {
            return Err(anchor_lang::error::Error::from(
                crate::error::ErrorCode::AddressLookupTableAuthorityInvalid,
            ));
        }
        Ok(lookup_table)
    }
}
