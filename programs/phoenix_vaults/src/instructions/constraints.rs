use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::state::{Investor, MarketRegistry, Vault};

pub fn is_vault_for_investor(
    investor: &AccountLoader<Investor>,
    vault: &AccountLoader<Vault>,
) -> Result<bool> {
    Ok(investor.load()?.vault.eq(&vault.key()))
}

pub fn is_authority_for_investor(
    investor: &AccountLoader<Investor>,
    signer: &Signer,
) -> Result<bool> {
    Ok(investor.load()?.authority.eq(signer.key))
}

pub fn is_manager_for_vault(vault: &AccountLoader<Vault>, signer: &Signer) -> Result<bool> {
    Ok(vault.load()?.manager.eq(signer.key))
}

pub fn is_delegate_for_vault(vault: &AccountLoader<Vault>, signer: &Signer) -> Result<bool> {
    Ok(vault.load()?.delegate.eq(signer.key))
}

pub fn is_protocol_for_vault(vault: &AccountLoader<Vault>, protocol: &Signer) -> Result<bool> {
    Ok(vault.load()?.protocol.eq(protocol.key))
}

pub fn is_sol_usdc_market(
    market: &UncheckedAccount,
    registry: &AccountLoader<MarketRegistry>,
) -> Result<bool> {
    Ok(registry.load()?.sol_usdc_market.eq(market.key))
}

pub fn is_usdc_token_for_vault(
    vault: &AccountLoader<Vault>,
    token: &Account<TokenAccount>,
) -> Result<bool> {
    let vault_ref = vault.load()?;
    let owner = token.owner.eq(&vault.key());
    let mint_is_usdc = vault_ref.usdc_mint.eq(&token.mint);
    Ok(owner && mint_is_usdc && vault_ref.usdc_token_account.eq(&token.key()))
}

pub fn is_sol_token_for_vault(
    vault: &AccountLoader<Vault>,
    token: &Account<TokenAccount>,
) -> Result<bool> {
    let vault_ref = vault.load()?;
    let owner = token.owner.eq(&vault.key());
    let mint_is_sol = vault_ref.sol_mint.eq(&token.mint);
    Ok(owner && mint_is_sol && vault_ref.sol_token_account.eq(&token.key()))
}

pub fn is_vault_token(vault: &AccountLoader<Vault>, token: &Account<TokenAccount>) -> Result<bool> {
    let is_usdc = is_usdc_token_for_vault(vault, token)?;
    let is_sol = is_sol_token_for_vault(vault, token)?;
    Ok(is_usdc || is_sol)
}

pub fn is_usdc_mint(vault: &AccountLoader<Vault>, mint: &Pubkey) -> Result<bool> {
    Ok(vault.load()?.usdc_mint.eq(mint))
}

pub fn is_sol_mint(vault: &AccountLoader<Vault>, mint: &Pubkey) -> Result<bool> {
    Ok(vault.load()?.sol_mint.eq(mint))
}

pub fn is_vault_mint(vault: &AccountLoader<Vault>, mint: &Pubkey) -> Result<bool> {
    let is_usdc_mint = is_usdc_mint(vault, mint)?;
    let is_sol_mint = is_sol_mint(vault, mint)?;
    Ok(is_usdc_mint || is_sol_mint)
}

pub fn is_liquidator_for_vault(vault: &AccountLoader<Vault>, authority: &Signer) -> Result<bool> {
    Ok(vault.load()?.liquidator.eq(authority.key))
}
