use helpers::*;
use phoenix::program::{load_with_dispatch, MarketHeader};
use phoenix::quantities::WrapperU64;
use sokoban::ZeroCopy;
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_program::pubkey;
use solana_program::pubkey::Pubkey;
use solana_sdk::commitment_config::CommitmentConfig;

mod helpers;

const MAINNET_USDC_MINT: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
// const MAINNET_SOL_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");
// const MAINNET_JUP_MINT: Pubkey = pubkey!("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
const MAINNET_SOL_USDC_MARKET: Pubkey = pubkey!("4DoNfFBfF7UokCC2FQzriy7yHK6DY6NVdYpuekQ5pRgg");
const MAINNET_JUP_SOL_MARKET: Pubkey = pubkey!("Ge1Vb599LquMJziLbLTF5aR4icq8MZQxpmgNywvdPqjL");
const MAINNET_JUP_USDC_MARKET: Pubkey = pubkey!("2pspvjWWaf3dNgt3jsgSzFCNvMGPb7t8FrEYvLGjvcCe");

struct MarketInfo {
    pub tick_price: u64,
    pub float_price: f64,
    pub price_precision: u64,
    pub synth_equity_precision: u64,
    pub real_float_equity: f64,
}

#[tokio::test]
async fn market_prices() -> anyhow::Result<()> {
    const RPC_URL: &str = "https://api.mainnet-beta.solana.com";
    // const RPC_URL: &str = "https://mainnet.helius-rpc.com/?api-key=0b810c4e-acb6-49a3-b2cd-90e671480ca8";

    let client = RpcClient::new_with_timeouts_and_commitment(
        RPC_URL.to_string(),
        std::time::Duration::from_secs(5),
        CommitmentConfig::processed(),
        std::time::Duration::from_secs(5),
    );

    let MarketInfo {
        float_price: sol_usdc_float_price,
        price_precision: sol_usdc_price_precision,
        synth_equity_precision: sol_usdc_synth_equity,
        real_float_equity: sol_usdc_real_equity,
        ..
    } = read_market(&client, &MAINNET_SOL_USDC_MARKET).await?;
    let MarketInfo {
        float_price: jup_sol_float_price,
        price_precision: jup_sol_price_precision,
        synth_equity_precision: jup_sol_synth_equity,
        real_float_equity: jup_sol_real_equity,
        ..
    } = read_market(&client, &MAINNET_JUP_SOL_MARKET).await?;
    let MarketInfo {
        float_price: jup_usdc_float_price,
        price_precision: jup_usdc_price_precision,
        synth_equity_precision: jup_usdc_synth_equity,
        real_float_equity: jup_usdc_real_equity,
        ..
    } = read_market(&client, &MAINNET_JUP_USDC_MARKET).await?;

    println!(
        "SOL/USDC synth equity: {}",
        sol_usdc_synth_equity as f64 / PRICE_PRECISION_U64 as f64
    );
    println!("SOL/USDC real equity: {}", sol_usdc_real_equity);

    println!(
        "JUP/SOL synth equity: {}",
        jup_sol_synth_equity as f64 / PRICE_PRECISION_U64 as f64
    );
    println!("JUP/SOL real equity: {}", jup_sol_real_equity);

    println!(
        "JUP/USDC synth equity: {}",
        jup_usdc_synth_equity as f64 / PRICE_PRECISION_U64 as f64
    );
    println!("JUP/USDC real equity: {}", jup_usdc_real_equity);

    // println!("SOL/USDC, actual: {}, derived: {}", trunc!(sol_usdc_float_price, 6), trunc!(sol_usdc_price_precision as f64 / 1_000_000.0, 6));
    // println!("JUP/SOL, actual: {}, derived: {}", trunc!(jup_sol_float_price, 6), trunc!(jup_sol_price_precision as f64 / 1_000_000.0, 6));
    // println!("JUP/USDC, actual: {}, derived: {}", trunc!(jup_usdc_float_price, 6), trunc!(jup_usdc_price_precision as f64 / 1_000_000.0, 6));
    // println!("JUP/USDC synth: {}", sol_to_usdc_denom(jup_sol_price_precision, sol_usdc_price_precision) as f64 / 1_000_000.0);
    // println!("JUP/USDC real: {}", jup_usdc_price_precision as f64 / 1_000_000.0);

    Ok(())
}

async fn read_market<'a>(client: &'a RpcClient, market: &'a Pubkey) -> anyhow::Result<MarketInfo> {
    let account = get_account(client, market).await?;
    let (header_bytes, bytes) = account.data.split_at(std::mem::size_of::<MarketHeader>());
    let header = Box::new(
        MarketHeader::load_bytes(header_bytes).ok_or(anyhow::anyhow!(
            "Failed to deserialize market: {:?}",
            market
        ))?,
    );
    let wrapper = load_with_dispatch(&header.market_size_params, bytes)?;
    let ladder = wrapper.inner.get_ladder(1);
    let tick_price = match ladder.bids.first() {
        Some(bid) => Ok(bid.price_in_ticks),
        None => Err(anyhow::anyhow!("No bids found in ladder")),
    }?;

    let mut price_precision = ticks_to_price_precision(&header, tick_price);

    if header.quote_params.mint_key != MAINNET_USDC_MINT {
        let fake_sol_price: f64 = 124.7 * 1_000_000.0;
        price_precision = sol_to_usdc_denom(price_precision, fake_sol_price.round() as u64);
        // return Ok(MarketInfo {
        //     tick_price,
        //     float_price: ticks_to_float_price(&header, tick_price),
        //     price_precision,
        //     synth_equity_precision: 0,
        //     real_float_equity: 0.0
        // });
    }

    let traders = wrapper.inner.get_registered_traders();
    let (_, trader_state) = traders
        .iter()
        .nth(5)
        .ok_or(anyhow::anyhow!("No traders found in market: {:?}", market))?;

    let base_lots = trader_state.base_lots_locked.as_u64() + trader_state.base_lots_free.as_u64();
    let quote_lots =
        trader_state.quote_lots_locked.as_u64() + trader_state.quote_lots_free.as_u64();

    let base_units_precision = base_lots_to_raw_base_units_precision(&header, base_lots);
    let _base_units = base_units_precision as f64 / PRICE_PRECISION_U64 as f64;
    println!("base units: {}", _base_units);
    let _price = price_precision as f64 / PRICE_PRECISION_U64 as f64;
    println!("price: ${}", _price);
    let _base_quote_units = _base_units * _price;
    println!("base as quote: {}", _base_quote_units);
    // both are multiplied by PRICE_PRECISION so multiply by one to make it multiplied once in total.
    let base_quote_units_precision = base_units_precision * price_precision / PRICE_PRECISION_U64;
    let quote_units_precision = quote_lots_to_quote_units_precision(&header, quote_lots);
    let _quote_units = quote_units_precision as f64 / PRICE_PRECISION_U64 as f64;
    println!("quote: {}", _quote_units);
    let total_quote_units_precision = base_quote_units_precision + quote_units_precision;
    println!(
        "equity: {}",
        total_quote_units_precision as f64 / PRICE_PRECISION_U64 as f64
    );

    // todo: remove after debug
    let trader_base_quote_units =
        _base_lots_to_quote_units_as_float(&header, base_lots, tick_price);
    let trader_quote_units = _quote_lots_to_quote_units_as_float(&header, quote_lots);
    let total_quote_units = trader_base_quote_units + trader_quote_units;

    Ok(MarketInfo {
        tick_price,
        float_price: ticks_to_float_price(&header, tick_price),
        price_precision,
        synth_equity_precision: total_quote_units_precision,
        real_float_equity: total_quote_units,
    })
}

const PRICE_PRECISION_U64: u64 = 1_000_000;

fn ticks_to_price_precision(header: &MarketHeader, price_in_ticks: u64) -> u64 {
    let raw_base_units_per_base_unit = header.raw_base_units_per_base_unit.max(1);
    // 10^6 for USDC, 10^9 for SOL
    let quote_atoms_per_quote_unit = 10u64.pow(header.quote_params.decimals);
    let tick_size_in_quote_atoms_per_base_unit: u64 =
        header.get_tick_size_in_quote_atoms_per_base_unit().into();
    price_in_ticks * tick_size_in_quote_atoms_per_base_unit * PRICE_PRECISION_U64
        / (quote_atoms_per_quote_unit * raw_base_units_per_base_unit as u64)
}

fn ticks_to_float_price(header: &MarketHeader, price_in_ticks: u64) -> f64 {
    let raw_base_units_per_base_unit = header.raw_base_units_per_base_unit.max(1);
    // 10^6 for USDC, 10^9 for SOL
    let quote_atoms_per_quote_unit = 10u64.pow(header.quote_params.decimals);
    let tick_size_in_quote_atoms_per_base_unit: u64 =
        header.get_tick_size_in_quote_atoms_per_base_unit().into();
    (price_in_ticks as f64 * tick_size_in_quote_atoms_per_base_unit as f64)
        / (quote_atoms_per_quote_unit as f64 * raw_base_units_per_base_unit as f64)
}

/// Both base and sol price are already in f64 * PRICE_PRECISION format.
fn sol_to_usdc_denom(base_price: u64, sol_price: u64) -> u64 {
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

// todo: remove after debug
pub fn _base_lots_and_tick_price_to_quote_atoms(
    header: &MarketHeader,
    base_lots: u64,
    price_in_ticks: u64,
) -> u64 {
    let base_atoms_per_base_lot: u64 = header.get_base_lot_size().into();
    let base_atoms_per_raw_base_unit = 10u64.pow(header.base_params.decimals);
    let raw_base_units_per_base_unit = header.raw_base_units_per_base_unit.max(1);
    let num_base_lots_per_base_unit: u64 = (base_atoms_per_raw_base_unit
        * raw_base_units_per_base_unit as u64)
        / base_atoms_per_base_lot;

    let tick_size_in_quote_atoms_per_base_unit: u64 =
        header.get_tick_size_in_quote_atoms_per_base_unit().into();
    base_lots * price_in_ticks * tick_size_in_quote_atoms_per_base_unit
        / num_base_lots_per_base_unit
}

/// Given a number of quote atoms, returns the equivalent number of quote units.
pub fn _quote_atoms_to_quote_units_as_float(header: &MarketHeader, quote_atoms: u64) -> f64 {
    let quote_atoms_per_quote_unit = 10u64.pow(header.quote_params.decimals);
    quote_atoms as f64 / quote_atoms_per_quote_unit as f64
}

fn _base_lots_to_quote_units_as_float(
    header: &MarketHeader,
    base_lots: u64,
    price_in_ticks: u64,
) -> f64 {
    let base_quote_atoms =
        _base_lots_and_tick_price_to_quote_atoms(header, base_lots, price_in_ticks);
    _quote_atoms_to_quote_units_as_float(header, base_quote_atoms)
}

fn _quote_lots_to_quote_units_as_float(header: &MarketHeader, quote_lots: u64) -> f64 {
    let quote_atoms_per_quote_lot: u64 = header.get_quote_lot_size().into();
    let quote_atoms_per_quote_unit = 10u64.pow(header.quote_params.decimals);
    let quote_atoms = quote_lots * quote_atoms_per_quote_lot;
    quote_atoms as f64 / quote_atoms_per_quote_unit as f64
}
