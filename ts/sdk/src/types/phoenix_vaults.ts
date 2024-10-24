export type PhoenixVaults = {
	version: '0.1.0';
	name: 'phoenix_vaults';
	instructions: [
		{
			name: 'initializeVault';
			docs: [
				'The wallet that signs this instruction becomes the manager and therefore profits the management fee and profit share.',
				'The manager can NOT be updated, so be careful who creates the vault.',
				'',
				'By default, the manager is also the delegate who has permission to trade on behalf of the vault.',
				'',
				'The delegate can be updated at anytime by calling `update_vault`.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'manager';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'usdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'usdcMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'solTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'solMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'payer';
					isMut: true;
					isSigner: true;
				},
				{
					name: 'rent';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'systemProgram';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'associatedTokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [
				{
					name: 'params';
					type: {
						defined: 'VaultParams';
					};
				}
			];
		},
		{
			name: 'initializeInvestor';
			docs: [
				'User creates an [`Investor`] account to invest with a [`Vault`].'
			];
			accounts: [
				{
					name: 'vault';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'investor';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'authority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'payer';
					isMut: true;
					isSigner: true;
				},
				{
					name: 'rent';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'systemProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'initializeMarketRegistry';
			docs: [
				'Admin function to create an on-chain source of truth for list of Phoenix markets.',
				'This is called once after the first deploy of this program to a network.'
			];
			accounts: [
				{
					name: 'authority';
					isMut: false;
					isSigner: true;
					docs: ['Admin-level keypair'];
				},
				{
					name: 'marketRegistry';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'payer';
					isMut: true;
					isSigner: true;
				},
				{
					name: 'rent';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'systemProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [
				{
					name: 'params';
					type: {
						defined: 'MarketLookupTableParams';
					};
				}
			];
		},
		{
			name: 'investorDeposit';
			docs: ['Investor deposits funds to the vault USDC token account.'];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'investor';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'authority';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'investorQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [
				{
					name: 'amount';
					type: 'u64';
				}
			];
		},
		{
			name: 'investorWithdraw';
			docs: [
				'Investor withdraws funds from the vault, assuming funds are in the vault USDC token account.',
				'',
				'If insufficient USDC in the vault_usdc_token_account, then the investor must call `appoint_liquidator` to',
				'acquire permission to liquidate the vault market positions.',
				'',
				'Then call `liquidate_usdc_market` or `liquidate_sol_market` to forcefully swap a vault market position back to USDC,',
				'and then withdraw back to the investor.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'investor';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'authority';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'investorQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'quoteMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'claimSeat';
			docs: [
				'Vault delegate claims a seat on a Phoenix market to enable trading.',
				'Call this before `place_limit_order`.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: false;
					isSigner: false;
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.'
					];
				},
				{
					name: 'delegate';
					isMut: false;
					isSigner: true;
					docs: [
						'Either vault delegate or an investor liquidating this vault.',
						'If an investor needs to call this, then they must call `appoint_liquidator` first.'
					];
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seatManager';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seatDepositCollector';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'payer';
					isMut: true;
					isSigner: true;
				},
				{
					name: 'seat';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'systemProgram';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'phoenixSeatManager';
					isMut: false;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'placeLimitOrder';
			docs: ['Vault delegate places a limit order on behalf of the vault.'];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.'
					];
				},
				{
					name: 'delegate';
					isMut: false;
					isSigner: true;
					docs: [
						'Is manager by default, but can be delegated to another pubkey using `update_delegate`'
					];
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'quoteMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [
				{
					name: 'params';
					type: {
						defined: 'PlaceOrderParams';
					};
				}
			];
		},
		{
			name: 'investorRequestWithdraw';
			docs: ['Investor request withdrawal of funds from the vault.'];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'investor';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'authority';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				}
			];
			args: [
				{
					name: 'withdrawAmount';
					type: 'u64';
				},
				{
					name: 'withdrawUnit';
					type: {
						defined: 'WithdrawUnit';
					};
				}
			];
		},
		{
			name: 'cancelWithdrawRequest';
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'investor';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'authority';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'marketDeposit';
			docs: [
				'Vault delegate deposits vault assets from the USDC or SOL token account to a Phoenix market.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.'
					];
				},
				{
					name: 'delegate';
					isMut: false;
					isSigner: true;
					docs: [
						'Is manager by default, but can be delegated to another pubkey using `update_delegate`'
					];
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'quoteMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [
				{
					name: 'params';
					type: {
						defined: 'MarketTransferParams';
					};
				}
			];
		},
		{
			name: 'marketWithdraw';
			docs: [
				'Vault delegate withdraws vault Phoenix market back to the vault USDC or SOL token accounts.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.'
					];
				},
				{
					name: 'delegate';
					isMut: false;
					isSigner: true;
					docs: [
						'Is manager by default, but can be delegated to another pubkey using `update_delegate`'
					];
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'quoteMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [
				{
					name: 'params';
					type: {
						defined: 'MarketTransferParams';
					};
				}
			];
		},
		{
			name: 'appointInvestorLiquidator';
			docs: [
				'Assign an investor as delegate to enable liquidation of market positions.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'investor';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'authority';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'appointManagerLiquidator';
			docs: [
				'Assign a vault manager as delegate to enable liquidation of market positions.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'manager';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'appointProtocolLiquidator';
			docs: [
				'Assign a vault protocol as delegate to enable liquidation of market positions.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'protocol';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'investorLiquidateUsdcMarket';
			docs: [
				'After `appoint_investor_liquidator` the investor can liquidate a USDC denominated market position',
				'to fulfill their withdrawal request.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'investor';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'authority';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'investorUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'usdcMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'investorLiquidateSolMarket';
			docs: [
				'After `appoint_investor_liquidator` the investor can liquidate a SOL denominated market position',
				'to fulfill their withdrawal request.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'investor';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'authority';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'investorUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'solMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'usdcMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultSolTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketSolTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'solUsdcMarket';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'solUsdcMarketSeat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'solUsdcMarketSolTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'solUsdcMarketUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'managerLiquidateUsdcMarket';
			docs: [
				'After `appoint_manager_liquidator` the manager can liquidate a USDC denominated market position',
				'to fulfill their withdrawal request.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'manager';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'managerUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'usdcMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'managerLiquidateSolMarket';
			docs: [
				'After `appoint_manager_liquidator` the manager can liquidate a SOL denominated market position',
				'to fulfill their withdrawal request.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'manager';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'managerUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'solMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'usdcMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultSolTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketSolTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'solUsdcMarket';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'solUsdcMarketSeat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'solUsdcMarketSolTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'solUsdcMarketUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'protocolLiquidateSolMarket';
			docs: [
				'After `appoint_protocol_liquidator` the protocol can liquidate a SOL denominated market position',
				'to fulfill their withdrawal request.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'protocol';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'protocolUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'solMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'usdcMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultSolTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketSolTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'solUsdcMarket';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'solUsdcMarketSeat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'solUsdcMarketSolTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'solUsdcMarketUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'protocolLiquidateUsdcMarket';
			docs: [
				'After `appoint_protocol_liquidator` the protocol can liquidate a USDC denominated market position',
				'to fulfill their withdrawal request.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'protocol';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'protocolUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'usdcMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'updateVault';
			docs: [
				'Update the fees, profit share, min deposit, max capacity, delegate, and more.'
			];
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'manager';
					isMut: false;
					isSigner: true;
				}
			];
			args: [
				{
					name: 'params';
					type: {
						defined: 'UpdateVaultParams';
					};
				}
			];
		},
		{
			name: 'managerWithdraw';
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'manager';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'managerQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'quoteMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'managerDeposit';
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'manager';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'managerQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [
				{
					name: 'amount';
					type: 'u64';
				}
			];
		},
		{
			name: 'managerRequestWithdraw';
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'manager';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				}
			];
			args: [
				{
					name: 'withdrawAmount';
					type: 'u64';
				},
				{
					name: 'withdrawUnit';
					type: {
						defined: 'WithdrawUnit';
					};
				}
			];
		},
		{
			name: 'managerCancelWithdrawRequest';
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'manager';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'protocolWithdraw';
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'protocol';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'protocolQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'seat';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'baseMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'quoteMint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'vaultQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketBaseTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'marketQuoteTokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenProgram';
					isMut: false;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'protocolRequestWithdraw';
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'protocol';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				}
			];
			args: [
				{
					name: 'withdrawAmount';
					type: 'u64';
				},
				{
					name: 'withdrawUnit';
					type: {
						defined: 'WithdrawUnit';
					};
				}
			];
		},
		{
			name: 'protocolCancelWithdrawRequest';
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'protocol';
					isMut: false;
					isSigner: true;
				},
				{
					name: 'marketRegistry';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'vaultUsdcTokenAccount';
					isMut: true;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'cancelAllOrders';
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.'
					];
				},
				{
					name: 'delegate';
					isMut: false;
					isSigner: true;
					docs: [
						'Is manager by default, but can be delegated to another pubkey using `update_delegate`'
					];
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				}
			];
			args: [];
		},
		{
			name: 'cancelMultipleOrdersById';
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.'
					];
				},
				{
					name: 'delegate';
					isMut: false;
					isSigner: true;
					docs: [
						'Is manager by default, but can be delegated to another pubkey using `update_delegate`'
					];
				},
				{
					name: 'phoenix';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'logAuthority';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'market';
					isMut: true;
					isSigner: false;
				}
			];
			args: [
				{
					name: 'params';
					type: {
						defined: 'CancelMultipleOrdersParams';
					};
				}
			];
		}
	];
	accounts: [
		{
			name: 'investor';
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'vault';
						docs: ['The vault deposited into'];
						type: 'publicKey';
					},
					{
						name: 'pubkey';
						docs: [
							"The vault depositor account's pubkey. It is a pda of vault and authority"
						];
						type: 'publicKey';
					},
					{
						name: 'authority';
						docs: [
							'The authority is the address w permission to deposit/withdraw'
						];
						type: 'publicKey';
					},
					{
						name: 'vaultShares';
						docs: [
							"share of vault owned by this depositor. vault_shares / vault.total_shares is depositor's ownership of vault_equity"
						];
						type: 'u128';
					},
					{
						name: 'lastWithdrawRequest';
						docs: ['last withdraw request'];
						type: {
							defined: 'WithdrawRequest';
						};
					},
					{
						name: 'lastValidTs';
						docs: ['creation ts of vault depositor'];
						type: 'i64';
					},
					{
						name: 'netDeposits';
						docs: ['lifetime net deposits of vault depositor for the vault'];
						type: 'i64';
					},
					{
						name: 'totalDeposits';
						docs: ['lifetime total deposits'];
						type: 'u64';
					},
					{
						name: 'totalWithdraws';
						docs: ['lifetime total withdraws'];
						type: 'u64';
					},
					{
						name: 'cumulativeProfitShareAmount';
						docs: [
							'the token amount of gains the vault depositor has paid performance fees on (in other words, cumulative profit)'
						];
						type: 'i64';
					},
					{
						name: 'profitShareFeePaid';
						docs: [
							'the token amount profit share paid out to the manager and protocol'
						];
						type: 'u64';
					},
					{
						name: 'vaultSharesBase';
						docs: ['the exponent for vault_shares decimal places'];
						type: 'u32';
					},
					{
						name: 'padding1';
						type: 'u32';
					},
					{
						name: 'padding';
						type: {
							array: ['u64', 8];
						};
					}
				];
			};
		},
		{
			name: 'marketRegistry';
			docs: [
				'DriftVaults validates vault user positions against the remaining accounts provided for those markets.',
				'If the remaining accounts do not contain every market the user has a position in, then the instruction errors.',
				'For Phoenix, we use our MarketRegistry as the official source of truth for the "list of markets",',
				"and we can get the TraderState for the vault within each market to determine the vault's positions.",
				'If the remaining accounts do not contain every market in the MarketRegistry that the vault has a position in,',
				'then the instruction will error.'
			];
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'authority';
						docs: [
							'Authority over this account. This is a program admin-level keypair.'
						];
						type: 'publicKey';
					},
					{
						name: 'solUsdcMarket';
						docs: ['Phoenix SOL/USDC market'];
						type: 'publicKey';
					},
					{
						name: 'usdcMint';
						docs: [
							'Phoenix markets are denominated in USDC or SOL, so we must pre-define this'
						];
						type: 'publicKey';
					},
					{
						name: 'solMint';
						docs: [
							'Phoenix markets are denominated in USDC or SOL, so we must pre-define this'
						];
						type: 'publicKey';
					}
				];
			};
		},
		{
			name: 'vault';
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'name';
						docs: [
							'The name of the vault. Vault pubkey is derived from this name.'
						];
						type: {
							array: ['u8', 32];
						};
					},
					{
						name: 'pubkey';
						docs: [
							"The vault's pubkey. It is a PDA also used as the authority token accounts"
						];
						type: 'publicKey';
					},
					{
						name: 'manager';
						docs: [
							'The manager of the vault who has ability to update vault config,',
							'and earns a profit share or management fee.'
						];
						type: 'publicKey';
					},
					{
						name: 'usdcMint';
						docs: ['The Phoenix USDC mint.'];
						type: 'publicKey';
					},
					{
						name: 'solMint';
						docs: ['The Phoenix (wrapped) SOL mint.'];
						type: 'publicKey';
					},
					{
						name: 'usdcTokenAccount';
						docs: [
							'The USDC token account investor transfer with,',
							'and the vault transfer to Phoenix markets with.'
						];
						type: 'publicKey';
					},
					{
						name: 'solTokenAccount';
						docs: [
							'The SOL token account investor transfer with,',
							'and the vault transfer to Phoenix markets with.'
						];
						type: 'publicKey';
					},
					{
						name: 'liquidator';
						docs: [
							'The delegate (investor) handling liquidation for an investor to withdraw their funds.'
						];
						type: 'publicKey';
					},
					{
						name: 'delegate';
						docs: [
							'The delegate is the "portfolio manager", "trader", or "bot" that trades the vault assets.',
							'It can swap 100% of vault tokens.',
							'This is the manager by default.'
						];
						type: 'publicKey';
					},
					{
						name: 'investorShares';
						docs: ['The sum of all shares held by the investors'];
						type: 'u128';
					},
					{
						name: 'totalShares';
						docs: [
							'The sum of all shares: investor deposits, manager deposits, manager profit/fee, and protocol profit/fee.',
							'The manager deposits are total_shares - investor_shares - protocol_profit_and_fee_shares.'
						];
						type: 'u128';
					},
					{
						name: 'lastFeeUpdateTs';
						docs: ['Last fee update unix timestamp'];
						type: 'i64';
					},
					{
						name: 'liquidationStartTs';
						docs: ['When the liquidation starts'];
						type: 'i64';
					},
					{
						name: 'redeemPeriod';
						docs: [
							'The period (in seconds) that an investor must wait after requesting a withdrawal to transfer funds.',
							'The maximum is 90 days.',
							'This is only updatable to lesser values.'
						];
						type: 'i64';
					},
					{
						name: 'totalWithdrawRequested';
						docs: ['The sum of all outstanding withdraw requests'];
						type: 'u64';
					},
					{
						name: 'maxTokens';
						docs: [
							'Max token capacity, once hit/passed vault will reject new deposits.',
							'This is only updatable to lesser values.'
						];
						type: 'u64';
					},
					{
						name: 'managementFee';
						docs: [
							'The annual fee charged on deposits by the manager.',
							'Traditional funds typically charge 2% per year on assets under management.',
							'This is only updatable to lesser values.'
						];
						type: 'i64';
					},
					{
						name: 'initTs';
						docs: ['Timestamp vault initialized'];
						type: 'i64';
					},
					{
						name: 'netDeposits';
						docs: ['The net deposits for the vault'];
						type: 'i64';
					},
					{
						name: 'managerNetDeposits';
						docs: ['The net deposits for the manager'];
						type: 'i64';
					},
					{
						name: 'totalDeposits';
						docs: ['Total deposits'];
						type: 'u64';
					},
					{
						name: 'totalWithdraws';
						docs: ['Total withdraws'];
						type: 'u64';
					},
					{
						name: 'managerTotalDeposits';
						docs: ['Total deposits for the manager'];
						type: 'u64';
					},
					{
						name: 'managerTotalWithdraws';
						docs: ['Total withdraws for the manager'];
						type: 'u64';
					},
					{
						name: 'managerTotalFee';
						docs: ['Total management fee accrued by the manager'];
						type: 'i64';
					},
					{
						name: 'managerTotalProfitShare';
						docs: ['Total profit share accrued by the manager'];
						type: 'u64';
					},
					{
						name: 'minDepositAmount';
						docs: [
							'The minimum deposit amount.',
							'This is only updatable to lesser values.'
						];
						type: 'u64';
					},
					{
						name: 'lastManagerWithdrawRequest';
						type: {
							defined: 'WithdrawRequest';
						};
					},
					{
						name: 'sharesBase';
						docs: [
							'The base 10 exponent of the shares (given massive share inflation can occur at near zero vault equity)'
						];
						type: 'u32';
					},
					{
						name: 'profitShare';
						docs: [
							'Percentage the manager charges on all profits realized by depositors (multiplied by PERCENTAGE_PRECISION).',
							'Traditional funds typically charge 20% of profits.',
							'This is only updatable to lesser values.'
						];
						type: 'u32';
					},
					{
						name: 'hurdleRate';
						docs: [
							'Vault manager only collect incentive fees during periods when returns are higher than this amount (multiplied by PERCENTAGE_PRECISION).'
						];
						type: 'u32';
					},
					{
						name: 'protocolProfitShare';
						docs: [
							'Percentage the protocol charges on all profits realized by depositors: PERCENTAGE_PRECISION'
						];
						type: 'u32';
					},
					{
						name: 'protocol';
						docs: [
							'The protocol, company, or entity that services the product using this vault.',
							'The protocol is not allowed to deposit into the vault but can profit share and collect annual fees just like the manager.'
						];
						type: 'publicKey';
					},
					{
						name: 'protocolProfitAndFeeShares';
						docs: [
							'The shares from profit share and annual fee unclaimed by the protocol.'
						];
						type: 'u128';
					},
					{
						name: 'protocolFee';
						docs: [
							'The annual fee charged on deposits by the protocol (traditional hedge funds typically charge 2% per year on assets under management).',
							"Unlike the management fee this can't be negative."
						];
						type: 'u64';
					},
					{
						name: 'protocolTotalWithdraws';
						docs: ['Total withdraws for the protocol'];
						type: 'u64';
					},
					{
						name: 'protocolTotalFee';
						docs: [
							'Total fee charged by the protocol (annual management fee + profit share).',
							"Unlike the management fee this can't be negative."
						];
						type: 'u64';
					},
					{
						name: 'protocolTotalProfitShare';
						docs: ['Total profit share charged by the protocol'];
						type: 'u64';
					},
					{
						name: 'lastProtocolWithdrawRequest';
						type: {
							defined: 'WithdrawRequest';
						};
					},
					{
						name: 'positions';
						type: {
							array: [
								{
									defined: 'MarketPosition';
								},
								8
							];
						};
					},
					{
						name: 'permissioned';
						docs: ['Whether anyone can be an investor'];
						type: 'bool';
					},
					{
						name: 'bump';
						docs: ['The bump for the vault PDA'];
						type: 'u8';
					},
					{
						name: 'padding';
						type: {
							array: ['u8', 6];
						};
					}
				];
			};
		}
	];
	types: [
		{
			name: 'MarketLookupTableParams';
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'solUsdcMarket';
						type: 'publicKey';
					},
					{
						name: 'usdcMint';
						type: 'publicKey';
					},
					{
						name: 'solMint';
						type: 'publicKey';
					}
				];
			};
		},
		{
			name: 'CancelMultipleOrdersParams';
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'orders';
						type: {
							vec: {
								defined: 'CancelOrderParams';
							};
						};
					}
				];
			};
		},
		{
			name: 'CancelOrderParams';
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'side';
						type: {
							defined: 'Side';
						};
					},
					{
						name: 'priceInTicks';
						type: 'u64';
					},
					{
						name: 'orderSequenceNumber';
						type: 'u64';
					}
				];
			};
		},
		{
			name: 'VaultParams';
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'name';
						type: {
							array: ['u8', 32];
						};
					},
					{
						name: 'redeemPeriod';
						type: 'i64';
					},
					{
						name: 'maxTokens';
						type: 'u64';
					},
					{
						name: 'managementFee';
						type: 'i64';
					},
					{
						name: 'minDepositAmount';
						type: 'u64';
					},
					{
						name: 'profitShare';
						type: 'u32';
					},
					{
						name: 'hurdleRate';
						type: 'u32';
					},
					{
						name: 'permissioned';
						type: 'bool';
					},
					{
						name: 'protocol';
						type: 'publicKey';
					},
					{
						name: 'protocolFee';
						type: 'u64';
					},
					{
						name: 'protocolProfitShare';
						type: 'u32';
					}
				];
			};
		},
		{
			name: 'PlaceOrderParams';
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'order';
						type: 'bytes';
					}
				];
			};
		},
		{
			name: 'UpdateVaultParams';
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'redeemPeriod';
						type: {
							option: 'i64';
						};
					},
					{
						name: 'maxTokens';
						type: {
							option: 'u64';
						};
					},
					{
						name: 'managementFee';
						type: {
							option: 'i64';
						};
					},
					{
						name: 'minDepositAmount';
						type: {
							option: 'u64';
						};
					},
					{
						name: 'profitShare';
						type: {
							option: 'u32';
						};
					},
					{
						name: 'hurdleRate';
						type: {
							option: 'u32';
						};
					},
					{
						name: 'permissioned';
						type: {
							option: 'bool';
						};
					},
					{
						name: 'delegate';
						type: {
							option: 'publicKey';
						};
					}
				];
			};
		},
		{
			name: 'MarketPosition';
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'market';
						type: 'publicKey';
					},
					{
						name: 'quoteLotsLocked';
						type: 'u64';
					},
					{
						name: 'quoteLotsFree';
						type: 'u64';
					},
					{
						name: 'baseLotsLocked';
						type: 'u64';
					},
					{
						name: 'baseLotsFree';
						type: 'u64';
					}
				];
			};
		},
		{
			name: 'MarketTransferParams';
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'quoteLots';
						type: 'u64';
					},
					{
						name: 'baseLots';
						type: 'u64';
					}
				];
			};
		},
		{
			name: 'WithdrawRequest';
			type: {
				kind: 'struct';
				fields: [
					{
						name: 'shares';
						docs: ['request shares of vault withdraw'];
						type: 'u128';
					},
					{
						name: 'value';
						docs: ['requested value in USDC of shares for withdraw'];
						type: 'u64';
					},
					{
						name: 'ts';
						docs: ['request ts of vault withdraw'];
						type: 'i64';
					}
				];
			};
		},
		{
			name: 'Side';
			type: {
				kind: 'enum';
				variants: [
					{
						name: 'Bid';
					},
					{
						name: 'Ask';
					}
				];
			};
		},
		{
			name: 'InvestorAction';
			type: {
				kind: 'enum';
				variants: [
					{
						name: 'Deposit';
					},
					{
						name: 'WithdrawRequest';
					},
					{
						name: 'CancelWithdrawRequest';
					},
					{
						name: 'Withdraw';
					},
					{
						name: 'FeePayment';
					}
				];
			};
		},
		{
			name: 'WithdrawUnit';
			type: {
				kind: 'enum';
				variants: [
					{
						name: 'Shares';
					},
					{
						name: 'Token';
					},
					{
						name: 'SharesPercent';
					}
				];
			};
		}
	];
	events: [
		{
			name: 'VaultRecord';
			fields: [
				{
					name: 'ts';
					type: 'i64';
					index: false;
				},
				{
					name: 'spotMarketIndex';
					type: 'u16';
					index: false;
				},
				{
					name: 'vaultEquityBefore';
					type: 'u64';
					index: false;
				}
			];
		},
		{
			name: 'InvestorRecord';
			fields: [
				{
					name: 'ts';
					type: 'i64';
					index: false;
				},
				{
					name: 'vault';
					type: 'publicKey';
					index: false;
				},
				{
					name: 'depositorAuthority';
					type: 'publicKey';
					index: false;
				},
				{
					name: 'action';
					type: {
						defined: 'InvestorAction';
					};
					index: false;
				},
				{
					name: 'amount';
					type: 'u64';
					index: false;
				},
				{
					name: 'usdcMint';
					type: 'publicKey';
					index: false;
				},
				{
					name: 'solMint';
					type: 'publicKey';
					index: false;
				},
				{
					name: 'vaultSharesBefore';
					type: 'u128';
					index: false;
				},
				{
					name: 'vaultSharesAfter';
					type: 'u128';
					index: false;
				},
				{
					name: 'vaultEquityBefore';
					type: 'u64';
					index: false;
				},
				{
					name: 'userVaultSharesBefore';
					type: 'u128';
					index: false;
				},
				{
					name: 'totalVaultSharesBefore';
					type: 'u128';
					index: false;
				},
				{
					name: 'protocolSharesBefore';
					type: 'u128';
					index: false;
				},
				{
					name: 'userVaultSharesAfter';
					type: 'u128';
					index: false;
				},
				{
					name: 'totalVaultSharesAfter';
					type: 'u128';
					index: false;
				},
				{
					name: 'protocolSharesAfter';
					type: 'u128';
					index: false;
				},
				{
					name: 'protocolProfitShare';
					type: 'u64';
					index: false;
				},
				{
					name: 'protocolFee';
					type: 'i64';
					index: false;
				},
				{
					name: 'protocolFeeShares';
					type: 'i64';
					index: false;
				},
				{
					name: 'managerProfitShare';
					type: 'u64';
					index: false;
				},
				{
					name: 'managementFee';
					type: 'i64';
					index: false;
				},
				{
					name: 'managementFeeShares';
					type: 'i64';
					index: false;
				}
			];
		}
	];
	errors: [
		{
			code: 6000;
			name: 'Default';
			msg: 'Default';
		},
		{
			code: 6001;
			name: 'InvalidVaultRebase';
			msg: 'InvalidVaultRebase';
		},
		{
			code: 6002;
			name: 'InvalidVaultSharesDetected';
			msg: 'InvalidVaultSharesDetected';
		},
		{
			code: 6003;
			name: 'CannotWithdrawBeforeRedeemPeriodEnd';
			msg: 'CannotWithdrawBeforeRedeemPeriodEnd';
		},
		{
			code: 6004;
			name: 'InvalidVaultWithdraw';
			msg: 'InvalidVaultWithdraw';
		},
		{
			code: 6005;
			name: 'InsufficientVaultShares';
			msg: 'InsufficientVaultShares';
		},
		{
			code: 6006;
			name: 'InvalidVaultWithdrawSize';
			msg: 'InvalidVaultWithdrawSize';
		},
		{
			code: 6007;
			name: 'InvalidVaultForNewDepositors';
			msg: 'InvalidVaultForNewDepositors';
		},
		{
			code: 6008;
			name: 'VaultWithdrawRequestInProgress';
			msg: 'VaultWithdrawRequestInProgress';
		},
		{
			code: 6009;
			name: 'VaultIsAtCapacity';
			msg: 'VaultIsAtCapacity';
		},
		{
			code: 6010;
			name: 'InvalidVaultDepositorInitialization';
			msg: 'InvalidVaultDepositorInitialization';
		},
		{
			code: 6011;
			name: 'DelegateNotAvailableForLiquidation';
			msg: 'DelegateNotAvailableForLiquidation';
		},
		{
			code: 6012;
			name: 'InvalidLiquidator';
			msg: 'InvalidLiquidator';
		},
		{
			code: 6013;
			name: 'LiquidationExpired';
			msg: 'LiquidationExpired';
		},
		{
			code: 6014;
			name: 'InvalidEquityValue';
			msg: 'InvalidEquityValue';
		},
		{
			code: 6015;
			name: 'VaultInLiquidation';
			msg: 'VaultInLiquidation';
		},
		{
			code: 6016;
			name: 'InvestorCanWithdraw';
			msg: 'InvestorCanWithdraw';
		},
		{
			code: 6017;
			name: 'InvalidVaultInitialization';
			msg: 'InvalidVaultInitialization';
		},
		{
			code: 6018;
			name: 'InvalidVaultUpdate';
			msg: 'InvalidVaultUpdate';
		},
		{
			code: 6019;
			name: 'PermissionedVault';
			msg: 'PermissionedVault';
		},
		{
			code: 6020;
			name: 'WithdrawInProgress';
			msg: 'WithdrawInProgress';
		},
		{
			code: 6021;
			name: 'SharesPercentTooLarge';
			msg: 'SharesPercentTooLarge';
		},
		{
			code: 6022;
			name: 'InvalidVaultDeposit';
			msg: 'InvalidVaultDeposit';
		},
		{
			code: 6023;
			name: 'OngoingLiquidation';
			msg: 'OngoingLiquidation';
		},
		{
			code: 6024;
			name: 'VaultProtocolMissing';
			msg: 'VaultProtocolMissing';
		},
		{
			code: 6025;
			name: 'BnConversion';
			msg: 'BnConversion';
		},
		{
			code: 6026;
			name: 'MathError';
			msg: 'MathError';
		},
		{
			code: 6027;
			name: 'CastError';
			msg: 'CastError';
		},
		{
			code: 6028;
			name: 'UnwrapError';
			msg: 'UnwrapError';
		},
		{
			code: 6029;
			name: 'MarketDeserializationError';
			msg: 'MarketDeserializationError';
		},
		{
			code: 6030;
			name: 'UnrecognizedQuoteMint';
			msg: 'UnrecognizedQuoteMint';
		},
		{
			code: 6031;
			name: 'SolMarketMissing';
			msg: 'SolMarketMissing';
		},
		{
			code: 6032;
			name: 'MarketMissingInRemainingAccounts';
			msg: 'MarketMissingInRemainingAccounts';
		},
		{
			code: 6033;
			name: 'MarketRegistryMismatch';
			msg: 'MarketRegistryMismatch';
		},
		{
			code: 6034;
			name: 'OrderPacketDeserialization';
			msg: 'OrderPacketDeserialization';
		},
		{
			code: 6035;
			name: 'OrderPacketMustUseDepositedFunds';
			msg: 'OrderPacketMustUseDepositedFunds';
		},
		{
			code: 6036;
			name: 'InvalidPhoenixInstruction';
			msg: 'InvalidPhoenixInstruction';
		},
		{
			code: 6037;
			name: 'OrderPacketMustBeTakeOnly';
			msg: 'OrderPacketMustBeTakeOnly';
		},
		{
			code: 6038;
			name: 'BaseLotsMustBeZero';
			msg: 'BaseLotsMustBeZero';
		},
		{
			code: 6039;
			name: 'TraderStateNotFound';
			msg: 'TraderStateNotFound';
		},
		{
			code: 6040;
			name: 'MarketPositionNotFound';
			msg: 'MarketPositionNotFound';
		}
	];
};

export const IDL: PhoenixVaults = {
	version: '0.1.0',
	name: 'phoenix_vaults',
	instructions: [
		{
			name: 'initializeVault',
			docs: [
				'The wallet that signs this instruction becomes the manager and therefore profits the management fee and profit share.',
				'The manager can NOT be updated, so be careful who creates the vault.',
				'',
				'By default, the manager is also the delegate who has permission to trade on behalf of the vault.',
				'',
				'The delegate can be updated at anytime by calling `update_vault`.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'manager',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'usdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'usdcMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'solTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'solMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'payer',
					isMut: true,
					isSigner: true,
				},
				{
					name: 'rent',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'systemProgram',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'associatedTokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [
				{
					name: 'params',
					type: {
						defined: 'VaultParams',
					},
				},
			],
		},
		{
			name: 'initializeInvestor',
			docs: [
				'User creates an [`Investor`] account to invest with a [`Vault`].',
			],
			accounts: [
				{
					name: 'vault',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'investor',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'authority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'payer',
					isMut: true,
					isSigner: true,
				},
				{
					name: 'rent',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'systemProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'initializeMarketRegistry',
			docs: [
				'Admin function to create an on-chain source of truth for list of Phoenix markets.',
				'This is called once after the first deploy of this program to a network.',
			],
			accounts: [
				{
					name: 'authority',
					isMut: false,
					isSigner: true,
					docs: ['Admin-level keypair'],
				},
				{
					name: 'marketRegistry',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'payer',
					isMut: true,
					isSigner: true,
				},
				{
					name: 'rent',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'systemProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [
				{
					name: 'params',
					type: {
						defined: 'MarketLookupTableParams',
					},
				},
			],
		},
		{
			name: 'investorDeposit',
			docs: ['Investor deposits funds to the vault USDC token account.'],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'investor',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'authority',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'investorQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [
				{
					name: 'amount',
					type: 'u64',
				},
			],
		},
		{
			name: 'investorWithdraw',
			docs: [
				'Investor withdraws funds from the vault, assuming funds are in the vault USDC token account.',
				'',
				'If insufficient USDC in the vault_usdc_token_account, then the investor must call `appoint_liquidator` to',
				'acquire permission to liquidate the vault market positions.',
				'',
				'Then call `liquidate_usdc_market` or `liquidate_sol_market` to forcefully swap a vault market position back to USDC,',
				'and then withdraw back to the investor.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'investor',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'authority',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'investorQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'quoteMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'claimSeat',
			docs: [
				'Vault delegate claims a seat on a Phoenix market to enable trading.',
				'Call this before `place_limit_order`.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: false,
					isSigner: false,
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.',
					],
				},
				{
					name: 'delegate',
					isMut: false,
					isSigner: true,
					docs: [
						'Either vault delegate or an investor liquidating this vault.',
						'If an investor needs to call this, then they must call `appoint_liquidator` first.',
					],
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seatManager',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seatDepositCollector',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'payer',
					isMut: true,
					isSigner: true,
				},
				{
					name: 'seat',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'systemProgram',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'phoenixSeatManager',
					isMut: false,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'placeLimitOrder',
			docs: ['Vault delegate places a limit order on behalf of the vault.'],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.',
					],
				},
				{
					name: 'delegate',
					isMut: false,
					isSigner: true,
					docs: [
						'Is manager by default, but can be delegated to another pubkey using `update_delegate`',
					],
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'quoteMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [
				{
					name: 'params',
					type: {
						defined: 'PlaceOrderParams',
					},
				},
			],
		},
		{
			name: 'investorRequestWithdraw',
			docs: ['Investor request withdrawal of funds from the vault.'],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'investor',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'authority',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
			],
			args: [
				{
					name: 'withdrawAmount',
					type: 'u64',
				},
				{
					name: 'withdrawUnit',
					type: {
						defined: 'WithdrawUnit',
					},
				},
			],
		},
		{
			name: 'cancelWithdrawRequest',
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'investor',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'authority',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'marketDeposit',
			docs: [
				'Vault delegate deposits vault assets from the USDC or SOL token account to a Phoenix market.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.',
					],
				},
				{
					name: 'delegate',
					isMut: false,
					isSigner: true,
					docs: [
						'Is manager by default, but can be delegated to another pubkey using `update_delegate`',
					],
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'quoteMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [
				{
					name: 'params',
					type: {
						defined: 'MarketTransferParams',
					},
				},
			],
		},
		{
			name: 'marketWithdraw',
			docs: [
				'Vault delegate withdraws vault Phoenix market back to the vault USDC or SOL token accounts.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.',
					],
				},
				{
					name: 'delegate',
					isMut: false,
					isSigner: true,
					docs: [
						'Is manager by default, but can be delegated to another pubkey using `update_delegate`',
					],
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'quoteMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [
				{
					name: 'params',
					type: {
						defined: 'MarketTransferParams',
					},
				},
			],
		},
		{
			name: 'appointInvestorLiquidator',
			docs: [
				'Assign an investor as delegate to enable liquidation of market positions.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'investor',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'authority',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'appointManagerLiquidator',
			docs: [
				'Assign a vault manager as delegate to enable liquidation of market positions.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'manager',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'appointProtocolLiquidator',
			docs: [
				'Assign a vault protocol as delegate to enable liquidation of market positions.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'protocol',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'investorLiquidateUsdcMarket',
			docs: [
				'After `appoint_investor_liquidator` the investor can liquidate a USDC denominated market position',
				'to fulfill their withdrawal request.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'investor',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'authority',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'investorUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'usdcMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'investorLiquidateSolMarket',
			docs: [
				'After `appoint_investor_liquidator` the investor can liquidate a SOL denominated market position',
				'to fulfill their withdrawal request.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'investor',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'authority',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'investorUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'solMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'usdcMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultSolTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketSolTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'solUsdcMarket',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'solUsdcMarketSeat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'solUsdcMarketSolTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'solUsdcMarketUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'managerLiquidateUsdcMarket',
			docs: [
				'After `appoint_manager_liquidator` the manager can liquidate a USDC denominated market position',
				'to fulfill their withdrawal request.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'manager',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'managerUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'usdcMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'managerLiquidateSolMarket',
			docs: [
				'After `appoint_manager_liquidator` the manager can liquidate a SOL denominated market position',
				'to fulfill their withdrawal request.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'manager',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'managerUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'solMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'usdcMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultSolTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketSolTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'solUsdcMarket',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'solUsdcMarketSeat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'solUsdcMarketSolTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'solUsdcMarketUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'protocolLiquidateSolMarket',
			docs: [
				'After `appoint_protocol_liquidator` the protocol can liquidate a SOL denominated market position',
				'to fulfill their withdrawal request.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'protocol',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'protocolUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'solMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'usdcMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultSolTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketSolTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'solUsdcMarket',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'solUsdcMarketSeat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'solUsdcMarketSolTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'solUsdcMarketUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'protocolLiquidateUsdcMarket',
			docs: [
				'After `appoint_protocol_liquidator` the protocol can liquidate a USDC denominated market position',
				'to fulfill their withdrawal request.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'protocol',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'protocolUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'usdcMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'updateVault',
			docs: [
				'Update the fees, profit share, min deposit, max capacity, delegate, and more.',
			],
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'manager',
					isMut: false,
					isSigner: true,
				},
			],
			args: [
				{
					name: 'params',
					type: {
						defined: 'UpdateVaultParams',
					},
				},
			],
		},
		{
			name: 'managerWithdraw',
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'manager',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'managerQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'quoteMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'managerDeposit',
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'manager',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'managerQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [
				{
					name: 'amount',
					type: 'u64',
				},
			],
		},
		{
			name: 'managerRequestWithdraw',
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'manager',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
			],
			args: [
				{
					name: 'withdrawAmount',
					type: 'u64',
				},
				{
					name: 'withdrawUnit',
					type: {
						defined: 'WithdrawUnit',
					},
				},
			],
		},
		{
			name: 'managerCancelWithdrawRequest',
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'manager',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'protocolWithdraw',
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'protocol',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'protocolQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'seat',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'baseMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'quoteMint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'vaultQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketBaseTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'marketQuoteTokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenProgram',
					isMut: false,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'protocolRequestWithdraw',
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'protocol',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
			],
			args: [
				{
					name: 'withdrawAmount',
					type: 'u64',
				},
				{
					name: 'withdrawUnit',
					type: {
						defined: 'WithdrawUnit',
					},
				},
			],
		},
		{
			name: 'protocolCancelWithdrawRequest',
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'protocol',
					isMut: false,
					isSigner: true,
				},
				{
					name: 'marketRegistry',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'vaultUsdcTokenAccount',
					isMut: true,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'cancelAllOrders',
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.',
					],
				},
				{
					name: 'delegate',
					isMut: false,
					isSigner: true,
					docs: [
						'Is manager by default, but can be delegated to another pubkey using `update_delegate`',
					],
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
			],
			args: [],
		},
		{
			name: 'cancelMultipleOrdersById',
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
					docs: [
						'If delegate has authority to sign for vault, then any Phoenix CPI is valid.',
						'Phoenix CPI validates that opaque instruction data is a [`PhoenixInstruction`],',
						'so this is safe since any Phoenix CPI is secure.',
					],
				},
				{
					name: 'delegate',
					isMut: false,
					isSigner: true,
					docs: [
						'Is manager by default, but can be delegated to another pubkey using `update_delegate`',
					],
				},
				{
					name: 'phoenix',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'logAuthority',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'market',
					isMut: true,
					isSigner: false,
				},
			],
			args: [
				{
					name: 'params',
					type: {
						defined: 'CancelMultipleOrdersParams',
					},
				},
			],
		},
	],
	accounts: [
		{
			name: 'investor',
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'vault',
						docs: ['The vault deposited into'],
						type: 'publicKey',
					},
					{
						name: 'pubkey',
						docs: [
							"The vault depositor account's pubkey. It is a pda of vault and authority",
						],
						type: 'publicKey',
					},
					{
						name: 'authority',
						docs: [
							'The authority is the address w permission to deposit/withdraw',
						],
						type: 'publicKey',
					},
					{
						name: 'vaultShares',
						docs: [
							"share of vault owned by this depositor. vault_shares / vault.total_shares is depositor's ownership of vault_equity",
						],
						type: 'u128',
					},
					{
						name: 'lastWithdrawRequest',
						docs: ['last withdraw request'],
						type: {
							defined: 'WithdrawRequest',
						},
					},
					{
						name: 'lastValidTs',
						docs: ['creation ts of vault depositor'],
						type: 'i64',
					},
					{
						name: 'netDeposits',
						docs: ['lifetime net deposits of vault depositor for the vault'],
						type: 'i64',
					},
					{
						name: 'totalDeposits',
						docs: ['lifetime total deposits'],
						type: 'u64',
					},
					{
						name: 'totalWithdraws',
						docs: ['lifetime total withdraws'],
						type: 'u64',
					},
					{
						name: 'cumulativeProfitShareAmount',
						docs: [
							'the token amount of gains the vault depositor has paid performance fees on (in other words, cumulative profit)',
						],
						type: 'i64',
					},
					{
						name: 'profitShareFeePaid',
						docs: [
							'the token amount profit share paid out to the manager and protocol',
						],
						type: 'u64',
					},
					{
						name: 'vaultSharesBase',
						docs: ['the exponent for vault_shares decimal places'],
						type: 'u32',
					},
					{
						name: 'padding1',
						type: 'u32',
					},
					{
						name: 'padding',
						type: {
							array: ['u64', 8],
						},
					},
				],
			},
		},
		{
			name: 'marketRegistry',
			docs: [
				'DriftVaults validates vault user positions against the remaining accounts provided for those markets.',
				'If the remaining accounts do not contain every market the user has a position in, then the instruction errors.',
				'For Phoenix, we use our MarketRegistry as the official source of truth for the "list of markets",',
				"and we can get the TraderState for the vault within each market to determine the vault's positions.",
				'If the remaining accounts do not contain every market in the MarketRegistry that the vault has a position in,',
				'then the instruction will error.',
			],
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'authority',
						docs: [
							'Authority over this account. This is a program admin-level keypair.',
						],
						type: 'publicKey',
					},
					{
						name: 'solUsdcMarket',
						docs: ['Phoenix SOL/USDC market'],
						type: 'publicKey',
					},
					{
						name: 'usdcMint',
						docs: [
							'Phoenix markets are denominated in USDC or SOL, so we must pre-define this',
						],
						type: 'publicKey',
					},
					{
						name: 'solMint',
						docs: [
							'Phoenix markets are denominated in USDC or SOL, so we must pre-define this',
						],
						type: 'publicKey',
					},
				],
			},
		},
		{
			name: 'vault',
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'name',
						docs: [
							'The name of the vault. Vault pubkey is derived from this name.',
						],
						type: {
							array: ['u8', 32],
						},
					},
					{
						name: 'pubkey',
						docs: [
							"The vault's pubkey. It is a PDA also used as the authority token accounts",
						],
						type: 'publicKey',
					},
					{
						name: 'manager',
						docs: [
							'The manager of the vault who has ability to update vault config,',
							'and earns a profit share or management fee.',
						],
						type: 'publicKey',
					},
					{
						name: 'usdcMint',
						docs: ['The Phoenix USDC mint.'],
						type: 'publicKey',
					},
					{
						name: 'solMint',
						docs: ['The Phoenix (wrapped) SOL mint.'],
						type: 'publicKey',
					},
					{
						name: 'usdcTokenAccount',
						docs: [
							'The USDC token account investor transfer with,',
							'and the vault transfer to Phoenix markets with.',
						],
						type: 'publicKey',
					},
					{
						name: 'solTokenAccount',
						docs: [
							'The SOL token account investor transfer with,',
							'and the vault transfer to Phoenix markets with.',
						],
						type: 'publicKey',
					},
					{
						name: 'liquidator',
						docs: [
							'The delegate (investor) handling liquidation for an investor to withdraw their funds.',
						],
						type: 'publicKey',
					},
					{
						name: 'delegate',
						docs: [
							'The delegate is the "portfolio manager", "trader", or "bot" that trades the vault assets.',
							'It can swap 100% of vault tokens.',
							'This is the manager by default.',
						],
						type: 'publicKey',
					},
					{
						name: 'investorShares',
						docs: ['The sum of all shares held by the investors'],
						type: 'u128',
					},
					{
						name: 'totalShares',
						docs: [
							'The sum of all shares: investor deposits, manager deposits, manager profit/fee, and protocol profit/fee.',
							'The manager deposits are total_shares - investor_shares - protocol_profit_and_fee_shares.',
						],
						type: 'u128',
					},
					{
						name: 'lastFeeUpdateTs',
						docs: ['Last fee update unix timestamp'],
						type: 'i64',
					},
					{
						name: 'liquidationStartTs',
						docs: ['When the liquidation starts'],
						type: 'i64',
					},
					{
						name: 'redeemPeriod',
						docs: [
							'The period (in seconds) that an investor must wait after requesting a withdrawal to transfer funds.',
							'The maximum is 90 days.',
							'This is only updatable to lesser values.',
						],
						type: 'i64',
					},
					{
						name: 'totalWithdrawRequested',
						docs: ['The sum of all outstanding withdraw requests'],
						type: 'u64',
					},
					{
						name: 'maxTokens',
						docs: [
							'Max token capacity, once hit/passed vault will reject new deposits.',
							'This is only updatable to lesser values.',
						],
						type: 'u64',
					},
					{
						name: 'managementFee',
						docs: [
							'The annual fee charged on deposits by the manager.',
							'Traditional funds typically charge 2% per year on assets under management.',
							'This is only updatable to lesser values.',
						],
						type: 'i64',
					},
					{
						name: 'initTs',
						docs: ['Timestamp vault initialized'],
						type: 'i64',
					},
					{
						name: 'netDeposits',
						docs: ['The net deposits for the vault'],
						type: 'i64',
					},
					{
						name: 'managerNetDeposits',
						docs: ['The net deposits for the manager'],
						type: 'i64',
					},
					{
						name: 'totalDeposits',
						docs: ['Total deposits'],
						type: 'u64',
					},
					{
						name: 'totalWithdraws',
						docs: ['Total withdraws'],
						type: 'u64',
					},
					{
						name: 'managerTotalDeposits',
						docs: ['Total deposits for the manager'],
						type: 'u64',
					},
					{
						name: 'managerTotalWithdraws',
						docs: ['Total withdraws for the manager'],
						type: 'u64',
					},
					{
						name: 'managerTotalFee',
						docs: ['Total management fee accrued by the manager'],
						type: 'i64',
					},
					{
						name: 'managerTotalProfitShare',
						docs: ['Total profit share accrued by the manager'],
						type: 'u64',
					},
					{
						name: 'minDepositAmount',
						docs: [
							'The minimum deposit amount.',
							'This is only updatable to lesser values.',
						],
						type: 'u64',
					},
					{
						name: 'lastManagerWithdrawRequest',
						type: {
							defined: 'WithdrawRequest',
						},
					},
					{
						name: 'sharesBase',
						docs: [
							'The base 10 exponent of the shares (given massive share inflation can occur at near zero vault equity)',
						],
						type: 'u32',
					},
					{
						name: 'profitShare',
						docs: [
							'Percentage the manager charges on all profits realized by depositors (multiplied by PERCENTAGE_PRECISION).',
							'Traditional funds typically charge 20% of profits.',
							'This is only updatable to lesser values.',
						],
						type: 'u32',
					},
					{
						name: 'hurdleRate',
						docs: [
							'Vault manager only collect incentive fees during periods when returns are higher than this amount (multiplied by PERCENTAGE_PRECISION).',
						],
						type: 'u32',
					},
					{
						name: 'protocolProfitShare',
						docs: [
							'Percentage the protocol charges on all profits realized by depositors: PERCENTAGE_PRECISION',
						],
						type: 'u32',
					},
					{
						name: 'protocol',
						docs: [
							'The protocol, company, or entity that services the product using this vault.',
							'The protocol is not allowed to deposit into the vault but can profit share and collect annual fees just like the manager.',
						],
						type: 'publicKey',
					},
					{
						name: 'protocolProfitAndFeeShares',
						docs: [
							'The shares from profit share and annual fee unclaimed by the protocol.',
						],
						type: 'u128',
					},
					{
						name: 'protocolFee',
						docs: [
							'The annual fee charged on deposits by the protocol (traditional hedge funds typically charge 2% per year on assets under management).',
							"Unlike the management fee this can't be negative.",
						],
						type: 'u64',
					},
					{
						name: 'protocolTotalWithdraws',
						docs: ['Total withdraws for the protocol'],
						type: 'u64',
					},
					{
						name: 'protocolTotalFee',
						docs: [
							'Total fee charged by the protocol (annual management fee + profit share).',
							"Unlike the management fee this can't be negative.",
						],
						type: 'u64',
					},
					{
						name: 'protocolTotalProfitShare',
						docs: ['Total profit share charged by the protocol'],
						type: 'u64',
					},
					{
						name: 'lastProtocolWithdrawRequest',
						type: {
							defined: 'WithdrawRequest',
						},
					},
					{
						name: 'positions',
						type: {
							array: [
								{
									defined: 'MarketPosition',
								},
								8,
							],
						},
					},
					{
						name: 'permissioned',
						docs: ['Whether anyone can be an investor'],
						type: 'bool',
					},
					{
						name: 'bump',
						docs: ['The bump for the vault PDA'],
						type: 'u8',
					},
					{
						name: 'padding',
						type: {
							array: ['u8', 6],
						},
					},
				],
			},
		},
	],
	types: [
		{
			name: 'MarketLookupTableParams',
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'solUsdcMarket',
						type: 'publicKey',
					},
					{
						name: 'usdcMint',
						type: 'publicKey',
					},
					{
						name: 'solMint',
						type: 'publicKey',
					},
				],
			},
		},
		{
			name: 'CancelMultipleOrdersParams',
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'orders',
						type: {
							vec: {
								defined: 'CancelOrderParams',
							},
						},
					},
				],
			},
		},
		{
			name: 'CancelOrderParams',
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'side',
						type: {
							defined: 'Side',
						},
					},
					{
						name: 'priceInTicks',
						type: 'u64',
					},
					{
						name: 'orderSequenceNumber',
						type: 'u64',
					},
				],
			},
		},
		{
			name: 'VaultParams',
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'name',
						type: {
							array: ['u8', 32],
						},
					},
					{
						name: 'redeemPeriod',
						type: 'i64',
					},
					{
						name: 'maxTokens',
						type: 'u64',
					},
					{
						name: 'managementFee',
						type: 'i64',
					},
					{
						name: 'minDepositAmount',
						type: 'u64',
					},
					{
						name: 'profitShare',
						type: 'u32',
					},
					{
						name: 'hurdleRate',
						type: 'u32',
					},
					{
						name: 'permissioned',
						type: 'bool',
					},
					{
						name: 'protocol',
						type: 'publicKey',
					},
					{
						name: 'protocolFee',
						type: 'u64',
					},
					{
						name: 'protocolProfitShare',
						type: 'u32',
					},
				],
			},
		},
		{
			name: 'PlaceOrderParams',
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'order',
						type: 'bytes',
					},
				],
			},
		},
		{
			name: 'UpdateVaultParams',
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'redeemPeriod',
						type: {
							option: 'i64',
						},
					},
					{
						name: 'maxTokens',
						type: {
							option: 'u64',
						},
					},
					{
						name: 'managementFee',
						type: {
							option: 'i64',
						},
					},
					{
						name: 'minDepositAmount',
						type: {
							option: 'u64',
						},
					},
					{
						name: 'profitShare',
						type: {
							option: 'u32',
						},
					},
					{
						name: 'hurdleRate',
						type: {
							option: 'u32',
						},
					},
					{
						name: 'permissioned',
						type: {
							option: 'bool',
						},
					},
					{
						name: 'delegate',
						type: {
							option: 'publicKey',
						},
					},
				],
			},
		},
		{
			name: 'MarketPosition',
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'market',
						type: 'publicKey',
					},
					{
						name: 'quoteLotsLocked',
						type: 'u64',
					},
					{
						name: 'quoteLotsFree',
						type: 'u64',
					},
					{
						name: 'baseLotsLocked',
						type: 'u64',
					},
					{
						name: 'baseLotsFree',
						type: 'u64',
					},
				],
			},
		},
		{
			name: 'MarketTransferParams',
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'quoteLots',
						type: 'u64',
					},
					{
						name: 'baseLots',
						type: 'u64',
					},
				],
			},
		},
		{
			name: 'WithdrawRequest',
			type: {
				kind: 'struct',
				fields: [
					{
						name: 'shares',
						docs: ['request shares of vault withdraw'],
						type: 'u128',
					},
					{
						name: 'value',
						docs: ['requested value in USDC of shares for withdraw'],
						type: 'u64',
					},
					{
						name: 'ts',
						docs: ['request ts of vault withdraw'],
						type: 'i64',
					},
				],
			},
		},
		{
			name: 'Side',
			type: {
				kind: 'enum',
				variants: [
					{
						name: 'Bid',
					},
					{
						name: 'Ask',
					},
				],
			},
		},
		{
			name: 'InvestorAction',
			type: {
				kind: 'enum',
				variants: [
					{
						name: 'Deposit',
					},
					{
						name: 'WithdrawRequest',
					},
					{
						name: 'CancelWithdrawRequest',
					},
					{
						name: 'Withdraw',
					},
					{
						name: 'FeePayment',
					},
				],
			},
		},
		{
			name: 'WithdrawUnit',
			type: {
				kind: 'enum',
				variants: [
					{
						name: 'Shares',
					},
					{
						name: 'Token',
					},
					{
						name: 'SharesPercent',
					},
				],
			},
		},
	],
	events: [
		{
			name: 'VaultRecord',
			fields: [
				{
					name: 'ts',
					type: 'i64',
					index: false,
				},
				{
					name: 'spotMarketIndex',
					type: 'u16',
					index: false,
				},
				{
					name: 'vaultEquityBefore',
					type: 'u64',
					index: false,
				},
			],
		},
		{
			name: 'InvestorRecord',
			fields: [
				{
					name: 'ts',
					type: 'i64',
					index: false,
				},
				{
					name: 'vault',
					type: 'publicKey',
					index: false,
				},
				{
					name: 'depositorAuthority',
					type: 'publicKey',
					index: false,
				},
				{
					name: 'action',
					type: {
						defined: 'InvestorAction',
					},
					index: false,
				},
				{
					name: 'amount',
					type: 'u64',
					index: false,
				},
				{
					name: 'usdcMint',
					type: 'publicKey',
					index: false,
				},
				{
					name: 'solMint',
					type: 'publicKey',
					index: false,
				},
				{
					name: 'vaultSharesBefore',
					type: 'u128',
					index: false,
				},
				{
					name: 'vaultSharesAfter',
					type: 'u128',
					index: false,
				},
				{
					name: 'vaultEquityBefore',
					type: 'u64',
					index: false,
				},
				{
					name: 'userVaultSharesBefore',
					type: 'u128',
					index: false,
				},
				{
					name: 'totalVaultSharesBefore',
					type: 'u128',
					index: false,
				},
				{
					name: 'protocolSharesBefore',
					type: 'u128',
					index: false,
				},
				{
					name: 'userVaultSharesAfter',
					type: 'u128',
					index: false,
				},
				{
					name: 'totalVaultSharesAfter',
					type: 'u128',
					index: false,
				},
				{
					name: 'protocolSharesAfter',
					type: 'u128',
					index: false,
				},
				{
					name: 'protocolProfitShare',
					type: 'u64',
					index: false,
				},
				{
					name: 'protocolFee',
					type: 'i64',
					index: false,
				},
				{
					name: 'protocolFeeShares',
					type: 'i64',
					index: false,
				},
				{
					name: 'managerProfitShare',
					type: 'u64',
					index: false,
				},
				{
					name: 'managementFee',
					type: 'i64',
					index: false,
				},
				{
					name: 'managementFeeShares',
					type: 'i64',
					index: false,
				},
			],
		},
	],
	errors: [
		{
			code: 6000,
			name: 'Default',
			msg: 'Default',
		},
		{
			code: 6001,
			name: 'InvalidVaultRebase',
			msg: 'InvalidVaultRebase',
		},
		{
			code: 6002,
			name: 'InvalidVaultSharesDetected',
			msg: 'InvalidVaultSharesDetected',
		},
		{
			code: 6003,
			name: 'CannotWithdrawBeforeRedeemPeriodEnd',
			msg: 'CannotWithdrawBeforeRedeemPeriodEnd',
		},
		{
			code: 6004,
			name: 'InvalidVaultWithdraw',
			msg: 'InvalidVaultWithdraw',
		},
		{
			code: 6005,
			name: 'InsufficientVaultShares',
			msg: 'InsufficientVaultShares',
		},
		{
			code: 6006,
			name: 'InvalidVaultWithdrawSize',
			msg: 'InvalidVaultWithdrawSize',
		},
		{
			code: 6007,
			name: 'InvalidVaultForNewDepositors',
			msg: 'InvalidVaultForNewDepositors',
		},
		{
			code: 6008,
			name: 'VaultWithdrawRequestInProgress',
			msg: 'VaultWithdrawRequestInProgress',
		},
		{
			code: 6009,
			name: 'VaultIsAtCapacity',
			msg: 'VaultIsAtCapacity',
		},
		{
			code: 6010,
			name: 'InvalidVaultDepositorInitialization',
			msg: 'InvalidVaultDepositorInitialization',
		},
		{
			code: 6011,
			name: 'DelegateNotAvailableForLiquidation',
			msg: 'DelegateNotAvailableForLiquidation',
		},
		{
			code: 6012,
			name: 'InvalidLiquidator',
			msg: 'InvalidLiquidator',
		},
		{
			code: 6013,
			name: 'LiquidationExpired',
			msg: 'LiquidationExpired',
		},
		{
			code: 6014,
			name: 'InvalidEquityValue',
			msg: 'InvalidEquityValue',
		},
		{
			code: 6015,
			name: 'VaultInLiquidation',
			msg: 'VaultInLiquidation',
		},
		{
			code: 6016,
			name: 'InvestorCanWithdraw',
			msg: 'InvestorCanWithdraw',
		},
		{
			code: 6017,
			name: 'InvalidVaultInitialization',
			msg: 'InvalidVaultInitialization',
		},
		{
			code: 6018,
			name: 'InvalidVaultUpdate',
			msg: 'InvalidVaultUpdate',
		},
		{
			code: 6019,
			name: 'PermissionedVault',
			msg: 'PermissionedVault',
		},
		{
			code: 6020,
			name: 'WithdrawInProgress',
			msg: 'WithdrawInProgress',
		},
		{
			code: 6021,
			name: 'SharesPercentTooLarge',
			msg: 'SharesPercentTooLarge',
		},
		{
			code: 6022,
			name: 'InvalidVaultDeposit',
			msg: 'InvalidVaultDeposit',
		},
		{
			code: 6023,
			name: 'OngoingLiquidation',
			msg: 'OngoingLiquidation',
		},
		{
			code: 6024,
			name: 'VaultProtocolMissing',
			msg: 'VaultProtocolMissing',
		},
		{
			code: 6025,
			name: 'BnConversion',
			msg: 'BnConversion',
		},
		{
			code: 6026,
			name: 'MathError',
			msg: 'MathError',
		},
		{
			code: 6027,
			name: 'CastError',
			msg: 'CastError',
		},
		{
			code: 6028,
			name: 'UnwrapError',
			msg: 'UnwrapError',
		},
		{
			code: 6029,
			name: 'MarketDeserializationError',
			msg: 'MarketDeserializationError',
		},
		{
			code: 6030,
			name: 'UnrecognizedQuoteMint',
			msg: 'UnrecognizedQuoteMint',
		},
		{
			code: 6031,
			name: 'SolMarketMissing',
			msg: 'SolMarketMissing',
		},
		{
			code: 6032,
			name: 'MarketMissingInRemainingAccounts',
			msg: 'MarketMissingInRemainingAccounts',
		},
		{
			code: 6033,
			name: 'MarketRegistryMismatch',
			msg: 'MarketRegistryMismatch',
		},
		{
			code: 6034,
			name: 'OrderPacketDeserialization',
			msg: 'OrderPacketDeserialization',
		},
		{
			code: 6035,
			name: 'OrderPacketMustUseDepositedFunds',
			msg: 'OrderPacketMustUseDepositedFunds',
		},
		{
			code: 6036,
			name: 'InvalidPhoenixInstruction',
			msg: 'InvalidPhoenixInstruction',
		},
		{
			code: 6037,
			name: 'OrderPacketMustBeTakeOnly',
			msg: 'OrderPacketMustBeTakeOnly',
		},
		{
			code: 6038,
			name: 'BaseLotsMustBeZero',
			msg: 'BaseLotsMustBeZero',
		},
		{
			code: 6039,
			name: 'TraderStateNotFound',
			msg: 'TraderStateNotFound',
		},
		{
			code: 6040,
			name: 'MarketPositionNotFound',
			msg: 'MarketPositionNotFound',
		},
	],
};
