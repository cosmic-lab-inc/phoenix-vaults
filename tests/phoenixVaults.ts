import * as anchor from '@coral-xyz/anchor';
import {
	AccountMeta,
	AddressLookupTableAccount,
	AddressLookupTableProgram,
	ConfirmOptions,
	Keypair,
	PublicKey,
	TransactionConfirmationStrategy,
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
} from '../ts/sdk';
import { BN } from '@coral-xyz/anchor';

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
	const payer: any = provider.wallet.payer;
	const providerKeypair = payer as Keypair;
	const program = anchor.workspace
		.PhoenixVaults as anchor.Program<PhoenixVaults>;

	const marketRegistry = getMarketRegistryAddressSync();
	let lutSlot: number;
	let lut: PublicKey;

	const usdcMint = MOCK_USDC_MINT;
	const solMint = MOCK_SOL_MINT;
	const _jupMint = MOCK_JUP_MINT;
	const _manager = provider.publicKey;
	const protocol = provider.publicKey;

	const name = 'Test Vault';
	const vaultKey = getVaultAddressSync(encodeName(name));
	const vaultAta = getTokenVaultAddressSync(vaultKey);
	const investor = getInvestorAddressSync(vaultKey, provider.publicKey);

	const marketKeys: PublicKey[] = [
		MOCK_SOL_USDC_MARKET.publicKey,
		MOCK_JUP_SOL_MARKET.publicKey,
		MOCK_JUP_USDC_MARKET.publicKey,
	];
	const solUsdcMarketIndex = 0;

	before(async () => {
		// await mockMint(provider, MOCK_USDC_MINT);
		// await mockMint(provider, MOCK_SOL_MINT);
		// await mockMint(provider, MOCK_JUP_MINT);

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
		const recentBlockhash = await provider.connection
			.getLatestBlockhash()
			.then((res) => res.blockhash);
		const msg = new anchor.web3.TransactionMessage({
			payerKey: provider.publicKey,
			recentBlockhash,
			instructions: [ix],
		}).compileToV0Message();
		const tx = new anchor.web3.VersionedTransaction(msg);
		tx.sign([providerKeypair]);

		const sig = await provider.sendAndConfirm(tx, [], {
			skipPreflight: true,
		});
		console.log('create lut:', sig);

		const lutAcctInfo = await provider.connection.getAccountInfo(
			lut,
			'processed'
		);
		assert(lutAcctInfo !== null);
		const lutAcct = AddressLookupTableAccount.deserialize(lutAcctInfo.data);
		assert(lutAcct.authority.toString() === provider.publicKey.toString());
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
			usdcMint: usdcMint.publicKey,
			solMint: solMint.publicKey,
			solUsdcMarketIndex,
		};

		try {
			const sim = await program.methods
				.initializeMarketRegistry(params)
				.accounts(accounts)
				.remainingAccounts(markets)
				.simulate();
			console.log(sim);

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
			protocol,
			protocolFee: new BN(0),
			protocolProfitShare: 0,
		};
		const accounts = {
			vault: vaultKey,
			tokenAccount: vaultAta,
			mint: usdcMint.publicKey,
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
});
