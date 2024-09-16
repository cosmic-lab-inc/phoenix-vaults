use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use phoenix::program::deposit::DepositParams;
use solana_program::program::invoke_signed;

use crate::constraints::{
    is_delegate_for_vault, is_sol_mint, is_usdc_mint, is_usdc_token_for_vault,
};
use crate::cpis::PhoenixWithdrawCPI;
use crate::declare_vault_seeds;
use crate::state::{MarketTransferParams, PhoenixProgram, Vault};

pub fn market_withdraw<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, MarketWithdraw<'info>>,
    params: MarketTransferParams,
) -> Result<()> {
    ctx.phoenix_withdraw(params)?;

    Ok(())
}

#[derive(Accounts)]
pub struct MarketWithdraw<'info> {
    /// If delegate has authority to sign for vault, then any Phoenix CPI is valid.
    /// Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],
    /// so this is safe since any Phoenix CPI is secure.
    #[account(
        constraint = is_delegate_for_vault(&vault, &delegate)?
    )]
    pub vault: AccountLoader<'info, Vault>,
    /// Is manager by default, but can be delegated to another pubkey using `update_delegate`
    pub delegate: Signer<'info>,

    //
    // Phoenix CPI accounts
    //
    pub phoenix: Program<'info, PhoenixProgram>,
    /// CHECK: validated in Phoenix CPI
    pub log_authority: UncheckedAccount<'info>,
    /// CHECK: validated in Phoenix CPI
    #[account(mut)]
    pub market: UncheckedAccount<'info>,

    pub base_mint: Account<'info, Mint>,
    #[account(
        constraint = is_usdc_mint(&vault, &quote_mint.key())? || is_sol_mint(&vault, &quote_mint.key())?,
    )]
    pub quote_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint = base_mint
    )]
    pub vault_base_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = is_usdc_token_for_vault(&vault, &vault_quote_token_account)?,
        token::mint = quote_mint
    )]
    pub vault_quote_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = base_mint
    )]
    pub market_base_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = is_usdc_mint(&vault, &market_quote_token_account.mint)? || is_sol_mint(&vault, &market_quote_token_account.mint)?,
        token::mint = quote_mint
    )]
    pub market_quote_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> PhoenixWithdrawCPI for Context<'_, '_, '_, 'info, MarketWithdraw<'info>> {
    fn phoenix_withdraw(&self, params: MarketTransferParams) -> Result<()> {
        let trader_index = 3;
        let mut ix = phoenix::program::instruction_builders::create_withdraw_funds_with_custom_amounts_instruction(
            &self.accounts.market.key(),
            &self.accounts.vault.key(),
            &self.accounts.base_mint.key(),
            &self.accounts.quote_mint.key(),
            params.base_lots,
            params.quote_lots
        );
        ix.accounts[trader_index].is_signer = true;

        // #[account(0, name = "phoenix_program", desc = "Phoenix program")]
        // #[account(1, name = "log_authority", desc = "Phoenix log authority")]
        // #[account(2, writable, name = "market", desc = "This account holds the market state")]
        // #[account(3, signer, name = "trader")]
        // #[account(4, writable, name = "base_account", desc = "Trader base token account")]
        // #[account(5, writable, name = "quote_account", desc = "Trader quote token account")]
        // #[account(6, writable, name = "base_vault", desc = "Base vault PDA, seeds are [b'vault', market_address, base_mint_address]")]
        // #[account(7, writable, name = "quote_vault", desc = "Quote vault PDA, seeds are [b'vault', market_address, quote_mint_address]")]
        // #[account(8, name = "token_program", desc = "Token program")]
        let accounts = [
            self.accounts.phoenix.to_account_info(),
            self.accounts.log_authority.to_account_info(),
            self.accounts.market.to_account_info(),
            self.accounts.vault.to_account_info(),
            self.accounts.vault_base_token_account.to_account_info(),
            self.accounts.vault_quote_token_account.to_account_info(),
            self.accounts.market_base_token_account.to_account_info(),
            self.accounts.market_quote_token_account.to_account_info(),
            self.accounts.token_program.to_account_info(),
        ];
        declare_vault_seeds!(self.accounts.vault, seeds);
        invoke_signed(&ix, &accounts, seeds)?;

        Ok(())
    }
}
