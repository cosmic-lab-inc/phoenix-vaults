use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Transfer};
use anchor_spl::token::{Token, TokenAccount};
use solana_program::program::invoke_signed;

use crate::constraints::*;
use crate::cpis::{PhoenixWithdrawCPI, TokenTransferCPI};
use crate::declare_vault_seeds;
use crate::math::quote_atoms_to_quote_lots_rounded_down;
use crate::state::{
    Investor, MarketLookupTable, MarketMapProvider, MarketRegistry, MarketTransferParams,
    PhoenixProgram, Vault,
};

pub fn investor_withdraw<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InvestorWithdraw<'info>>,
) -> Result<()> {
    let clock = &Clock::get()?;
    let vault_key = ctx.accounts.vault.key();
    let mut vault = ctx.accounts.vault.load_mut()?;
    let mut investor = ctx.accounts.investor.load_mut()?;

    let registry = ctx.accounts.market_registry.load_mut()?;

    let lut_acct_info = ctx.accounts.lut.to_account_info();
    let lut_data = lut_acct_info.data.borrow();
    let lut = MarketRegistry::deserialize_lookup_table(registry.lut_auth, lut_data.as_ref())?;
    let market_lut = MarketLookupTable {
        lut_key: ctx.accounts.lut.key(),
        lut: &lut,
    };
    let vault_equity = ctx.equity(&vault_key, &registry, market_lut)?;

    let investor_withdraw_amount =
        investor.withdraw(vault_equity, &mut vault, clock.unix_timestamp)?;

    msg!("investor_withdraw_amount: {}", investor_withdraw_amount);

    drop(vault);

    let (_, _, sol_usdc_header) = ctx.load_sol_usdc_market(&registry, &lut)?;
    let quote_lots =
        quote_atoms_to_quote_lots_rounded_down(&sol_usdc_header, investor_withdraw_amount);
    ctx.phoenix_withdraw(MarketTransferParams {
        quote_lots,
        base_lots: 0,
    })?;

    ctx.token_transfer(investor_withdraw_amount)?;

    Ok(())
}

#[derive(Accounts)]
pub struct InvestorWithdraw<'info> {
    #[account(mut)]
    pub vault: AccountLoader<'info, Vault>,

    #[account(
        mut,
        seeds = [b"investor", vault.key().as_ref(), authority.key().as_ref()],
        bump,
        constraint = is_authority_for_investor(&investor, &authority)?
    )]
    pub investor: AccountLoader<'info, Investor>,
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market_registry"],
        bump,
        constraint = is_lut_for_registry(&market_registry, &lut)?
    )]
    pub market_registry: AccountLoader<'info, MarketRegistry>,
    /// CHECK: Deserialized into [`AddressLookupTable`] within instruction
    pub lut: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = is_usdc_mint(&vault, &investor_quote_token_account.mint)?,
        token::authority = authority,
    )]
    pub investor_quote_token_account: Box<Account<'info, TokenAccount>>,

    //
    // Phoenix CPI accounts
    //
    pub phoenix: Program<'info, PhoenixProgram>,
    /// CHECK: validated in Phoenix CPI
    pub log_authority: UncheckedAccount<'info>,
    /// CHECK: validated in Phoenix CPI
    #[account(mut)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: validated in Phoenix CPI
    pub seat: UncheckedAccount<'info>,

    #[account(
        constraint = is_sol_mint(&vault, &base_mint.key())?
    )]
    pub base_mint: Account<'info, Mint>,
    #[account(
        constraint = is_usdc_mint(&vault, &quote_mint.key())?
    )]
    pub quote_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = is_sol_token_for_vault(&vault, &vault_base_token_account)?,
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
        constraint = is_sol_mint(&vault, &market_base_token_account.mint)?,
        token::mint = base_mint
    )]
    pub market_base_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = is_usdc_mint(&vault, &market_quote_token_account.mint)?,
        token::mint = quote_mint
    )]
    pub market_quote_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

impl<'info> PhoenixWithdrawCPI for Context<'_, '_, '_, 'info, InvestorWithdraw<'info>> {
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

impl<'info> TokenTransferCPI for Context<'_, '_, '_, 'info, InvestorWithdraw<'info>> {
    fn token_transfer(&self, amount: u64) -> Result<()> {
        declare_vault_seeds!(self.accounts.vault, seeds);

        let cpi_accounts = Transfer {
            from: self
                .accounts
                .vault_quote_token_account
                .to_account_info()
                .clone(),
            to: self
                .accounts
                .investor_quote_token_account
                .to_account_info()
                .clone(),
            authority: self.accounts.vault.to_account_info().clone(),
        };
        let token_program = self.accounts.token_program.to_account_info().clone();
        let cpi_context = CpiContext::new_with_signer(token_program, cpi_accounts, seeds);
        token::transfer(cpi_context, amount)?;

        Ok(())
    }
}
