use anchor_lang::prelude::*;

#[derive(Clone)]
pub struct PhoenixProgram;

impl Id for PhoenixProgram {
    fn id() -> Pubkey {
        phoenix::ID
    }
}
