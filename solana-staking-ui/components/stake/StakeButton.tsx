import { Button, Flex, Dialog, Text } from "@radix-ui/themes";
import { LockClosedIcon } from "@radix-ui/react-icons";
import { useCallback, useRef, useState } from "react";
import { UiWalletAccount, useWallets } from "@wallet-standard/react";
import { useWalletAccountTransactionSendingSigner } from "@solana/react";
import { VersionedTransaction, Connection, Keypair } from "@solana/web3.js";
import * as nacl from "tweetnacl"; // Using tweetnacl for manual signiしかし、これではまだユーザーの署名が欠落している問題が解決されていません。正しいアプローチは、バックエンド
import { getCurrentChain } from "@/utils/config";
import { LAMPORTS_PER_SOL } from "@/utils/constants";
import { ErrorDialog } from "../ErrorDialog";
import { StakeSuccessModal } from "./StakeSuccessModal";
import Image from "next/image";
// Removed unused imports
// Helper function to detect Phantom wallet
function isPhantomWallet(
  wallets: readonly import("@wallet-standard/react").UiWallet[],
  account: UiWalletAccount
): boolean {
  for (const wallet of wallets) {
    if (
      wallet.accounts.some(
        (acc: UiWalletAccount) => acc.address === account.address
      )
    ) {
      return wallet.name.toLowerCase().includes("phantom");
    }
  }
  return false;
}

// Helper function to detect Solflare wallet
function isSolflareWallet(
  wallets: readonly import("@wallet-standard/react").UiWallet[],
  account: UiWalletAccount
): boolean {
  for (const wallet of wallets) {
    if (
      wallet.accounts.some(
        (acc: UiWalletAccount) => acc.address === account.address
      )
    ) {
      return wallet.name.toLowerCase().includes("solflare");
    }
  }
  return false;
}

// Helper function to detect Backpack wallet
function isBackpackWallet(
  wallets: readonly import("@wallet-standard/react").UiWallet[],
  account: UiWalletAccount
): boolean {
  for (const wallet of wallets) {
    if (
      wallet.accounts.some(
        (acc: UiWalletAccount) => acc.address === account.address
      )
    ) {
      return wallet.name.toLowerCase().includes("backpack");
    }
  }
  return false;
}

// Helper function to get wallet name for debugging
function getWalletName(
  wallets: readonly import("@wallet-standard/react").UiWallet[],
  account: UiWalletAccount
): string {
  for (const wallet of wallets) {
    if (
      wallet.accounts.some(
        (acc: UiWalletAccount) => acc.address === account.address
      )
    ) {
      return wallet.name;
    }
  }
  return "Unknown";
}

// Type definition for Phantom provider
interface PhantomProvider {
  isPhantom: boolean;
  request: (params: {
    method: string;
    params: Record<string, unknown>;
  }) => Promise<{ signature: string }>;
  signTransaction: (
    transaction: VersionedTransaction
  ) => Promise<VersionedTransaction>;
  signAndSendTransaction: (
    transaction: unknown
  ) => Promise<{ signature: string }>;
}

// Singleton pattern to cache Phantom provider
let cachedProvider: PhantomProvider | null = null;

// Helper function to get the provider for message signing
function getProvider(): PhantomProvider {
  // Return cached provider if available
  if (cachedProvider) {
    return cachedProvider;
  }

  if (typeof window !== "undefined" && "solana" in window) {
    const provider = (window as { solana?: PhantomProvider }).solana;
    if (provider?.isPhantom) {
      cachedProvider = provider; // Cache the provider
      return provider;
    }
  }
  throw new Error("Phantom wallet not found");
}

// Helper function to get Solflare provider
function getSolflareProvider(): { signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction> } {
  if (typeof window !== "undefined" && "solflare" in window) {
    const provider = (window as any).solflare;
    if (provider && typeof provider.signTransaction === 'function') {
      return provider;
    }
  }
  
  // Try to get Solflare through the standard solana provider
  if (typeof window !== "undefined" && "solana" in window) {
    const provider = (window as any).solana;
    if (provider && !provider.isPhantom && typeof provider.signTransaction === 'function') {
      return provider;
    }
  }
  
  throw new Error("Solflare wallet not found or not properly connected");
}

// Helper function to get Backpack provider
function getBackpackProvider(): { signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction> } {
  if (typeof window !== "undefined" && "backpack" in window) {
    const provider = (window as any).backpack;
    if (provider && typeof provider.signTransaction === 'function') {
      return provider;
    }
  }
  
  // Try to get Backpack through the standard solana provider
  if (typeof window !== "undefined" && "solana" in window) {
    const provider = (window as any).solana;
    if (provider && !provider.isPhantom && typeof provider.signTransaction === 'function') {
      // Additional check for Backpack-specific properties
      if (provider.isBackpack || (window as any).backpack) {
        return provider;
      }
    }
  }
  
  throw new Error("Backpack wallet not found or not properly connected");
}

// Generic provider getter for non-Phantom wallets
function getGenericWalletProvider(): { signTransaction: (transaction: VersionedTransaction) => Promise<VersionedTransaction> } {
  if (typeof window !== "undefined" && "solana" in window) {
    const provider = (window as any).solana;
    if (provider && !provider.isPhantom && typeof provider.signTransaction === 'function') {
      return provider;
    }
  }
  
  throw new Error("No compatible wallet provider found");
}

// Phantom Lighthouse compliant signing function
async function handlePhantomLighthouseSigning(
  wireTransaction: string,
  newAccount: { address: string; keyPair: Keypair }
): Promise<string> {
  try {
    const provider = getProvider();
    const network = process.env.NEXT_PUBLIC_MAINNET_RPC_ENDPOINT!;
    const connection = new Connection(network);

    // 1. Deserialize the unsigned transaction from backend
    const transaction = VersionedTransaction.deserialize(
      new Uint8Array(Buffer.from(wireTransaction, "base64"))
    );

    // 1.5. Get fresh blockhash right before signing to avoid expiration
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.message.recentBlockhash = blockhash;

    // 2. ★CRITICAL: Phantom signs first (Lighthouse requirement)
    let signedByPhantomTx;
    try {
      signedByPhantomTx = await provider.signTransaction(transaction);
    } catch (error: any) {
      if (error.message?.includes('rejected') || error.message?.includes('User rejected')) {
        throw new Error('Transaction cancelled by user');
      }
      throw error;
    }

    // 3. Validate that newAccount is expected as a signer
    const accountKeysArray = signedByPhantomTx.message.staticAccountKeys.map(
      (key) => key.toString()
    );
    const newAccountIndex = accountKeysArray.indexOf(newAccount.address);

    if (
      newAccountIndex < 0 ||
      newAccountIndex >= signedByPhantomTx.message.header.numRequiredSignatures
    ) {
      throw new Error(
        `newAccount ${newAccount.address} is not a required signer.`
      );
    }

    // 4. ★MANUAL SIGNING: Add newAccount signature manually using tweetnacl
    const messageBytes = signedByPhantomTx.message.serialize();

    // Use tweetnacl to sign the message bytes with the keypair's secret key
    const newAccountSignature = nacl.sign.detached(
      new Uint8Array(messageBytes),
      newAccount.keyPair.secretKey // CORRECT: Use the secretKey property
    );

    // CORRECT: Directly modify the signatures array of the transaction returned by Phantom.
    signedByPhantomTx.signatures[newAccountIndex] = newAccountSignature;

    // 5. Serialize the fully signed transaction
    const rawTransaction = signedByPhantomTx.serialize();

    // 6. dApp sends the completed transaction to network
    const txSignature = await connection.sendRawTransaction(rawTransaction, {
      skipPreflight: true
    });

    // 7. Wait for transaction confirmation using the same blockhash
    await connection.confirmTransaction(
      {
        signature: txSignature,
        blockhash,
        lastValidBlockHeight
      },
      "processed"
    );

    return txSignature;
  } catch (error) {
    console.error("Phantom Lighthouse signing process failed:", error);
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
        const newAccountKeypair = Keypair.generate();
        const newAccount = {
          address: newAccountKeypair.publicKey.toString(),
          keyPair: newAccountKeypair
        };
        setLastStakeAccount(newAccount.address);
        // Convert SOL to lamports
        const stakeLamports = Math.floor(
          parseFloat(stakeAmount) * LAMPORTS_PER_SOL
        );

        const isPhantom = isPhantomWallet(wallets, account);
        const isSolflare = isSolflareWallet(wallets, account);
        const isBackpack = isBackpackWallet(wallets, account);
        const walletName = getWalletName(wallets, account);
        
        console.log('Wallet detection:', { walletName, isPhantom, isSolflare, isBackpack });

        const payload = {
          newAccountAddress: newAccount.address,
          stakeLamports,
          stakerAddress: account.address
        };

        const generateResponse = await fetch("/api/stake/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!generateResponse.ok) {
          const errorText = await generateResponse.text();
          throw new Error(`Failed to generate transaction: ${errorText}`);
        }

        const { wireTransaction } = (await generateResponse.json()) as {
          wireTransaction: string;
        };

        let signature: string;

        if (isPhantom) {
          // Use Lighthouse compliant signing: Phantom first, then dApp keypair manually
          signature = await handlePhantomLighthouseSigning(
            wireTransaction,
            newAccount
          );
        } else {
          console.log(`Using wallet adapter pattern for ${walletName} wallet`);
          
          // Create connection
          const network = process.env.NEXT_PUBLIC_MAINNET_RPC_ENDPOINT!;
          const connection = new Connection(network);

          // Deserialize the base64 transaction
          const transactionBytes = Buffer.from(wireTransaction, "base64");
          const transaction = VersionedTransaction.deserialize(transactionBytes);

          // Get fresh blockhash right before signing to avoid expiration
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          transaction.message.recentBlockhash = blockhash;

          // Sign with the new account keypair first (partial signing)
          console.log('Partially signing transaction with new account keypair for', walletName);
          transaction.sign([newAccount.keyPair]);

          // Now we need the user's wallet to sign the transaction
          // Since transactionSendingSigner is complex, let's use a direct approach
          console.log('Requesting user signature from', walletName, 'wallet');
          
          // Use the wallet adapter to get user signature
          // This requires the wallet to implement the signTransaction method
          if (!transactionSendingSigner) {
            throw new Error(`Wallet ${walletName} is not properly connected`);
          }

          // The key insight: we need to use the wallet's signTransaction capability
          // Handle different wallet types
          let userSignedTransaction;
          
          if (isSolflare) {
            // Special handling for Solflare wallet
            console.log('Using Solflare-specific provider');
            const solflareProvider = getSolflareProvider();
            userSignedTransaction = await solflareProvider.signTransaction(transaction);
          } else if (isBackpack) {
            // Special handling for Backpack wallet
            console.log('Using Backpack-specific provider');
            const backpackProvider = getBackpackProvider();
            userSignedTransaction = await backpackProvider.signTransaction(transaction);
          } else {
            // Generic approach for other wallets
            console.log('Using generic wallet provider for', walletName);
            try {
              const genericProvider = getGenericWalletProvider();
              userSignedTransaction = await genericProvider.signTransaction(transaction);
            } catch (error) {
              console.error('Generic wallet provider failed:', error);
              throw new Error(`Wallet ${walletName} signing not yet implemented. Please use Phantom, Solflare, or Backpack wallet.`);
            }
          }

          // Send the fully signed transaction
          const rawTransaction = userSignedTransaction.serialize();
          signature = await connection.sendRawTransaction(rawTransaction, {
            skipPreflight: true
          });

          // Wait for confirmation using the same blockhash
          await connection.confirmTransaction(
            {
              signature,
              blockhash,
              lastValidBlockHeight
            },
            "processed"
          );

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
        }

        setLastSignature(signature);
      } catch (error: any) {
        console.error("Staking error:", error);
        
        // Handle specific error cases with user-friendly messages
        if (error.message?.includes('Transaction cancelled by user') || 
            error.message?.includes('User rejected') ||
            error.message?.includes('rejected')) {
          // Don't show error dialog for user cancellation - just reset state
          console.log('User cancelled transaction');
        } else {
          setError(error as symbol);
        }
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
  const disableStakeButton =
    isSendingTransaction || inSufficientBalance || isZeroStake;
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
                      animation: "spin 3s linear infinite",
                      width: "48px",
                      height: "48px"
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
              <Dialog.Description>
                <Text size="2" color="gray" style={{ marginTop: "-8px" }}>
                  Please wait while we process your stake transaction...
                </Text>
              </Dialog.Description>
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

      <style>{`
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
