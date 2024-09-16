To avoid calculating equity across vault atas and TraderState in every market, and handling cases where funds 
transfer between the two, we opt to keep everything in the TraderState on a per-market basis.

When investors deposit, the instruction transfers to the vault's ata as an intermediate step, but then 
immediately transfers from the vault to the market.

When investors withdraw, the instruction transfers from the market to the vault's ata as an intermediate step, 
but then immediately transfers from the vault to the investor.

The transfer is atomic, so at no point after the transaction should funds exist in the vault ata, so tests should 
assert zero balances after each transaction.