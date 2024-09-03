#![allow(dead_code)]

use anchor_lang::solana_program::native_token::LAMPORTS_PER_SOL;

pub const LAMPORTS_PER_SOL_U64: u64 = LAMPORTS_PER_SOL;
pub const LAMPORTS_PER_SOL_I64: i64 = LAMPORTS_PER_SOL as i64;

// PRECISIONS
pub const AMM_RESERVE_PRECISION: u128 = 1_000_000_000; //expo = -9;
pub const AMM_RESERVE_PRECISION_I128: i128 = (AMM_RESERVE_PRECISION) as i128;
pub const BASE_PRECISION: u128 = AMM_RESERVE_PRECISION; //expo = -9;
pub const BASE_PRECISION_I128: i128 = AMM_RESERVE_PRECISION_I128;
pub const BASE_PRECISION_U64: u64 = AMM_RESERVE_PRECISION as u64; //expo = -9;
pub const BASE_PRECISION_I64: i64 = AMM_RESERVE_PRECISION_I128 as i64; //expo = -9;

pub const PRICE_PRECISION: u128 = 1_000_000; //expo = -6;
pub const PRICE_PRECISION_I128: i128 = PRICE_PRECISION as i128;
pub const PRICE_PRECISION_U64: u64 = 1_000_000; //expo = -6;
pub const PRICE_PRECISION_I64: i64 = 1_000_000; //expo = -6;

pub const QUOTE_PRECISION: u128 = 1_000_000; // expo = -6
pub const QUOTE_PRECISION_I128: i128 = 1_000_000; // expo = -6
pub const QUOTE_PRECISION_I64: i64 = 1_000_000; // expo = -6
pub const QUOTE_PRECISION_U64: u64 = 1_000_000; // expo = -6

pub const PERCENTAGE_PRECISION: u128 = 1_000_000; // expo -6 (represents 100%)
pub const PERCENTAGE_PRECISION_I128: i128 = PERCENTAGE_PRECISION as i128;
pub const PERCENTAGE_PRECISION_U64: u64 = PERCENTAGE_PRECISION as u64;
pub const PERCENTAGE_PRECISION_I64: i64 = PERCENTAGE_PRECISION as i64;

// TIME
pub const ONE_HOUR: i64 = 60 * 60;
pub const ONE_DAY: i64 = ONE_HOUR * 24;
pub const ONE_YEAR: u128 = 31536000;
