use phoenix::program::status::MarketStatus;
use phoenix::program::*;
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::signature::{Keypair, Signature};
use solana_sdk::signer::Signer;
use solana_sdk::transaction::Transaction;
use tokio::time::sleep;

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
const MOCK_USDC_DECIMALS: u8 = 6;

const MOCK_SOL_MINT: [u8; 64] = [
    5, 115, 129, 253, 239, 188, 34, 72, 142, 147, 21, 152, 94, 100, 191, 206, 26, 129, 167, 50,
    201, 216, 101, 81, 145, 34, 176, 222, 158, 149, 230, 9, 171, 215, 53, 230, 38, 137, 41, 143,
    238, 69, 176, 245, 195, 239, 161, 157, 215, 72, 0, 40, 202, 156, 21, 36, 111, 246, 221, 154,
    168, 106, 235, 122,
];
const MOCK_SOL_DECIMALS: u8 = 9;

const MOCK_JUP_MINT: [u8; 64] = [
    239, 37, 196, 242, 130, 217, 89, 30, 157, 246, 22, 44, 213, 30, 154, 9, 107, 91, 87, 56, 32,
    44, 132, 214, 205, 160, 235, 21, 193, 82, 156, 27, 0, 52, 31, 170, 133, 18, 164, 125, 228, 81,
    137, 2, 18, 235, 65, 106, 203, 192, 88, 222, 174, 198, 7, 131, 115, 181, 13, 17, 236, 173, 207,
    77,
];
const MOCK_JUP_DECIMALS: u8 = 9;

const MOCK_SOL_USDC_MARKET: [u8; 64] = [
    93, 15, 240, 33, 150, 60, 211, 167, 231, 22, 41, 204, 200, 97, 206, 142, 26, 4, 165, 42, 10,
    250, 122, 223, 206, 1, 229, 158, 165, 59, 223, 236, 43, 187, 177, 182, 105, 104, 42, 76, 105,
    0, 63, 206, 168, 171, 153, 177, 92, 111, 205, 70, 213, 77, 79, 158, 212, 90, 50, 22, 37, 161,
    233, 161,
];

const MOCK_JUP_SOL_MARKET: [u8; 64] = [
    15, 151, 240, 120, 77, 168, 237, 143, 234, 212, 68, 61, 31, 86, 52, 247, 1, 94, 88, 16, 218,
    194, 238, 146, 159, 57, 164, 139, 27, 8, 199, 208, 149, 224, 247, 248, 83, 62, 63, 218, 7, 175,
    97, 67, 149, 214, 103, 186, 179, 0, 75, 42, 193, 199, 229, 89, 59, 238, 67, 228, 155, 206, 166,
    232,
];

const MOCK_JUP_USDC_MARKET: [u8; 64] = [
    136, 1, 116, 112, 92, 96, 18, 218, 159, 171, 129, 153, 142, 137, 45, 170, 71, 12, 207, 146, 4,
    42, 43, 220, 224, 11, 240, 249, 154, 169, 93, 114, 97, 155, 77, 41, 195, 245, 43, 240, 189,
    119, 112, 171, 181, 73, 151, 234, 158, 154, 244, 252, 42, 218, 124, 117, 43, 55, 204, 36, 167,
    160, 42, 233,
];

#[allow(clippy::too_many_arguments)]
async fn bootstrap_market_default(
    payer: &Keypair,
    authority: &Keypair,
    market: &Keypair,
    quote_mint: &Keypair,
    quote_decimals: u8,
    base_mint: &Keypair,
    base_decimals: u8,
    fees_bps: u16,
) -> anyhow::Result<Signature> {
    bootstrap_market(
        payer,
        authority, 
        market, 
        quote_mint, 
        base_mint, 
        100_000, 
        1_000, 
        1_000, 
        base_decimals, 
        quote_decimals, 
        fees_bps,
        None,
    )
    .await
}

#[allow(clippy::too_many_arguments)]
async fn bootstrap_market(
    payer: &Keypair,
    authority: &Keypair,
    market: &Keypair,
    quote_mint: &Keypair,
    base_mint: &Keypair,
    num_quote_lots_per_quote_unit: u64,
    num_base_lots_per_base_unit: u64,
    tick_size_in_quote_lots_per_base_unit: u64,
    base_decimals: u8,
    quote_decimals: u8,
    fee_bps: u16,
    raw_base_units_per_base_unit: Option<u32>,
) -> anyhow::Result<Signature> {
    let client = RpcClient::new("http://localhost:8899".to_string());
    client
        .request_airdrop(&payer.pubkey(), sol(100.0))
        .await?;
    client
        .request_airdrop(&authority.pubkey(), sol(100.0))
        .await?;
    let params = MarketSizeParams {
        bids_size: BOOK_SIZE as u64,
        asks_size: BOOK_SIZE as u64,
        num_seats: NUM_SEATS as u64,
    };

    // create base and quote token mints
    let create_base_mint_sig = create_mint(
        &client,
        payer,
        &authority.pubkey(),
        None,
        base_decimals,
        base_mint,
    )
    .await?;
    println!("create_base_mint_sig: {:?}", create_base_mint_sig);

    let create_quote_mint_sig = create_mint(
        &client,
        payer,
        &authority.pubkey(),
        None,
        quote_decimals,
        quote_mint,
    )
    .await?;
    println!("create_quote_mint_sig: {:?}", create_quote_mint_sig);
    
    sleep(
        std::time::Duration::from_secs(2)
    ).await;
    let mint_acct = client.get_account_with_commitment(
        &quote_mint.pubkey(),
        CommitmentConfig::processed()
    ).await?.value.unwrap();
    println!("quote mint exists? {:?}", mint_acct.owner == anchor_spl::token::spl_token::id());
    let (_, create_quote_ata_sig) = create_associated_token_account(
        &client,
        payer,
        &quote_mint.pubkey(),
        &anchor_spl::token::spl_token::id(),
    )
    .await?;
    println!("create_quote_ata_sig: {:?}", create_quote_ata_sig);

    let mut init_instructions = vec![];

    init_instructions.extend(
        create_initialize_market_instructions_default(
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

    let sig = send_tx(
        &client,
        Transaction::new_with_payer(&init_instructions, Some(&payer.pubkey())),
        &[&payer, &market],
        Some(true)
    )
    .await?;
    Ok(sig)
}

#[tokio::test]
async fn bootstrap_markets() -> anyhow::Result<()> {
    let payer = Keypair::from_bytes(&MOCK_MARKET_AUTHORITY_KEYPAIR).unwrap();
    let authority = Keypair::from_bytes(&MOCK_MARKET_AUTHORITY_KEYPAIR).unwrap();
    let usdc_mint = Keypair::from_bytes(&MOCK_USDC_MINT).unwrap();
    let sol_mint = Keypair::from_bytes(&MOCK_SOL_MINT).unwrap();
    let jup_mint = Keypair::from_bytes(&MOCK_JUP_MINT).unwrap();
    let sol_usdc_market = Keypair::from_bytes(&MOCK_SOL_USDC_MARKET).unwrap();
    let jup_sol_market = Keypair::from_bytes(&MOCK_JUP_SOL_MARKET).unwrap();
    let jup_usdc_market = Keypair::from_bytes(&MOCK_JUP_USDC_MARKET).unwrap();

    // SOL/USDC market
    let sol_usdc_sig = bootstrap_market_default(
        &payer,
        &authority,
        &sol_usdc_market,
        &usdc_mint,
        MOCK_USDC_DECIMALS,
        &sol_mint,
        MOCK_SOL_DECIMALS,
        1,
    )
    .await?;
    println!("sol usdc: {:?}", sol_usdc_sig);

    // // JUP/SOL market
    // let jup_sol_sig =
    //     bootstrap_market_default(
    //         &payer, 
    //         &authority, 
    //         &jup_sol_market, 
    //         &sol_mint,
    //         MOCK_SOL_DECIMALS,
    //         &jup_mint,
    //         MOCK_JUP_DECIMALS,
    //         1
    //     ).await?;
    // println!("jup sol: {:?}", jup_sol_sig);
    // 
    // // JUP/USDC market
    // let jup_usdc_sig = bootstrap_market_default(
    //     &payer,
    //     &authority,
    //     &jup_usdc_market,
    //     &usdc_mint,
    //     MOCK_USDC_DECIMALS,
    //     &jup_mint,
    //     MOCK_JUP_DECIMALS,
    //     1,
    // )
    // .await?;
    // println!("jup usdc: {:?}", jup_usdc_sig);

    Ok(())
}
