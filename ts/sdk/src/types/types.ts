import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

export const PHOENIX_VAULTS_PROGRAM_ID = new PublicKey(
	'VAULT8EhRg1mduZJYCab7xkNq7ieXMQ1Tqec2LPU6jv'
);

export class WithdrawUnit {
	static readonly SHARES = { shares: {} };
	static readonly TOKEN = { token: {} };
	static readonly SHARES_PERCENT = { sharesPercent: {} };
}

export type WithdrawRequest = {
	shares: BN;
	value: BN;
	ts: BN;
};

export type VaultParams = {
	name: number[];
	redeemPeriod: BN;
	maxTokens: BN;
	managementFee: BN;
	minDepositAmount: BN;
	profitShare: number;
	hurdleRate: number;
	permissioned: boolean;
	protocol: PublicKey;
	protocolFee: BN;
	protocolProfitShare: number;
};

export type Vault = {
	name: number[];
	pubkey: PublicKey;
	manager: PublicKey;
	usdcMint: PublicKey;
	solMint: PublicKey;
	usdcTokenAccount: PublicKey;
	solTokenAccount: PublicKey;
	delegate: PublicKey;
	investorShares: BN;
	totalShares: BN;
	lastFeeUpdateTs: BN;
	redeemPeriod: BN;
	totalWithdrawRequested: BN;
	maxTokens: BN;
	managementFee: BN;
	initTs: BN;
	netDeposits: BN;
	managerNetDeposits: BN;
	totalDeposits: BN;
	totalWithdraws: BN;
	managerTotalDeposits: BN;
	managerTotalWithdraws: BN;
	managerTotalFee: BN;
	managerTotalProfitShare: BN;
	minDepositAmount: BN;
	lastManagerWithdrawRequest: WithdrawRequest;
	sharesBase: number;
	profitShare: number;
	hurdleRate: number;

	protocolProfitShare: number;
	protocol: PublicKey;
	protocolProfitAndFeeShares: BN;
	protocolFee: BN;
	protocolTotalWithdraws: BN;
	protocolTotalFee: BN;
	protocolTotalProfitShare: BN;
	lastProtocolWithdrawRequest: WithdrawRequest;

	permissioned: boolean;
	bump: number;
	padding: number[];
};

export type MarketTransferParams = {
	quoteLots: BN;
	baseLots: BN;
};

export type Investor = {
	vault: PublicKey;
	pubkey: PublicKey;
	authority: PublicKey;
	vaultShares: BN;
	lastWithdrawRequest: WithdrawRequest;
	lastValidTs: BN;
	netDeposits: BN;
	totalDeposits: BN;
	totalWithdraws: BN;
	cumulativeProfitShareAmount: BN;
	profitShareFeePaid: BN;
	vaultSharesBase: number;
	padding1: number;
	padding: BN[];
};
