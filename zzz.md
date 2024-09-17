### Vault Checks

Before any non-liquidation instruction is executed, run these vault checks in a single function:
* vault not in liquidation
* 

### Liquidate Market

Instruction validates:
* vault in liquidation by investor
* investor withdraw request is unfulfilled and has waited redeem period

Instruction executes:
* debits quote lots from vault position in market
* if quote lots are insufficient to fulfill investor withdraw request, 
then market swap base lots into quote lots as needed until zero or investor withdraw request is fulfilled,
whichever comes first.


### Investor Deposit/Withdraw

* investor transfer to vault ata
* vault ata transfers to SOL/USDC market
investor to market transfer settled atomically


### Client Liquidation Process

* `appoint_liquidator`: client acquires liquidation authority
* `liquidate_market`:liquidates market one at a time until request is fulfilled
* `reset_liquidator`: releases liquidation authority