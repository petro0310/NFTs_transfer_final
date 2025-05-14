import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';

export const Header: React.FC = () => {

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <h1>NFT Transfer</h1>
        </div>
        <div className="wallet-section">
          <WalletMultiButton className="wallet-button" />
        </div>
      </div>
    </header>
  );
}; 