import { BN } from '@coral-xyz/anchor';
import { Keypair, PublicKey } from '@solana/web3.js';
import { RawMarketConfig } from '@ellipsis-labs/phoenix-sdk';

export const ZERO = new BN(0);
export const QUOTE_PRECISION_EXP = new BN(6);
export const PRICE_PRECISION_EXP = new BN(6);
export const QUOTE_PRECISION = new BN(10).pow(QUOTE_PRECISION_EXP);
export const PRICE_PRECISION = new BN(10).pow(PRICE_PRECISION_EXP);
export const PERCENTAGE_PRECISION_EXP = new BN(6);
export const PERCENTAGE_PRECISION = new BN(10).pow(PERCENTAGE_PRECISION_EXP);

export const MOCK_MARKET_AUTHORITY = Keypair.fromSecretKey(
	Uint8Array.from([
		66, 123, 76, 224, 250, 46, 45, 185, 92, 44, 26, 59, 177, 162, 57, 152, 152,
		168, 214, 27, 185, 110, 97, 62, 226, 94, 214, 190, 206, 253, 83, 234, 143,
		207, 63, 171, 250, 160, 85, 171, 204, 57, 11, 146, 117, 118, 22, 155, 104,
		251, 84, 131, 255, 168, 226, 187, 237, 120, 54, 43, 103, 65, 121, 161,
	])
);

export const MOCK_USDC_MINT = Keypair.fromSecretKey(
	Uint8Array.from([
		87, 198, 89, 198, 67, 63, 51, 219, 219, 205, 135, 80, 234, 56, 140, 16, 89,
		50, 81, 229, 158, 31, 99, 65, 96, 2, 245, 44, 73, 148, 172, 223, 207, 221,
		139, 122, 3, 190, 18, 238, 58, 168, 238, 122, 70, 81, 217, 218, 189, 29,
		109, 94, 252, 95, 110, 157, 33, 107, 20, 14, 201, 83, 184, 122,
	])
);
export const MOCK_USDC_DECIMALS = 6;
export const MOCK_USDC_PRECISION = new BN(10).pow(new BN(MOCK_USDC_DECIMALS));

export const MOCK_SOL_MINT = Keypair.fromSecretKey(
	Uint8Array.from([
		168, 35, 20, 1, 139, 84, 3, 188, 183, 74, 164, 142, 249, 104, 144, 203, 18,
		74, 246, 121, 144, 17, 17, 220, 68, 183, 73, 72, 98, 138, 227, 243, 236, 2,
		190, 43, 13, 5, 202, 115, 113, 27, 211, 68, 74, 123, 176, 95, 132, 166, 213,
		212, 17, 228, 204, 134, 113, 149, 209, 227, 99, 7, 170, 237,
	])
);
export const MOCK_SOL_DECIMALS = 9;
export const MOCK_SOL_PRECISION = new BN(10).pow(new BN(MOCK_SOL_DECIMALS));

export const MOCK_JUP_MINT = Keypair.fromSecretKey(
	Uint8Array.from([
		239, 37, 196, 242, 130, 217, 89, 30, 157, 246, 22, 44, 213, 30, 154, 9, 107,
		91, 87, 56, 32, 44, 132, 214, 205, 160, 235, 21, 193, 82, 156, 27, 0, 52,
		31, 170, 133, 18, 164, 125, 228, 81, 137, 2, 18, 235, 65, 106, 203, 192, 88,
		222, 174, 198, 7, 131, 115, 181, 13, 17, 236, 173, 207, 77,
	])
);
export const MOCK_JUP_DECIMALS = 9;
export const MOCK_JUP_PRECISION = new BN(10).pow(new BN(MOCK_JUP_DECIMALS));

export const MOCK_SOL_USDC_MARKET = Keypair.fromSecretKey(
	Uint8Array.from([
		93, 15, 240, 33, 150, 60, 211, 167, 231, 22, 41, 204, 200, 97, 206, 142, 26,
		4, 165, 42, 10, 250, 122, 223, 206, 1, 229, 158, 165, 59, 223, 236, 43, 187,
		177, 182, 105, 104, 42, 76, 105, 0, 63, 206, 168, 171, 153, 177, 92, 111,
		205, 70, 213, 77, 79, 158, 212, 90, 50, 22, 37, 161, 233, 161,
	])
);

export const MOCK_JUP_SOL_MARKET = Keypair.fromSecretKey(
	Uint8Array.from([
		15, 151, 240, 120, 77, 168, 237, 143, 234, 212, 68, 61, 31, 86, 52, 247, 1,
		94, 88, 16, 218, 194, 238, 146, 159, 57, 164, 139, 27, 8, 199, 208, 149,
		224, 247, 248, 83, 62, 63, 218, 7, 175, 97, 67, 149, 214, 103, 186, 179, 0,
		75, 42, 193, 199, 229, 89, 59, 238, 67, 228, 155, 206, 166, 232,
	])
);

export const MOCK_JUP_USDC_MARKET = Keypair.fromSecretKey(
	Uint8Array.from([
		136, 1, 116, 112, 92, 96, 18, 218, 159, 171, 129, 153, 142, 137, 45, 170,
		71, 12, 207, 146, 4, 42, 43, 220, 224, 11, 240, 249, 154, 169, 93, 114, 97,
		155, 77, 41, 195, 245, 43, 240, 189, 119, 112, 171, 181, 73, 151, 234, 158,
		154, 244, 252, 42, 218, 124, 117, 43, 55, 204, 36, 167, 160, 42, 233,
	])
);

export const PHOENIX_PROGRAM_ID = new PublicKey(
	'PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY'
);
export const PHOENIX_SEAT_MANAGER_PROGRAM_ID = new PublicKey(
	'PSMxQbAoDWDbvd9ezQJgARyq6R9L5kJAasaLDVcZwf1'
);

export const LOCALNET_MARKET_CONFIG: RawMarketConfig = {
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
			// {
			// 	market: MOCK_JUP_USDC_MARKET.publicKey.toString(),
			// 	baseMint: MOCK_JUP_MINT.publicKey.toString(),
			// 	quoteMint: MOCK_USDC_MINT.publicKey.toString(),
			// },
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
