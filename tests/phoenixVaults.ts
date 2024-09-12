import * as anchor from '@coral-xyz/anchor';
import {
	AccountMeta,
	AddressLookupTableAccount,
	AddressLookupTableProgram,
	ConfirmOptions,
	Keypair,
	LAMPORTS_PER_SOL,
	PublicKey,
	TransactionInstruction,
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
	MOCK_JUP_MINT,
	MOCK_SOL_USDC_MARKET,
	MOCK_JUP_SOL_MARKET,
	MOCK_JUP_USDC_MARKET,
	MOCK_MARKET_AUTHORITY,
	QUOTE_PRECISION,
	MOCK_USDC_PRECISION,
	MOCK_SOL_PRECISION,
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
	signatureLink,
	sendAndConfirm,
	simulate,
} from './testHelpers';
import {
	RawMarketConfig,
	Client as PhoenixClient,
	getMakerSetupInstructionsForMarket,
	getLimitOrderPacket,
	Side,
	getSeatManagerAddress,
	deserializeSeatManagerData,
	createPlaceLimitOrderInstruction,
	PROGRAM_ID as PHOENIX_PROGRAM_ID,
	getLogAuthority,
	getSeatAddress,
	confirmOrCreateClaimSeatIxs,
	createRequestSeatInstruction,
} from '@ellipsis-labs/phoenix-sdk';

const MARKET_CONFIG: RawMarketConfig = {
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
			{
				name: 'JUP',
				symbol: 'JUP',
				mint: MOCK_JUP_MINT.publicKey.toString(),
				logoUri: '',
			},
		],
		markets: [
			{
				market: MOCK_SOL_USDC_MARKET.publicKey.toString(),
				baseMint: MOCK_SOL_MINT.publicKey.toString(),
				quoteMint: MOCK_USDC_MINT.publicKey.toString(),
			},
			{
				market: MOCK_JUP_SOL_MARKET.publicKey.toString(),
				baseMint: MOCK_JUP_MINT.publicKey.toString(),
				quoteMint: MOCK_SOL_MINT.publicKey.toString(),
			},
			{
				market: MOCK_JUP_USDC_MARKET.publicKey.toString(),
				baseMint: MOCK_JUP_MINT.publicKey.toString(),
				quoteMint: MOCK_USDC_MINT.publicKey.toString(),
			},
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
	const payer: any = provider.wallet.payer as any as Keypair;
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
	const _jupMint = MOCK_JUP_MINT;
	const solUsdcMarket = MOCK_SOL_USDC_MARKET.publicKey;
	const jupSolMarket = MOCK_JUP_SOL_MARKET.publicKey;
	const jupUsdcMarket = MOCK_JUP_USDC_MARKET.publicKey;
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

	const marketKeys: PublicKey[] = [solUsdcMarket, jupSolMarket, jupUsdcMarket];
	const solUsdcMarketIndex = 0;
	const startSolUsdcPrice = 100;
	const _endSolUsdcPrice = 110;
	const usdcUiAmount = 1_000;
	const usdcAmount = new BN(usdcUiAmount).mul(MOCK_USDC_PRECISION);
	const solUiAmount = usdcUiAmount / startSolUsdcPrice;
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
		const createAtaIx = createAssociatedTokenAccountInstruction(
			payer.publicKey,
			vaultAta,
			vaultKey,
			usdcMint
		);
		await sendAndConfirm(conn, payer, [createAtaIx]);

		const config: VaultParams = {
			name: encodeName(name),
			redeemPeriod: new BN(0),
			maxTokens: new BN(0),
			managementFee: new BN(0),
			minDepositAmount: new BN(0),
			profitShare: 0,
			hurdleRate: 0,
			permissioned: false,
			protocol: protocol.publicKey,
			protocolFee: new BN(0),
			protocolProfitShare: 0,
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

		const vaultAtaBalance = (await conn.getTokenAccountBalance(vaultAta)).value
			.uiAmount;
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

	it('Maker Short SOL/USDC', async () => {
		const marketState = phoenix.marketStates.get(solUsdcMarket.toString());
		if (marketState === undefined) {
			throw Error('SOL/USDC market not found');
		}

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
		console.log('setup maker tokens');

		const claimMakerSeatIxs = await confirmOrCreateClaimSeatIxs(
			conn,
			marketState,
			maker.publicKey
		);
		console.log('maker:', maker.publicKey.toString());
		for (const ix of claimMakerSeatIxs) {
			for (const acct of ix.keys) {
				console.log(`${acct.pubkey.toString()}, signer: ${acct.isSigner}`);
			}
		}
		// const sig = await sendAndConfirm(conn, payer, claimMakerSeatIxs, [maker]);
		// console.log('claim maker seat:', signatureLink(sig, conn));

		try {
			const claimSeatIxs: TransactionInstruction[] = [];
			for (const ix of claimMakerSeatIxs) {
				claimSeatIxs.push(
					await program.methods
						.phoenix({
							phoenixIxData: ix.data,
						})
						.accounts({
							vault: vaultKey,
							delegate: manager.publicKey,
							phoenix: PHOENIX_PROGRAM_ID,
							phoenixVaults: program.programId,
						})
						.remainingAccounts(ix.keys)
						.signers([payer, maker])
						.instruction()
				);
			}
			await simulate(conn, payer, claimSeatIxs, [maker, manager]);
			const sig = await sendAndConfirm(conn, payer, claimSeatIxs, [maker]);
			console.log('claim maker seat:', signatureLink(sig, conn));
		} catch (e: any) {
			throw new Error(e);
		}

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
		console.log('placed maker ask');
	});

	// it('Taker Long SOL/USDC', async () => {
	// 	const marketState = phoenix.marketStates.get(solUsdcMarket.toString());
	// 	if (marketState === undefined) {
	// 		throw Error('SOL/USDC market not found');
	// 	}
	//
	// 	// taker is buying SOL
	// 	const createAtaIxs = await createMarketTokenAccountIxs(
	// 		conn,
	// 		marketState,
	// 		vaultKey,
	// 		payer
	// 	);
	// 	const usdcAta = getAssociatedTokenAddressSync(usdcMint, vaultKey, true);
	// 	const mintUsdcIx = createMintToInstruction(
	// 		usdcMint,
	// 		usdcAta,
	// 		mintAuth.publicKey,
	// 		usdcAmount.toNumber()
	// 	);
	//
	// 	await sendAndConfirm(
	// 		conn,
	// 		payer,
	// 		[...createAtaIxs, mintUsdcIx],
	// 		[mintAuth]
	// 	);
	// 	console.log('setup taker tokens');
	//
	// 	const claimTakerSeatIxs = await confirmOrCreateClaimSeatIxs(
	// 		conn,
	// 		marketState,
	// 		vaultKey
	// 	);
	// 	try {
	// 		const claimSeatIxs: TransactionInstruction[] = [];
	// 		for (const ix of claimTakerSeatIxs) {
	// 			claimSeatIxs.push(
	// 				await program.methods
	// 					.phoenix({
	// 						phoenixIxData: ix.data,
	// 					})
	// 					.accounts({
	// 						vault: vaultKey,
	// 						phoenix: PHOENIX_PROGRAM_ID,
	// 					})
	// 					.remainingAccounts(ix.keys)
	// 					.instruction()
	// 			);
	// 		}
	// 		await simulate(conn, payer, claimSeatIxs);
	// 		const sig = await sendAndConfirm(conn, payer, claimSeatIxs);
	// 		console.log('claim taker seat:', signatureLink(sig, conn));
	// 	} catch (e: any) {
	// 		throw new Error(e);
	// 	}
	//
	// 	const priceInTicks = phoenix.floatPriceToTicks(
	// 		startSolUsdcPrice,
	// 		solUsdcMarket.toBase58()
	// 	);
	// 	const numBaseLots = phoenix.rawBaseUnitsToBaseLotsRoundedDown(
	// 		solUiAmount,
	// 		solUsdcMarket.toBase58()
	// 	);
	// 	const takerOrderPacket = getLimitOrderPacket({
	// 		side: Side.Bid,
	// 		priceInTicks,
	// 		numBaseLots,
	// 	});
	// 	const takerOrderIx = createPlaceLimitOrderInstruction(
	// 		{
	// 			phoenixProgram: PHOENIX_PROGRAM_ID,
	// 			logAuthority: getLogAuthority(),
	// 			market: solUsdcMarket,
	// 			trader: vaultKey,
	// 			seat: getSeatAddress(solUsdcMarket, vaultKey),
	// 			baseAccount: phoenix.getBaseAccountKey(
	// 				vaultKey,
	// 				solUsdcMarket.toString()
	// 			),
	// 			quoteAccount: phoenix.getQuoteAccountKey(
	// 				vaultKey,
	// 				solUsdcMarket.toString()
	// 			),
	// 			baseVault: phoenix.getBaseVaultKey(solUsdcMarket.toString()),
	// 			quoteVault: phoenix.getQuoteVaultKey(solUsdcMarket.toString()),
	// 		},
	// 		{
	// 			orderPacket: takerOrderPacket,
	// 		}
	// 	);
	// 	try {
	// 		const ix = await program.methods
	// 			.phoenix({
	// 				phoenixIxData: takerOrderIx.data,
	// 			})
	// 			.accounts({
	// 				vault: vaultKey,
	// 				phoenix: PHOENIX_PROGRAM_ID,
	// 			})
	// 			.remainingAccounts(takerOrderIx.keys)
	// 			.instruction();
	// 		await simulate(conn, payer, [ix]);
	//
	// 		const sig = await program.methods
	// 			.phoenix({
	// 				phoenixIxData: takerOrderIx.data,
	// 			})
	// 			.accounts({
	// 				vault: vaultKey,
	// 				phoenix: PHOENIX_PROGRAM_ID,
	// 			})
	// 			.remainingAccounts(takerOrderIx.keys)
	// 			.rpc();
	// 		console.log('placed taker bid:', signatureLink(sig, conn));
	// 	} catch (e: any) {
	// 		throw new Error(e);
	// 	}
	// });
});
