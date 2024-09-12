use anchor_lang::prelude::*;

#[derive(Clone)]
pub struct PhoenixProgram;
impl Id for PhoenixProgram {
    fn id() -> Pubkey {
        phoenix::ID
    }
}

#[derive(Clone)]
pub struct PhoenixSeatManagerProgram;

impl Id for PhoenixSeatManagerProgram {
    fn id() -> Pubkey {
        phoenix_seat_manager::ID
    }
}
