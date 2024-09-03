export type JupiterVaults = {
	version: '0.1.0';
	name: 'jupiter_vaults';
	instructions: [
		{
			name: 'initializeVault';
			accounts: [
				{
					name: 'vault';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'tokenAccount';
					isMut: true;
					isSigner: false;
				},
				{
					name: 'mint';
					isMut: false;
					isSigner: false;
				},
				{
					name: 'manager';
					isMut: false;
					isSigner: true;
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
							'the token amount of gains the vault depositor has paid performance fees on'
						];
						type: 'i64';
					},
					{
						name: 'profitShareFeePaid';
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
						name: 'mint';
						docs: [
							'The token mint the vault deposits into/withdraws from (e.g., USDC).'
						];
						type: 'publicKey';
					},
					{
						name: 'tokenAccount';
						docs: [
							'The vault token account. Used to receive tokens between deposits and withdrawals.',
							'This is a PDA of the vault signer seed and the mint defined for this vault.'
						];
						type: 'publicKey';
					},
					{
						name: 'delegate';
						docs: [
							'The delegate is the "portfolio manager", "trader", or "bot" that manages the vault\'s assets.',
							'They can swap 100% of vault tokens using Jupiter.'
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
						name: 'spotMarketIndex';
						type: 'u16';
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
						docs: [
							'requested value (in vault spot_market_index) of shares for withdraw'
						];
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
					name: 'mint';
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
			name: 'InvalidEquityValue';
			msg: 'InvalidEquityValue';
		},
		{
			code: 6013;
			name: 'VaultInLiquidation';
			msg: 'VaultInLiquidation';
		},
		{
			code: 6014;
			name: 'DriftError';
			msg: 'DriftError';
		},
		{
			code: 6015;
			name: 'InvalidVaultInitialization';
			msg: 'InvalidVaultInitialization';
		},
		{
			code: 6016;
			name: 'InvalidVaultUpdate';
			msg: 'InvalidVaultUpdate';
		},
		{
			code: 6017;
			name: 'PermissionedVault';
			msg: 'PermissionedVault';
		},
		{
			code: 6018;
			name: 'WithdrawInProgress';
			msg: 'WithdrawInProgress';
		},
		{
			code: 6019;
			name: 'SharesPercentTooLarge';
			msg: 'SharesPercentTooLarge';
		},
		{
			code: 6020;
			name: 'InvalidVaultDeposit';
			msg: 'InvalidVaultDeposit';
		},
		{
			code: 6021;
			name: 'OngoingLiquidation';
			msg: 'OngoingLiquidation';
		},
		{
			code: 6022;
			name: 'VaultProtocolMissing';
			msg: 'VaultProtocolMissing';
		},
		{
			code: 6023;
			name: 'BnConversion';
			msg: 'BnConversion';
		},
		{
			code: 6024;
			name: 'MathError';
			msg: 'MathError';
		},
		{
			code: 6025;
			name: 'CastError';
			msg: 'CastError';
		},
		{
			code: 6026;
			name: 'UnwrapError';
			msg: 'UnwrapError';
		}
	];
};

export const IDL: JupiterVaults = {
	version: '0.1.0',
	name: 'jupiter_vaults',
	instructions: [
		{
			name: 'initializeVault',
			accounts: [
				{
					name: 'vault',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'tokenAccount',
					isMut: true,
					isSigner: false,
				},
				{
					name: 'mint',
					isMut: false,
					isSigner: false,
				},
				{
					name: 'manager',
					isMut: false,
					isSigner: true,
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
							'the token amount of gains the vault depositor has paid performance fees on',
						],
						type: 'i64',
					},
					{
						name: 'profitShareFeePaid',
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
						name: 'mint',
						docs: [
							'The token mint the vault deposits into/withdraws from (e.g., USDC).',
						],
						type: 'publicKey',
					},
					{
						name: 'tokenAccount',
						docs: [
							'The vault token account. Used to receive tokens between deposits and withdrawals.',
							'This is a PDA of the vault signer seed and the mint defined for this vault.',
						],
						type: 'publicKey',
					},
					{
						name: 'delegate',
						docs: [
							'The delegate is the "portfolio manager", "trader", or "bot" that manages the vault\'s assets.',
							'They can swap 100% of vault tokens using Jupiter.',
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
						name: 'spotMarketIndex',
						type: 'u16',
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
						docs: [
							'requested value (in vault spot_market_index) of shares for withdraw',
						],
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
					name: 'mint',
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
			name: 'InvalidEquityValue',
			msg: 'InvalidEquityValue',
		},
		{
			code: 6013,
			name: 'VaultInLiquidation',
			msg: 'VaultInLiquidation',
		},
		{
			code: 6014,
			name: 'DriftError',
			msg: 'DriftError',
		},
		{
			code: 6015,
			name: 'InvalidVaultInitialization',
			msg: 'InvalidVaultInitialization',
		},
		{
			code: 6016,
			name: 'InvalidVaultUpdate',
			msg: 'InvalidVaultUpdate',
		},
		{
			code: 6017,
			name: 'PermissionedVault',
			msg: 'PermissionedVault',
		},
		{
			code: 6018,
			name: 'WithdrawInProgress',
			msg: 'WithdrawInProgress',
		},
		{
			code: 6019,
			name: 'SharesPercentTooLarge',
			msg: 'SharesPercentTooLarge',
		},
		{
			code: 6020,
			name: 'InvalidVaultDeposit',
			msg: 'InvalidVaultDeposit',
		},
		{
			code: 6021,
			name: 'OngoingLiquidation',
			msg: 'OngoingLiquidation',
		},
		{
			code: 6022,
			name: 'VaultProtocolMissing',
			msg: 'VaultProtocolMissing',
		},
		{
			code: 6023,
			name: 'BnConversion',
			msg: 'BnConversion',
		},
		{
			code: 6024,
			name: 'MathError',
			msg: 'MathError',
		},
		{
			code: 6025,
			name: 'CastError',
			msg: 'CastError',
		},
		{
			code: 6026,
			name: 'UnwrapError',
			msg: 'UnwrapError',
		},
	],
};
