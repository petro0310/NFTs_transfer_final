import { Connection, PublicKey } from '@solana/web3.js';
import { Metaplex } from '@metaplex-foundation/js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

const RPC_CONFIG = {
  // Public RPC (not recommended for production)
  public: 'https://api.devnet.solana.com',
  
  // Add your dedicated RPC URLs here
  quicknode: 'https://quiet-orbital-aura.solana-devnet.quiknode.pro/3dbfdc65d8f6bb108a903f56382118152355f5cf/',
  // quicknode: 'https://magical-special-tent.solana-devnet.quiknode.pro/a9338fd2b405412ffff731d8b054f835a1921a45/',
  alchemy: 'YOUR_ALCHEMY_URL',
  helius: 'https://api-devnet.helius-rpc.com/v0/transactions/?api-key=94b5dc2c-0ade-43f5-9b1b-41209ee11423 ',
};

export const getMetaplex = () => {
  const connection = new Connection(RPC_CONFIG.quicknode);
  return new Metaplex(connection);
};

// Type guard to check if an object has 'ownership' property
function hasOwnership(nft: any): nft is { address: PublicKey; ownership: { owner: PublicKey } } {
  return (
    nft &&
    typeof nft === 'object' &&
    'ownership' in nft &&
    nft.ownership &&
    'owner' in nft.ownership &&
    nft.address
  );
}

// Fetch NFTs by creator, but only return those owned by userWallet
export async function fetchNFTsByCreator(
  candyMachineId: string,
  userWallet: PublicKey,
  connection: Connection
): Promise<string[]> {
  try {
    const metaplex = getMetaplex();
    const creator = new PublicKey(candyMachineId);

    // Get all NFTs by creator
    const nfts = await metaplex.nfts().findAllByCreator({ creator });

    // Filter NFTs where the owner is the userWallet
    const ownedNfts: string[] = [];
    for (const nft of nfts) {
      if (hasOwnership(nft) && nft.ownership.owner.equals(userWallet)) {
        ownedNfts.push(nft.address.toString());
      }
    }
    return ownedNfts;
  } catch (error) {
    console.error('Error fetching NFT token addresses:', error);
    throw error;
  }
}

export async function fetchNFTsByOwner(
  userWallet: PublicKey,
  connection: Connection
): Promise<string[]> {
  try {
    const metaplex = getMetaplex();
    const nfts = await metaplex.nfts().findAllByOwner({ owner: userWallet });
    // Return all mint addresses
    return nfts.map(nft => nft.address.toString());
  } catch (error) {
    console.error('Error fetching NFT token addresses:', error);
    throw error;
  }
}

export async function fetchNFTsByCollection(
  userWallet: PublicKey,
  collectionAddress: string,
  connection: Connection
): Promise<string[]> {
  try {
    const metaplex = getMetaplex();
    const nfts = await metaplex.nfts().findAllByOwner({ owner: userWallet });
    const filtered: any[] = nfts.filter(nft =>
      nft.collection &&
      nft.collection.verified &&
      nft.collection.address.toString() === collectionAddress
    );
    return filtered.map(nft => nft.mintAddress.toString());
  } catch (error) {
    console.error('Error fetching NFT token addresses:', error);
    throw error;
  }
} 