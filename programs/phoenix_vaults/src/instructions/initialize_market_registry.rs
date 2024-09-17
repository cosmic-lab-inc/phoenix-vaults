use crate::error::ErrorCode;
use crate::state::{MarketLookupTable, MarketRegistry};
use crate::Size;
use crate::{validate, MarketMapProvider};
use anchor_lang::prelude::*;

pub fn initialize_market_registry<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InitializeMarketRegistry<'info>>,
    params: MarketLookupTableParams,
) -> Result<()> {
    let auth = ctx.accounts.authority.key();
    let lut_acct_info = ctx.accounts.lut.to_account_info();
    let lut_data = lut_acct_info.data.borrow();
    let lut = MarketRegistry::deserialize_lookup_table(auth, lut_data.as_ref())?;

    let mut registry = ctx.accounts.market_registry.load_init()?;
    registry.lut = ctx.accounts.lut.key();
    registry.lut_auth = ctx.accounts.authority.key();
    registry.usdc_mint = params.usdc_mint;
    registry.sol_mint = params.sol_mint;

    // transpose RefMut<MarketRegistry> to Ref<MarketRegistry>

    let market_lut = MarketLookupTable {
        lut_key: ctx.accounts.lut.key(),
        lut: &lut,
    };
    let markets: Vec<Pubkey> = ctx
        .load_markets(&registry, market_lut)?
        .keys()
        .cloned()
        .collect();

    validate!(
        markets.len() == lut.addresses.len(),
        ErrorCode::MarketRegistryLength,
        &format!(
            "MarketRegistryLength: {:?} != {:?}",
            markets.len(),
            lut.addresses.len()
        )
    )?;

    validate!(
        markets.len() == lut.addresses.len(),
        ErrorCode::MarketRegistryLength,
        &format!(
            "MarketRegistryLength: {:?} != {:?}",
            markets.len(),
            lut.addresses.len()
        )
    )?;

    Ok(())
}

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct MarketLookupTableParams {
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
