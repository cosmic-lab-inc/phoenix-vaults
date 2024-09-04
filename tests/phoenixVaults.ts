import * as anchor from '@coral-xyz/anchor';
import {ConfirmOptions, Keypair, PublicKey} from '@solana/web3.js';
import { assert } from 'chai';
import {
	getVaultAddressSync,
	PhoenixVaults,
	encodeName,
	VaultParams,
	getTokenVaultAddressSync,
	getInvestorAddressSync,
	PHOENIX_VAULTS_PROGRAM_ID,
} from "../ts/sdk";
import {BN} from "@coral-xyz/anchor";
import {mockUSDCMint} from "./testHelpers";
import { AddressLookupTableProgram } from "@solana/web3.js";

describe('phoenixVaults', () => {
	const opts: ConfirmOptions = {
		preflightCommitment: 'confirmed',
		skipPreflight: false,
		commitment: 'confirmed',
	};

	// Configure the client to use the local cluster.
	const provider = anchor.AnchorProvider.local(undefined, opts);
	anchor.setProvider(provider);
	const program = anchor.workspace.PhoenixVaults as anchor.Program<PhoenixVaults>;

	// const initialSolPerpPrice = 100;

	let mint: Keypair;
	const _manager = provider.publicKey;
	const protocol = provider.publicKey;

	const name = 'Test Vault';
	const vaultKey = getVaultAddressSync(program.programId, encodeName(name));
	const vaultAta = getTokenVaultAddressSync(
		program.programId,
		vaultKey,
	);
	const investor = getInvestorAddressSync(
		program.programId,
		vaultKey,
		provider.publicKey,
	);

	before(async () => {
		mint = await mockUSDCMint(provider);
		// const _solPerpOracle = await mockOracle(initialSolPerpPrice, undefined, undefined);
	});

	it('Initialize Market Lookup Table', async () => {
		const slot = await provider.connection.getSlot();
		const params = {
			slot: new BN(slot)
		};

		// convert slot to little endian
		const slotBuffer = Buffer.alloc(8);
		slotBuffer.writeBigInt64LE(BigInt(slot), 0);

		// let lut_seeds = &[auth.as_ref(), &clock.slot.to_le_bytes()],
		const lutSeeds = [
			provider.publicKey.toBuffer(),
			slotBuffer
		];
		const lut = PublicKey.findProgramAddressSync(
			lutSeeds,
			PHOENIX_VAULTS_PROGRAM_ID
			// AddressLookupTableProgram.programId
		)[0];
		console.log('lut:', lut.toString());

		const accounts = {
			authority: provider.publicKey,
			lut,
			lutProgram: AddressLookupTableProgram.programId,
		};

		try {
			const sim = await program.methods
				.initializeMarketLookupTable(params)
				.accounts(accounts)
				.simulate();
			console.log(sim);

			await program.methods.initializeMarketLookupTable(params)
				.accounts(accounts)
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
			mint: mint.publicKey,
		};
		// @ts-ignore
		await program.methods.initializeVault(config)
			.accounts(accounts)
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
		// @ts-ignore
		await program.methods.initializeInvestor()
			.accounts(accounts)
			.rpc();
		const acct = await program.account.investor.fetch(investor);
		assert(!!acct);
	});
});
