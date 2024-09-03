import { BN } from '@coral-xyz/anchor';

export const QUOTE_PRECISION_EXP = new BN(6);
export const PRICE_PRECISION_EXP = new BN(6);

export const QUOTE_PRECISION = new BN(10).pow(QUOTE_PRECISION_EXP);
export const PRICE_PRECISION = new BN(10).pow(PRICE_PRECISION_EXP);