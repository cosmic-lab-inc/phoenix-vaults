### Scenario 1
To avoid calculating equity across vault atas and TraderState in every market, and handling cases where funds 
transfer between the two, we opt to keep everything in the TraderState on a per-market basis.

When investors deposit, the instruction transfers to the vault's ata as an intermediate step, but then 
immediately transfers from the vault to the market.

When investors withdraw, the instruction transfers from the market to the vault's ata as an intermediate step, 
but then immediately transfers from the vault to the investor.

The transfer is atomic, so at no point after the transaction should funds exist in the vault ata, so tests should 
assert zero balances after each transaction.

**Problem:**
Complicated for the vault to move funds from one market to another.
If the vault requests more quote units than are free in Market A, then the instruction will fail.
The client must exit the base asset of Market A before attempting to transfer those funds to Market B.
All markets are denominated in USDC or SOL. So long as the market transfer is from moves assets in those two assets,
the accounts required for the instruction are fixed.
By comparison this is a cleaner solution than Scenario 2.


### Scenario 2
Investor deposits to vault atas, then vault deposits to markets it wants to trade.
The investor upon withdrawal might not have the equity sitting in the vault atas.
The remaining equity might be in the vault's market positions.
Therefore, the investor must have the authority to foreclose the vault's market positions.

**Problem*:**
Complicated for investor to withdraw. There must be a foreclosure mechanism to liquidate the vault's market positions.
It is unknown which markets would be used to fulfill the withdraw request, and so the accounts given to the instruction
are unknown. It is not an option to provide all market accounts since that would quickly approach the 1232 
transaction byte limit (32 accounts).