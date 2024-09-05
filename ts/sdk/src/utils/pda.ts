import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import {PHOENIX_VAULTS_PROGRAM_ID} from "../types";

export function getVaultAddressSync(
  encodedName: number[]
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('vault')),
      Buffer.from(encodedName),
    ],
    PHOENIX_VAULTS_PROGRAM_ID
  )[0];
}

export function getInvestorAddressSync(
  vault: PublicKey,
  authority: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('investor')),
      vault.toBuffer(),
      authority.toBuffer(),
    ],
    PHOENIX_VAULTS_PROGRAM_ID
  )[0];
}

export function getTokenVaultAddressSync(
  vault: PublicKey
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('vault_token_account')),
      vault.toBuffer(),
    ],
    PHOENIX_VAULTS_PROGRAM_ID
  )[0];
}

export function getMarketRegistryAddressSync(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode('market_registry')),
    ],
    PHOENIX_VAULTS_PROGRAM_ID
  )[0];
}