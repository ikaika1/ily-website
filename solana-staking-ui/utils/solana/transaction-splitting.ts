import {
  createTransactionMessage,
  appendTransactionMessageInstruction,
  prependTransactionMessageInstruction,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  pipe,
  type Address,
  type TransactionSigner,
  type Blockhash,
  type IInstruction
} from "@solana/kit";
import { getSetComputeUnitLimitInstruction, getSetComputeUnitPriceInstruction } from "@solana-program/compute-budget";
import { MAX_COMPUTE_UNIT_LIMIT, DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS } from "@/utils/constants";

interface TransactionSplitParams {
  instructions: IInstruction<string, any>[];
  feePayer: Address;
  feePayerSigner: TransactionSigner;
  blockhashObject: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>;
  maxComputeUnitsPerTx?: number;
  priorityFeeMicroLamports?: number;
}

/**
 * Split transaction instructions into multiple transactions if CU limit is exceeded
 */
export function splitTransactionIfNeeded({
  instructions,
  feePayer,
  feePayerSigner,
  blockhashObject,
  maxComputeUnitsPerTx = MAX_COMPUTE_UNIT_LIMIT,
  priorityFeeMicroLamports = DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS
}: TransactionSplitParams) {
  // Estimate CU usage per instruction (rough estimate)
  const estimatedCUPerInstruction = 50000; // Conservative estimate
  const totalEstimatedCU = instructions.length * estimatedCUPerInstruction;
  
  // If transaction fits within CU limit, return single transaction
  if (totalEstimatedCU <= maxComputeUnitsPerTx) {
    return [{
      message: createTransactionMessageWithInstructions({
        instructions,
        feePayer,
        feePayerSigner,
        blockhashObject,
        computeUnitLimit: totalEstimatedCU,
        priorityFeeMicroLamports
      }),
      estimatedCU: totalEstimatedCU
    }];
  }
  
  // Split instructions into multiple transactions
  const maxInstructionsPerTx = Math.floor(maxComputeUnitsPerTx / estimatedCUPerInstruction);
  const transactions = [];
  
  for (let i = 0; i < instructions.length; i += maxInstructionsPerTx) {
    const txInstructions = instructions.slice(i, i + maxInstructionsPerTx);
    const estimatedCU = txInstructions.length * estimatedCUPerInstruction;
    
    transactions.push({
      message: createTransactionMessageWithInstructions({
        instructions: txInstructions,
        feePayer,
        feePayerSigner,
        blockhashObject,
        computeUnitLimit: estimatedCU,
        priorityFeeMicroLamports
      }),
      estimatedCU
    });
  }
  
  return transactions;
}

function createTransactionMessageWithInstructions({
  instructions,
  feePayer,
  feePayerSigner,
  blockhashObject,
  computeUnitLimit,
  priorityFeeMicroLamports
}: {
  instructions: IInstruction<string, any>[];
  feePayer: Address;
  feePayerSigner: TransactionSigner;
  blockhashObject: Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: bigint;
  }>;
  computeUnitLimit: number;
  priorityFeeMicroLamports: number;
}) {
  return instructions.reduce((msg, instruction) => {
    return appendTransactionMessageInstruction(instruction, msg);
  }, pipe(
    createTransactionMessage({ version: 0 }),
    (msg) => setTransactionMessageFeePayer(feePayer, msg),
    (msg) => setTransactionMessageLifetimeUsingBlockhash(blockhashObject, msg),
    (msg) => prependTransactionMessageInstruction(
      getSetComputeUnitLimitInstruction({ units: computeUnitLimit }),
      msg
    ),
    (msg) => prependTransactionMessageInstruction(
      getSetComputeUnitPriceInstruction({ microLamports: priorityFeeMicroLamports }),
      msg
    )
  ));
}

/**
 * Check if a transaction needs to be split based on CU usage
 */
export function shouldSplitTransaction(
  estimatedCU: number,
  maxCUPerTransaction: number = MAX_COMPUTE_UNIT_LIMIT
): boolean {
  // Add buffer for Lighthouse instructions
  const LIGHTHOUSE_CU_BUFFER = 100000;
  return estimatedCU + LIGHTHOUSE_CU_BUFFER > maxCUPerTransaction;
}