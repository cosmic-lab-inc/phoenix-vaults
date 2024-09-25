use crate::state::MarketRegistry;
use crate::Size;
use anchor_lang::prelude::*;

pub fn initialize_market_registry<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InitializeMarketRegistry<'info>>,
    params: MarketLookupTableParams,
) -> Result<()> {
    let mut registry = ctx.accounts.market_registry.load_init()?;
    registry.authority = ctx.accounts.authority.key();
    registry.sol_usdc_market = params.sol_usdc_market;
    registry.usdc_mint = params.usdc_mint;
    registry.sol_mint = params.sol_mint;

    Ok(())
}

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct MarketLookupTableParams {
    pub sol_usdc_market: Pubkey,
    pub usdc_mint: Pubkey,
    pub sol_mint: Pubkey,
}

#[derive(Accounts)]
#[instruction(params: MarketLookupTableParams)]
pub struct InitializeMarketRegistry<'info> {
    /// Admin-level keypair
    pub authority: Signer<'info>,

    #[account(
        init,
        seeds = [b"market_registry"],
        space = MarketRegistry::SIZE,
        bump,
        payer = payer
    )]
    pub market_registry: AccountLoader<'info, MarketRegistry>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}
