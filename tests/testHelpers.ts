import * as anchor from '@coral-xyz/anchor';
import {
	getAssociatedTokenAddress,
	createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import {
	ComputeBudgetProgram,
	Connection,
	MessageV0,
	PublicKey,
	Signer,
	TransactionConfirmationStrategy,
	TransactionInstruction,
	VersionedTransaction,
} from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import {
	Investor,
	MarketPosition,
	OrderSide,
	PERCENTAGE_PRECISION,
	PhoenixVaults,
	QUOTE_PRECISION,
	UiMarketPosition,
	Vault,
	ZERO,
} from '../ts/sdk';
import {
	CancelMultipleOrdersByIdParams,
	CancelMultipleOrdersByIdWithFreeFundsInstructionArgs,
	CancelMultipleOrdersByIdWithFreeFundsStruct,
	deserializeMarketData,
	getExpectedOutAmountRouter,
	MarketState,
	OrderPacket,
	PlaceLimitOrderInstructionArgs,
	placeLimitOrderInstructionDiscriminator,
	PlaceLimitOrderStruct,
	PlaceLimitOrderWithFreeFundsInstructionArgs,
	placeLimitOrderWithFreeFundsInstructionDiscriminator,
	PlaceLimitOrderWithFreeFundsStruct,
	cancelMultipleOrdersByIdInstructionDiscriminator,
	Side,
	toNum,
} from '@ellipsis-labs/phoenix-sdk';

export async function simulate(
	connection: Connection,
	payer: Signer,
	ixs: TransactionInstruction[],
	signers: Signer[] = []
): Promise<void> {
	const instructions = [
		ComputeBudgetProgram.setComputeUnitLimit({
			units: 400_000,
		}),
		ComputeBudgetProgram.setComputeUnitPrice({
			microLamports: 10_000,
		}),
		...ixs,
	];

	const recentBlockhash = await connection
		.getLatestBlockhash()
		.then((res) => res.blockhash);
	const msg = new anchor.web3.TransactionMessage({
		payerKey: payer.publicKey,
		recentBlockhash,
		instructions,
	}).compileToV0Message();

	const tx = new anchor.web3.VersionedTransaction(msg);
	tx.sign([payer, ...signers]);

	console.log(
		'signers:',
		expectedSigners(tx).map((k) => k.toString())
	);
	try {
		const sim = await connection.simulateTransaction(tx, {
			sigVerify: false,
		});
		console.log('simulation:', sim.value.err, sim.value.logs);
	} catch (e: any) {
		const missingSigners = checkMissingSigners(tx);
		console.log(
			'missing signers:',
			missingSigners.map((k) => k.toString())
		);
		throw new Error(e);
	}
}

export async function sendAndConfirm(
	connection: Connection,
	payer: Signer,
	ixs: TransactionInstruction[],
	signers: Signer[] = []
): Promise<string> {
	try {
		const instructions = [
			ComputeBudgetProgram.setComputeUnitLimit({
				units: 400_000,
			}),
			ComputeBudgetProgram.setComputeUnitPrice({
				microLamports: 10_000,
			}),
			...ixs,
		];

		const recentBlockhash = await connection
			.getLatestBlockhash()
			.then((res) => res.blockhash);
		const msg = new anchor.web3.TransactionMessage({
			payerKey: payer.publicKey,
			recentBlockhash,
			instructions,
		}).compileToV0Message();
		const tx = new anchor.web3.VersionedTransaction(msg);
		tx.sign([payer, ...signers]);

		const sim = await connection.simulateTransaction(tx, {
			sigVerify: false,
		});
		if (sim.value.err !== null) {
			console.log('simulation:', sim.value.err, sim.value.logs);
			throw new Error(JSON.stringify(sim.value.err));
		}

		const sig = await connection.sendTransaction(tx, {
			skipPreflight: true,
		});
		const strategy = {
			signature: sig,
		} as TransactionConfirmationStrategy;
		const confirm = await connection.confirmTransaction(strategy);
		if (confirm.value.err) {
			throw new Error(JSON.stringify(confirm.value.err));
		}
		return sig;
	} catch (e: any) {
		throw new Error(e);
	}
}

function expectedSigners(tx: VersionedTransaction): PublicKey[] {
	const msg = tx.message as MessageV0;
	const signers = [];
	for (let i = 0; i < msg.staticAccountKeys.length; i++) {
		if (msg.isAccountSigner(i)) {
			signers.push(msg.staticAccountKeys[i]);
		}
	}
	return signers;
}

function checkMissingSigners(tx: VersionedTransaction): PublicKey[] {
	const msg = tx.message as MessageV0;
	const sigs = tx.signatures;
	let sigIndex = 0;
	const missingSigners = [];
	for (let i = 0; i < msg.staticAccountKeys.length; i++) {
		if (msg.isAccountSigner(i)) {
			const sig = sigs[sigIndex];
			if (sig.toString() === EMPTY_SIGNATURE.toString()) {
				missingSigners.push(msg.staticAccountKeys[i]);
			}
			sigIndex++;
		}
	}
	return missingSigners;
}

const EMPTY_SIGNATURE = Uint8Array.from([
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]);

export async function createAtaIdempotent(
	connection: Connection,
	owner: PublicKey,
	payer: PublicKey,
	tokenMintAddress: PublicKey
): Promise<TransactionInstruction[]> {
	const associatedTokenAccountAddress = await getAssociatedTokenAddress(
		tokenMintAddress,
		owner,
		true
	);

	const ata = await connection.getAccountInfo(
		associatedTokenAccountAddress,
		'confirmed'
	);
	const ixs: TransactionInstruction[] = [];
	if (ata === null || ata.data.length === 0) {
		ixs.push(
			createAssociatedTokenAccountInstruction(
				payer,
				associatedTokenAccountAddress,
				owner,
				tokenMintAddress
			)
		);
	}
	return ixs;
}

export async function createMarketTokenAccountIxs(
	connection: Connection,
	market: MarketState,
	trader: PublicKey,
	payer: Signer
): Promise<TransactionInstruction[]> {
	const baseAtaIxs = await createAtaIdempotent(
		connection,
		trader,
		payer.publicKey,
		market.data.header.baseParams.mintKey
	);
	const quoteAtaIxs = await createAtaIdempotent(
		connection,
		trader,
		payer.publicKey,
		market.data.header.quoteParams.mintKey
	);
	return [...baseAtaIxs, ...quoteAtaIxs];
}

export function signatureLink(sig: string, connection: Connection): string {
	const clusterUrl = encodeURIComponent(connection.rpcEndpoint);
	return `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${clusterUrl}`;
}

export function messageLink(
	tx: VersionedTransaction,
	connection: Connection
): string {
	const clusterUrl = encodeURIComponent(connection.rpcEndpoint);
	const serializedMessage: Buffer = Buffer.from(tx.message.serialize());
	const message = encodeURIComponent(serializedMessage.toString('base64'));
	return `https://explorer.solana.com/tx/inspector?message=${message}&cluster=custom&customUrl=${clusterUrl}`;
}

export function encodeLimitOrderPacket(packet: OrderPacket): Buffer {
	const args: PlaceLimitOrderInstructionArgs = {
		orderPacket: packet,
	};
	const [buffer] = PlaceLimitOrderStruct.serialize({
		instructionDiscriminator: placeLimitOrderInstructionDiscriminator,
		...args,
	});
	const order: Buffer = Buffer.from(buffer);
	return order;
}

export function encodeLimitOrderPacketWithFreeFunds(
	packet: OrderPacket
): Buffer {
	const args: PlaceLimitOrderWithFreeFundsInstructionArgs = {
		orderPacket: packet,
	};
	const [buffer] = PlaceLimitOrderWithFreeFundsStruct.serialize({
		instructionDiscriminator:
			placeLimitOrderWithFreeFundsInstructionDiscriminator,
		...args,
	});
	const order: Buffer = Buffer.from(buffer);
	return order;
}

export async function tokenBalance(
	conn: Connection,
	tokenAccount: PublicKey
): Promise<number> {
	const result = await conn.getTokenAccountBalance(tokenAccount);
	if (!result) {
		return 0;
	}
	const value: number | null = result.value.uiAmount;
	if (value) {
		return Number(value);
	} else {
		return 0;
	}
}

export async function fetchMarketState(
	conn: Connection,
	market: PublicKey
): Promise<MarketState> {
	const ai = await conn.getAccountInfo(market);
	if (!ai) {
		throw Error(`market ${market.toString()} not found`);
	}
	const buffer: Buffer = ai.data;
	const marketData = deserializeMarketData(buffer);
	return new MarketState({
		address: market,
		data: marketData,
	});
}

export interface UiTraderState {
	quoteUnitsFree: number;
	quoteUnitsLocked: number;
	baseUnitsFree: number;
	baseUnitsLocked: number;
}

export function parseTraderState(
	marketState: MarketState,
	trader: PublicKey
): UiTraderState {
	const traderState = marketState.data.traders.get(trader.toString());

	const quoteLotsFreeBigNum = traderState.quoteLotsFree;
	let quoteLotsFree: number;
	if (quoteLotsFreeBigNum instanceof BN) {
		quoteLotsFree = quoteLotsFreeBigNum.toNumber();
	} else {
		quoteLotsFree = quoteLotsFreeBigNum as number;
	}

	const quoteLotsLockedBigNum = traderState.quoteLotsLocked;
	let quoteLotsLocked: number;
	if (quoteLotsLockedBigNum instanceof BN) {
		quoteLotsLocked = quoteLotsLockedBigNum.toNumber();
	} else {
		quoteLotsLocked = quoteLotsLockedBigNum as number;
	}

	const baseLotsFreeBigNum = traderState.baseLotsFree;
	let baseLotsFree: number;
	if (baseLotsFreeBigNum instanceof BN) {
		baseLotsFree = baseLotsFreeBigNum.toNumber();
	} else {
		baseLotsFree = baseLotsFreeBigNum as number;
	}

	const baseLotsLockedBigNum = traderState.baseLotsLocked;
	let baseLotsLocked: number;
	if (baseLotsLockedBigNum instanceof BN) {
		baseLotsLocked = baseLotsLockedBigNum.toNumber();
	} else {
		baseLotsLocked = baseLotsLockedBigNum as number;
	}

	const quoteUnitsFree = marketState.quoteLotsToQuoteUnits(quoteLotsFree);
	const quoteUnitsLocked = marketState.quoteLotsToQuoteUnits(quoteLotsLocked);
	const baseUnitsFree = marketState.baseLotsToRawBaseUnits(baseLotsFree);
	const baseUnitsLocked = marketState.baseLotsToRawBaseUnits(baseLotsLocked);
	return {
		quoteUnitsFree,
		quoteUnitsLocked,
		baseUnitsFree,
		baseUnitsLocked,
	};
}

export async function fetchTraderState(
	conn: Connection,
	market: PublicKey,
	trader: PublicKey
): Promise<UiTraderState> {
	const marketState = await fetchMarketState(conn, market);
	return parseTraderState(marketState, trader);
}

export async function outAmount(
	conn: Connection,
	market: PublicKey,
	side: Side,
	inAmount: number,
	takerFeeBps?: number
) {
	const marketState = await fetchMarketState(conn, market);
	const uiLadder = marketState.getUiLadder(3, 0, 0);
	return getExpectedOutAmountRouter({
		uiLadder,
		side,
		takerFeeBps: takerFeeBps ?? marketState.data.takerFeeBps,
		inAmount,
	});
}

export async function amountPlusFee(
	conn: Connection,
	market: PublicKey,
	inAmount: number
) {
	const marketState = await fetchMarketState(conn, market);
	const takerFeeBps = marketState.data.takerFeeBps;
	return inAmount / (1 - takerFeeBps / 10000);
}

export async function amountMinusFee(
	conn: Connection,
	market: PublicKey,
	inAmount: number
) {
	const marketState = await fetchMarketState(conn, market);
	const takerFeeBps = marketState.data.takerFeeBps;
	return inAmount / (1 + takerFeeBps / 10000);
}

export async function calcFee(
	conn: Connection,
	market: PublicKey,
	side: Side,
	inAmount: number
) {
	const marketState = await fetchMarketState(conn, market);
	const takerFeeBps = marketState.data.takerFeeBps;
	if (side === Side.Bid) {
		return inAmount / (1 + takerFeeBps / 10000);
	} else {
		return inAmount / (1 - takerFeeBps / 10000);
	}
}

export function isAvailable(position: MarketPosition) {
	return (
		position.baseLotsFree.eq(ZERO) &&
		position.baseLotsLocked.eq(ZERO) &&
		position.quoteLotsFree.eq(ZERO) &&
		position.quoteLotsLocked.eq(ZERO)
	);
}

export async function fetchVaultEquity(
	program: anchor.Program<PhoenixVaults>,
	conn: Connection,
	vault: PublicKey
): Promise<number> {
	const vaultAcct = await program.account.vault.fetch(vault);
	let equity = 0;
	equity += await tokenBalance(conn, vaultAcct.usdcTokenAccount);
	for (const position of vaultAcct.positions) {
		if (isAvailable(position as MarketPosition)) {
			continue;
		}
		const marketState = await fetchMarketState(conn, position.market);
		const price = marketState.getUiLadder(1, 0, 0).bids[0].price;
		const vaultState = parseTraderState(marketState, vault);

		const baseQuoteUnits =
			(vaultState.baseUnitsFree + vaultState.baseUnitsLocked) * price;

		const quoteUnits =
			vaultState.quoteUnitsFree + vaultState.quoteUnitsLocked + baseQuoteUnits;
		equity += quoteUnits;
	}
	return equity;
}

export async function fetchVaultShares(
	program: anchor.Program<PhoenixVaults>,
	vault: PublicKey
): Promise<number> {
	const vaultAcct = await program.account.vault.fetch(vault);
	return vaultAcct.totalShares.toNumber();
}

export async function fetchInvestorShares(
	program: anchor.Program<PhoenixVaults>,
	investor: PublicKey
): Promise<number> {
	const investorAcct = await program.account.investor.fetch(investor);
	return investorAcct.vaultShares.toNumber();
}

export async function fetchManagerShares(
	program: anchor.Program<PhoenixVaults>,
	vault: PublicKey
): Promise<number> {
	const vaultAcct = await program.account.vault.fetch(vault);
	return vaultAcct.totalShares
		.sub(vaultAcct.investorShares)
		.sub(vaultAcct.protocolProfitAndFeeShares)
		.toNumber();
}

export async function fetchProtocolShares(
	program: anchor.Program<PhoenixVaults>,
	vault: PublicKey
): Promise<number> {
	const vaultAcct = await program.account.vault.fetch(vault);
	return vaultAcct.protocolProfitAndFeeShares.toNumber();
}

export async function fetchInvestorEquity(
	program: anchor.Program<PhoenixVaults>,
	conn: Connection,
	investor: PublicKey,
	vault: PublicKey
): Promise<number> {
	const investorShares = await fetchInvestorShares(program, investor);
	const vaultShares = await fetchVaultShares(program, vault);
	const vaultEquity = await fetchVaultEquity(program, conn, vault);
	// return (investorShares / vaultShares) * vaultEquity;
	const rawAmount = (investorShares / vaultShares) * vaultEquity;
	const rawAmountBN = new BN(rawAmount * QUOTE_PRECISION.toNumber());
	return rawAmountBN.toNumber() / QUOTE_PRECISION.toNumber();
}

export async function fetchManagerEquity(
	program: anchor.Program<PhoenixVaults>,
	conn: Connection,
	vault: PublicKey
): Promise<number> {
	const managerShares = await fetchManagerShares(program, vault);
	const vaultShares = await fetchVaultShares(program, vault);
	const vaultEquity = await fetchVaultEquity(program, conn, vault);
	// return (managerShares / vaultShares) * vaultEquity;
	const rawAmount = (managerShares / vaultShares) * vaultEquity;
	const rawAmountBN = new BN(rawAmount * QUOTE_PRECISION.toNumber());
	return rawAmountBN.toNumber() / QUOTE_PRECISION.toNumber();
}

export async function fetchProtocolEquity(
	program: anchor.Program<PhoenixVaults>,
	conn: Connection,
	vault: PublicKey
): Promise<number> {
	const protocolShares = await fetchProtocolShares(program, vault);
	const vaultShares = await fetchVaultShares(program, vault);
	const vaultEquity = await fetchVaultEquity(program, conn, vault);
	// return (protocolShares / vaultShares) * vaultEquity;
	const rawAmount = (protocolShares / vaultShares) * vaultEquity;
	const rawAmountBN = new BN(rawAmount * QUOTE_PRECISION.toNumber());
	return rawAmountBN.toNumber() / QUOTE_PRECISION.toNumber();
}

export function amountToShares(
	amount: BN,
	totalShares: BN,
	totalEquity: BN
): BN {
	let nShares: BN;
	if (totalEquity.gt(ZERO)) {
		nShares = amount.mul(totalShares).div(totalEquity);
	} else {
		nShares = amount;
	}

	return nShares;
}

export function sharesToAmount(
	nShares: BN,
	totalShares: BN,
	totalEquity: BN
): BN {
	let amount: BN;
	if (totalShares.gt(ZERO)) {
		amount = BN.max(ZERO, nShares.mul(totalEquity).div(totalShares));
	} else {
		amount = ZERO;
	}

	return amount;
}

function calculateProfitShare(
	investor: Investor,
	totalAmount: BN,
	vault: Vault
) {
	const profit = totalAmount.sub(
		investor.netDeposits.add(investor.cumulativeProfitShareAmount)
	);
	const profitShare = vault.profitShare + vault.protocolProfitShare;
	if (profit.gt(ZERO)) {
		return profit.mul(new BN(profitShare)).div(PERCENTAGE_PRECISION);
	}
	return ZERO;
}

export function calculateRealizedInvestorEquity(
	investor: Investor,
	vaultEquity: BN,
	vault: Vault
): BN {
	const investorAmount = sharesToAmount(
		investor.vaultShares,
		vault.totalShares,
		vaultEquity
	);
	const profitShareAmount = calculateProfitShare(
		investor,
		investorAmount,
		vault
	);
	return investorAmount.sub(profitShareAmount);
}

export async function fetchMarketPosition(
	program: anchor.Program<PhoenixVaults>,
	vault: PublicKey,
	market: PublicKey
): Promise<UiMarketPosition> {
	const marketState = await fetchMarketState(
		program.provider.connection,
		market
	);
	const vaultAcct = await program.account.vault.fetch(vault);
	const pos = (vaultAcct.positions as MarketPosition[]).find((pos) => {
		return pos.market.equals(market);
	});
	if (!pos) {
		throw Error(`MarketPosition not found in for market ${market.toString()}`);
	}

	const quoteLotsFreeBigNum = pos.quoteLotsFree;
	let quoteLotsFree: number;
	if (quoteLotsFreeBigNum instanceof BN) {
		quoteLotsFree = quoteLotsFreeBigNum.toNumber();
	} else {
		quoteLotsFree = quoteLotsFreeBigNum as number;
	}

	const quoteLotsLockedBigNum = pos.quoteLotsLocked;
	let quoteLotsLocked: number;
	if (quoteLotsLockedBigNum instanceof BN) {
		quoteLotsLocked = quoteLotsLockedBigNum.toNumber();
	} else {
		quoteLotsLocked = quoteLotsLockedBigNum as number;
	}

	const baseLotsFreeBigNum = pos.baseLotsFree;
	let baseLotsFree: number;
	if (baseLotsFreeBigNum instanceof BN) {
		baseLotsFree = baseLotsFreeBigNum.toNumber();
	} else {
		baseLotsFree = baseLotsFreeBigNum as number;
	}

	const baseLotsLockedBigNum = pos.baseLotsLocked;
	let baseLotsLocked: number;
	if (baseLotsLockedBigNum instanceof BN) {
		baseLotsLocked = baseLotsLockedBigNum.toNumber();
	} else {
		baseLotsLocked = baseLotsLockedBigNum as number;
	}

	const quoteUnitsFree = marketState.quoteLotsToQuoteUnits(quoteLotsFree);
	const quoteUnitsLocked = marketState.quoteLotsToQuoteUnits(quoteLotsLocked);
	const baseUnitsFree = marketState.baseLotsToRawBaseUnits(baseLotsFree);
	const baseUnitsLocked = marketState.baseLotsToRawBaseUnits(baseLotsLocked);
	return {
		market,
		quoteUnitsFree,
		quoteUnitsLocked,
		baseUnitsFree,
		baseUnitsLocked,
	};
}

export async function getTokenBalance(
	conn: Connection,
	tokenAccount: PublicKey
): Promise<number> {
	const result = await conn.getTokenAccountBalance(tokenAccount);
	if (!result) {
		return 0;
	}
	const value: number | null = result.value.uiAmount;
	if (value) {
		return Number(value);
	} else {
		return 0;
	}
}

export async function fetchOpenOrders(
	conn: Connection,
	market: PublicKey,
	trader: PublicKey
): Promise<
	{
		side: OrderSide;
		orderSequenceNumber: BN;
		priceInTicks: BN;
		baseLots: BN;
	}[]
> {
	const marketState = await fetchMarketState(conn, market);
	const traderState = marketState.data.traders.get(trader.toString());
	if (!traderState) {
		throw Error(`TraderState not found for trader ${trader.toString()}`);
	}
	const traderIndex = marketState.data.traderPubkeyToTraderIndex.get(
		trader.toString()
	);
	const orders = [];

	for (const [orderId, order] of marketState.data.bids) {
		if (toNum(order.traderIndex) === traderIndex) {
			let orderSequenceNumber: BN;
			if (orderId.orderSequenceNumber instanceof BN) {
				orderSequenceNumber = orderId.orderSequenceNumber;
			} else {
				orderSequenceNumber = new BN(orderId.orderSequenceNumber as number);
			}

			let priceInTicks: BN;
			if (orderId.priceInTicks instanceof BN) {
				priceInTicks = orderId.priceInTicks;
			} else {
				priceInTicks = new BN(orderId.priceInTicks as number);
			}

			let baseLots: BN;
			if (order.numBaseLots instanceof BN) {
				baseLots = order.numBaseLots;
			} else {
				baseLots = new BN(order.numBaseLots as number);
			}

			const bid = {
				side: OrderSide.BID,
				orderSequenceNumber,
				priceInTicks,
				baseLots,
			};
			orders.push(bid);
		}
	}

	for (const [orderId, order] of marketState.data.asks) {
		if (toNum(order.traderIndex) === traderIndex) {
			let orderSequenceNumber: BN;
			if (orderId.orderSequenceNumber instanceof BN) {
				orderSequenceNumber = orderId.orderSequenceNumber;
			} else {
				orderSequenceNumber = new BN(orderId.orderSequenceNumber as number);
			}

			let priceInTicks: BN;
			if (orderId.priceInTicks instanceof BN) {
				priceInTicks = orderId.priceInTicks;
			} else {
				priceInTicks = new BN(orderId.priceInTicks as number);
			}

			let baseLots: BN;
			if (order.numBaseLots instanceof BN) {
				baseLots = order.numBaseLots;
			} else {
				baseLots = new BN(order.numBaseLots as number);
			}

			const ask = {
				side: OrderSide.ASK,
				orderSequenceNumber,
				priceInTicks,
				baseLots,
			};
			orders.push(ask);
		}
	}
	return orders;
}

export function encodeCancelMultipleOrdersParams(
	params: CancelMultipleOrdersByIdParams
): Buffer {
	const args: CancelMultipleOrdersByIdWithFreeFundsInstructionArgs = {
		params,
	};
	const [buffer] = CancelMultipleOrdersByIdWithFreeFundsStruct.serialize({
		instructionDiscriminator: cancelMultipleOrdersByIdInstructionDiscriminator,
		...args,
	});
	return Buffer.from(buffer) as Buffer;
}
