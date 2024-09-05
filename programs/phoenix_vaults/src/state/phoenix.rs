use anchor_lang::prelude::*;

#[derive(Clone)]
pub struct Phoenix;

impl Id for Phoenix {
    fn id() -> Pubkey {
        phoenix::ID
    }
}
