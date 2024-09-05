use crate::state::MarketRegistry;
use crate::MarketMapProvider;
use crate::Size;
use anchor_lang::prelude::*;

pub fn initialize_market_registry<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InitializeMarketRegistry<'info>>,
    params: MarketLookupTableParams,
) -> Result<()> {
    // drift validates markets given in rem accts because it checks all spot/perp positions for the user,
    // and if a market is missing it will fail since it can't compute the USDC equity of that position.
    //
    // for Phoenix, we can load all markets but that must be cross-referenced to vault tokens owned.
    // so for each market we must check that the rem accts provides the vault's token account for that market's base mint.
    // then fetch the price of that market and multiply by the vault's token balance to get the vault's equity.

    let markets: Vec<Pubkey> = ctx.load_markets(params)?.keys().cloned().collect();

    let auth = ctx.accounts.authority.key();
    let _ = MarketRegistry::deserialize_lookup_table(
        auth,
        ctx.accounts.lut.to_account_info().data.borrow().as_ref(),
    )?;

    let ix = solana_address_lookup_table_program::instruction::extend_lookup_table(
        ctx.accounts.lut.key(),
        auth,
        None,
        markets,
    );
    let acct_infos = [
        ctx.accounts.lut.to_account_info(),
        ctx.accounts.authority.to_account_info(),
    ];
    if let Err(e) = solana_program::program::invoke(&ix, &acct_infos) {
        msg!("{:?}", e);
    }

    let mut registry = ctx.accounts.market_registry.load_init()?;
    registry.lut = ctx.accounts.lut.key();
    registry.usdc_mint = params.usdc_mint;
    registry.sol_mint = params.sol_mint;

    Ok(())
}

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct MarketLookupTableParams {
    pub usdc_mint: Pubkey,
    pub sol_mint: Pubkey,
    /// Index of SOL/USDC market in remaining accounts
    pub sol_usdc_market_index: u8,
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

    /// Assumes [`AddressLookupTable`] is initialized prior to calling this instruction,
    /// ideally within the same transaction.
    /// CHECK: Deserialized into [`AddressLookupTable`] within instruction
    #[account(mut)]
    pub lut: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub lut_program: Program<'info, LutProgram>,
}

#[derive(Clone)]
pub struct LutProgram;

impl Id for LutProgram {
    fn id() -> Pubkey {
        solana_address_lookup_table_program::id()
    }
}
