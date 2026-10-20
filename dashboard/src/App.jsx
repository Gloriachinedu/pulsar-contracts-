import React, { useEffect, useState } from 'react';
import { useWallet } from './hooks/useWallet';
import PaymentHistory from './components/PaymentHistory';
import RefundManager from './components/RefundManager';
import MerchantProfile from './components/MerchantProfile';
import AdminPanel from './components/AdminPanel';
import './App.css';

const TABS = ['Payments', 'Refunds', 'Profile', 'Admin'];

export default function App() {
  const { publicKey, connect, disconnect, error } = useWallet();
  const [tab, setTab] = useState('Payments');
  const [theme, setTheme] = useState(() => {
    const savedTheme = window.localStorage.getItem('pulsar-theme');
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('pulsar-theme', theme);
  }, [theme]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Pulsar Merchant Dashboard</h1>
        <button
          type="button"
          aria-pressed={theme === 'dark'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        {publicKey ? (
          <div className="wallet-info">
            <span title={publicKey}>{publicKey.slice(0, 8)}…{publicKey.slice(-4)}</span>
            <button onClick={disconnect}>Disconnect</button>
          </div>
        ) : (
          <button onClick={connect}>Connect Freighter</button>
        )}
      </header>

      {error && <p role="alert" className="error">{error}</p>}

      {!publicKey ? (
        <main className="connect-prompt">
          <p>Connect your Freighter wallet to access the dashboard.</p>
        </main>
      ) : (
        <main>
          <nav aria-label="Dashboard sections">
            <ul role="tablist" className="tabs">
              {TABS.map(t => (
                <li key={t} role="presentation">
                  <button
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                  >
                    {t}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div role="tabpanel" aria-label={tab} className="tab-content">
            {tab === 'Payments' && <PaymentHistory merchantAddress={publicKey} />}
            {tab === 'Refunds'  && <RefundManager  merchantAddress={publicKey} />}
            {tab === 'Profile'  && <MerchantProfile publicKey={publicKey} />}
            {tab === 'Admin'    && <AdminPanel      adminAddress={publicKey} />}
          </div>
        </main>
      )}
    </div>
  );
}
