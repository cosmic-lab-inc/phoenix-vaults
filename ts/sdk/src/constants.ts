import { BN } from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';

export const QUOTE_PRECISION_EXP = new BN(6);
export const PRICE_PRECISION_EXP = new BN(6);

export const QUOTE_PRECISION = new BN(10).pow(QUOTE_PRECISION_EXP);
export const PRICE_PRECISION = new BN(10).pow(PRICE_PRECISION_EXP);

export const MOCK_MARKET_AUTHORITY = Keypair.fromSecretKey(
	Uint8Array.from([
		51, 85, 204, 221, 166, 99, 229, 39, 196, 242, 180, 231, 122, 9, 62, 131,
		140, 27, 117, 23, 93, 155, 55, 105, 52, 10, 90, 241, 145, 11, 140, 46, 53,
		175, 223, 204, 97, 194, 133, 147, 230, 208, 127, 22, 253, 59, 155, 99, 120,
		103, 216, 164, 114, 107, 104, 142, 128, 14, 3, 209, 80, 200, 208, 80,
	])
);

export const MOCK_USDC_MINT = Keypair.fromSecretKey(
	Uint8Array.from([
		7, 195, 209, 165, 147, 124, 219, 244, 18, 184, 6, 123, 255, 168, 93, 207,
		142, 219, 230, 140, 66, 109, 233, 111, 220, 234, 137, 35, 234, 195, 48, 31,
		119, 40, 86, 47, 63, 3, 25, 13, 2, 30, 182, 198, 119, 230, 94, 90, 90, 155,
		32, 183, 120, 247, 19, 243, 83, 246, 212, 233, 178, 151, 121, 161,
	])
);

export const MOCK_SOL_MINT = Keypair.fromSecretKey(
	Uint8Array.from([
		5, 115, 129, 253, 239, 188, 34, 72, 142, 147, 21, 152, 94, 100, 191, 206,
		26, 129, 167, 50, 201, 216, 101, 81, 145, 34, 176, 222, 158, 149, 230, 9,
		171, 215, 53, 230, 38, 137, 41, 143, 238, 69, 176, 245, 195, 239, 161, 157,
		215, 72, 0, 40, 202, 156, 21, 36, 111, 246, 221, 154, 168, 106, 235, 122,
	])
);

export const MOCK_JUP_MINT = Keypair.fromSecretKey(
	Uint8Array.from([
		239, 37, 196, 242, 130, 217, 89, 30, 157, 246, 22, 44, 213, 30, 154, 9, 107,
		91, 87, 56, 32, 44, 132, 214, 205, 160, 235, 21, 193, 82, 156, 27, 0, 52,
		31, 170, 133, 18, 164, 125, 228, 81, 137, 2, 18, 235, 65, 106, 203, 192, 88,
		222, 174, 198, 7, 131, 115, 181, 13, 17, 236, 173, 207, 77,
	])
);
