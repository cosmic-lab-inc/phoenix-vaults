use crate::state::MarketRegistry;
use crate::MarketMapProvider;
use crate::Size;
use anchor_lang::prelude::*;

pub fn initialize_market_registry<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InitializeMarketRegistry<'info>>,
    params: MarketLookupTableParams,
) -> Result<()> {
    let auth = ctx.accounts.authority.key();
    let lut_acct_info = ctx.accounts.lut.to_account_info();
    let lut_data = lut_acct_info.data.borrow();
    // checks unchecked account info is a lookup table
    let lut = MarketRegistry::deserialize_lookup_table(auth, lut_data.as_ref())?;

    let markets: Vec<Pubkey> = ctx.load_markets(params)?.keys().cloned().collect();

    if markets.len() != lut.addresses.len() {
        msg!(
            "MarketRegistryLength: {:?} != {:?}",
            markets.len(),
            lut.addresses.len()
        );
        return Err(crate::error::ErrorCode::MarketRegistryLength.into());
    }

    // zip markets and lut addresses and check they match
    // if this ix was built correctly, the order of the remaining accounts should simply be the lut addresses
    for (market, lut_address) in markets.iter().zip(lut.addresses.iter()) {
        if market != lut_address {
            msg!("MarketRegistryMismatch: {:?} != {:?}", market, lut_address);
            return Err(crate::error::ErrorCode::MarketRegistryMismatch.into());
            // return Err(anchor_lang::error::Error::from(crate::error::ErrorCode::MarketRegistryMismatch));
        }
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
