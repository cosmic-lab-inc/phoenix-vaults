import * as anchor from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { assert } from 'chai';
import { before } from 'mocha';
import {
	PhoenixVaults,
	getMarketRegistryAddressSync,
	LOCALNET_MARKET_CONFIG,
} from '../ts/sdk';
import { Client as PhoenixClient } from '@ellipsis-labs/phoenix-sdk';
import { sendAndConfirm, simulate } from './testHelpers';

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

	it('Create Market Registry If Needed', async () => {
		const registryAi = await conn.getAccountInfo(marketRegistry);
		if (registryAi !== null) {
			console.log('MarketRegistry already exists');
			return;
		}

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
			solUsdcMarket: new PublicKey(solUsdcMarketConfig.marketId),
			solMint: new PublicKey(solUsdcMarketConfig.baseToken.mint),
			usdcMint: new PublicKey(solUsdcMarketConfig.quoteToken.mint),
		};
		console.log('sol mint:', params.solMint.toString());
		console.log('usdc mint:', params.usdcMint.toString());

		try {
			const ix = await program.methods
				.initializeMarketRegistry(params)
				.accounts({
					authority: provider.publicKey,
					marketRegistry,
				})
				.instruction();
			await simulate(conn, payer, [ix]);
			await sendAndConfirm(conn, payer, [ix]);
			console.log('created market registry');
		} catch (e: any) {
			throw new Error(e);
		}
	});
});
