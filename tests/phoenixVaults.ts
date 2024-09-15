import * as anchor from '@coral-xyz/anchor';
import {
	AccountMeta,
	AddressLookupTableAccount,
	AddressLookupTableProgram,
	ConfirmOptions,
	Keypair,
	LAMPORTS_PER_SOL,
	PublicKey,
	SystemProgram,
} from '@solana/web3.js';
import { assert } from 'chai';
import { before } from 'mocha';
import {
	getVaultAddressSync,
	PhoenixVaults,
	encodeName,
	VaultParams,
	getInvestorAddressSync,
	getMarketRegistryAddressSync,
	MOCK_USDC_MINT,
	MOCK_SOL_MINT,
	MOCK_SOL_USDC_MARKET,
	MOCK_MARKET_AUTHORITY,
	QUOTE_PRECISION,
	MOCK_USDC_PRECISION,
	MOCK_SOL_PRECISION,
	PHOENIX_PROGRAM_ID,
	PHOENIX_SEAT_MANAGER_PROGRAM_ID,
	WithdrawUnit,
} from '../ts/sdk';
import { BN } from '@coral-xyz/anchor';
import {
	createAssociatedTokenAccountInstruction,
	createMintToInstruction,
	getAssociatedTokenAddressSync,
	TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
	createMarketTokenAccountIxs,
	encodeLimitOrderPacket,
	sendAndConfirm,
	signatureLink,
	MARKET_CONFIG,
	tokenBalance,
	fetchMarketState,
	simulate,
	logLadder,
	outAmount,
	marketPrice,
	parseTraderState,
} from './testHelpers';
import {
	Client as PhoenixClient,
	getSeatManagerAddress,
	deserializeSeatManagerData,
	getLimitOrderPacket,
	Side,
	confirmOrCreateClaimSeatIxs,
	getLogAuthority,
	getSeatAddress,
	getSeatDepositCollectorAddress,
	getExpectedOutAmountRouter,
} from '@cosmic-lab/phoenix-sdk';

describe('phoenixVaults', () => {
	const opts: ConfirmOptions = {
		preflightCommitment: 'confirmed',
		skipPreflight: false,
		commitment: 'confirmed',
	};

	// Configure the client to use the local cluster.
	const provider = anchor.AnchorProvider.local(undefined, opts);
	anchor.setProvider(provider);
	const conn = provider.connection;
	// @ts-ignore
	const payer: Keypair = provider.wallet.payer as any as Keypair;
	// const payer = _payer as Keypair;
	const program = anchor.workspace
		.PhoenixVaults as anchor.Program<PhoenixVaults>;

	let phoenix: PhoenixClient;

	const marketRegistry = getMarketRegistryAddressSync();
	let lutSlot: number;
	let lut: PublicKey;

	const mintAuth = MOCK_MARKET_AUTHORITY;
	const usdcMint = MOCK_USDC_MINT.publicKey;
	const solMint = MOCK_SOL_MINT.publicKey;
	// const _jupMint = MOCK_JUP_MINT;
	const solUsdcMarket = MOCK_SOL_USDC_MARKET.publicKey;
	// const jupSolMarket = MOCK_JUP_SOL_MARKET.publicKey;
	// const jupUsdcMarket = MOCK_JUP_USDC_MARKET.publicKey;
	// const manager = Keypair.generate();
	const manager = payer;
	const protocol = Keypair.generate();
	const maker = Keypair.generate();

	const name = 'Test Vault';
	const vaultKey = getVaultAddressSync(encodeName(name));
	// const vaultAta = getTokenVaultAddressSync(vaultKey);
	const vaultAta = getAssociatedTokenAddressSync(usdcMint, vaultKey, true);
	const investor = getInvestorAddressSync(vaultKey, provider.publicKey);
	const investorAta = getAssociatedTokenAddressSync(
		usdcMint,
		provider.publicKey
	);

	const marketKeys: PublicKey[] = MARKET_CONFIG['localhost'].markets.map(
		(m) => new PublicKey(m.market)
	);
	const solUsdcMarketIndex = 0;
	const startSolUsdcPrice = 100;
	const endSolUsdcPrice = 125;
	const usdcUiAmount = 1_000;
	const usdcAmount = new BN(usdcUiAmount).mul(MOCK_USDC_PRECISION);
	const solUiAmount = usdcUiAmount / startSolUsdcPrice; // 10 SOL
	const solAmount = new BN(solUiAmount).mul(MOCK_SOL_PRECISION);

	before(async () => {
		phoenix = await PhoenixClient.createFromConfig(
			conn,
			MARKET_CONFIG,
			true,
			false
		);
		await phoenix.addMarket(solUsdcMarket.toBase58(), true, false);

		await conn.requestAirdrop(maker.publicKey, LAMPORTS_PER_SOL * 10);

		lutSlot = await conn.getSlot('finalized');
		const slotBuffer = Buffer.alloc(8);
		slotBuffer.writeBigInt64LE(BigInt(lutSlot), 0);
		const lutSeeds = [provider.publicKey.toBuffer(), slotBuffer];
		lut = PublicKey.findProgramAddressSync(
			lutSeeds,
			AddressLookupTableProgram.programId
		)[0];
	});

	it('Create Address Lookup Table', async () => {
		const [ix, lutKey] = AddressLookupTableProgram.createLookupTable({
			authority: provider.publicKey,
			payer: provider.publicKey,
			recentSlot: lutSlot,
		});
		assert(lutKey.toString() === lut.toString());

		await sendAndConfirm(conn, payer, [ix]);

		const lutAcctInfo = await conn.getAccountInfo(lut, 'processed');
		assert(lutAcctInfo !== null);
		const lutAcct = AddressLookupTableAccount.deserialize(lutAcctInfo.data);
		assert(lutAcct.authority.toString() === provider.publicKey.toString());
	});

	it('Fill Address Lookup Table', async () => {
		const ix = AddressLookupTableProgram.extendLookupTable({
			lookupTable: lut,
			authority: provider.publicKey,
			payer: provider.publicKey,
			addresses: marketKeys,
		});

		await sendAndConfirm(conn, payer, [ix]);

		const lutAcctInfo = await conn.getAccountInfo(lut, 'processed');
		assert(lutAcctInfo !== null);
		const lutAcct = AddressLookupTableAccount.deserialize(lutAcctInfo.data);
		assert(lutAcct.addresses.length === marketKeys.length);
	});

	it('Initialize Market Registry', async () => {
		const accounts = {
			authority: provider.publicKey,
			lut,
			marketRegistry,
			lutProgram: AddressLookupTableProgram.programId,
		};

		const markets: AccountMeta[] = marketKeys.map((pubkey) => {
			return {
				pubkey,
				isWritable: false,
				isSigner: false,
			};
		});
		const params = {
			usdcMint,
			solMint,
			solUsdcMarketIndex,
		};

		try {
			await program.methods
				.initializeMarketRegistry(params)
				.accounts(accounts)
				.remainingAccounts(markets)
				.rpc();
		} catch (e) {
			console.error(e);
			assert(false);
		}
	});

	it('Initialize Vault', async () => {
		const marketState = phoenix.marketStates.get(solUsdcMarket.toString());
		if (marketState === undefined) {
			throw Error('SOL/USDC market not found');
		}
		const createAtaIxs = await createMarketTokenAccountIxs(
			conn,
			marketState,
			vaultKey,
			payer
		);
		await sendAndConfirm(conn, payer, createAtaIxs);

		const config: VaultParams = {
			name: encodeName(name),
			redeemPeriod: new BN(0),
			maxTokens: new BN(0),
			managementFee: new BN(0),
			minDepositAmount: new BN(0),
			profitShare: 100_000, // 10%
			hurdleRate: 0,
			permissioned: false,
			protocol: protocol.publicKey,
			protocolFee: new BN(0),
			protocolProfitShare: 100_000, // 10%
		};
		const accounts = {
			vault: vaultKey,
			tokenAccount: vaultAta,
			mint: usdcMint,
			manager: manager.publicKey,
		};
		// @ts-ignore
		await program.methods.initializeVault(config).accounts(accounts).rpc();
		const acct = await program.account.vault.fetch(vaultKey);
		assert(!!acct);
	});

	it('Initialize Investor', async () => {
		const accounts = {
			vault: vaultKey,
			investor,
			authority: provider.publicKey,
		};
		// @ts-ignore
		await program.methods.initializeInvestor().accounts(accounts).rpc();
		const acct = await program.account.investor.fetch(investor);
		assert(!!acct);
	});

	it('Deposit', async () => {
		const createAtaIx = createAssociatedTokenAccountInstruction(
			provider.publicKey,
			investorAta,
			provider.publicKey,
			usdcMint
		);
		const mintToIx = createMintToInstruction(
			usdcMint,
			investorAta,
			mintAuth.publicKey,
			usdcAmount.toNumber()
		);

		const accounts = {
			vault: vaultKey,
			investor,
			marketRegistry,
			vaultTokenAccount: vaultAta,
			investorTokenAccount: investorAta,
			authority: provider.publicKey,
			tokenProgram: TOKEN_PROGRAM_ID,
		};
		const markets: AccountMeta[] = marketKeys.map((pubkey) => {
			return {
				pubkey,
				isWritable: false,
				isSigner: false,
			};
		});
		await program.methods
			.deposit(usdcAmount)
			.preInstructions([createAtaIx, mintToIx])
			.accounts(accounts)
			.remainingAccounts(markets)
			.signers([mintAuth])
			.rpc();
		const investorAcct = await program.account.investor.fetch(investor);
		const deposits = investorAcct.netDeposits.div(QUOTE_PRECISION).toNumber();
		const shares = investorAcct.vaultShares.div(QUOTE_PRECISION).toNumber();
		assert.equal(deposits, 1000);
		assert.equal(shares, 1000);

		const vaultAtaBalance = await tokenBalance(conn, vaultAta);
		assert.equal(vaultAtaBalance, 1000);
	});

	it('Check SOL/USDC Seat Manager', async () => {
		const smKey = getSeatManagerAddress(solUsdcMarket);
		const smAcct = await conn.getAccountInfo(smKey);
		if (!smAcct) {
			throw new Error(
				`Seat manager ${smKey.toString()} not found for market ${solUsdcMarket.toString()}`
			);
		}

		// Deserialize the data inside the Seat Manager Account
		const sm = deserializeSeatManagerData(smAcct.data);

		// For the purposes of this example, assert that the authority for the above market is the same as the devnetSeatManagerAuthority.
		// You can remove or replace the below logic with the conditions you want to verify.
		assert.equal(sm.market.toBase58(), solUsdcMarket.toBase58());
	});

	//
	// Simulate profitable trader by vault for 25% gain
	//

	it('Maker Sell SOL/USDC', async () => {
		const marketState = await fetchMarketState(conn, solUsdcMarket);
		await logLadder(conn, solUsdcMarket);

		const createAtaIxs = await createMarketTokenAccountIxs(
			conn,
			marketState,
			maker.publicKey,
			payer
		);
		const solAta = getAssociatedTokenAddressSync(
			solMint,
			maker.publicKey,
			true
		);
		const mintSolIx = createMintToInstruction(
			solMint,
			solAta,
			mintAuth.publicKey,
			solAmount.toNumber()
		);
		await sendAndConfirm(conn, payer, [...createAtaIxs, mintSolIx], [mintAuth]);

		try {
			const claimMakerSeatIxs = await confirmOrCreateClaimSeatIxs(
				conn,
				marketState,
				maker.publicKey,
				payer.publicKey
			);
			await sendAndConfirm(conn, payer, claimMakerSeatIxs, [maker]);
		} catch (e: any) {
			throw new Error(e);
		}

		const makerBaseTokenAccount = getAssociatedTokenAddressSync(
			solMint,
			maker.publicKey
		);
		const makerQuoteTokenAccount = getAssociatedTokenAddressSync(
			usdcMint,
			maker.publicKey
		);
		const makerSolBefore = await tokenBalance(conn, makerBaseTokenAccount);
		const makerUsdcBefore = await tokenBalance(conn, makerQuoteTokenAccount);
		console.log(
			`maker before sell, sol: ${makerSolBefore}, usdc: ${makerUsdcBefore}`
		);
		assert.strictEqual(makerSolBefore, 10);
		assert.strictEqual(makerUsdcBefore, 0);

		const priceInTicks = phoenix.floatPriceToTicks(
			startSolUsdcPrice,
			solUsdcMarket.toBase58()
		);
		const numBaseLots = phoenix.rawBaseUnitsToBaseLotsRoundedDown(
			solUiAmount,
			solUsdcMarket.toBase58()
		);
		const makerOrderPacket = getLimitOrderPacket({
			side: Side.Ask,
			priceInTicks,
			numBaseLots,
		});
		const makerOrderIx = phoenix.createPlaceLimitOrderInstruction(
			makerOrderPacket,
			solUsdcMarket.toString(),
			maker.publicKey
		);
		await sendAndConfirm(conn, payer, [makerOrderIx], [maker]);

		await logLadder(conn, solUsdcMarket);
	});

	it('Taker Buy SOL/USDC', async () => {
		try {
			const seatManager = getSeatManagerAddress(solUsdcMarket);
			const seatDepositCollector =
				getSeatDepositCollectorAddress(solUsdcMarket);
			const seat = getSeatAddress(solUsdcMarket, vaultKey);
			const logAuthority = getLogAuthority();
			const claimSeatIx = await program.methods
				.claimSeat()
				.accounts({
					vault: vaultKey,
					delegate: manager.publicKey,
					phoenix: PHOENIX_PROGRAM_ID,
					logAuthority,
					market: solUsdcMarket,
					seatManager,
					seatDepositCollector,
					payer: payer.publicKey,
					seat,
					systemProgram: SystemProgram.programId,
					phoenixSeatManager: PHOENIX_SEAT_MANAGER_PROGRAM_ID,
				})
				.instruction();
			await sendAndConfirm(conn, payer, [claimSeatIx], [manager]);
		} catch (e: any) {
			throw new Error(e);
		}

		const priceInTicks = phoenix.floatPriceToTicks(
			startSolUsdcPrice,
			solUsdcMarket.toBase58()
		);
		const solAmountAfterFee = await outAmount(
			conn,
			solUsdcMarket,
			Side.Bid,
			usdcUiAmount
		);
		console.log(`out: ${solAmountAfterFee}`);
		const numBaseLots = phoenix.rawBaseUnitsToBaseLotsRoundedDown(
			solAmountAfterFee,
			solUsdcMarket.toBase58()
		);
		const takerOrderPacket = getLimitOrderPacket({
			side: Side.Bid,
			priceInTicks,
			numBaseLots,
		});
		const order = encodeLimitOrderPacket(takerOrderPacket);

		const vaultBaseTokenAccount = getAssociatedTokenAddressSync(
			solMint,
			vaultKey,
			true
		);
		const vaultQuoteTokenAccount = getAssociatedTokenAddressSync(
			usdcMint,
			vaultKey,
			true
		);
		const marketBaseTokenAccount = phoenix.getBaseVaultKey(
			solUsdcMarket.toString()
		);
		const marketQuoteTokenAccount = phoenix.getQuoteVaultKey(
			solUsdcMarket.toString()
		);

		const vaultSolBefore = await tokenBalance(conn, vaultBaseTokenAccount);
		const vaultUsdcBefore = await tokenBalance(conn, vaultQuoteTokenAccount);
		console.log(
			`taker before buy, sol: ${vaultSolBefore}, usdc: ${vaultUsdcBefore}`
		);
		assert.strictEqual(vaultSolBefore, 0);
		assert.strictEqual(vaultUsdcBefore, 1000);

		try {
			const ix = await program.methods
				.placeLimitOrder({
					order,
				})
				.accounts({
					vault: vaultKey,
					delegate: manager.publicKey,
					phoenix: PHOENIX_PROGRAM_ID,
					logAuthority: getLogAuthority(),
					market: solUsdcMarket,
					seat: getSeatAddress(solUsdcMarket, vaultKey),
					baseMint: solMint,
					quoteMint: usdcMint,
					vaultBaseTokenAccount,
					vaultQuoteTokenAccount,
					marketBaseTokenAccount,
					marketQuoteTokenAccount,
					tokenProgram: TOKEN_PROGRAM_ID,
				})
				.instruction();
			await sendAndConfirm(conn, payer, [ix], [manager]);
		} catch (e: any) {
			throw new Error(e);
		}

		const vaultSolAfter = await tokenBalance(conn, vaultBaseTokenAccount);
		const vaultUsdcAfter = await tokenBalance(conn, vaultQuoteTokenAccount);
		console.log(
			`taker after buy, sol: ${vaultSolAfter}, usdc: ${vaultUsdcAfter}`
		);
		assert.strictEqual(vaultSolAfter, 9.999);
		assert.strictEqual(vaultUsdcAfter, 0.00001);

		const makerBaseTokenAccount = getAssociatedTokenAddressSync(
			solMint,
			maker.publicKey
		);
		const makerQuoteTokenAccount = getAssociatedTokenAddressSync(
			usdcMint,
			maker.publicKey
		);
		const makerSolAfter = await tokenBalance(conn, makerBaseTokenAccount);
		const makerUsdcAfter = await tokenBalance(conn, makerQuoteTokenAccount);
		console.log(
			`maker after taker buy, sol: ${makerSolAfter}, usdc: ${makerUsdcAfter}`
		);
		assert.strictEqual(makerSolAfter, 0);
		assert.strictEqual(makerUsdcAfter, 0);

		const marketSolAfter = await tokenBalance(conn, marketBaseTokenAccount);
		const marketUsdcAfter = await tokenBalance(conn, marketQuoteTokenAccount);
		console.log(
			`market after taker buy, sol: ${marketSolAfter}, usdc: ${marketUsdcAfter}`
		);
		assert.strictEqual(marketSolAfter, 0.001);
		assert.strictEqual(marketUsdcAfter, 999.99999);

		await logLadder(conn, solUsdcMarket);
	});

	it('Maker Buy SOL/USDC @ $125', async () => {
		// after a 25% loss, the vault needs more USDC to match the vault's sell order
		const usdcAta = getAssociatedTokenAddressSync(usdcMint, maker.publicKey);
		const mintUsdcIx = createMintToInstruction(
			usdcMint,
			usdcAta,
			mintAuth.publicKey,
			usdcAmount.toNumber()
		);
		await sendAndConfirm(conn, payer, [mintUsdcIx], [mintAuth]);

		const vaultBaseTokenAccount = getAssociatedTokenAddressSync(
			solMint,
			vaultKey,
			true
		);
		const solAmount = await tokenBalance(conn, vaultBaseTokenAccount);
		// maker buys 100% of what vault can sell
		console.log(`maker to buy ${solAmount} SOL @ $125/SOL`);
		const numBaseLots = phoenix.rawBaseUnitsToBaseLotsRoundedDown(
			solAmount,
			solUsdcMarket.toBase58()
		);
		const priceInTicks = phoenix.floatPriceToTicks(
			endSolUsdcPrice,
			solUsdcMarket.toBase58()
		);
		const makerOrderPacket = getLimitOrderPacket({
			side: Side.Bid,
			priceInTicks,
			numBaseLots,
		});
		const makerOrderIx = phoenix.createPlaceLimitOrderInstruction(
			makerOrderPacket,
			solUsdcMarket.toString(),
			maker.publicKey
		);
		await sendAndConfirm(conn, payer, [makerOrderIx], [maker]);

		await logLadder(conn, solUsdcMarket);
	});

	it('Taker Sell SOL/USDC @ $125', async () => {
		const vaultBaseTokenAccount = getAssociatedTokenAddressSync(
			solMint,
			vaultKey,
			true
		);
		const vaultQuoteTokenAccount = getAssociatedTokenAddressSync(
			usdcMint,
			vaultKey,
			true
		);
		const marketBaseTokenAccount = phoenix.getBaseVaultKey(
			solUsdcMarket.toString()
		);
		const marketQuoteTokenAccount = phoenix.getQuoteVaultKey(
			solUsdcMarket.toString()
		);

		const priceInTicks = phoenix.floatPriceToTicks(
			endSolUsdcPrice,
			solUsdcMarket.toBase58()
		);

		const solAmountAfterFee = await tokenBalance(conn, vaultBaseTokenAccount);
		console.log(`taker to sell ${solAmountAfterFee} SOL @ $125/SOL`);
		const numBaseLots = phoenix.rawBaseUnitsToBaseLotsRoundedDown(
			solAmountAfterFee,
			solUsdcMarket.toBase58()
		);
		const takerOrderPacket = getLimitOrderPacket({
			side: Side.Ask,
			priceInTicks,
			numBaseLots,
		});
		const order = encodeLimitOrderPacket(takerOrderPacket);

		try {
			const ix = await program.methods
				.placeLimitOrder({
					order,
				})
				.accounts({
					vault: vaultKey,
					delegate: manager.publicKey,
					phoenix: PHOENIX_PROGRAM_ID,
					logAuthority: getLogAuthority(),
					market: solUsdcMarket,
					seat: getSeatAddress(solUsdcMarket, vaultKey),
					baseMint: solMint,
					quoteMint: usdcMint,
					vaultBaseTokenAccount,
					vaultQuoteTokenAccount,
					marketBaseTokenAccount,
					marketQuoteTokenAccount,
					tokenProgram: TOKEN_PROGRAM_ID,
				})
				.instruction();
			await simulate(conn, payer, [ix], [manager]);
			await sendAndConfirm(conn, payer, [ix], [manager]);
		} catch (e: any) {
			throw new Error(e);
		}

		const vaultSolAfter = await tokenBalance(conn, vaultBaseTokenAccount);
		const vaultUsdcAfter = await tokenBalance(conn, vaultQuoteTokenAccount);
		console.log(
			`taker after sell, sol: ${vaultSolAfter}, usdc: ${vaultUsdcAfter}`
		);
		assert.strictEqual(vaultSolAfter, 0);
		// 25% gain on $1000 minus fees
		assert.strictEqual(vaultUsdcAfter, 1249.75002);

		const makerBaseTokenAccount = getAssociatedTokenAddressSync(
			solMint,
			maker.publicKey
		);
		const makerQuoteTokenAccount = getAssociatedTokenAddressSync(
			usdcMint,
			maker.publicKey
		);
		const makerSolAfter = await tokenBalance(conn, makerBaseTokenAccount);
		const makerUsdcAfter = await tokenBalance(conn, makerQuoteTokenAccount);
		console.log(
			`maker after taker sell, sol: ${makerSolAfter}, usdc: ${makerUsdcAfter}`
		);
		assert.strictEqual(makerSolAfter, 0);
		assert.strictEqual(makerUsdcAfter, 750.025);

		const marketSolAfter = await tokenBalance(conn, marketBaseTokenAccount);
		const marketUsdcAfter = await tokenBalance(conn, marketQuoteTokenAccount);
		console.log(
			`market after taker sell, sol: ${marketSolAfter}, usdc: ${marketUsdcAfter}`
		);
		assert.strictEqual(marketSolAfter, 10);
		// entry USDC fee: $999.9 * 0.01% fee = $0.09999
		// exit SOL fee: 9.999 SOL @ $125/SOL * 0.01% fee = $0.1249875
		// total fee = $0.09999 + $0.1249875 = $0.2249775 rounded to $0.22498
		assert.strictEqual(marketUsdcAfter, 0.22498);

		await logLadder(conn, solUsdcMarket);
	});

	//
	// Place pending ask at $125/SOL that never gets filled, so withdraw request can measure price as best ask on-chain.
	//

	// it('Maker Pending Ask SOL/USDC', async () => {
	// 	const makerTraderState = parseTraderState(
	// 		await fetchMarketState(conn, solUsdcMarket),
	// 		maker.publicKey
	// 	);
	// 	console.log(makerTraderState);
	//
	// 	const makerBaseTokenAccount = getAssociatedTokenAddressSync(
	// 		solMint,
	// 		maker.publicKey
	// 	);
	// 	const priceInTicks = phoenix.floatPriceToTicks(
	// 		endSolUsdcPrice,
	// 		solUsdcMarket.toBase58()
	// 	);
	// 	const makerSol = await tokenBalance(conn, makerBaseTokenAccount);
	// 	const numBaseLots = phoenix.rawBaseUnitsToBaseLotsRoundedDown(
	// 		makerSol,
	// 		solUsdcMarket.toBase58()
	// 	);
	// 	const makerOrderPacket = getLimitOrderPacket({
	// 		side: Side.Ask,
	// 		priceInTicks,
	// 		numBaseLots,
	// 	});
	// 	const makerOrderIx = phoenix.createPlaceLimitOrderInstruction(
	// 		makerOrderPacket,
	// 		solUsdcMarket.toString(),
	// 		maker.publicKey
	// 	);
	// 	await simulate(conn, payer, [makerOrderIx], [maker]);
	// 	await sendAndConfirm(conn, payer, [makerOrderIx], [maker]);
	//
	// 	await logLadder(conn, solUsdcMarket);
	// });
	//
	// it('Request Withdraw', async () => {
	// 	const vaultQuoteTokenAccount = getAssociatedTokenAddressSync(
	// 		usdcMint,
	// 		vaultKey,
	// 		true
	// 	);
	// 	const usdc = await tokenBalance(conn, vaultQuoteTokenAccount);
	// 	const usdcBN = new BN(usdc * QUOTE_PRECISION.toNumber());
	// 	try {
	// 		const markets: AccountMeta[] = marketKeys.map((pubkey) => {
	// 			return {
	// 				pubkey,
	// 				isWritable: false,
	// 				isSigner: false,
	// 			};
	// 		});
	// 		const ix = await program.methods
	// 			.requestWithdraw(usdcBN, WithdrawUnit.TOKEN)
	// 			.accounts({
	// 				vault: vaultKey,
	// 				investor,
	// 				authority: provider.publicKey,
	// 				marketRegistry,
	// 			})
	// 			.remainingAccounts(markets)
	// 			.instruction();
	//
	// 		await simulate(conn, payer, [ix], [payer]);
	// 		await sendAndConfirm(conn, payer, [ix], [payer]);
	// 	} catch (e: any) {
	// 		throw new Error(e);
	// 	}
	//
	// 	await logLadder(conn, solUsdcMarket);
	// });
});
