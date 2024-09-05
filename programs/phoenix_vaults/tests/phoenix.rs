use phoenix::quantities::WrapperU64;
use sokoban::ZeroCopy;

use phoenix::program::status::{MarketStatus, SeatApprovalStatus};
use phoenix::program::*;
use phoenix::state::*;
use solana_client::nonblocking::rpc_client::RpcClient;

use solana_program::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::Signer;
use solana_sdk::transaction::Transaction;

pub mod helpers;
use crate::helpers::*;

const BOOK_SIZE: usize = 4096;
const NUM_SEATS: usize = 8193;

const MARKET_AUTHORITY: Keypair = Keypair::from_bytes(&[
    51,85,204,221,166,99,229,39,196,242,180,231,122,9,62,131,140,27,117,23,
    93,155,55,105,52,10,90,241,145,11,140,46,53,175,223,204,97,194,133,147,230,208, 
    127,22,253,59,
    155,99,120,103,216,164,114,107,104,142,128,14,3,209,80,200,208,80
]).unwrap();


async fn bootstrap_market_default(fees_bps: u16) -> anyhow::Result<()> {
    bootstrap_market(
        100_000, 
        1_000, 
        1_000, 
        9, 
        6, 
        fees_bps,
        None
    ).await
}

async fn bootstrap_market(
    num_quote_lots_per_quote_unit: u64,
    num_base_lots_per_base_unit: u64,
    tick_size_in_quote_lots_per_base_unit: u64,
    base_decimals: u8,
    quote_decimals: u8,
    fee_bps: u16,
    raw_base_units_per_base_unit: Option<u32>,
) -> anyhow::Result<()> {
    let client = RpcClient::new("http://localhost:8899".to_string());
    let payer = MARKET_AUTHORITY;
    let authority = MARKET_AUTHORITY;
    client.request_airdrop(&authority.pubkey(), sol(10.0)).await?;
    let market = Keypair::new();
    let params = MarketSizeParams {
        bids_size: BOOK_SIZE as u64,
        asks_size: BOOK_SIZE as u64,
        num_seats: NUM_SEATS as u64,
    };

    // create base and quote token mints
    let base_mint = Keypair::new();
    create_mint(
        &client,
        &payer,
        &authority.pubkey(),
        None,
        base_decimals,
        Some(clone_keypair(&base_mint)),
    )
        .await?;

    let quote_mint = Keypair::new();
    create_mint(
        &client,
        &payer,
        &authority.pubkey(),
        None,
        quote_decimals,
        Some(clone_keypair(&quote_mint)),
    )
        .await?;

    create_associated_token_account(
        &client,
        &payer,
        &quote_mint.pubkey(),
        &spl_token::id(),
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
        &vec![&market]
    ).await?;
    Ok(())
}