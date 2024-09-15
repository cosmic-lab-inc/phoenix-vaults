import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, Program, Provider } from '@coral-xyz/anchor';
import {
	AccountLayout,
	MintLayout,
	TOKEN_PROGRAM_ID,
	getMinimumBalanceForRentExemptMint,
	getMinimumBalanceForRentExemptAccount,
	createInitializeMintInstruction,
	createInitializeAccountInstruction,
	createMintToInstruction,
	createWrappedNativeAccount,
	getAssociatedTokenAddress,
	createAssociatedTokenAccountInstruction,
	// unpackAccount,
	// Account as TokenAccount,
} from '@solana/spl-token';
import {
	ComputeBudgetProgram,
	Connection,
	Keypair,
	MessageV0,
	PublicKey,
	sendAndConfirmTransaction,
	Signer,
	SystemProgram,
	Transaction,
	TransactionConfirmationStrategy,
	TransactionInstruction,
	TransactionSignature,
	VersionedTransaction,
} from '@solana/web3.js';
import { assert } from 'chai';
import buffer from 'buffer';
import { BN } from '@coral-xyz/anchor';
import {
	MOCK_JUP_MINT,
	MOCK_JUP_SOL_MARKET,
	MOCK_JUP_USDC_MARKET,
	MOCK_SOL_MINT,
	MOCK_SOL_USDC_MARKET,
	MOCK_USDC_MINT,
	PRICE_PRECISION,
} from '../ts/sdk';
import {
	deserializeMarketData,
	getExpectedOutAmountRouter,
	MarketState,
	OrderPacket,
	orderPacketBeet,
	PlaceLimitOrderInstructionArgs,
	placeLimitOrderInstructionDiscriminator,
	PlaceLimitOrderStruct,
	RawMarketConfig,
	Side,
	toNum,
} from '@cosmic-lab/phoenix-sdk';

export const MARKET_CONFIG: RawMarketConfig = {
	['localhost']: {
		tokens: [
			{
				name: 'SOL',
				symbol: 'SOL',
				mint: MOCK_SOL_MINT.publicKey.toString(),
				logoUri: '',
			},
			{
				name: 'USDC',
				symbol: 'USDC',
				mint: MOCK_USDC_MINT.publicKey.toString(),
				logoUri: '',
			},
			// {
			// 	name: 'JUP',
			// 	symbol: 'JUP',
			// 	mint: MOCK_JUP_MINT.publicKey.toString(),
			// 	logoUri: '',
			// },
		],
		markets: [
			{
				market: MOCK_SOL_USDC_MARKET.publicKey.toString(),
				baseMint: MOCK_SOL_MINT.publicKey.toString(),
				quoteMint: MOCK_USDC_MINT.publicKey.toString(),
			},
			// {
			// 	market: MOCK_JUP_SOL_MARKET.publicKey.toString(),
			// 	baseMint: MOCK_JUP_MINT.publicKey.toString(),
			// 	quoteMint: MOCK_SOL_MINT.publicKey.toString(),
			// },
			// {
			// 	market: MOCK_JUP_USDC_MARKET.publicKey.toString(),
			// 	baseMint: MOCK_JUP_MINT.publicKey.toString(),
			// 	quoteMint: MOCK_USDC_MINT.publicKey.toString(),
			// },
		],
	},
	['devnet']: {
		tokens: [],
		markets: [],
	},
	['mainnet-beta']: {
		tokens: [],
		markets: [],
	},
};

export type OraclePriceData = {
	price: BN;
	slot: BN;
	confidence: BN;
	hasSufficientNumberOfDataPoints: boolean;
	twap?: BN;
	twapConfidence?: BN;
	maxPrice?: BN; // pre-launch markets only
};

export async function mockOracle(
	price: number = 50 * 10e7,
	expo = -7,
	confidence?: number,
	tokenFeed?: Keypair
): Promise<PublicKey> {
	// default: create a $50 coin oracle
	const program = anchor.workspace.Pyth;

	anchor.setProvider(
		anchor.AnchorProvider.local(undefined, {
			commitment: 'confirmed',
			preflightCommitment: 'confirmed',
		})
	);

	const priceFeedAddress = await createPriceFeed({
		oracleProgram: program,
		initPrice: price,
		expo: expo,
		confidence,
		tokenFeed,
	});

	const feedData = await getFeedData(program, priceFeedAddress);
	if (feedData.price !== price) {
		console.log('mockOracle precision error:', feedData.price, '!=', price);
	}
	assert.ok(Math.abs(feedData.price - price) < 1e-10);

	return priceFeedAddress;
}

export async function mockMint(
	provider: Provider,
	mint?: Keypair
): Promise<Keypair> {
	let fakeMint: Keypair;
	if (mint) {
		fakeMint = mint;
	} else {
		fakeMint = anchor.web3.Keypair.generate();
	}
	const createMintAccountIx = SystemProgram.createAccount({
		// @ts-ignore
		fromPubkey: provider.wallet.publicKey,
		newAccountPubkey: fakeMint.publicKey,
		lamports: await getMinimumBalanceForRentExemptMint(provider.connection),
		space: MintLayout.span,
		programId: TOKEN_PROGRAM_ID,
	});
	const initCollateralMintIx = createInitializeMintInstruction(
		fakeMint.publicKey,
		6,
		// @ts-ignore
		provider.wallet.publicKey,
		// @ts-ignore
		provider.wallet.publicKey
	);

	const fakeTx = new Transaction();
	fakeTx.add(createMintAccountIx);
	fakeTx.add(initCollateralMintIx);

	await sendAndConfirmTransaction(
		provider.connection,
		fakeTx,
		// @ts-ignore
		[provider.wallet.payer, fakeMint],
		{
			skipPreflight: false,
			commitment: 'recent',
			preflightCommitment: 'recent',
		}
	);
	return fakeMint;
}

export async function mockUserUSDCAccount(
	fakeUSDCMint: Keypair,
	usdcMintAmount: BN,
	provider: Provider,
	owner?: PublicKey
): Promise<Keypair> {
	const userUSDCAccount = anchor.web3.Keypair.generate();
	const fakeUSDCTx = new Transaction();

	if (owner === undefined) {
		// @ts-ignore
		owner = provider.wallet.publicKey;
	}

	const createUSDCTokenAccountIx = SystemProgram.createAccount({
		// @ts-ignore
		fromPubkey: provider.wallet.publicKey,
		newAccountPubkey: userUSDCAccount.publicKey,
		lamports: await getMinimumBalanceForRentExemptAccount(provider.connection),
		space: AccountLayout.span,
		programId: TOKEN_PROGRAM_ID,
	});
	fakeUSDCTx.add(createUSDCTokenAccountIx);

	const initUSDCTokenAccountIx = createInitializeAccountInstruction(
		userUSDCAccount.publicKey,
		fakeUSDCMint.publicKey,
		owner
	);
	fakeUSDCTx.add(initUSDCTokenAccountIx);

	const mintToUserAccountTx = createMintToInstruction(
		fakeUSDCMint.publicKey,
		userUSDCAccount.publicKey,
		// @ts-ignore
		provider.wallet.publicKey,
		usdcMintAmount.toNumber()
	);
	fakeUSDCTx.add(mintToUserAccountTx);

	try {
		const _fakeUSDCTxResult = await sendAndConfirmTransaction(
			provider.connection,
			fakeUSDCTx,
			// @ts-ignore
			[provider.wallet.payer, userUSDCAccount],
			{
				skipPreflight: false,
				commitment: 'recent',
				preflightCommitment: 'recent',
			}
		);
		return userUSDCAccount;
	} catch (e) {
		console.log('failed to create mock user USDC account:', e);
	}
}

export async function mintTokens(
	fakeMint: Keypair,
	userAccount: PublicKey,
	usdcMintAmount: BN,
	provider: Provider
): Promise<void> {
	const tx = new Transaction();
	const mintToUserAccountTx = createMintToInstruction(
		fakeMint.publicKey,
		userAccount,
		// @ts-ignore
		provider.wallet.publicKey,
		usdcMintAmount.toNumber()
	);
	tx.add(mintToUserAccountTx);

	await sendAndConfirmTransaction(
		provider.connection,
		tx,
		// @ts-ignore
		[provider.wallet.payer],
		{
			skipPreflight: false,
			commitment: 'recent',
			preflightCommitment: 'recent',
		}
	);
}

export async function createFundedKeyPair(
	connection: Connection
): Promise<Keypair> {
	const userKeyPair = new Keypair();
	await connection.requestAirdrop(userKeyPair.publicKey, 10 ** 9);
	return userKeyPair;
}

export async function createUSDCAccountForUser(
	provider: AnchorProvider,
	userKeyPair: Keypair,
	usdcMint: Keypair,
	usdcAmount: BN
): Promise<PublicKey> {
	const userUSDCAccount = await mockUserUSDCAccount(
		usdcMint,
		usdcAmount,
		provider,
		userKeyPair.publicKey
	);
	return userUSDCAccount.publicKey;
}

export async function createWSolTokenAccountForUser(
	provider: AnchorProvider,
	userKeypair: Keypair,
	amount: BN
): Promise<PublicKey> {
	await provider.connection.requestAirdrop(
		userKeypair.publicKey,
		amount.toNumber() +
			(await getMinimumBalanceForRentExemptAccount(provider.connection))
	);
	return await createWrappedNativeAccount(
		provider.connection,
		// @ts-ignore
		provider.wallet.payer,
		userKeypair.publicKey,
		amount.toNumber()
	);
}

export async function printTxLogs(
	connection: Connection,
	txSig: TransactionSignature
): Promise<void> {
	console.log(
		'tx logs',
		(await connection.getTransaction(txSig, { commitment: 'confirmed' })).meta
			.logMessages
	);
}

const empty32Buffer = buffer.Buffer.alloc(32);
const PKorNull = (data) =>
	data.equals(empty32Buffer) ? null : new anchor.web3.PublicKey(data);

export const createPriceFeed = async ({
	oracleProgram,
	initPrice,
	confidence = undefined,
	expo = -4,
	tokenFeed,
}: {
	oracleProgram: Program;
	initPrice: number;
	confidence?: number;
	expo?: number;
	tokenFeed?: Keypair;
}): Promise<PublicKey> => {
	const conf = new BN(confidence) || new BN((initPrice / 10) * 10 ** -expo);
	let collateralTokenFeed: Keypair;
	if (tokenFeed) {
		collateralTokenFeed = tokenFeed;
	} else {
		collateralTokenFeed = Keypair.generate();
	}
	await oracleProgram.methods
		.initialize(new BN(initPrice * 10 ** -expo), expo, conf)
		.accounts({ price: collateralTokenFeed.publicKey })
		.signers([collateralTokenFeed])
		.preInstructions([
			anchor.web3.SystemProgram.createAccount({
				// @ts-ignore
				fromPubkey: oracleProgram.provider.wallet.publicKey,
				newAccountPubkey: collateralTokenFeed.publicKey,
				space: 3312,
				lamports:
					await oracleProgram.provider.connection.getMinimumBalanceForRentExemption(
						3312
					),
				programId: oracleProgram.programId,
			}),
		])
		.rpc();
	return collateralTokenFeed.publicKey;
};

export const setFeedPrice = async (
	oracleProgram: Program,
	newPrice: number,
	priceFeed: PublicKey
) => {
	const info = await oracleProgram.provider.connection.getAccountInfo(
		priceFeed
	);
	const data = parsePriceData(info.data);
	await oracleProgram.rpc.setPrice(new BN(newPrice * 10 ** -data.exponent), {
		accounts: { price: priceFeed },
	});
};
export const setFeedTwap = async (
	oracleProgram: Program,
	newTwap: number,
	priceFeed: PublicKey
) => {
	const info = await oracleProgram.provider.connection.getAccountInfo(
		priceFeed
	);
	const data = parsePriceData(info.data);
	await oracleProgram.rpc.setTwap(new BN(newTwap * 10 ** -data.exponent), {
		accounts: { price: priceFeed },
	});
};
export const getFeedData = async (
	oracleProgram: Program,
	priceFeed: PublicKey
) => {
	const info = await oracleProgram.provider.connection.getAccountInfo(
		priceFeed
	);
	return parsePriceData(info.data);
};

export const getOraclePriceData = async (
	oracleProgram: Program,
	priceFeed: PublicKey
): Promise<OraclePriceData> => {
	const info = await oracleProgram.provider.connection.getAccountInfo(
		priceFeed
	);
	const interData = parsePriceData(info.data);
	const oraclePriceData: OraclePriceData = {
		price: new BN(interData.price * PRICE_PRECISION.toNumber()),
		slot: new BN(interData.currentSlot.toString()),
		confidence: new BN(interData.confidence * PRICE_PRECISION.toNumber()),
		hasSufficientNumberOfDataPoints: true,
	};

	return oraclePriceData;
};

// https://github.com/nodejs/node/blob/v14.17.0/lib/internal/errors.js#L758
const ERR_BUFFER_OUT_OF_BOUNDS = () =>
	new Error('Attempt to access memory outside buffer bounds');
// https://github.com/nodejs/node/blob/v14.17.0/lib/internal/errors.js#L968
const ERR_INVALID_ARG_TYPE = (name, expected, actual) =>
	new Error(
		`The "${name}" argument must be of type ${expected}. Received ${actual}`
	);
// https://github.com/nodejs/node/blob/v14.17.0/lib/internal/errors.js#L1262
const ERR_OUT_OF_RANGE = (str, range, received) =>
	new Error(
		`The value of "${str} is out of range. It must be ${range}. Received ${received}`
	);
// https://github.com/nodejs/node/blob/v14.17.0/lib/internal/validators.js#L127-L130
function validateNumber(value, name) {
	if (typeof value !== 'number')
		throw ERR_INVALID_ARG_TYPE(name, 'number', value);
}
// https://github.com/nodejs/node/blob/v14.17.0/lib/internal/buffer.js#L68-L80
function boundsError(value, length) {
	if (Math.floor(value) !== value) {
		validateNumber(value, 'offset');
		throw ERR_OUT_OF_RANGE('offset', 'an integer', value);
	}
	if (length < 0) throw ERR_BUFFER_OUT_OF_BOUNDS();
	throw ERR_OUT_OF_RANGE('offset', `>= 0 and <= ${length}`, value);
}
function readBigInt64LE(buffer, offset = 0) {
	validateNumber(offset, 'offset');
	const first = buffer[offset];
	const last = buffer[offset + 7];
	if (first === undefined || last === undefined)
		boundsError(offset, buffer.length - 8);
	const val =
		buffer[offset + 4] +
		buffer[offset + 5] * 2 ** 8 +
		buffer[offset + 6] * 2 ** 16 +
		(last << 24); // Overflow
	return (
		(BigInt(val) << BigInt(32)) +
		BigInt(
			first +
				buffer[++offset] * 2 ** 8 +
				buffer[++offset] * 2 ** 16 +
				buffer[++offset] * 2 ** 24
		)
	);
}
// https://github.com/nodejs/node/blob/v14.17.0/lib/internal/buffer.js#L89-L107
function readBigUInt64LE(buffer, offset = 0) {
	validateNumber(offset, 'offset');
	const first = buffer[offset];
	const last = buffer[offset + 7];
	if (first === undefined || last === undefined)
		boundsError(offset, buffer.length - 8);
	const lo =
		first +
		buffer[++offset] * 2 ** 8 +
		buffer[++offset] * 2 ** 16 +
		buffer[++offset] * 2 ** 24;
	const hi =
		buffer[++offset] +
		buffer[++offset] * 2 ** 8 +
		buffer[++offset] * 2 ** 16 +
		last * 2 ** 24;
	return BigInt(lo) + (BigInt(hi) << BigInt(32)); // tslint:disable-line:no-bitwise
}

const parsePriceData = (data) => {
	// Pyth magic number.
	const magic = data.readUInt32LE(0);
	// Program version.
	const version = data.readUInt32LE(4);
	// Account type.
	const type = data.readUInt32LE(8);
	// Price account size.
	const size = data.readUInt32LE(12);
	// Price or calculation type.
	const priceType = data.readUInt32LE(16);
	// Price exponent.
	const exponent = data.readInt32LE(20);
	// Number of component prices.
	const numComponentPrices = data.readUInt32LE(24);
	// unused
	// const unused = accountInfo.data.readUInt32LE(28)
	// Currently accumulating price slot.
	const currentSlot = readBigUInt64LE(data, 32);
	// Valid on-chain slot of aggregate price.
	const validSlot = readBigUInt64LE(data, 40);
	// Time-weighted average price.
	const twapComponent = readBigInt64LE(data, 48);
	const twap = Number(twapComponent) * 10 ** exponent;
	// Annualized price volatility.
	const avolComponent = readBigUInt64LE(data, 56);
	const avol = Number(avolComponent) * 10 ** exponent;
	// Space for future derived values.
	const drv0Component = readBigInt64LE(data, 64);
	const drv0 = Number(drv0Component) * 10 ** exponent;
	const drv1Component = readBigInt64LE(data, 72);
	const drv1 = Number(drv1Component) * 10 ** exponent;
	const drv2Component = readBigInt64LE(data, 80);
	const drv2 = Number(drv2Component) * 10 ** exponent;
	const drv3Component = readBigInt64LE(data, 88);
	const drv3 = Number(drv3Component) * 10 ** exponent;
	const drv4Component = readBigInt64LE(data, 96);
	const drv4 = Number(drv4Component) * 10 ** exponent;
	const drv5Component = readBigInt64LE(data, 104);
	const drv5 = Number(drv5Component) * 10 ** exponent;
	// Product id / reference account.
	const productAccountKey = new anchor.web3.PublicKey(data.slice(112, 144));
	// Next price account in list.
	const nextPriceAccountKey = PKorNull(data.slice(144, 176));
	// Aggregate price updater.
	const aggregatePriceUpdaterAccountKey = new anchor.web3.PublicKey(
		data.slice(176, 208)
	);
	const aggregatePriceInfo = parsePriceInfo(data.slice(208, 240), exponent);
	// Price components - up to 32.
	const priceComponents = [];
	let offset = 240;
	let shouldContinue = true;
	while (offset < data.length && shouldContinue) {
		const publisher = PKorNull(data.slice(offset, offset + 32));
		offset += 32;
		if (publisher) {
			const aggregate = parsePriceInfo(
				data.slice(offset, offset + 32),
				exponent
			);
			offset += 32;
			const latest = parsePriceInfo(data.slice(offset, offset + 32), exponent);
			offset += 32;
			priceComponents.push({ publisher, aggregate, latest });
		} else {
			shouldContinue = false;
		}
	}
	return Object.assign(
		Object.assign(
			{
				magic,
				version,
				type,
				size,
				priceType,
				exponent,
				numComponentPrices,
				currentSlot,
				validSlot,
				twapComponent,
				twap,
				avolComponent,
				avol,
				drv0Component,
				drv0,
				drv1Component,
				drv1,
				drv2Component,
				drv2,
				drv3Component,
				drv3,
				drv4Component,
				drv4,
				drv5Component,
				drv5,
				productAccountKey,
				nextPriceAccountKey,
				aggregatePriceUpdaterAccountKey,
			},
			aggregatePriceInfo
		),
		{ priceComponents }
	);
};
const _parseProductData = (data) => {
	// Pyth magic number.
	const magic = data.readUInt32LE(0);
	// Program version.
	const version = data.readUInt32LE(4);
	// Account type.
	const type = data.readUInt32LE(8);
	// Price account size.
	const size = data.readUInt32LE(12);
	// First price account in list.
	const priceAccountBytes = data.slice(16, 48);
	const priceAccountKey = new anchor.web3.PublicKey(priceAccountBytes);
	const product = {};
	let idx = 48;
	while (idx < data.length) {
		const keyLength = data[idx];
		idx++;
		if (keyLength) {
			const key = data.slice(idx, idx + keyLength).toString();
			idx += keyLength;
			const valueLength = data[idx];
			idx++;
			const value = data.slice(idx, idx + valueLength).toString();
			idx += valueLength;
			product[key] = value;
		}
	}
	return { magic, version, type, size, priceAccountKey, product };
};

const parsePriceInfo = (data, exponent) => {
	// Aggregate price.
	const priceComponent = data.readBigUInt64LE(0);
	const price = Number(priceComponent) * 10 ** exponent;
	// Aggregate confidence.
	const confidenceComponent = data.readBigUInt64LE(8);
	const confidence = Number(confidenceComponent) * 10 ** exponent;
	// Aggregate status.
	const status = data.readUInt32LE(16);
	// Aggregate corporate action.
	const corporateAction = data.readUInt32LE(20);
	// Aggregate publish slot.
	const publishSlot = data.readBigUInt64LE(24);
	return {
		priceComponent,
		price,
		confidenceComponent,
		confidence,
		status,
		corporateAction,
		publishSlot,
	};
};

export function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getTokenAmountAsBN(
	connection: Connection,
	tokenAccount: PublicKey
): Promise<BN> {
	return new BN(
		(await connection.getTokenAccountBalance(tokenAccount)).value.amount
	);
}

export async function simulate(
	connection: Connection,
	payer: Signer,
	instructions: TransactionInstruction[],
	signers: Signer[] = []
): Promise<void> {
	instructions = [
		ComputeBudgetProgram.setComputeUnitLimit({
			units: 400_000,
		}),
		ComputeBudgetProgram.setComputeUnitPrice({
			microLamports: 10_000,
		}),
		...instructions,
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
	instructions: TransactionInstruction[],
	signers: Signer[] = []
): Promise<string> {
	try {
		instructions = [
			ComputeBudgetProgram.setComputeUnitLimit({
				units: 400_000,
			}),
			ComputeBudgetProgram.setComputeUnitPrice({
				microLamports: 10_000,
			}),
			...instructions,
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
		console.error(e);
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

export function encodeLimitOrderPacket(packet: OrderPacket) {
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

export function decodeLimitOrderPacket(buffer: Buffer) {
	const serializedOrderPacket = buffer.slice(1, buffer.length);
	const orderPacket = orderPacketBeet.toFixedFromData(serializedOrderPacket, 0);
	return orderPacket.read(serializedOrderPacket, 0);
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

export async function outAmount(
	conn: Connection,
	market: PublicKey,
	side: Side,
	inAmount: number,
	takerFeeBps?: number
) {
	const marketState = await fetchMarketState(conn, market);
	const uiLadder = marketState.getUiLadder(3, 0, 0);
	const out = getExpectedOutAmountRouter({
		uiLadder,
		side,
		takerFeeBps: takerFeeBps ?? marketState.data.takerFeeBps,
		inAmount,
	});
	return out;
}

export async function logLadder(conn: Connection, market: PublicKey) {
	const marketState = await fetchMarketState(conn, market);
	const ladder = marketState.getUiLadder(3, 0, 0);
	if (ladder.bids.length === 0) {
		console.log('no bids');
	}
	if (ladder.asks.length === 0) {
		console.log('no asks');
	}
	for (const bid of ladder.bids) {
		// const price = marketState.ticksToFloatPrice(bid.priceInTicks.toNumber());
		const price = bid.price;
		console.log(`bid: ${price}`);
	}
	for (const ask of ladder.asks) {
		// const price = marketState.ticksToFloatPrice(ask.priceInTicks.toNumber());
		const price = ask.price;
		console.log(`ask: ${price}`);
	}
}

export async function marketPrice(conn: Connection, market: PublicKey) {
	const marketState = await fetchMarketState(conn, market);
	const quoteAtomsPrice =
		marketState.data.header.tickSizeInQuoteAtomsPerBaseUnit;
	const price = marketState.quoteAtomsToQuoteUnits(toNum(quoteAtomsPrice));
	return price;
}
