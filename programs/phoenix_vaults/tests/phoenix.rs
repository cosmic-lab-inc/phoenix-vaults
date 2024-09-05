use phoenix::program::status::MarketStatus;
use phoenix::program::*;
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::Signer;
use solana_sdk::transaction::Transaction;

pub mod helpers;
use crate::helpers::*;

const BOOK_SIZE: usize = 4096;
const NUM_SEATS: usize = 8193;

const MOCK_MARKET_AUTHORITY_KEYPAIR: [u8; 64] = [
    51, 85, 204, 221, 166, 99, 229, 39, 196, 242, 180, 231, 122, 9, 62, 131, 140, 27, 117, 23, 93,
    155, 55, 105, 52, 10, 90, 241, 145, 11, 140, 46, 53, 175, 223, 204, 97, 194, 133, 147, 230,
    208, 127, 22, 253, 59, 155, 99, 120, 103, 216, 164, 114, 107, 104, 142, 128, 14, 3, 209, 80,
    200, 208, 80,
];

const MOCK_USDC_MINT: [u8; 64] = [
    7, 195, 209, 165, 147, 124, 219, 244, 18, 184, 6, 123, 255, 168, 93, 207, 142, 219, 230, 140,
    66, 109, 233, 111, 220, 234, 137, 35, 234, 195, 48, 31, 119, 40, 86, 47, 63, 3, 25, 13, 2, 30,
    182, 198, 119, 230, 94, 90, 90, 155, 32, 183, 120, 247, 19, 243, 83, 246, 212, 233, 178, 151,
    121, 161,
];

const MOCK_SOL_MINT: [u8; 64] = [
    5, 115, 129, 253, 239, 188, 34, 72, 142, 147, 21, 152, 94, 100, 191, 206, 26, 129, 167, 50,
    201, 216, 101, 81, 145, 34, 176, 222, 158, 149, 230, 9, 171, 215, 53, 230, 38, 137, 41, 143,
    238, 69, 176, 245, 195, 239, 161, 157, 215, 72, 0, 40, 202, 156, 21, 36, 111, 246, 221, 154,
    168, 106, 235, 122,
];

const MOCK_JUP_MINT: [u8; 64] = [
    239, 37, 196, 242, 130, 217, 89, 30, 157, 246, 22, 44, 213, 30, 154, 9, 107, 91, 87, 56, 32,
    44, 132, 214, 205, 160, 235, 21, 193, 82, 156, 27, 0, 52, 31, 170, 133, 18, 164, 125, 228, 81,
    137, 2, 18, 235, 65, 106, 203, 192, 88, 222, 174, 198, 7, 131, 115, 181, 13, 17, 236, 173, 207,
    77,
];

async fn bootstrap_market_default(
    payer: &Keypair,
    authority: &Keypair,
    quote_mint: &Keypair,
    base_mint: &Keypair,
    fees_bps: u16,
) -> anyhow::Result<()> {
    bootstrap_market(
        payer, authority, quote_mint, base_mint, 100_000, 1_000, 1_000, 9, 6, fees_bps, None,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn bootstrap_market(
    payer: &Keypair,
    authority: &Keypair,
    quote_mint: &Keypair,
    base_mint: &Keypair,
    num_quote_lots_per_quote_unit: u64,
    num_base_lots_per_base_unit: u64,
    tick_size_in_quote_lots_per_base_unit: u64,
    base_decimals: u8,
    quote_decimals: u8,
    fee_bps: u16,
    raw_base_units_per_base_unit: Option<u32>,
) -> anyhow::Result<()> {
    let client = RpcClient::new("http://localhost:8899".to_string());
    client
        .request_airdrop(&authority.pubkey(), sol(10.0))
        .await?;
    let market = Keypair::new();
    let params = MarketSizeParams {
        bids_size: BOOK_SIZE as u64,
        asks_size: BOOK_SIZE as u64,
        num_seats: NUM_SEATS as u64,
    };

    // create base and quote token mints
    create_mint(
        &client,
        payer,
        &authority.pubkey(),
        None,
        base_decimals,
        Some(clone_keypair(base_mint)),
    )
    .await?;

    create_mint(
        &client,
        payer,
        &authority.pubkey(),
        None,
        quote_decimals,
        Some(clone_keypair(quote_mint)),
    )
    .await?;

    create_associated_token_account(
        &client,
        payer,
        &quote_mint.pubkey(),
        &anchor_spl::token::spl_token::id(),
    )
    .await?;

    let mut init_instructions = vec![];

    init_instructions.extend_from_slice(
        &create_initialize_market_instructions_default(
            &market.pubkey(),
            &base_mint.pubkey(),
            &quote_mint.pubkey(),
            &payer.pubkey(),
            params,
            num_quote_lots_per_quote_unit,
            num_base_lots_per_base_unit,
            tick_size_in_quote_lots_per_base_unit,
            fee_bps,
            raw_base_units_per_base_unit,
        )
        .unwrap(),
    );
    init_instructions.push(create_change_market_status_instruction(
        &payer.pubkey(),
        &market.pubkey(),
        MarketStatus::Active,
    ));

    send_tx(
        &client,
        Transaction::new_with_payer(&init_instructions, Some(&payer.pubkey())),
        &[&market],
    )
    .await?;
    Ok(())
}

#[tokio::test]
async fn bootstrap_sol_usdc_market() -> anyhow::Result<()> {
    let payer = Keypair::from_bytes(&MOCK_MARKET_AUTHORITY_KEYPAIR).unwrap();
    let authority = Keypair::from_bytes(&MOCK_MARKET_AUTHORITY_KEYPAIR).unwrap();
    let usdc_mint = Keypair::from_bytes(&MOCK_USDC_MINT).unwrap();
    let sol_mint = Keypair::from_bytes(&MOCK_SOL_MINT).unwrap();
    let jup_mint = Keypair::from_bytes(&MOCK_JUP_MINT).unwrap();

    // SOL/USDC market
    bootstrap_market_default(&payer, &authority, &usdc_mint, &sol_mint, 1).await?;

    // JUP/SOL market
    bootstrap_market_default(&payer, &authority, &sol_mint, &jup_mint, 1).await?;

    // JUP/USDC market
    bootstrap_market_default(&payer, &authority, &usdc_mint, &jup_mint, 1).await?;

    Ok(())
}
