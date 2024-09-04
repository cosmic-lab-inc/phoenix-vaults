use crate::error::VaultResult;
use crate::unwrap_error;
use anchor_lang::solana_program::msg;

pub trait SafeUnwrap {
    type Item;

    fn safe_unwrap(self) -> VaultResult<Self::Item>;
}

impl<T> SafeUnwrap for Option<T> {
    type Item = T;

    #[track_caller]
    #[inline(always)]
    fn safe_unwrap(self) -> VaultResult<T> {
        match self {
            Some(v) => Ok(v),
            None => Err(unwrap_error!()()),
        }
    }
}

impl<T, U> SafeUnwrap for Result<T, U> {
    type Item = T;

    #[track_caller]
    #[inline(always)]
    fn safe_unwrap(self) -> VaultResult<T> {
        match self {
            Ok(v) => Ok(v),
            Err(_) => Err(unwrap_error!()()),
        }
    }
}
