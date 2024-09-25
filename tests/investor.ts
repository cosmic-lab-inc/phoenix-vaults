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
	PHOENIX_PROGRAM_ID,
	WithdrawUnit,
	LOCALNET_MARKET_CONFIG,
	PHOENIX_SEAT_MANAGER_PROGRAM_ID,
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
	fetchTraderState,
	fetchInvestorEquity,
	calculateRealizedInvestorEquity,
} from './testHelpers';
import {
	Client as PhoenixClient,
	getLogAuthority,
	getSeatAddress,
	getSeatDepositCollectorAddress,
	getSeatManagerAddress,
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
	const solUsdcMarket = MOCK_SOL_USDC_MARKET.publicKey;
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
	const usdcUiAmount = 1009.037049;
	const usdcAmount = new BN(usdcUiAmount).mul(MOCK_USDC_PRECISION);

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

	it('Deposit', async () => {
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
			usdcAmount.toNumber()
		);
		await sendAndConfirm(conn, payer, [createAtaIx, mintToIx], [mintAuth]);

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

		const accounts = {
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
			vaultBaseTokenAccount,
			vaultQuoteTokenAccount,
			marketBaseTokenAccount,
			marketQuoteTokenAccount,
		};
		const markets: AccountMeta[] = marketKeys.map((pubkey) => {
			return {
				pubkey,
				isWritable: false,
				isSigner: false,
			};
		});

		const ix = await program.methods
			.investorDeposit(usdcAmount)
			.accounts(accounts)
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
		assert.equal(deposits, usdcUiAmount);
		// assert.equal(shares, 1000);

		const vaultSol = await tokenBalance(conn, vaultQuoteTokenAccount);
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
		assert.equal(vaultState.quoteUnitsFree, usdcUiAmount);
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
		// assert.strictEqual(investorEquityBefore, 1249.75002);

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
			`withdraw request equity: ${
				withdrawRequestEquity.toNumber() / QUOTE_PRECISION.toNumber()
			}`
		);

		try {
			const markets: AccountMeta[] = marketKeys.map((pubkey) => {
				return {
					pubkey,
					isWritable: false,
					isSigner: false,
				};
			});
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
		console.log(
			`investor equity after withdraw request: ${investorEquityAfter}`
		);
		// assert.strictEqual(investorEquityAfter, 1199.80001619964);

		const investorAcctAfter = await program.account.investor.fetch(investor);
		const withdrawRequestValue =
			investorAcctAfter.lastWithdrawRequest.value.toNumber() /
			QUOTE_PRECISION.toNumber();
		console.log(`investor withdraw request: ${withdrawRequestValue}`);
		// assert.strictEqual(withdrawRequestValue, 1199.800016);
	});

	it('Withdraw', async () => {
		const markets: AccountMeta[] = marketKeys.map((pubkey) => {
			return {
				pubkey,
				isWritable: false,
				isSigner: false,
			};
		});

		const ix = await program.methods
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
			await sendAndConfirm(conn, payer, [ix]);
		} catch (e: any) {
			throw new Error(e);
		}
	});
});
