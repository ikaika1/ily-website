import { NextResponse } from "next/server";
import {
  address,
  appendTransactionMessageInstruction,
  assertIsAddress,
  createNoopSigner,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  compileTransaction,
  assertIsTransactionMessageWithBlockhashLifetime,
  getBase64EncodedWireTransaction,
  prependTransactionMessageInstruction,
  getComputeUnitEstimateForTransactionMessageFactory,
  compressTransactionMessageUsingAddressLookupTables,
  type Address,
  type TransactionSigner,
  type Blockhash
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  getInitializeInstruction,
  getDelegateStakeInstruction
} from "@/utils/solana/stake/stake-instructions";
import { createRpcConnection } from "@/utils/solana/rpc";
import {
  DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS,
  INVALID_BUT_SUFFICIENT_FOR_COMPILATION_BLOCKHASH,
  MAX_COMPUTE_UNIT_LIMIT,
  STAKE_PROGRAM,
  SYSVAR
} from "@/utils/constants";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction
} from "@solana-program/compute-budget";
import { getValidatorAddress } from "@/utils/config";
import { getStakeLookupTables, shouldOptimizeTransactionSize } from "@/utils/solana/lookup-tables";
import { shouldSplitTransaction } from "@/utils/solana/transaction-splitting";

interface StakeMessageParams {
  authority: Address;
  authorityNoopSigner: TransactionSigner;
  newAccount: Address;
  newAccountNoopSigner: TransactionSigner;
  stakeLamports: number;
  blockhashObject: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>;
  computeUnitLimit: number;
  priorityFeeMicroLamports?: number;
}

function getStakeMessage({
  authority,
  authorityNoopSigner,
  newAccount,
  newAccountNoopSigner,
  stakeLamports,
  blockhashObject,
  computeUnitLimit,
  priorityFeeMicroLamports = DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS
}: StakeMessageParams) {
  return pipe(
    createTransactionMessage({ version: 0 }),
    (msg) => setTransactionMessageFeePayer(authority, msg),
    (msg) => setTransactionMessageLifetimeUsingBlockhash(blockhashObject, msg),
    (msg) =>
      prependTransactionMessageInstruction(
        getSetComputeUnitLimitInstruction({ units: computeUnitLimit }),
        msg
      ),
    (msg) =>
      prependTransactionMessageInstruction(
        getSetComputeUnitPriceInstruction({
          microLamports: priorityFeeMicroLamports
        }),
        msg
      ),
    (msg) =>
      appendTransactionMessageInstruction(
        getCreateAccountInstruction({
          payer: authorityNoopSigner,
          newAccount: newAccountNoopSigner,
          lamports: BigInt(stakeLamports),
          space: STAKE_PROGRAM.STAKE_ACCOUNT_SPACE,
          programAddress: STAKE_PROGRAM.ADDRESS
        }),
        msg
      ),
    (msg) =>
      appendTransactionMessageInstruction(
        getInitializeInstruction(
          {
            stake: newAccount,
            rentSysvar: SYSVAR.RENT_ADDRESS,
            authorized: {
              staker: authority,
              withdrawer: authority
            },
            lockup: STAKE_PROGRAM.DEFAULT_LOCKUP
          },
          { programAddress: STAKE_PROGRAM.ADDRESS }
        ),
        msg
      ),
    (msg) =>
      appendTransactionMessageInstruction(
        getDelegateStakeInstruction(
          {
            stake: newAccount,
            vote: getValidatorAddress(),
            clockSysvar: SYSVAR.CLOCK_ADDRESS,
            stakeHistory: SYSVAR.STAKE_HISTORY_ADDRESS,
            unused: STAKE_PROGRAM.CONFIG_ADDRESS,
            stakeAuthority: authorityNoopSigner
          },
          { programAddress: STAKE_PROGRAM.ADDRESS }
        ),
        msg
      )
  );
}

export async function POST(request: Request) {
  try {
    const { stakeLamports, stakerAddress, newAccountAddress } =
      await request.json();

    if (!stakeLamports) {
      return NextResponse.json(
        { error: "Missing required parameter: stakeLamports" },
        { status: 400 }
      );
    }
    if (!stakerAddress) {
      return NextResponse.json(
        { error: "Missing required parameter: stakerAddress" },
        { status: 400 }
      );
    }

    const authority = address(stakerAddress);
    const newAccount = address(newAccountAddress);
    assertIsAddress(authority);
    assertIsAddress(newAccount);

    const rpc = createRpcConnection();

    const authorityNoopSigner = createNoopSigner(authority);
    const newAccountNoopSigner = createNoopSigner(newAccount);

    const sampleMessage = getStakeMessage({
      authority,
      authorityNoopSigner,
      newAccount,
      newAccountNoopSigner,
      stakeLamports,
      blockhashObject: INVALID_BUT_SUFFICIENT_FOR_COMPILATION_BLOCKHASH,
      computeUnitLimit: MAX_COMPUTE_UNIT_LIMIT
    });

    assertIsTransactionMessageWithBlockhashLifetime(sampleMessage);
    const computeUnitEstimate =
      await getComputeUnitEstimateForTransactionMessageFactory({ rpc })(
        sampleMessage
      );
    console.log("computeUnitEstimate", computeUnitEstimate);

    const { value: latestBlockhash } = await rpc
      .getLatestBlockhash({ commitment: "confirmed" })
      .send();
    const message = getStakeMessage({
      authority,
      authorityNoopSigner,
      newAccount,
      newAccountNoopSigner,
      stakeLamports,
      blockhashObject: latestBlockhash,
      computeUnitLimit: computeUnitEstimate
    });

    assertIsTransactionMessageWithBlockhashLifetime(message);

    // Check if we need to optimize transaction size using lookup tables
    const compiledTransaction = compileTransaction(message);
    const initialWireTransaction = getBase64EncodedWireTransaction(compiledTransaction);
    
    // Calculate transaction size (base64 encoded size approximation)
    const transactionSize = initialWireTransaction.length * 0.75; // Rough conversion from base64 to bytes
    
    let finalMessage = message;
    if (shouldOptimizeTransactionSize(transactionSize)) {
      try {
        const lookupTables = await getStakeLookupTables(rpc, getValidatorAddress());
        if (Object.keys(lookupTables).length > 0) {
          finalMessage = compressTransactionMessageUsingAddressLookupTables(
            message,
            lookupTables
          );
          console.log("Transaction optimized with lookup tables");
        }
      } catch (error) {
        console.warn("Failed to optimize transaction with lookup tables:", error);
        // Continue with original message if lookup table optimization fails
      }
    }

    const finalCompiledTransaction = compileTransaction(finalMessage);
    const wireTransaction = getBase64EncodedWireTransaction(finalCompiledTransaction);

    // Check if transaction splitting might be needed for future optimization
    const needsSplitting = shouldSplitTransaction(computeUnitEstimate);

    return NextResponse.json({
      wireTransaction,
      computeUnitEstimate,
      needsSplitting,
      transactionSize: Math.round(transactionSize)
    });
  } catch (error) {
    console.error("Error generating stake transaction:", error);
    return NextResponse.json(
      { error: "Failed to generate stake transaction" },
      { status: 500 }
    );
  }
}
