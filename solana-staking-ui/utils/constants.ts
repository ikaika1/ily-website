import { STAKE_PROGRAM_ADDRESS } from "@solana-program/stake";
import { address, Blockhash } from "@solana/kit";

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const PRIORITY_FEE_BUFFER = 0.001;

export const PUBLICKEY_DEFAULT = address("11111111111111111111111111111111");
export const STAKE_PROGRAM = {
  ADDRESS: STAKE_PROGRAM_ADDRESS,
  CONFIG_ADDRESS: address("StakeConfig11111111111111111111111111111111"),
  STAKE_ACCOUNT_RENT: 0.0025,
  STAKE_ACCOUNT_SPACE: 200,
  DEFAULT_LOCKUP: {
    unixTimestamp: BigInt(0),
    epoch: BigInt(0),
    custodian: PUBLICKEY_DEFAULT
  },
  STAKE_ACCOUNT_FILTERS: {
    ownerOffset: 44, // Withdrawl authority
    voteOffset: 124, // Validator vote account
    sizeOf: 200
  }
} as const;
export const SYSVAR = {
  CLOCK_ADDRESS: address("SysvarC1ock11111111111111111111111111111111"),
  STAKE_HISTORY_ADDRESS: address("SysvarStakeHistory1111111111111111111111111"),
  RENT_ADDRESS: address("SysvarRent111111111111111111111111111111111")
} as const;

export const INVALID_BUT_SUFFICIENT_FOR_COMPILATION_BLOCKHASH = {
  blockhash: "11111111111111111111111111111111" as Blockhash,
  lastValidBlockHeight: BigInt(0)
} as const;

export const MAX_COMPUTE_UNIT_LIMIT = 1_400_000;
export const DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS = 1;

// Address Lookup Tables for transaction size optimization
export const COMMON_LOOKUP_TABLES = [
  // System Program and other common addresses
  address("11111111111111111111111111111111"), // System Program
  address("SysvarC1ock11111111111111111111111111111111"), // Clock sysvar
  address("SysvarRent111111111111111111111111111111111"), // Rent sysvar
  address("SysvarStakeHistory1111111111111111111111111"), // Stake history sysvar
  address("StakeConfig11111111111111111111111111111111"), // Stake config
  STAKE_PROGRAM_ADDRESS // Stake program
] as const;
