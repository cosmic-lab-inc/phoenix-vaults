### Market Deposit/Withdraw

Drift has `User.spot_positions` which is an array of length 8.
Positions in a new market must overwrite an index that has a zero balance.
There can't be more than 8 positions open at once.
The program iterates the positions and uses the first index with a zero balance.

This program must replicate this process to validate the Phoenix markets given as remaining accounts to an ix.
If the remaining account keys line up with each vault position market then the equity calculation is valid.
If not the ix errors saying with `ErrorCode::MarketMissingInRemainingAccounts`.

This system removes the need for `MarketRegistry` and the necessity for its `AddressLookupTable` to be given with each
ix. The `MarketRegistry` system relied on an admin creating the registry upon program deployment, but also fails to 
scale non-localnet networks since the number of markets exceeds the stack frame allocated to the instruction context,
which would contain the `AddressLookupTable` of up to 32 market keys.