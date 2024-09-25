use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use phoenix::program::PhoenixInstruction;
use phoenix::state::{decode_order_packet, OrderPacket, OrderPacketMetadata};
use solana_program::program::invoke_signed;

use crate::constraints::{
    is_delegate_for_vault, is_sol_mint, is_sol_token_for_vault, is_usdc_mint,
    is_usdc_token_for_vault,
};
use crate::cpis::PhoenixTradeCPI;
use crate::error::ErrorCode;
use crate::state::{MarketMapProvider, PhoenixProgram, Vault};
use crate::{declare_vault_seeds, validate};

pub fn place_limit_order<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, PlaceLimitOrder<'info>>,
    params: PlaceOrderParams,
) -> Result<()> {
    let (tag, data) = params
        .order
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;
    let instruction =
        PhoenixInstruction::try_from(*tag).or(Err(ProgramError::InvalidInstructionData))?;
    validate!(
        matches!(
            instruction,
            PhoenixInstruction::PlaceLimitOrderWithFreeFunds
        ),
        ErrorCode::InvalidPhoenixInstruction,
        "Phoenix instruction tag does not match PlaceLimitOrderWithFreeFunds"
    )?;

    let order = decode_order_packet(data).ok_or(ErrorCode::OrderPacketDeserialization)?;
    ctx.phoenix_trade(order)?;

    let mut vault = ctx.accounts.vault.load_mut()?;
    let market = ctx.accounts.market.key();
    let pos = ctx.market_position(&vault, market)?;
    let index = vault.force_get_market_position_index(market)?;
    vault.update_market_position(index, pos)?;
    drop(vault);

    Ok(())
}

#[derive(AnchorDeserialize, AnchorSerialize, Clone, PartialEq, Eq, Debug)]
pub struct PlaceOrderParams {
    pub order: Vec<u8>,
}

#[derive(Accounts)]
pub struct PlaceLimitOrder<'info> {
    /// If delegate has authority to sign for vault, then any Phoenix CPI is valid.
    /// Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],
    /// so this is safe since any Phoenix CPI is secure.
    #[account(
        mut,
        constraint = is_delegate_for_vault(&vault, &delegate)?
    )]
    pub vault: AccountLoader<'info, Vault>,
    /// Is manager by default, but can be delegated to another pubkey using `update_delegate`
    pub delegate: Signer<'info>,

    pub phoenix: Program<'info, PhoenixProgram>,
    /// CHECK: validated in Phoenix CPI
    pub log_authority: UncheckedAccount<'info>,
    /// CHECK: validated in Phoenix CPI
    #[account(mut)]
    pub market: UncheckedAccount<'info>,
    /// CHECK: validated in Phoenix CPI
    pub seat: UncheckedAccount<'info>,

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
        constraint = is_usdc_token_for_vault(&vault, &vault_quote_token_account)? || is_sol_token_for_vault(&vault, &vault_quote_token_account)?,
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

impl<'info> PhoenixTradeCPI for Context<'_, '_, '_, 'info, PlaceLimitOrder<'info>> {
    fn phoenix_trade(&self, order: OrderPacket) -> Result<()> {
        validate!(
            order.no_deposit_or_withdrawal(),
            ErrorCode::OrderPacketMustUseDepositedFunds,
            "OrderPacket must use deposited funds"
        )?;

        let trader_index = 3;
        let mut ix =
            phoenix::program::instruction_builders::create_new_order_with_free_funds_instruction(
                &self.accounts.market.key(),
                &self.accounts.vault.key(),
                &order,
            );
        ix.accounts[trader_index].is_signer = true;

        // #[account(0, name = "phoenix_program", desc = "Phoenix program")]
        // #[account(1, name = "log_authority", desc = "Phoenix log authority")]
        // #[account(2, writable, name = "market", desc = "This account holds the market state")]
        // #[account(3, signer, name = "trader")]
        // #[account(4, name = "seat")]
        // #[account(5, writable, name = "base_account", desc = "Trader base token account")]
        // #[account(6, writable, name = "quote_account", desc = "Trader quote token account")]
        // #[account(7, writable, name = "base_vault", desc = "Base vault PDA, seeds are [b'vault', market_address, base_mint_address]")]
        // #[account(8, writable, name = "quote_vault", desc = "Quote vault PDA, seeds are [b'vault', market_address, quote_mint_address]")]
        // #[account(9, name = "token_program", desc = "Token program")]
        let accounts = [
            self.accounts.phoenix.to_account_info(),
            self.accounts.log_authority.to_account_info(),
            self.accounts.market.to_account_info(),
            self.accounts.vault.to_account_info(),
            self.accounts.seat.to_account_info(),
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
