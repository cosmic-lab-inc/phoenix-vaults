### Vault Checks
Before any non-liquidation instruction is executed, run these vault checks in a single function:
* vault not in liquidation
* 

### Liquidate Market
Instruction validates:
* vault in liquidation by investor
* investor withdraw request is unfulfilled and has waited redeem period

Instruction executes:
* token transfer `vault_usdc_token_account` to `investor_usdc_token_account`
* if `vault_usdc_token_account` amount is insufficient to fulfill investor withdraw request, then liquidate market:

If the market is USDC denominated:
* if not enough quote USDC to fulfill withdraw request, swap base to USDC as needed
* withdraw quote USDC to `vault_usdc_token_account`
* transfer quote USDC to `investor_quote_token_account`

If the market is SOL denominated:
* if not enough quote SOL to fulfill withdraw request, swap base to SOL as needed
* withdraw quote SOL to `vault_sol_token_account`
* deposit to the SOL/USDC market
* swap SOL into USDC
* withdraw quote USDC `vault_quote_token_account`
* transfer quote USDC to `investor_quote_token_account`

The market denomination (USDC or SOL) is the `quote` token.

### Switch Market


### Client Liquidation Process
* `appoint_liquidator`: client acquires liquidation authority
* `liquidate_market`:liquidates market one at a time until request is fulfilled
* `reset_liquidator`: releases liquidation authority