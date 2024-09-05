use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use crate::state::{Investor, Vault};

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

pub fn is_mint_for_vault(vault: &AccountLoader<Vault>, mint: &Account<Mint>) -> Result<bool> {
    Ok(vault.load()?.mint.eq(&mint.key()))
}

pub fn is_token_for_vault(
    vault: &AccountLoader<Vault>,
    token: &Account<TokenAccount>,
) -> Result<bool> {
    let vault_ref = vault.load()?;
    Ok(vault_ref.token_account.eq(&token.key()) && vault_ref.mint.eq(&token.mint))
}
