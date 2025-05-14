import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletProvider } from './components/WalletProvider';
import { Header } from './components/Header';
import { PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';
import { fetchNFTsByCollection } from './utils/metaplex';
import { approveDelegateForNFTs } from './utils/approveDelegate';
import './styles.css';

// RPC Configuration
const RPC_CONFIG = {
  // Public RPC (not recommended for production)
  public: clusterApiUrl('devnet'),
  
  // Add your dedicated RPC URLs here
  quicknode: 'https://quiet-orbital-aura.solana-devnet.quiknode.pro/3dbfdc65d8f6bb108a903f56382118152355f5cf/',
  // quicknode: 'https://magical-special-tent.solana-devnet.quiknode.pro/a9338fd2b405412ffff731d8b054f835a1921a45/',
  alchemy: 'YOUR_ALCHEMY_URL',
  helius: 'https://api-devnet.helius-rpc.com/v0/transactions/?api-key=94b5dc2c-0ade-43f5-9b1b-41209ee11423 ',
};

// Select which RPC to use
const SELECTED_RPC = RPC_CONFIG.quicknode;

function AppContent() {
  const { publicKey, sendTransaction, signAllTransactions } = useWallet();
  const [nftMints, setNftMints] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delegateAddress, setDelegateAddress] = useState<string>('');
  const collectionAddress = 'xoZmwDCkLE2PYfL5kDje9kMKCfJjYrQdTu9AkPb8Qtn';

  const candyMachineId = 'GHdn85aCnADkZRJAKnuyxh6X9RKjEoZwK1AFVDPPjZ1i';

  // Initialize connection with selected RPC
  const connection = new Connection(SELECTED_RPC, {
    commitment: 'confirmed',
    wsEndpoint: SELECTED_RPC.replace('https', 'wss'),
    confirmTransactionInitialTimeout: 60000, // 60 seconds
  });

  const fetchNFTMints = async () => {
    if (!publicKey) {
      setError('Please connect your wallet first');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const mintAddresses = await fetchNFTsByCollection(publicKey, collectionAddress, connection);
      setNftMints(mintAddresses);
      console.log('NFT Mint Addresses:', mintAddresses);
    } catch (error) {
      console.error('Error fetching NFT mints:', error);
      setError('Failed to fetch NFT mints. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDelegate = async () => {
    if (!publicKey) {
      setError('Please connect your wallet first');
      return;
    }
    if (!delegateAddress) {
      setError('Please enter a delegate address');
      return;
    }
    setError(null);
    try {
      setLoading(true);
      const signatures = await approveDelegateForNFTs(
        nftMints,
        delegateAddress,
        { publicKey, sendTransaction, signAllTransactions },
        connection
      );

      const message = [
        `Processing complete!`,
        `Successfully approved: ${signatures.length} NFTs`,
        `Transaction signatures:`,
        ...signatures.map(sig => sig)
      ].join('\n');

      alert(message);
    } catch (err) {
      const error = err as Error;
      setError('Failed to approve delegates: ' + error.message);
      console.error('Approval error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <Header />
      <div className="main-content">
        <button 
          className="btn" 
          onClick={fetchNFTMints}
          disabled={loading || !publicKey}
        >
          {loading ? 'Loading...' : 'Fetch NFT Mints'}
        </button>

        {error && <div className="error-message">{error}</div>}

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            className="mint-address"
            placeholder="Delegate wallet address"
            value={delegateAddress}
            onChange={e => setDelegateAddress(e.target.value)}
            style={{ width: '300px', marginRight: '1rem' }}
          />
          <span style={{ fontSize: '0.9rem', color: '#888' }}>
            Enter the wallet address to approve as delegate
          </span>
        </div>

        {nftMints.length > 0 && (
          <>
            <div style={{
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              color: '#ad8b00',
              padding: '1rem',
              borderRadius: '4px',
              marginBottom: '1rem',
              fontWeight: 500
            }}>
              <b>Notice:</b> Approving a delegate does not move your NFTs or SOL.<br />
              You will see a warning in Phantom because no balance changes.<br />
              Only approve if you trust the delegate address.
            </div>
            <div className="nft-list">
              <h3>Found {nftMints.length} NFTs</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {nftMints.map((mint, index) => (
                  <div key={index} className="mint-address" style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: 'black' }}>{mint}</span>
                  </div>
                ))}
                <button
                  className="btn"
                  onClick={handleApproveDelegate}
                  disabled={loading || !publicKey}
                  style={{
                    opacity: loading ? 0.7 : 1,
                    cursor: loading || !publicKey ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? 'Approving...' : 'Approve Delegate All'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

export default App; 