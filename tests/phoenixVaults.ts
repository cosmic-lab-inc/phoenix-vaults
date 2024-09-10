import * as anchor from '@coral-xyz/anchor';
import {
	AccountMeta,
	AddressLookupTableAccount,
	AddressLookupTableProgram,
	ConfirmOptions,
	Keypair,
	LAMPORTS_PER_SOL,
	PublicKey,
} from '@solana/web3.js';
import { assert } from 'chai';
import { before } from 'mocha';
import {
	getVaultAddressSync,
	PhoenixVaults,
	encodeName,
	VaultParams,
	getTokenVaultAddressSync,
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
import { sendAndConfirm } from './testHelpers';
// import {
// 	RawMarketConfig,
// 	Client as PhoenixClient,
// 	getMakerSetupInstructionsForMarket,
// 	getLimitOrderPacket,
// 	Side,
// } from '@ellipsis-labs/phoenix-sdk';
import {
	RawMarketConfig,
	Client as PhoenixClient,
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
	const _manager = Keypair.generate();
	const protocol = Keypair.generate();
	const maker = Keypair.generate();

	const name = 'Test Vault';
	const vaultKey = getVaultAddressSync(encodeName(name));
	const vaultAta = getTokenVaultAddressSync(vaultKey);
	const investor = getInvestorAddressSync(vaultKey, provider.publicKey);
	const investorAta = getAssociatedTokenAddressSync(
		usdcMint,
		provider.publicKey
	);

	const marketKeys: PublicKey[] = [solUsdcMarket, jupSolMarket, jupUsdcMarket];
	const solUsdcMarketIndex = 0;
	const _startSolUsdcPrice = 100;
	const _endSolUsdcPrice = 110;
	const usdcAmount = new BN(1_000).mul(MOCK_USDC_PRECISION);
	const _solAmount = new BN(1_000).mul(MOCK_SOL_PRECISION);

	before(async () => {
		phoenix = await PhoenixClient.createFromConfig(
			provider.connection,
			MARKET_CONFIG
		);
		// await phoenix.addMarket(solUsdcMarket.toBase58(), true);

		await provider.connection.requestAirdrop(maker.publicKey, LAMPORTS_PER_SOL);

		lutSlot = await provider.connection.getSlot('finalized');
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

		const sig = await sendAndConfirm(provider, payer, [ix]);
		console.log('create lut:', sig);

		const lutAcctInfo = await provider.connection.getAccountInfo(
			lut,
			'processed'
		);
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

		const sig = await sendAndConfirm(provider, payer, [ix]);
		console.log('extend lut:', sig);

		const lutAcctInfo = await provider.connection.getAccountInfo(
			lut,
			'processed'
		);
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
		assert(deposits === 1000);
		assert(shares === 1000);
	});

	// it('Long SOL-USDC', async () => {
	// 	// todo
	// 	//   init maker and place maker order
	// 	//   place taker order with vault
	// 	//   assert balances
	//
	// 	const marketState = phoenix.marketStates.get(solUsdcMarket.toString());
	// 	if (marketState === undefined) {
	// 		throw Error('SOL/USDC market not found');
	// 	}
	//
	// 	// This function creates a bundle of new instructions that includes:
	// 	// - Create associated token accounts for base and quote tokens, if needed
	// 	// - Claim a maker seat on the market, if needed
	// 	const setupMakerIxs = await getMakerSetupInstructionsForMarket(
	// 		provider.connection,
	// 		marketState,
	// 		maker.publicKey
	// 	);
	// 	// maker is selling SOL
	// 	const mintSolIx = createMintToInstruction(
	// 		usdcMint,
	// 		investorAta,
	// 		mintAuth.publicKey,
	// 		solAmount.toNumber()
	// 	);
	// 	await sendAndConfirm(
	// 		provider,
	// 		payer,
	// 		[...setupMakerIxs, mintSolIx],
	// 		[mintAuth, maker]
	// 	);
	// 	console.log('setup maker');
	//
	// 	// todo: convert float values to ticks and lots
	// 	const makerOrderPacket = getLimitOrderPacket({
	// 		side: Side.Ask,
	// 		priceInTicks: 200,
	// 		numBaseLots: 1,
	// 	});
	// 	const makerOrderIx = phoenix.createPlaceLimitOrderInstruction(
	// 		makerOrderPacket,
	// 		solUsdcMarket.toString(),
	// 		maker.publicKey
	// 	);
	// 	await sendAndConfirm(provider, payer, [makerOrderIx], [maker]);
	// 	console.log('placed maker ask');
	// });
});
