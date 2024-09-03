use crate::error::{ErrorCode, VaultResult};
use crate::math::U192;
use crate::math::{Cast, SafeMath};
use crate::{math_error, validate};
use anchor_lang::solana_program::msg;

pub fn shares_to_amount(
    n_shares: u128,
    total_vault_shares: u128,
    vault_balance: u64,
) -> VaultResult<u64> {
    validate!(
        n_shares <= total_vault_shares,
        ErrorCode::InvalidVaultWithdrawSize,
        "n_shares({}) > total_vault_shares({})",
        n_shares,
        total_vault_shares
    )?;

    let amount = if total_vault_shares > 0 {
        get_proportion_u128(vault_balance as u128, n_shares, total_vault_shares)?.cast::<u64>()?
    } else {
        0
    };

    Ok(amount)
}

pub fn amount_to_shares(
    amount: u64,
    total_vault_shares: u128,
    insurance_fund_vault_balance: u64,
) -> VaultResult<u128> {
    // relative to the entire pool + total amount minted
    let n_shares = if insurance_fund_vault_balance > 0 {
        // assumes total_vault_shares != 0 (in most cases) for nice result for user

        get_proportion_u128(
            amount.cast::<u128>()?,
            total_vault_shares,
            insurance_fund_vault_balance.cast::<u128>()?,
        )?
    } else {
        // must be case that total_vault_shares == 0 for nice result for user
        validate!(
            total_vault_shares == 0,
            ErrorCode::InsufficientVaultShares,
            "assumes total_vault_shares == 0",
        )?;

        amount.cast::<u128>()?
    };

    Ok(n_shares)
}

pub fn get_proportion_u128(value: u128, numerator: u128, denominator: u128) -> VaultResult<u128> {
    // we use u128::max.sqrt() here
    let large_constant = u64::MAX.cast::<u128>()?;

    let proportional_value = if numerator == denominator {
        value
    } else if value >= large_constant || numerator >= large_constant {
        let value = U192::from(value)
            .safe_mul(U192::from(numerator))?
            .safe_div(U192::from(denominator))?;

        value.cast::<u128>()?
    } else if numerator > denominator / 2 && denominator > numerator {
        // get values to ensure a ceiling division
        let (std_value, r) = standardize_value_with_remainder_i128(
            value
                .safe_mul(denominator.safe_sub(numerator)?)?
                .cast::<i128>()?,
            denominator,
        )?;

        // perform ceiling division by subtracting one if there is a remainder
        value
            .safe_sub(std_value.cast::<u128>()?.safe_div(denominator)?)?
            .safe_sub(r.signum().cast::<u128>()?)?
    } else {
        value.safe_mul(numerator)?.safe_div(denominator)?
    };

    Ok(proportional_value)
}

pub fn standardize_value_with_remainder_i128(
    value: i128,
    step_size: u128,
) -> VaultResult<(i128, i128)> {
    let remainder = value
        .unsigned_abs()
        .checked_rem_euclid(step_size)
        .ok_or_else(math_error!())?
        .cast::<i128>()?
        .safe_mul(value.signum())?;

    let standardized_value = value.safe_sub(remainder)?;

    Ok((standardized_value, remainder))
}

pub fn calculate_rebase_info(
    total_if_shares: u128,
    insurance_fund_vault_balance: u64,
) -> VaultResult<(u32, u128)> {
    let rebase_divisor_full = total_if_shares
        .safe_div(10)?
        .safe_div(insurance_fund_vault_balance.cast::<u128>()?)?;

    let expo_diff = log10_iter(rebase_divisor_full).cast::<u32>()?;
    let rebase_divisor = 10_u128.pow(expo_diff);

    Ok((expo_diff, rebase_divisor))
}

fn log10_iter(n: u128) -> u128 {
    let mut result = 0;
    let mut n_copy = n;

    while n_copy >= 10 {
        result += 1;
        n_copy /= 10;
    }

    result
}
