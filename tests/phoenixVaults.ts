import * as anchor from '@coral-xyz/anchor';
import {
	AccountMeta,
	AddressLookupTableProgram,
	ConfirmOptions,
	Keypair,
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
} from '../ts/sdk';
import { BN } from '@coral-xyz/anchor';
import { mockMint } from './testHelpers';
import * as phoenix from '@ellipsis-labs/phoenix-sdk';

describe('phoenixVaults', () => {
	const opts: ConfirmOptions = {
		preflightCommitment: 'confirmed',
		skipPreflight: false,
		commitment: 'confirmed',
	};

	// Configure the client to use the local cluster.
	const provider = anchor.AnchorProvider.local(undefined, opts);
	anchor.setProvider(provider);
	const program = anchor.workspace
		.PhoenixVaults as anchor.Program<PhoenixVaults>;

	const mainnetConnection = new anchor.web3.Connection(
		'https://api.mainnet-beta.solana.com',
		'confirmed'
	);
	const mainnetUsdcMint = new PublicKey(
		'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
	);
	const mainnetSolMint = new PublicKey(
		'So11111111111111111111111111111111111111112'
	);
	let phoenixClient: phoenix.Client;
	const marketRegistry = getMarketRegistryAddressSync();
	let lutSlot: number;
	let lut: PublicKey;

	let usdcMint: Keypair;
	let _solMint: Keypair;
	const _manager = provider.publicKey;
	const protocol = provider.publicKey;

	const name = 'Test Vault';
	const vaultKey = getVaultAddressSync(encodeName(name));
	const vaultAta = getTokenVaultAddressSync(vaultKey);
	const investor = getInvestorAddressSync(vaultKey, provider.publicKey);

	before(async () => {
		phoenixClient = await phoenix.Client.create(mainnetConnection);

		usdcMint = await mockMint(provider);
		_solMint = await mockMint(provider);

		lutSlot = await provider.connection.getSlot();
		const slotBuffer = Buffer.alloc(8);
		slotBuffer.writeBigInt64LE(BigInt(lutSlot), 0);
		const lutSeeds = [provider.publicKey.toBuffer(), slotBuffer];
		lut = PublicKey.findProgramAddressSync(
			lutSeeds,
			AddressLookupTableProgram.programId
		)[0];
	});

	it('Create Address Lookup Table', async () => {
		const [ix, _] = AddressLookupTableProgram.createLookupTable({
			authority: provider.publicKey,
			payer: provider.publicKey,
			recentSlot: lutSlot,
		});
		const recentBlockhash = await provider.connection
			.getLatestBlockhash()
			.then((res) => res.blockhash);
		const msg = new anchor.web3.TransactionMessage({
			payerKey: provider.publicKey,
			recentBlockhash,
			instructions: [ix],
		}).compileToV0Message();
		const tx = new anchor.web3.VersionedTransaction(msg);
		await provider.wallet.signTransaction(tx);
	});

	it('Initialize Market Registry', async () => {
		const accounts = {
			authority: provider.publicKey,
			lut,
			marketRegistry,
			lutProgram: AddressLookupTableProgram.programId,
		};

		const marketMetadatas = Array.from(phoenixClient.marketMetadatas.values());
		// split in half
		const half = Math.ceil(marketMetadatas.length / 2);
		const firstHalf = marketMetadatas.slice(0, half);
		// const secondHalf = marketMetadatas.slice(half, marketMetadatas.length);

		const markets: AccountMeta[] = firstHalf.map((m) => {
			return {
				pubkey: m.address,
				isWritable: false,
				isSigner: false,
			};
		});
		const solUsdcMarketIndex = firstHalf.findIndex((m) => {
			return (
				m.baseParams.mintKey.toString() === mainnetSolMint.toString() &&
				m.quoteParams.mintKey.toString() === mainnetUsdcMint.toString()
			);
		});
		if (solUsdcMarketIndex === -1) {
			throw new Error('SOL/USDC market not found');
		}
		const params = {
			usdcMint: mainnetUsdcMint,
			solMint: mainnetSolMint,
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
