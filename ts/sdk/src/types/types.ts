import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

export const PHOENIX_VAULTS_PROGRAM_ID = new PublicKey(
	'VLt8tiD4iUGVuxFRr1NiN63BYJGKua5rNpEcsEGzdBq'
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

	positions: MarketPosition[];

	permissioned: boolean;
	bump: number;
	padding: number[];
};

export type MarketPosition = {
	market: PublicKey;
	quoteLotsLocked: BN;
	quoteLotsFree: BN;
	baseLotsLocked: BN;
	baseLotsFree: BN;
};

export type UiMarketPosition = {
	market: PublicKey;
	quoteUnitsLocked: number;
	quoteUnitsFree: number;
	baseUnitsLocked: number;
	baseUnitsFree: number;
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

export type UpdateVaultParams = {
	redeemPeriod: BN | null;
	maxTokens: BN | null;
	minDepositAmount: BN | null;
	managementFee: BN | null;
	profitShare: number | null;
	hurdleRate: number | null;
	permissioned: boolean | null;
	delegate: PublicKey | null;
};

export class OrderSide {
	static readonly BID = { bid: {} };
	static readonly ASK = { ask: {} };
}

export type CancelOrderParams = {
	side: OrderSide;
	priceInTicks: BN;
	orderSequenceNumber: BN;
};
export type CancelMultipleOrdersParams = {
	orders: CancelOrderParams[];
};
