use anchor_lang::prelude::*;
use sokoban::ZeroCopy;
use phoenix::program::{load_with_dispatch, MarketHeader};
use solana_program::pubkey;
use crate::error::ErrorCode;
// use heapless::LinearMap;

pub const USDC_MINT: Pubkey = pubkey!("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
pub const SOL_MINT: Pubkey = pubkey!("So11111111111111111111111111111111111111112");

pub trait MarketMapProvider<'a> {
    fn load_markets(&self) -> Result<[(Pubkey, u64); 32]>;
    fn load_sol_usdc_market(&self) -> Result<(Pubkey, u64)>;
}

impl<'a: 'info, 'info, T: anchor_lang::Bumps> MarketMapProvider<'a>
for Context<'_, '_, 'a, 'info, T>
{
    /// Process all markets on Phoenix
    fn load_markets(&self) -> Result<[(Pubkey, u64); 32]> {
        let mut market_prices = [(Pubkey::default(), 0); 32];
        
        let sol_rem_acct = self.remaining_accounts.first().ok_or(anchor_lang::error::Error::from(ErrorCode::SolMarketMissing))?;
        let sol_price = extract_price(sol_rem_acct)?;
        
        let remaining_accounts_iter = &mut self.remaining_accounts.iter().skip(1).peekable();
        for (i, account) in remaining_accounts_iter.enumerate() {
            let account = account.to_account_info();
            let account_data = account.try_borrow_data()?;
            let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
            let header = Box::new(
                MarketHeader::load_bytes(header_bytes)
                    .ok_or(anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError))?
            );
            let market = load_with_dispatch(&header.market_size_params, bytes)?;
            let ladder = market.inner.get_ladder(1);
            let tick_price = ladder.asks[0].price_in_ticks;
            let price = ticks_to_u64_price(&header, tick_price);
            
            let base_mint = header.base_params.mint_key;
            match header.quote_params.mint_key {
                USDC_MINT => {
                    market_prices[i] = (base_mint, price);
                },
                SOL_MINT => {
                    market_prices[i] = (base_mint, sol_price * price);
                },
                _ => {
                    return Err(anchor_lang::error::Error::from(ErrorCode::UnrecognizedQuoteMint));
                }
            }
        }
        Ok(market_prices)
    }

    /// Process a single market, usually SOL/USDC to cover all quote mints (SOL and USDC) on Phoenix.
    /// This allows for a realized pnl and equity calculation for all assets not actively in a trade.
    fn load_sol_usdc_market(&self) -> Result<(Pubkey, u64)> {
        let account = self.remaining_accounts.first().ok_or(anchor_lang::error::Error::from(ErrorCode::SolMarketMissing))?;
        let account = account.to_account_info();
        let account_data = account.try_borrow_data()?;
        let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
        let header = Box::new(
            MarketHeader::load_bytes(header_bytes)
                .ok_or(anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError))?
        );
        if header.quote_params.mint_key != USDC_MINT || header.base_params.mint_key != SOL_MINT {
            return Err(anchor_lang::error::Error::from(ErrorCode::SolMarketMissing));
        }
        let market = load_with_dispatch(&header.market_size_params, bytes)?;
        let ladder = market.inner.get_ladder(1);
        let tick_price = ladder.asks[0].price_in_ticks;
        let price = ticks_to_u64_price(&header, tick_price);
        Ok((account.key(), price))
    }
}

fn extract_price(account: &AccountInfo) -> Result<u64> {
    let account = account.to_account_info();
    let account_data = account.try_borrow_data()?;
    let (header_bytes, bytes) = account_data.split_at(std::mem::size_of::<MarketHeader>());
    let header = Box::new(
        MarketHeader::load_bytes(header_bytes)
            .ok_or(anchor_lang::error::Error::from(ErrorCode::MarketDeserializationError))?
    );
    let market = load_with_dispatch(&header.market_size_params, bytes)?;
    let ladder = market.inner.get_ladder(1);
    let tick_price = ladder.asks[0].price_in_ticks;
    Ok(ticks_to_u64_price(&header, tick_price))
}

fn ticks_to_u64_price(header: &MarketHeader, ticks: u64) -> u64 {
    let raw_base_units_per_base_unit = header.raw_base_units_per_base_unit.max(1);
    // 10^6 for USDC, 10^9 for SOL
    let quote_atoms_per_quote_unit = 10u64.pow(header.quote_params.decimals);
    let tick_size_in_quote_atoms_per_base_unit: u64 =
        header.get_tick_size_in_quote_atoms_per_base_unit().into();
    (ticks * tick_size_in_quote_atoms_per_base_unit)
        / (quote_atoms_per_quote_unit * raw_base_units_per_base_unit as u64)
}