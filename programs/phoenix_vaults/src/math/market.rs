use crate::constants::{PRICE_PRECISION, PRICE_PRECISION_U64};
use phoenix::program::MarketHeader;

/// Divide price by PRICE_PRECISION to get f64 price
pub fn ticks_to_price_precision(header: &MarketHeader, price_in_ticks: u64) -> u64 {
    let raw_base_units_per_base_unit = header.raw_base_units_per_base_unit.max(1);
    let quote_atoms_per_quote_unit = 10u64.pow(header.quote_params.decimals);
    let tick_size_in_quote_atoms_per_base_unit: u64 =
        header.get_tick_size_in_quote_atoms_per_base_unit().into();
    ((price_in_ticks as u128) * (tick_size_in_quote_atoms_per_base_unit as u128) * PRICE_PRECISION
        / (quote_atoms_per_quote_unit as u128 * raw_base_units_per_base_unit as u128)) as u64
}

/// Divide price by PRICE_PRECISION to get f64 price
pub fn sol_to_usdc_denom(base_price: u64, sol_price: u64) -> u64 {
    base_price * sol_price / PRICE_PRECISION_U64
}

/// Given a number of base lots, returns the equivalent number of raw base units
/// multiplied by PRICE_PRECISION to keep it as u64.
pub fn base_lots_to_raw_base_units_precision(header: &MarketHeader, base_lots: u64) -> u64 {
    let base_atoms_per_raw_base_unit = 10u64.pow(header.base_params.decimals);
    let base_atoms_per_base_lot: u64 = header.get_base_lot_size().into();
    base_lots * base_atoms_per_base_lot * PRICE_PRECISION_U64 / base_atoms_per_raw_base_unit
}

/// Given a number of quote lots, returns the equivalent number of quote units
/// multiplied by PRICE_PRECISION to keep it as u64.
pub fn quote_lots_to_quote_units_precision(header: &MarketHeader, quote_lots: u64) -> u64 {
    let quote_atoms_per_quote_lot: u64 = header.get_quote_lot_size().into();
    let quote_atoms_per_quote_unit = 10u64.pow(header.quote_params.decimals);
    quote_lots * quote_atoms_per_quote_lot * PRICE_PRECISION_U64 / quote_atoms_per_quote_unit
}
