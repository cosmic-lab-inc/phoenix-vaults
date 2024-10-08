use crate::cast_error;
use crate::error::VaultResult;
use crate::math::{U192, U256};
use anchor_lang::solana_program::msg;
use std::convert::TryInto;

pub trait Cast: Sized {
    #[track_caller]
    #[inline(always)]
    fn cast<T: std::convert::TryFrom<Self>>(self) -> VaultResult<T> {
        match self.try_into() {
            Ok(result) => Ok(result),
            Err(_) => Err(cast_error!()()),
        }
    }
}

impl Cast for U256 {}

impl Cast for U192 {}

impl Cast for u128 {}

impl Cast for u64 {}

impl Cast for u32 {}

impl Cast for u16 {}

impl Cast for u8 {}

impl Cast for i128 {}

impl Cast for i64 {}

impl Cast for i32 {}

impl Cast for i16 {}

impl Cast for i8 {}

impl Cast for bool {}
