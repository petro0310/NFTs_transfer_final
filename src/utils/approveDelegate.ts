import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createApproveInstruction } from '@solana/spl-token';

const BATCH_SIZE = 20; // Process 20 NFTs per transaction
const CHUNK_SIZE = 1000; // User confirms once per 500 NFTs
const MAX_RETRIES = 3; // Number of auto-retry attempts for blockhash errors
const PARALLEL_BATCH_SIZE = 5; // Number of transactions to send in parallel
const RATE_LIMIT_DELAY = 200; // Delay between batches in ms

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function approveDelegateForNFTs(
  mintAddresses: string[],
  delegateAddress: string,
  wallet: { publicKey: PublicKey; sendTransaction: any; signAllTransactions: any },
  connection: Connection
): Promise<string[]> {
  const userAddress = wallet.publicKey;
  const delegate = new PublicKey(delegateAddress);
  const signatures: string[] = [];
  const failedMints: string[] = [];

  // Split into chunks of CHUNK_SIZE NFTs
  for (let chunkStart = 0; chunkStart < mintAddresses.length; chunkStart += CHUNK_SIZE) {
    const chunk = mintAddresses.slice(chunkStart, chunkStart + CHUNK_SIZE);
    let transactions: Transaction[] = [];
    let txMintBatches: string[][] = [];

    // Prepare all transactions for this chunk
    for (let i = 0; i < chunk.length; i += BATCH_SIZE) {
      const batch = chunk.slice(i, i + BATCH_SIZE);
      const tx = new Transaction();

      // Add approve instructions for each NFT in the batch
      for (const mintAddress of batch) {
        const mint = new PublicKey(mintAddress);
        const ata = await getAssociatedTokenAddress(mint, userAddress);
        const approveIx = createApproveInstruction(
          ata,
          delegate,
          userAddress,
          1 // amount
        );
        tx.add(approveIx);
      }

      // Fetch a fresh blockhash for each transaction
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = userAddress;
      transactions.push(tx);
      txMintBatches.push(batch);
    }

    let attempts = 0;
    let txsToRetry = transactions;
    let mintBatchesToRetry = txMintBatches;

    while (txsToRetry.length > 0 && attempts <= MAX_RETRIES) {
      console.log(`\n[Chunk ${chunkStart / CHUNK_SIZE + 1}] Retry attempt ${attempts + 1} for ${txsToRetry.length} transactions.`);
      try {
        // For retries, create new transactions with fresh blockhashes
        if (attempts > 0) {
          console.log(`[Chunk ${chunkStart / CHUNK_SIZE + 1}] Rebuilding ${mintBatchesToRetry.length} failed transactions with fresh blockhashes...`);
          const newTransactions: Transaction[] = [];
          for (let i = 0; i < mintBatchesToRetry.length; i++) {
            const batch = mintBatchesToRetry[i];
            const tx = new Transaction();
            for (const mintAddress of batch) {
              const mint = new PublicKey(mintAddress);
              const ata = await getAssociatedTokenAddress(mint, userAddress);
              const approveIx = createApproveInstruction(
                ata,
                delegate,
                userAddress,
                1
              );
              tx.add(approveIx);
            }
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = userAddress;
            newTransactions.push(tx);
          }
          txsToRetry = newTransactions;
          // Add delay before retrying
          await delay(RATE_LIMIT_DELAY);
        }

        // Sign all transactions for this chunk at once - this is the only user confirmation needed
        console.log(`[Chunk ${chunkStart / CHUNK_SIZE + 1}] Requesting signature for ${txsToRetry.length} transactions...`);
        const allSignedTransactions = await wallet.signAllTransactions(txsToRetry);
        
        // Send all transactions first and collect signatures
        const sendResults: { signature: string | null, error: any, batch: string[] }[] = await Promise.all(
          allSignedTransactions.map(async (signedTx: Transaction, idx: number) => {
            try {
              const signature = await connection.sendRawTransaction(signedTx.serialize(), {
                skipPreflight: true,
                maxRetries: 0
              });
              return { signature, error: null, batch: mintBatchesToRetry[idx] };
            } catch (error) {
              return { signature: null, error, batch: mintBatchesToRetry[idx] };
            }
          })
        );

        // Add delay to avoid rate limiting
        await delay(RATE_LIMIT_DELAY);

        // Confirm all successful transactions in parallel (using 'processed' for speed)
        const failedMintBatches: string[][] = [];
        await Promise.all(
          sendResults.map(async ({ signature, error, batch }, idx) => {
            if (signature) {
              try {
                const confirmation = await connection.confirmTransaction(signature, 'processed');
                if (confirmation.value.err) {
                  throw new Error('Transaction failed confirmation');
                }
                signatures.push(signature);
                console.log(`[Chunk ${chunkStart / CHUNK_SIZE + 1}] Processed ${idx + 1}/${allSignedTransactions.length} transactions`);
              } catch (err) {
                console.warn(`[Chunk ${chunkStart / CHUNK_SIZE + 1}] Transaction ${signature} failed confirmation:`, err);
                failedMintBatches.push(batch);
              }
            } else {
              // If sending failed, check error type
              const msg = error?.message?.toLowerCase() || '';
              if (msg.includes('blockhash not found') || msg.includes('429')) {
                console.warn(`[Chunk ${chunkStart / CHUNK_SIZE + 1}] Transaction failed to send, will retry:`, error);
                failedMintBatches.push(batch);
              } else {
                console.error(`[Chunk ${chunkStart / CHUNK_SIZE + 1}] Transaction send error:`, error);
                failedMints.push(...(batch || []));
              }
            }
          })
        );

        mintBatchesToRetry = failedMintBatches;
        attempts++;

        // If we have failed transactions, wait before next retry
        if (failedMintBatches.length > 0) {
          console.log(`[Chunk ${chunkStart / CHUNK_SIZE + 1}] Waiting before next retry for ${failedMintBatches.length} failed transactions...`);
          await delay(RATE_LIMIT_DELAY * 2);
        }
      } catch (error) {
        console.error(`[Chunk ${chunkStart / CHUNK_SIZE + 1}] Error processing chunk:`, error);
        // Collect all remaining failed mints for reporting
        for (const batch of mintBatchesToRetry) {
          failedMints.push(...batch);
        }
        break; // Continue to next chunk
      }
    }

    if (txsToRetry.length > 0) {
      console.error(`[Chunk ${chunkStart / CHUNK_SIZE + 1}] Failed to send ${txsToRetry.length} transactions after ${MAX_RETRIES + 1} attempts.`);
      // Collect all remaining failed mints for reporting
      for (const batch of mintBatchesToRetry) {
        failedMints.push(...batch);
      }
      // Do NOT throw, continue to next chunk
    }
  }

  if (failedMints.length > 0) {
    console.error(`\nFailed to approve delegate for the following mints after all retries:`, failedMints);
  }

  return signatures;
} 