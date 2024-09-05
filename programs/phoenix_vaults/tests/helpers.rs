use anchor_spl::associated_token::get_associated_token_address;
use anchor_spl::token::spl_token;
use anchor_spl::token::spl_token::solana_program::program_pack::Pack;
use anchor_spl::token::spl_token::state::Account as TokenAccount;
use anchor_spl::token::spl_token::state::Mint;
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_client::rpc_config::RpcSendTransactionConfig;
use solana_program::native_token::LAMPORTS_PER_SOL;
use solana_program::rent::Rent;
use solana_sdk::account::Account;
use solana_sdk::commitment_config::{CommitmentConfig, CommitmentLevel};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Signature;
use solana_sdk::signer::{keypair::Keypair, Signer};
use solana_sdk::transaction::Transaction;
use std::str::FromStr;

pub fn sol(amount: f64) -> u64 {
    (amount * LAMPORTS_PER_SOL as f64) as u64
}

pub fn usdc(amount: f64) -> u64 {
    (amount * 1_000_000_f64) as u64
}

pub async fn get_token_account(
    client: &RpcClient,
    token_account: &Pubkey,
) -> anyhow::Result<TokenAccount> {
    let account = client.get_account(token_account).await?;
    TokenAccount::unpack(&account.data)
        .map_err(|err| anyhow::anyhow!("Failed to unpack token account: {:?}", err))
}

pub async fn get_token_balance(client: &RpcClient, token_account: &Pubkey) -> u64 {
    get_token_account(client, token_account)
        .await
        .unwrap()
        .amount
}

pub async fn send_tx(
    client: &RpcClient,
    mut tx: Transaction,
    signers: &[&Keypair],
    confirm: Option<bool>
) -> anyhow::Result<Signature> {
    let blockhash = client
        .get_latest_blockhash_with_commitment(CommitmentConfig::confirmed())
        .await?
        .0;
    tx.partial_sign(&signers.to_vec(), blockhash);
    let sig = client
        .send_transaction_with_config(
            &tx,
            RpcSendTransactionConfig {
                skip_preflight: true,
                preflight_commitment: None,
                encoding: None,
                max_retries: None,
                min_context_slot: None,
            },
        )
        .await?;
    if confirm.unwrap_or(false) {
        client.confirm_transaction_with_spinner(
            &sig,
            &blockhash,
            CommitmentConfig::confirmed()
        ).await?;
    }
    Ok(sig)
}

pub async fn airdrop(
    client: &RpcClient,
    payer: &Keypair,
    receiver: &Pubkey,
    amount: u64,
) -> anyhow::Result<Signature> {
    let ixs = vec![solana_program::system_instruction::transfer(
        &payer.pubkey(),
        receiver,
        amount,
    )];
    let tx = Transaction::new_with_payer(&ixs, Some(&payer.pubkey()));
    send_tx(client, tx, &[payer], None).await
}

pub fn clone_keypair(keypair: &Keypair) -> Keypair {
    Keypair::from_bytes(&keypair.to_bytes()).unwrap()
}

pub fn clone_pubkey(pubkey: &Pubkey) -> Pubkey {
    Pubkey::from_str(&pubkey.to_string()).unwrap()
}

pub async fn get_account(client: &RpcClient, pubkey: &Pubkey) -> anyhow::Result<Account> {
    client
        .get_account(pubkey)
        .await
        .map_err(|err| anyhow::anyhow!("Failed to get account: {:?}", err))
}

pub async fn create_associated_token_account(
    client: &RpcClient,
    payer: &Keypair,
    token_mint: &Pubkey,
    token_program: &Pubkey,
) -> anyhow::Result<(Pubkey, Signature)> {
    let ixs = vec![
        spl_associated_token_account::instruction::create_associated_token_account(
            &payer.pubkey(),
            &payer.pubkey(),
            token_mint,
            token_program,
        ),
    ];
    let sig = send_tx(
        client,
        Transaction::new_with_payer(&ixs, None),
        &[payer],
        Some(true)
    )
    .await?;
    Ok((
        get_associated_token_address(&payer.pubkey(), token_mint),
        sig,
    ))
}

pub async fn create_mint(
    client: &RpcClient,
    payer: &Keypair,
    authority: &Pubkey,
    freeze_authority: Option<&Pubkey>,
    decimals: u8,
    mint: &Keypair,
) -> anyhow::Result<Signature> {
    let create_acct_ix = solana_program::system_instruction::create_account(
        &payer.pubkey(),
        &mint.pubkey(),
        Rent::default().minimum_balance(Mint::LEN),
        Mint::LEN as u64,
        &spl_token::id(),
    );
    let init_mint_ix = spl_token::instruction::initialize_mint(
        &spl_token::id(),
        &mint.pubkey(),
        authority,
        freeze_authority,
        decimals,
    )?;
    let ixs = vec![create_acct_ix, init_mint_ix];
    let sig = send_tx(
        client,
        Transaction::new_with_payer(&ixs, None),
        &[payer, mint],
        Some(true)
    )
    .await?;
    Ok(sig)
}

pub async fn mint_tokens(
    client: &RpcClient,
    payer: &Keypair,
    authority: &Keypair,
    mint: &Pubkey,
    account: &Pubkey,
    amount: u64,
    additional_signer: Option<&Keypair>,
) -> anyhow::Result<Signature> {
    let mut signing_keypairs = vec![&payer, authority];
    if let Some(signer) = additional_signer {
        signing_keypairs.push(signer);
    }

    let ix = spl_token::instruction::mint_to(
        &spl_token::id(),
        mint,
        account,
        &authority.pubkey(),
        &[],
        amount,
    )
    .unwrap();

    send_tx(
        client,
        Transaction::new_with_payer(&[ix], None),
        &signing_keypairs,
        Some(true)
    )
    .await
}