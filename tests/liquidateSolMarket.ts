import * as anchor from '@coral-xyz/anchor';
import {
	AccountMeta,
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
	LOCALNET_MARKET_CONFIG,
	MarketTransferParams,
	MOCK_JUP_SOL_MARKET,
	MOCK_JUP_MINT,
	MOCK_SOL_DECIMALS,
	MarketPosition,
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
	sendAndConfirm,
	tokenBalance,
	fetchMarketState,
	outAmount,
	encodeLimitOrderPacketWithFreeFunds,
	fetchTraderState,
	fetchInvestorEquity,
	calculateRealizedInvestorEquity,
	parseTraderState,
	simulate,
	fetchVaultEquity,
	calcFee,
	amountMinusFee,
	fetchMarketPosition,
	amountPlusFee,
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
} from '@ellipsis-labs/phoenix-sdk';

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
	const program = anchor.workspace
		.PhoenixVaults as anchor.Program<PhoenixVaults>;

	let phoenix: PhoenixClient;

	const marketRegistry = getMarketRegistryAddressSync();

	const mintAuth = MOCK_MARKET_AUTHORITY;
	const usdcMint = MOCK_USDC_MINT.publicKey;
	const solMint = MOCK_SOL_MINT.publicKey;
	const jupMint = MOCK_JUP_MINT.publicKey;
	const solUsdcMarket = MOCK_SOL_USDC_MARKET.publicKey;
	const jupSolMarket = MOCK_JUP_SOL_MARKET.publicKey;
	const manager = payer;
	const protocol = Keypair.generate();
	const maker = Keypair.generate();

	const name = 'Test Vault';
	const vaultKey = getVaultAddressSync(encodeName(name));
	const vaultUsdcAta = getAssociatedTokenAddressSync(usdcMint, vaultKey, true);
	const vaultSolAta = getAssociatedTokenAddressSync(solMint, vaultKey, true);
	const investor = getInvestorAddressSync(vaultKey, provider.publicKey);
	const investorUsdcAta = getAssociatedTokenAddressSync(
		usdcMint,
		provider.publicKey
	);

	const marketKeys: PublicKey[] = LOCALNET_MARKET_CONFIG[
		'localhost'
	].markets.map((m) => new PublicKey(m.market));
	const markets: AccountMeta[] = marketKeys.map((pubkey) => {
		return {
			pubkey,
			isWritable: false,
			isSigner: false,
		};
	});
	const startSolUsdcPrice = 100;
	const endSolUsdcPrice = 125;
	const startJupSolPrice = 0.01;
	const usdcUiAmount = 1_000;
	const solUiAmount = usdcUiAmount / startSolUsdcPrice; // 10 SOL
	const solAmount = new BN(solUiAmount).mul(MOCK_SOL_PRECISION);

	before(async () => {
		phoenix = await PhoenixClient.createFromConfig(
			conn,
			LOCALNET_MARKET_CONFIG,
			false,
			false
		);

		await conn.requestAirdrop(maker.publicKey, LAMPORTS_PER_SOL * 10);
	});

	it('Initialize Market Registry', async () => {
		const params = {
			solUsdcMarket,
			usdcMint,
			solMint,
		};

		try {
			await program.methods
				.initializeMarketRegistry(params)
				.accounts({
					authority: provider.publicKey,
					marketRegistry,
				})
				.rpc();
		} catch (e: any) {
			throw new Error(e);
		}
	});

	it('Initialize Vault', async () => {
		const solUsdcMarketState = phoenix.marketStates.get(
			solUsdcMarket.toString()
		);
		if (solUsdcMarketState === undefined) {
			throw Error('SOL/USDC market not found');
		}
		const createSolUsdcAtaIxs = await createMarketTokenAccountIxs(
			conn,
			solUsdcMarketState,
			vaultKey,
			payer
		);
		await sendAndConfirm(conn, payer, createSolUsdcAtaIxs);

		const jupSolMarketState = phoenix.marketStates.get(jupSolMarket.toString());
		if (jupSolMarketState === undefined) {
			throw Error('JUP/SOL market not found');
		}
		const createJupSolAtaIxs = await createMarketTokenAccountIxs(
			conn,
			jupSolMarketState,
			vaultKey,
			payer
		);
		await sendAndConfirm(conn, payer, createJupSolAtaIxs);

		const config: VaultParams = {
			name: encodeName(name),
			redeemPeriod: new BN(0),
			maxTokens: new BN(0),
			managementFee: new BN(0),
			minDepositAmount: new BN(0),
			profitShare: 100_000,
			hurdleRate: 0,
			permissioned: false,
			protocol: protocol.publicKey,
			protocolFee: new BN(0),
			protocolProfitShare: 100_000,
		};
		await program.methods
			.initializeVault(config)
			.accounts({
				vault: vaultKey,
				usdcTokenAccount: vaultUsdcAta,
				usdcMint: usdcMint,
				solTokenAccount: vaultSolAta,
				solMint: solMint,
				manager: manager.publicKey,
			})
			.rpc();
		const acct = await program.account.vault.fetch(vaultKey);
		assert(!!acct);
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

	it('Check JUP/SOL Seat Manager', async () => {
		const smKey = getSeatManagerAddress(jupSolMarket);
		const smAcct = await conn.getAccountInfo(smKey);
		if (!smAcct) {
			throw new Error(
				`Seat manager ${smKey.toString()} not found for market ${jupSolMarket.toString()}`
			);
		}

		// Deserialize the data inside the Seat Manager Account
		const sm = deserializeSeatManagerData(smAcct.data);

		// For the purposes of this example, assert that the authority for the above market is the same as the devnetSeatManagerAuthority.
		// You can remove or replace the below logic with the conditions you want to verify.
		assert.equal(sm.market.toBase58(), jupSolMarket.toBase58());
	});

	it('Claim Taker SOL/USDC Seat', async () => {
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
	});

	it('Claim Taker JUP/SOL Seat', async () => {
		try {
			const seatManager = getSeatManagerAddress(jupSolMarket);
			const seatDepositCollector = getSeatDepositCollectorAddress(jupSolMarket);
			const seat = getSeatAddress(jupSolMarket, vaultKey);
			const logAuthority = getLogAuthority();
			const claimSeatIx = await program.methods
				.claimSeat()
				.accounts({
					vault: vaultKey,
					delegate: manager.publicKey,
					phoenix: PHOENIX_PROGRAM_ID,
					logAuthority,
					market: jupSolMarket,
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
	});

	it('Initialize Investor', async () => {
		const accounts = {
			vault: vaultKey,
			investor,
			authority: provider.publicKey,
		};
		await program.methods.initializeInvestor().accounts(accounts).rpc();
		const acct = await program.account.investor.fetch(investor);
		assert(!!acct);
	});

	it('Invest $2000 in Vault', async () => {
		const usdcToDeposit = usdcUiAmount * 2;
		const createAtaIx = createAssociatedTokenAccountInstruction(
			provider.publicKey,
			investorUsdcAta,
			provider.publicKey,
			usdcMint
		);
		const mintToIx = createMintToInstruction(
			usdcMint,
			investorUsdcAta,
			mintAuth.publicKey,
			usdcToDeposit * QUOTE_PRECISION.toNumber()
		);
		await sendAndConfirm(conn, payer, [createAtaIx, mintToIx], [mintAuth]);

		const ix = await program.methods
			.investorDeposit(new BN(usdcToDeposit * QUOTE_PRECISION.toNumber()))
			.accounts({
				vault: vaultKey,
				investor,
				authority: provider.publicKey,
				marketRegistry,
				investorQuoteTokenAccount: investorUsdcAta,
				vaultQuoteTokenAccount: vaultUsdcAta,
			})
			.remainingAccounts(markets)
			.instruction();
		try {
			await sendAndConfirm(conn, payer, [ix]);
		} catch (e: any) {
			throw new Error(e);
		}

		const investorAcct = await program.account.investor.fetch(investor);
		const deposits = investorAcct.netDeposits.div(QUOTE_PRECISION).toNumber();
		const shares = investorAcct.vaultShares.div(QUOTE_PRECISION).toNumber();
		assert.equal(deposits, usdcToDeposit);
		assert.equal(shares, usdcToDeposit);

		const vaultUsdc = await tokenBalance(conn, vaultUsdcAta);
		console.log(`vault after investor deposit, usdc: ${vaultUsdc}`);
		assert.equal(vaultUsdc, usdcToDeposit);
	});

	it('Vault Deposit $2000 to SOL/USDC Market', async () => {
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

		const usdcToDeposit = await tokenBalance(conn, vaultQuoteTokenAccount);
		const quoteLots = phoenix.quoteUnitsToQuoteLots(
			usdcToDeposit,
			solUsdcMarket.toString()
		);
		const params: MarketTransferParams = {
			quoteLots: new BN(quoteLots),
			baseLots: new BN(0),
		};

		const ix = await program.methods
			.marketDeposit(params)
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
			})
			.remainingAccounts(markets)
			.instruction();
		try {
			await sendAndConfirm(conn, payer, [ix]);
		} catch (e: any) {
			throw new Error(e);
		}

		const vaultSol = await tokenBalance(conn, vaultBaseTokenAccount);
		const vaultUsdc = await tokenBalance(conn, vaultQuoteTokenAccount);
		console.log(
			`vault after investor deposit, sol: ${vaultSol}, usdc: ${vaultUsdc}`
		);
		assert.equal(vaultSol, 0);
		assert.equal(vaultUsdc, 0);

		const vaultState = await fetchTraderState(conn, solUsdcMarket, vaultKey);
		console.log(
			`vault trader state after investor deposit, sol: ${vaultState.baseUnitsFree}, usdc: ${vaultState.quoteUnitsFree}`
		);
		assert.equal(vaultState.baseUnitsFree, 0);
		assert.equal(vaultState.quoteUnitsFree, usdcUiAmount * 2);
	});

	//
	// At this point the vault has 2000 USDC and will buy 10 SOL at $100/SOL
	//

	it('Maker Sell 10 SOL @ $100', async () => {
		const marketState = await fetchMarketState(conn, solUsdcMarket);

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
				maker.publicKey
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
	});

	it('Taker Buy 10 SOL @ $100', async () => {
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
		const numBaseLots = phoenix.rawBaseUnitsToBaseLotsRoundedDown(
			solAmountAfterFee,
			solUsdcMarket.toBase58()
		);
		const takerOrderPacket = getLimitOrderPacket({
			side: Side.Bid,
			priceInTicks,
			numBaseLots,
			useOnlyDepositedFunds: true,
		});
		const order = encodeLimitOrderPacketWithFreeFunds(takerOrderPacket);

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

		const vaultBefore = await fetchTraderState(conn, solUsdcMarket, vaultKey);
		console.log(
			`taker deposited tokens before buy, sol: ${vaultBefore.baseUnitsFree}, usdc: ${vaultBefore.quoteUnitsFree}`
		);
		assert.strictEqual(vaultBefore.baseUnitsFree, 0);
		assert.strictEqual(vaultBefore.quoteUnitsFree, usdcUiAmount * 2);

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
				.remainingAccounts(markets)
				.instruction();
			await sendAndConfirm(conn, payer, [ix], [manager]);
		} catch (e: any) {
			throw new Error(e);
		}

		const vaultAfter = await fetchTraderState(conn, solUsdcMarket, vaultKey);
		console.log(
			`taker deposited tokens after buy, sol: ${vaultAfter.baseUnitsFree}, usdc: ${vaultAfter.quoteUnitsFree}`
		);
		assert.strictEqual(vaultAfter.baseUnitsFree, 9.999);
		assert.strictEqual(vaultAfter.quoteUnitsFree, 1000.00001);

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
		assert.strictEqual(marketSolAfter, 10);
		assert.strictEqual(marketUsdcAfter, usdcUiAmount * 2);
	});

	// Place pending bid at $125/SOL that never gets filled, so program can measure SOL/USDC price as best bid.
	it('Maker Bid SOL/USDC @ $125', async () => {
		const vaultState = await fetchTraderState(conn, solUsdcMarket, vaultKey);
		const solAmount = vaultState.baseUnitsFree + vaultState.baseUnitsLocked;

		// top up the maker's USDC to match vault SOL
		const usdcAta = getAssociatedTokenAddressSync(usdcMint, maker.publicKey);
		const mintUsdcIx = createMintToInstruction(
			usdcMint,
			usdcAta,
			mintAuth.publicKey,
			solAmount * endSolUsdcPrice * QUOTE_PRECISION.toNumber()
		);
		await sendAndConfirm(conn, payer, [mintUsdcIx], [mintAuth]);

		const priceInTicks = phoenix.floatPriceToTicks(
			endSolUsdcPrice,
			solUsdcMarket.toBase58()
		);

		const numBaseLots = phoenix.rawBaseUnitsToBaseLotsRoundedDown(
			solAmount,
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
	});

	// At this point the vault owns $1000 USDC and 9.999 SOL (10 SOL - 0.01% fee)
	// Now transfer SOL to JUP/SOL market and buy 9.999 SOL worth of JUP

	it('Vault Withdraw SOL from SOL/USDC Market', async () => {
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

		const solToWithdraw = (
			await fetchTraderState(conn, solUsdcMarket, vaultKey)
		).baseUnitsFree;
		const baseLots = phoenix.rawBaseUnitsToBaseLotsRoundedDown(
			solToWithdraw,
			solUsdcMarket.toString()
		);
		const params: MarketTransferParams = {
			quoteLots: new BN(0),
			baseLots: new BN(baseLots),
		};

		const ix = await program.methods
			.marketWithdraw(params)
			.accounts({
				vault: vaultKey,
				delegate: manager.publicKey,
				phoenix: PHOENIX_PROGRAM_ID,
				logAuthority: getLogAuthority(),
				market: solUsdcMarket,
				baseMint: solMint,
				quoteMint: usdcMint,
				vaultBaseTokenAccount,
				vaultQuoteTokenAccount,
				marketBaseTokenAccount,
				marketQuoteTokenAccount,
				tokenProgram: TOKEN_PROGRAM_ID,
			})
			.remainingAccounts(markets)
			.instruction();
		await sendAndConfirm(conn, payer, [ix]);

		const vaultState = await fetchTraderState(conn, jupSolMarket, vaultKey);
		console.log(
			`vault SOL/USDC trader state after deposit, sol: ${vaultState.baseUnitsFree}, usdc: ${vaultState.quoteUnitsFree}`
		);
		assert.strictEqual(vaultState.baseUnitsFree, 0);
		assert.strictEqual(vaultState.quoteUnitsFree, 0);

		const vaultSol = await tokenBalance(conn, vaultBaseTokenAccount);
		const vaultUsdc = await tokenBalance(conn, vaultQuoteTokenAccount);
		console.log(
			`vault after SOL/USDC withdraw, sol: ${vaultSol}, usdc: ${vaultUsdc}`
		);
		assert.strictEqual(vaultSol, 9.999);
		assert.strictEqual(vaultUsdc, 0);
	});

	it('Vault Deposit SOL to JUP/SOL Market', async () => {
		const vaultBaseTokenAccount = getAssociatedTokenAddressSync(
			jupMint,
			vaultKey,
			true
		);
		const vaultQuoteTokenAccount = getAssociatedTokenAddressSync(
			solMint,
			vaultKey,
			true
		);
		const marketBaseTokenAccount = phoenix.getBaseVaultKey(
			jupSolMarket.toString()
		);
		const marketQuoteTokenAccount = phoenix.getQuoteVaultKey(
			jupSolMarket.toString()
		);

		const vaultToDeposit = await tokenBalance(conn, vaultQuoteTokenAccount);
		const quoteLots = phoenix.quoteUnitsToQuoteLots(
			vaultToDeposit,
			jupSolMarket.toString()
		);
		const params: MarketTransferParams = {
			quoteLots: new BN(quoteLots),
			baseLots: new BN(0),
		};

		const ix = await program.methods
			.marketDeposit(params)
			.accounts({
				vault: vaultKey,
				delegate: manager.publicKey,
				phoenix: PHOENIX_PROGRAM_ID,
				logAuthority: getLogAuthority(),
				market: jupSolMarket,
				seat: getSeatAddress(jupSolMarket, vaultKey),
				baseMint: jupMint,
				quoteMint: solMint,
				vaultBaseTokenAccount,
				vaultQuoteTokenAccount,
				marketBaseTokenAccount,
				marketQuoteTokenAccount,
				tokenProgram: TOKEN_PROGRAM_ID,
			})
			.remainingAccounts(markets)
			.instruction();
		await sendAndConfirm(conn, payer, [ix]);

		const vaultState = await fetchTraderState(conn, jupSolMarket, vaultKey);
		console.log(
			`vault JUP/SOL trader state after deposit, jup: ${vaultState.baseUnitsFree}, sol: ${vaultState.quoteUnitsFree}`
		);
		assert.strictEqual(vaultState.baseUnitsFree, 0);
		assert.strictEqual(vaultState.quoteUnitsFree, 9.999);

		const vaultSol = await tokenBalance(conn, vaultQuoteTokenAccount);
		console.log(`vault after JUP/SOL deposit, sol: ${vaultSol}`);
		assert.strictEqual(vaultSol, 0);
	});

	// Place pending bid at $125/SOL that never gets filled, so program can measure SOL/USDC price as best bid.
	it('Maker Bid JUP/SOL @ 0.01', async () => {
		const marketState = await fetchMarketState(conn, jupSolMarket);
		const vaultState = await fetchTraderState(conn, jupSolMarket, vaultKey);
		const vaultSolInMarket =
			vaultState.quoteUnitsFree + vaultState.quoteUnitsLocked;
		assert.strictEqual(vaultSolInMarket, 9.999);

		const solPlusFee = await amountPlusFee(
			conn,
			jupSolMarket,
			vaultSolInMarket
		);
		// top up the maker's SOL to match vault SOL
		const solAta = getAssociatedTokenAddressSync(solMint, maker.publicKey);
		const createAtaIxs = await createMarketTokenAccountIxs(
			conn,
			marketState,
			maker.publicKey,
			payer
		);
		const mintSolIx = createMintToInstruction(
			solMint,
			solAta,
			mintAuth.publicKey,
			solPlusFee * Math.pow(10, MOCK_SOL_DECIMALS)
		);
		await sendAndConfirm(conn, payer, [...createAtaIxs, mintSolIx], [mintAuth]);

		try {
			const claimMakerSeatIxs = await confirmOrCreateClaimSeatIxs(
				conn,
				marketState,
				maker.publicKey
			);
			await sendAndConfirm(conn, payer, claimMakerSeatIxs, [maker]);
		} catch (e: any) {
			throw new Error(e);
		}

		const makerSol = await tokenBalance(conn, solAta);
		assert.strictEqual(makerSol, solPlusFee);

		console.log('sol amount to bid after fee: ', vaultSolInMarket);
		const numBaseLots = phoenix.rawBaseUnitsToBaseLotsRoundedDown(
			vaultSolInMarket / startJupSolPrice,
			jupSolMarket.toString()
		);
		const priceInTicks = phoenix.floatPriceToTicks(
			startJupSolPrice,
			jupSolMarket.toString()
		);
		const makerOrderPacket = getLimitOrderPacket({
			side: Side.Bid,
			priceInTicks,
			numBaseLots,
		});
		const makerOrderIx = phoenix.createPlaceLimitOrderInstruction(
			makerOrderPacket,
			jupSolMarket.toString(),
			maker.publicKey
		);
		await sendAndConfirm(conn, payer, [makerOrderIx], [maker]);
	});

	it('Request Withdraw', async () => {
		const investorEquityBefore = await fetchInvestorEquity(
			program,
			conn,
			investor,
			vaultKey
		);
		console.log(
			`investor equity before withdraw request: ${investorEquityBefore}`
		);
		assert.strictEqual(investorEquityBefore, 1009.99901);

		const vaultEquity = new BN(
			investorEquityBefore * QUOTE_PRECISION.toNumber()
		);

		const investorAcct = await program.account.investor.fetch(investor);
		const vaultAcct = await program.account.vault.fetch(vaultKey);
		const withdrawRequestEquity = calculateRealizedInvestorEquity(
			investorAcct,
			vaultEquity,
			vaultAcct
		);
		console.log(
			`withdraw request: ${
				withdrawRequestEquity.toNumber() / QUOTE_PRECISION.toNumber()
			}`
		);

		try {
			const ix = await program.methods
				.requestWithdraw(withdrawRequestEquity, WithdrawUnit.TOKEN)
				.accounts({
					vault: vaultKey,
					investor,
					authority: provider.publicKey,
					marketRegistry,
					vaultUsdcTokenAccount: vaultUsdcAta,
				})
				.remainingAccounts(markets)
				.instruction();
			await sendAndConfirm(conn, payer, [ix]);
		} catch (e: any) {
			throw new Error(e);
		}

		const investorEquityAfter = await fetchInvestorEquity(
			program,
			conn,
			investor,
			vaultKey
		);
		assert.strictEqual(investorEquityAfter, 1009.99901);

		const investorAcctAfter = await program.account.investor.fetch(investor);
		const withdrawRequestValue =
			investorAcctAfter.lastWithdrawRequest.value.toNumber() /
			QUOTE_PRECISION.toNumber();
		assert.strictEqual(withdrawRequestValue, 1009.99901);
	});

	it('Appoint Liquidator', async () => {
		try {
			const markets: AccountMeta[] = [
				{
					pubkey: solUsdcMarket,
					isWritable: false,
					isSigner: false,
				},
			];
			const ix = await program.methods
				.appointLiquidator()
				.accounts({
					vault: vaultKey,
					investor,
					authority: provider.publicKey,
					marketRegistry,
					vaultQuoteTokenAccount: vaultUsdcAta,
				})
				.remainingAccounts(markets)
				.instruction();
			await sendAndConfirm(conn, payer, [ix]);
		} catch (e: any) {
			throw new Error(e);
		}
	});

	it('Liquidate Vault JUP/SOL Position', async () => {
		const vaultBaseTokenAccount = getAssociatedTokenAddressSync(
			jupMint,
			vaultKey,
			true
		);
		const vaultSolTokenAccount = getAssociatedTokenAddressSync(
			solMint,
			vaultKey,
			true
		);
		const vaultUsdcTokenAccount = getAssociatedTokenAddressSync(
			usdcMint,
			vaultKey,
			true
		);

		const vaultJupBefore = await tokenBalance(conn, vaultBaseTokenAccount);
		const vaultSolBefore = await tokenBalance(conn, vaultSolTokenAccount);
		const vaultUsdcBefore = await tokenBalance(conn, vaultUsdcTokenAccount);
		console.log(
			`vault before JUP/SOL liquidation, jup: ${vaultJupBefore}, sol: ${vaultSolBefore}, usdc: ${vaultUsdcBefore}`
		);
		assert.strictEqual(vaultJupBefore, 0);
		assert.strictEqual(vaultSolBefore, 0);
		assert.strictEqual(vaultUsdcBefore, 0);

		const vaultJupSolStateBefore = await fetchTraderState(
			conn,
			jupSolMarket,
			vaultKey
		);
		console.log(
			`vault JUP/SOL trader state before liquidation, jup: ${vaultJupSolStateBefore.baseUnitsFree}, sol: ${vaultJupSolStateBefore.quoteUnitsFree}`
		);
		assert.strictEqual(vaultJupSolStateBefore.baseUnitsFree, 0);
		assert.strictEqual(vaultJupSolStateBefore.quoteUnitsFree, 9.999);

		const vaultSolUsdcStateBefore = await fetchTraderState(
			conn,
			solUsdcMarket,
			vaultKey
		);
		console.log(
			`vault SOL/USDC trader state before liquidation, sol: ${vaultSolUsdcStateBefore.baseUnitsFree}, usdc: ${vaultSolUsdcStateBefore.quoteUnitsFree}`
		);
		assert.strictEqual(vaultSolUsdcStateBefore.baseUnitsFree, 0);
		assert.strictEqual(vaultSolUsdcStateBefore.quoteUnitsFree, 1000.00001);

		const investorEquity = await fetchInvestorEquity(
			program,
			conn,
			investor,
			vaultKey
		);
		assert.strictEqual(investorEquity, 1009.99901);

		const investorUsdcBefore = await tokenBalance(conn, investorUsdcAta);
		assert.strictEqual(investorUsdcBefore, 0);

		const jupSolMarketPositionBefore = await fetchMarketPosition(
			program,
			vaultKey,
			jupSolMarket
		);
		console.log(
			`vault JUP/SOL market position before liquidation, jup: ${jupSolMarketPositionBefore.baseUnitsFree}, sol: ${jupSolMarketPositionBefore.quoteUnitsFree}`
		);
		assert.strictEqual(jupSolMarketPositionBefore.baseUnitsFree, 0);
		assert.strictEqual(jupSolMarketPositionBefore.quoteUnitsFree, 9.999);

		try {
			const ix = await program.methods
				.liquidateSolMarket()
				.accounts({
					vault: vaultKey,
					investor,
					authority: provider.publicKey,
					marketRegistry,
					investorUsdcTokenAccount: investorUsdcAta,
					phoenix: PHOENIX_PROGRAM_ID,
					logAuthority: getLogAuthority(),
					market: jupSolMarket,
					seat: getSeatAddress(jupSolMarket, vaultKey),
					baseMint: jupMint,
					solMint,
					usdcMint,
					vaultBaseTokenAccount,
					vaultSolTokenAccount,
					vaultUsdcTokenAccount,
					marketBaseTokenAccount: phoenix.getBaseVaultKey(
						jupSolMarket.toString()
					),
					marketSolTokenAccount: phoenix.getQuoteVaultKey(
						jupSolMarket.toString()
					),
					solUsdcMarket,
					solUsdcMarketSeat: getSeatAddress(solUsdcMarket, vaultKey),
					solUsdcMarketSolTokenAccount: phoenix.getBaseVaultKey(
						solUsdcMarket.toString()
					),
					solUsdcMarketUsdcTokenAccount: phoenix.getQuoteVaultKey(
						solUsdcMarket.toString()
					),
					tokenProgram: TOKEN_PROGRAM_ID,
				})
				.remainingAccounts(markets)
				.instruction();
			await sendAndConfirm(conn, payer, [ix]);
		} catch (e: any) {
			throw new Error(e);
		}

		const vaultSolAfter = await tokenBalance(conn, vaultSolTokenAccount);
		const vaultUsdcAfter = await tokenBalance(conn, vaultUsdcTokenAccount);
		console.log(
			`vault after liquidation, sol: ${vaultSolAfter}, usdc: ${vaultUsdcAfter}`
		);
		assert.strictEqual(vaultSolAfter, 0);
		assert.strictEqual(vaultUsdcAfter, 1010);

		const vaultJupSolStateAfter = await fetchTraderState(
			conn,
			jupSolMarket,
			vaultKey
		);
		console.log(
			`vault JUP/SOL trader state after liquidation, jup: ${vaultJupSolStateAfter.baseUnitsFree}, sol: ${vaultJupSolStateAfter.quoteUnitsFree}`
		);
		assert.strictEqual(vaultJupSolStateAfter.baseUnitsFree, 0);
		assert.strictEqual(vaultJupSolStateAfter.quoteUnitsFree, 1.919);

		const vaultSolUsdcStateAfter = await fetchTraderState(
			conn,
			solUsdcMarket,
			vaultKey
		);
		console.log(
			`vault SOL/USDC trader state after liquidation, sol: ${vaultSolUsdcStateAfter.baseUnitsFree}, usdc: ${vaultSolUsdcStateAfter.quoteUnitsFree}`
		);
		assert.strictEqual(vaultSolUsdcStateAfter.baseUnitsFree, 0);
		assert.strictEqual(vaultSolUsdcStateAfter.quoteUnitsFree, 999.89901);

		const jupSolMarketPositionAfter = await fetchMarketPosition(
			program,
			vaultKey,
			jupSolMarket
		);
		console.log(
			`vault JUP/SOL market position after liquidation, jup: ${jupSolMarketPositionAfter.baseUnitsFree}, sol: ${jupSolMarketPositionAfter.quoteUnitsFree}`
		);
		assert.strictEqual(jupSolMarketPositionAfter.baseUnitsFree, 0);
		assert.strictEqual(jupSolMarketPositionAfter.quoteUnitsFree, 1.919);

		const solUsdcMarketPositionAfter = await fetchMarketPosition(
			program,
			vaultKey,
			solUsdcMarket
		);
		console.log(
			`vault SOL/USDC market position after liquidation, sol: ${solUsdcMarketPositionAfter.baseUnitsFree}, usdc: ${solUsdcMarketPositionAfter.quoteUnitsFree}`
		);
		assert.strictEqual(solUsdcMarketPositionAfter.baseUnitsFree, 0);
		assert.strictEqual(solUsdcMarketPositionAfter.quoteUnitsFree, 999.89901);
	});

	it('Withdraw', async () => {
		const markets: AccountMeta[] = marketKeys.map((pubkey) => {
			return {
				pubkey,
				isWritable: false,
				isSigner: false,
			};
		});
		const withdrawIx = await program.methods
			.investorWithdraw()
			.accounts({
				vault: vaultKey,
				investor,
				authority: provider.publicKey,
				marketRegistry,
				investorQuoteTokenAccount: investorUsdcAta,
				phoenix: PHOENIX_PROGRAM_ID,
				logAuthority: getLogAuthority(),
				market: solUsdcMarket,
				seat: getSeatAddress(solUsdcMarket, vaultKey),
				baseMint: solMint,
				quoteMint: usdcMint,
				vaultBaseTokenAccount: vaultSolAta,
				vaultQuoteTokenAccount: vaultUsdcAta,
				marketBaseTokenAccount: phoenix.getBaseVaultKey(
					solUsdcMarket.toString()
				),
				marketQuoteTokenAccount: phoenix.getQuoteVaultKey(
					solUsdcMarket.toString()
				),
				tokenProgram: TOKEN_PROGRAM_ID,
			})
			.remainingAccounts(markets)
			.instruction();
		try {
			await sendAndConfirm(conn, payer, [withdrawIx]);
		} catch (e: any) {
			throw new Error(e);
		}

		const vaultSolAfter = await tokenBalance(conn, vaultSolAta);
		const vaultUsdcAfter = await tokenBalance(conn, vaultUsdcAta);
		console.log(
			`vault after withdraw, sol: ${vaultSolAfter}, usdc: ${vaultUsdcAfter}`
		);
		assert.strictEqual(vaultSolAfter, 0);
		assert.strictEqual(vaultUsdcAfter, 0.00099);

		const investorUsdcAfter = await tokenBalance(conn, investorUsdcAta);
		console.log(`investor usdc after withdraw: ${investorUsdcAfter}`);
		assert.strictEqual(investorUsdcAfter, 1009.99901);

		const investorAcct = await program.account.investor.fetch(investor);
		const withdrawRequest =
			investorAcct.lastWithdrawRequest.value.toNumber() /
			QUOTE_PRECISION.toNumber();
		console.log(`investor withdraw request: ${withdrawRequest}`);
		assert.strictEqual(withdrawRequest, 0);
	});
});
