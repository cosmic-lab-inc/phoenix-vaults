use anchor_lang::prelude::*;
use solana_program::address_lookup_table::instruction::{derive_lookup_table_address, ProgramInstruction};
use solana_program::address_lookup_table::state::{AddressLookupTable, LOOKUP_TABLE_META_SIZE};
use solana_program::instruction::Instruction;
use crate::MarketMapProvider;

pub fn initialize_market_lookup_table<'c: 'info, 'info>(
    ctx: Context<'_, '_, 'c, 'info, InitializeMarketLookupTable<'info>>,
    params: MarketLookupTableParams
) -> Result<()> {
    // drift validates markets given in rem accts because it checks all spot/perp positions for the user,
    // and if a market is missing it will fail since it can't compute the USDC equity of that position.
    //
    // for Phoenix, we can load all markets but that must be cross-referenced to vault tokens owned.
    // so for each market we must check that the rem accts provides the vault's token account for that market's base mint.
    // then fetch the price of that market and multiply by the vault's token balance to get the vault's equity.

    // let _: Vec<&Pubkey> = ctx.load_markets()?.keys().collect();

    let slot = params.slot;
    let auth = ctx.accounts.authority.key();

    // let (ix, lut) = solana_address_lookup_table_program::instruction::create_lookup_table_signed(
    //     ctx.accounts.authority.key(),
    //     ctx.accounts.payer.key(),
    //     slot
    // );
    // msg!("lut: {:?}", lut);

    let lut_seeds: &[&[_]]  = &[
        auth.as_ref(),
        &slot.to_le_bytes(),
    ];
    let (lut_signer_pda, program_signer_bump) = Pubkey::find_program_address(lut_seeds, &crate::ID);
    msg!("lut signer pda: {:?}", lut_signer_pda);
    msg!("program signer bump: {:?}", program_signer_bump);
    let ix = Instruction::new_with_bincode(
        solana_address_lookup_table_program::id(),
        &ProgramInstruction::CreateLookupTable {
            recent_slot: slot,
            bump_seed: program_signer_bump,
        },
        vec![
            AccountMeta::new(lut_signer_pda, false),
            AccountMeta::new_readonly(auth, true),
            AccountMeta::new(ctx.accounts.payer.key(), true),
            AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
        ],
    );
    let lut_signer_seeds: &[&[u8]] = &[
        auth.as_ref(),
        &slot.to_le_bytes(),
        &[program_signer_bump]
    ];
    
    // let (lut, lut_bump) = derive_lookup_table_address(&auth, slot);
    // msg!("lut bump: {}", lut_bump);
    // msg!("lut: {:?}", lut);
    // let ix = Instruction::new_with_bincode(
    //     solana_address_lookup_table_program::id(),
    //     &ProgramInstruction::CreateLookupTable {
    //         recent_slot: slot,
    //         bump_seed: lut_bump,
    //     },
    //     vec![
    //         AccountMeta::new(lut, false),
    //         AccountMeta::new_readonly(auth, true),
    //         AccountMeta::new(ctx.accounts.payer.key(), true),
    //         AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
    //     ],
    // );
    // let lut_signer_seeds: &[&[u8]] = &[
    //     auth.as_ref(),
    //     &slot.to_le_bytes(),
    //     &[lut_bump]
    // ];

    let uninit_lut_acct_info = ctx.accounts.lut.to_account_info();
    msg!("lut from ctx: {:?}", uninit_lut_acct_info.key());
    let acct_infos = [
        uninit_lut_acct_info,
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.payer.to_account_info(),
        ctx.accounts.system_program.to_account_info(),
    ];
    
    if let Err(e) = solana_program::program::invoke_signed(
        &ix,
        &acct_infos,
        &[lut_signer_seeds]
    ) {
        msg!("{:?}", e);
    }

    Ok(())
}

#[derive(Debug, Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq)]
pub struct MarketLookupTableParams {
    pub slot: u64,
}

#[derive(Accounts)]
#[instruction(params: MarketLookupTableParams)]
pub struct InitializeMarketLookupTable<'info> {
    pub authority: Signer<'info>,

    /// CHECK: Checked in ALT program CPI
    #[account(
        mut,
        seeds = [
            authority.key().as_ref(),
            &params.slot.to_le_bytes()
        ],
        bump,
    )]
    pub lut: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub lut_program: Program<'info, LutProgram>
}

#[derive(Clone)]
pub struct LutProgram;

impl Id for LutProgram {
    fn id() -> Pubkey {
        solana_address_lookup_table_program::id()
    }
}