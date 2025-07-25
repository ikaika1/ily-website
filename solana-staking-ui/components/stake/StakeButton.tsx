import { Button, Flex, Dialog, Text } from "@radix-ui/themes";
import { LockClosedIcon } from "@radix-ui/react-icons";
import { useCallback, useRef, useState } from "react";
import { UiWalletAccount, useWallets } from "@wallet-standard/react";
import { useWalletAccountTransactionSendingSigner } from "@solana/react";
import {
  generateKeyPairSigner,
  getBase58Decoder,
  getTransactionDecoder,
  partiallySignTransaction,
  Base64EncodedWireTransaction
} from "@solana/kit";
import { getCurrentChain } from "@/utils/config";
import { LAMPORTS_PER_SOL } from "@/utils/constants";
import { ErrorDialog } from "../ErrorDialog";
import { StakeSuccessModal } from "./StakeSuccessModal";
import Image from "next/image";

// Helper function to detect Phantom wallet
function isPhantomWallet(wallets: readonly import("@wallet-standard/react").UiWallet[], account: UiWalletAccount): boolean {
  for (const wallet of wallets) {
    if (wallet.accounts.some(acc => acc.address === account.address)) {
      return wallet.name.toLowerCase().includes('phantom');
    }
  }
  return false;
}

// Helper function to get the provider for message signing
function getProvider() {
  if (typeof window !== 'undefined' && 'solana' in window) {
    const provider = (window as any).solana;
    if (provider.isPhantom) {
      return provider;
    }
  }
  throw new Error('Phantom wallet not found');
}

// Message signing function
async function signMessage(message: string): Promise<{ signature: Uint8Array; publicKey: string }> {
  try {
    const provider = getProvider();
    const encodedMessage = new TextEncoder().encode(message);
    
    // Use the request method as shown in your example
    const signedMessage = await provider.request({
      method: "signMessage",
      params: {
        message: encodedMessage,
        display: "hex",
      },
    });
    
    return {
      signature: signedMessage.signature,
      publicKey: signedMessage.publicKey
    };
  } catch (error) {
    console.error('Message signing failed:', error);
    throw error;
  }
}

// Phantom transaction signing function  
async function signTransactionWithPhantom(wireTransaction: string) {
  try {
    const provider = getProvider();
    
    // Convert the wire transaction to Phantom-compatible format
    const { VersionedTransaction } = await import('@solana/web3.js');
    const transactionBuffer = Buffer.from(wireTransaction, 'base64');
    const phantomTransaction = VersionedTransaction.deserialize(transactionBuffer);
    
    return await provider.signTransaction(phantomTransaction);
  } catch (error) {
    console.error('Phantom transaction signing failed:', error);
    throw error;
  }
}


interface StakeButtonProps {
  account: UiWalletAccount;
  stakeAmount: string;
  inSufficientBalance: boolean;
  onSuccess: () => void;
}

export function StakeButton({
  account,
  stakeAmount,
  inSufficientBalance,
  onSuccess
}: StakeButtonProps) {
  const currentChain = getCurrentChain();
  const wallets = useWallets();
  const transactionSendingSigner = useWalletAccountTransactionSendingSigner(
    account,
    currentChain
  );
  const [isSendingTransaction, setIsSendingTransaction] = useState(false);
  const [lastSignature, setLastSignature] = useState<string | undefined>();
  const [lastStakeAccount, setLastStakeAccount] = useState<
    string | undefined
  >();
  const { current: NO_ERROR } = useRef(Symbol());
  const [error, setError] = useState(NO_ERROR);

  const handleSubmit = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (!stakeAmount || !transactionSendingSigner) return;

      setError(NO_ERROR);
      setIsSendingTransaction(true);
      setLastSignature(undefined);
      setLastStakeAccount(undefined);
      try {
        const newAccount = await generateKeyPairSigner();
        setLastStakeAccount(newAccount.address);
        // Convert SOL to lamports
        const stakeLamports = Math.floor(
          parseFloat(stakeAmount) * LAMPORTS_PER_SOL
        );

        const isPhantom = isPhantomWallet(wallets, account);

        let signature: string;
        
        if (isPhantom) {
          // First, authenticate with message signing for Phantom
          try {
            const authMessage = `To avoid digital dognappers, sign below to authenticate with CryptoCorgis`;
            const signedAuth = await signMessage(authMessage);
            console.log('Authentication successful:', signedAuth.publicKey);
          } catch (authError) {
            console.error('Authentication failed:', authError);
            throw new Error('Authentication required for staking');
          }

          // For Phantom: Create clean transaction without pre-signatures
          const generateResponse = await fetch("/api/stake/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              newAccountAddress: newAccount.address,
              stakeLamports,
              stakerAddress: account.address,
              isPhantom: true
            })
          });
          
          if (!generateResponse.ok) {
            throw new Error("Failed to generate transaction");
          }
          
          const { wireTransaction } = (await generateResponse.json()) as {
            wireTransaction: Base64EncodedWireTransaction;
          };

          // First, let Phantom sign the wire transaction directly
          const phantomSignedTx = await signTransactionWithPhantom(wireTransaction);
          
          // Convert the signed transaction back to wire format
          const signedWireTransaction = Buffer.from(phantomSignedTx.serialize()).toString('base64');

          // Decode the signed transaction
          const transactionBytes = Buffer.from(signedWireTransaction, "base64");
          const transactionDecoder = getTransactionDecoder();
          const signedTransaction = transactionDecoder.decode(transactionBytes);

          // Then, add the new account signature
          const finalTransaction = await partiallySignTransaction(
            [newAccount.keyPair],
            signedTransaction,
            
          );

          // Send the fully signed transaction
          const [txSignature] = await transactionSendingSigner.signAndSendTransactions([finalTransaction]);
          signature = getBase58Decoder().decode(txSignature);

        } else {
          // Standard flow for non-Phantom wallets
          const generateResponse = await fetch("/api/stake/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              newAccountAddress: newAccount.address,
              stakeLamports,
              stakerAddress: account.address
            })
          });
          
          if (!generateResponse.ok) {
            throw new Error("Failed to generate transaction");
          }
          
          const { wireTransaction } = (await generateResponse.json()) as {
            wireTransaction: Base64EncodedWireTransaction;
          };

          const transactionBytes = Buffer.from(wireTransaction, "base64");
          const transactionDecoder = getTransactionDecoder();
          const decodedTransaction = transactionDecoder.decode(transactionBytes);
          const finalTransaction = await partiallySignTransaction(
            [newAccount.keyPair],
             decodedTransaction,
          );
          const rawSignatures = await transactionSendingSigner.signAndSendTransactions([finalTransaction]);
          const rawSignature = rawSignatures[0];
          signature = getBase58Decoder().decode(rawSignature);
        }

        // Call the confirmation API endpoint
        const confirmResponse = await fetch("/api/transaction/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            txid: signature,
            targetCommitment: "processed",
            timeout: 30000,
            interval: 1000
          })
        });

        if (!confirmResponse.ok) {
          throw new Error("Failed to confirm transaction");
        }

        const confirmResult = await confirmResponse.json();
        if (confirmResult.error) {
          throw new Error(confirmResult.error);
        }

        setLastSignature(signature);
      } catch (error) {
        console.error("Staking error:", error);
        setError(error as symbol);
        setLastStakeAccount(undefined);
      } finally {
        setIsSendingTransaction(false);
      }
    },
    [account, stakeAmount, transactionSendingSigner, NO_ERROR, wallets]
  );

  const handleCloseModal = useCallback(() => {
    setLastSignature(undefined);
    setLastStakeAccount(undefined);
    onSuccess();
  }, [onSuccess]);

  const stakeAmountNumber = parseFloat(stakeAmount) || 0;
  const isZeroStake = stakeAmountNumber <= 0;
  const disableStakeButton = isSendingTransaction || inSufficientBalance || isZeroStake;
  const buttonLabel = isSendingTransaction
    ? "Confirming Transaction"
    : inSufficientBalance
      ? "Insufficient Balance"
      : isZeroStake
        ? "Enter stake amount"
        : "Stake";
  const buttonBackground = disableStakeButton ? "grey" : "#009fd1";

  return (
    <>
      <Button
        type="button"
        size="3"
        style={{
          width: "100%",
          background: buttonBackground,
          color: "white",
          cursor: isSendingTransaction ? "default" : "pointer"
        }}
        onClick={handleSubmit}
        disabled={disableStakeButton}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          <LockClosedIcon width={20} height={20} color="white" />
          <span>{buttonLabel}</span>
        </div>
      </Button>

      {/* Loading Dialog */}
      <Dialog.Root open={isSendingTransaction}>
        {/* Dialog Backdrop */}
        {isSendingTransaction && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(4px)",
              zIndex: 5
            }}
          />
        )}

        {/* Dialog Content */}
        <Dialog.Content
          style={{
            background: "var(--gray-1)",
            border: "1px solid var(--gray-5)",
            maxWidth: "480px",
            padding: "24px",
            position: "relative",
            zIndex: 10
          }}
        >
          <Flex direction="column" gap="5">
            {/* Loading Header */}
            <Flex direction="column" gap="2" style={{ textAlign: "center" }}>
              <div style={{ margin: "0 auto", position: "relative" }}>
                <div
                  style={{
                    borderRadius: "50%",
                    padding: "8px",
                    background: "var(--gray-2)",
                    animation: "pulse 2s infinite",
                    width: "64px",
                    height: "64px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Image
                    src="/milady.svg"
                    alt="ILY♡Validator Logo"
                    width={48}
                    height={48}
                    style={{
                      animation: "spin 3s linear infinite"
                    }}
                  />
                </div>
              </div>
              <Dialog.Title
                style={{
                  color: "#009fd1",
                  fontSize: "24px",
                  fontWeight: "bold",
                  marginTop: "12px"
                }}
              >
                Staking your SOL...
              </Dialog.Title>
              <Text size="2" color="gray" style={{ marginTop: "-8px" }}>
                Please wait while we process your stake transaction...
              </Text>
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>

      <StakeSuccessModal
        isOpen={!!lastSignature}
        onClose={handleCloseModal}
        signature={lastSignature}
        stakeAccount={lastStakeAccount}
      />

      {error !== NO_ERROR && (
        <ErrorDialog
          error={error}
          onClose={() => setError(NO_ERROR)}
          title="Staking failed"
        />
      )}

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(0, 159, 209, 0.4);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(0, 159, 209, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(0, 159, 209, 0);
          }
        }
      `}</style>
    </>
  );
}