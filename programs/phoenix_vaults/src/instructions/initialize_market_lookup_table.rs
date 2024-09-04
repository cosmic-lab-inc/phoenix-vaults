use anchor_lang::prelude::*;
use crate::MarketMapProvider;

pub fn initialize_market_lookup_table<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InitializeMarketLookupTable<'info>>,
) -> Result<()> {
    // todo:
    //  drift validates markets given in rem accts because it checks all spot/perp positions for the user,
    //  and if a market is missing it will fail since it can't compute the USDC equity of that position.
    //  for phoenix we can load all markets but that must be cross-referenced to vault tokens owned.
    //  so for each market we must check that the rem accts provides the vault's token account for that market's base mint.
    //  then fetch the price of that market and multiply by the vault's token balance to get the vault's equity.

    // let markets: Vec<&Pubkey> = ctx.load_markets()?.keys().collect();

    let clock = Clock::get()?;
    
    let (ix, _lut) = solana_address_lookup_table_program::instruction::create_lookup_table_signed(
        ctx.accounts.authority.key(),
        ctx.accounts.payer.key(),
        clock.slot
    );
    
    // let system_program = ctx.accounts.system_program.key();
    // let uninit_lut_acct_info = AccountInfo::<'c>::new(
    //     &lut,
    //     false,
    //     true,
    //     &mut 0,
    //     &mut [],
    //     &system_program,    
    //     false,
    //     clock.epoch,
    // );
    // let acct_infos = [
    //     uninit_lut_acct_info,
    //     ctx.accounts.authority.to_account_info(),
    //     ctx.accounts.payer.to_account_info(),
    //     ctx.accounts.system_program.to_account_info()
    // ];

    // solana_program::program::invoke(
    //     &ix,
    //     &[],
    // )?;

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeMarketLookupTable<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}