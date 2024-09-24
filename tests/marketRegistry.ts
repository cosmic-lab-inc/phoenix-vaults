import * as anchor from '@coral-xyz/anchor';
import {
	AccountMeta,
	AddressLookupTableAccount,
	AddressLookupTableAccountArgs,
	AddressLookupTableProgram,
	Keypair,
	PublicKey,
	TransactionInstruction,
} from '@solana/web3.js';
import { assert } from 'chai';
import { before } from 'mocha';
import {
	PhoenixVaults,
	getMarketRegistryAddressSync,
	LOCALNET_MARKET_CONFIG,
} from '../ts/sdk';
import { Client as PhoenixClient } from '@ellipsis-labs/phoenix-sdk';
import {
	sendAndConfirm,
	sendAndConfirmWithLookupTable,
	simulate,
} from './testHelpers';

describe('phoenixVaults', () => {
	const provider = anchor.AnchorProvider.env();
	anchor.setProvider(provider);
	const conn = provider.connection;
	// @ts-ignore
	const payer: Keypair = provider.wallet.payer as any as Keypair;
	const program = anchor.workspace
		.PhoenixVaults as anchor.Program<PhoenixVaults>;

	let phoenix: PhoenixClient;

	const marketRegistry = getMarketRegistryAddressSync();
	let lut: PublicKey;

	before(async () => {
		if (conn.rpcEndpoint === 'http://localhost:8899') {
			console.log('On localnet');
			phoenix = await PhoenixClient.createFromConfig(
				conn,
				LOCALNET_MARKET_CONFIG,
				false,
				false
			);
		} else {
			const now = Date.now();
			phoenix = await PhoenixClient.create(conn);
			console.log(`loaded Phoenix markets in ${Date.now() - now}ms`);
		}
	});

	it('Check Authority', async () => {
		assert.strictEqual(
			provider.publicKey.toString(),
			'CSMCi5Z6pBjMXQFQayk4WgVPNAgjmo1jTNEryjYyk4xN'
		);
	});

	it('Create Lookup Table If Needed', async () => {
		const registryAi = await conn.getAccountInfo(marketRegistry);
		if (registryAi !== null) {
			console.log('MarketRegistry already exists, reading lookup table key');
			const registry = await program.account.marketRegistry.fetch(
				marketRegistry
			);
			lut = registry.lut;
			return;
		}

		const lutSlot = await conn.getSlot('finalized');
		const slotBuffer = Buffer.alloc(8);
		slotBuffer.writeBigInt64LE(BigInt(lutSlot), 0);
		const lutSeeds = [provider.publicKey.toBuffer(), slotBuffer];
		lut = PublicKey.findProgramAddressSync(
			lutSeeds,
			AddressLookupTableProgram.programId
		)[0];

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
		assert(lutAcct.authority?.toString() === provider.publicKey.toString());
		console.log('created lookup table');
	});

	it('Fill Address Lookup Table', async () => {
		const lutAcctInfo = await conn.getAccountInfo(lut);
		assert(lutAcctInfo !== null);
		const lutAcct = AddressLookupTableAccount.deserialize(lutAcctInfo.data);
		const marketKeys: PublicKey[] = Array.from(phoenix.marketStates.keys()).map(
			(key) => new PublicKey(key)
		);
		for (let i = 0; i < lutAcct.addresses.length; i++) {
			assert(lutAcct.addresses[i].equals(marketKeys[i]));
		}
		console.log(
			`validated ${lutAcct.addresses.length} lookup table keys match Phoenix markets`
		);

		if (marketKeys.length - lutAcct.addresses.length) {
			console.log('adding more addresses to the lookup table');
			const keysToAdd = marketKeys.slice(lutAcct.addresses.length);
			// if marketKeys.length > 20, we need to split the list into multiple transactions
			const addChunks: TransactionInstruction[] = [];
			const chunkSize = 20;
			for (let i = 0; i < keysToAdd.length; i += chunkSize) {
				const chunk = keysToAdd.slice(i, i + chunkSize);
				console.log(`---- #${i} ----`);
				console.log(chunk.map((key) => key.toString()));
				const ix = AddressLookupTableProgram.extendLookupTable({
					lookupTable: lut,
					authority: provider.publicKey,
					payer: provider.publicKey,
					addresses: chunk,
				});
				addChunks.push(ix);
			}
			await sendAndConfirm(conn, payer, addChunks);
		}
	});

	it('Create Market Registry If Needed', async () => {
		const registryAi = await conn.getAccountInfo(marketRegistry);
		if (registryAi !== null) {
			console.log('MarketRegistry already exists');
			return;
		}

		const markets: AccountMeta[] = Array.from(
			phoenix.marketMetadatas.keys()
		).map((key) => {
			return {
				pubkey: new PublicKey(key),
				isWritable: false,
				isSigner: false,
			};
		});
		const solUsdcMarketConfig = Array.from(phoenix.marketConfigs.values()).find(
			(market) => {
				return (
					market.baseToken.symbol === 'SOL' &&
					market.quoteToken.symbol === 'USDC'
				);
			}
		);
		if (!solUsdcMarketConfig) {
			throw new Error('SOL/USDC market not found');
		}
		const params = {
			solMint: new PublicKey(solUsdcMarketConfig.baseToken.mint),
			usdcMint: new PublicKey(solUsdcMarketConfig.quoteToken.mint),
		};
		console.log('sol mint:', params.solMint.toString());
		console.log('usdc mint:', params.usdcMint.toString());

		const lutAcctInfo = await conn.getAccountInfo(lut);
		assert(lutAcctInfo !== null);
		const lutState = AddressLookupTableAccount.deserialize(lutAcctInfo.data);
		const lookupTable = new AddressLookupTableAccount({
			key: lut,
			state: lutState,
		} as AddressLookupTableAccountArgs);

		try {
			const ix = await program.methods
				.initializeMarketRegistry(params)
				.accounts({
					authority: provider.publicKey,
					lut,
					marketRegistry,
					lutProgram: AddressLookupTableProgram.programId,
				})
				.remainingAccounts(markets)
				.instruction();
			await simulate(conn, payer, [ix]);
			await sendAndConfirmWithLookupTable(conn, payer, [ix], [lookupTable]);
			console.log('created market registry');
		} catch (e: any) {
			throw new Error(e);
		}
	});
});
