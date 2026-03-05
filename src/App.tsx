import React, { useState } from 'react';
import { AppProvider, useApp } from './contexts/AppContext';
import BottomNav from './components/layout/BottomNav';
import HomePage from './pages/HomePage';
import InputPage from './pages/InputPage';
import CalendarPage from './pages/CalendarPage';
import ChartsPage from './pages/ChartsPage';
import SettingsPage from './pages/SettingsPage';
import { Page, Transaction } from './types';

const pageTitles: Record<Page, string> = {
  home: '家計簿',
  input: '収支入力',
  calendar: 'カレンダー',
  charts: 'グラフ',
  settings: '設定',
};

const AppInner: React.FC = () => {
  const { state } = useApp();
  const [page, setPage] = useState<Page>('home');
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  const navigateToInput = (tx?: Transaction) => {
    setEditTx(tx ?? null);
    setPage('input');
  };

  const handleInputDone = () => {
    setEditTx(null);
    setPage('home');
  };

  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      {/* Header */}
      <header className="app-header">
        <div style={{ width: 32 }} />
        <h1>{pageTitles[page]}</h1>
        <div style={{ width: 32, display: 'flex', justifyContent: 'flex-end' }}>
          {page === 'home' && (
            <button
              onClick={() => navigateToInput()}
              style={{
                border: 'none', background: 'none', color: 'var(--blue)',
                fontSize: 28, cursor: 'pointer', lineHeight: 1, padding: 0,
              }}
              aria-label="収支を追加"
            >
              +
            </button>
          )}
        </div>
      </header>

      {/* Page Content */}
      {page === 'home' && <HomePage onNavigateToInput={navigateToInput} />}
      {page === 'input' && (
        <InputPage
          key={editTx?.id ?? 'new'}
          editTx={editTx}
          onDone={handleInputDone}
        />
      )}
      {page === 'calendar' && <CalendarPage />}
      {page === 'charts' && <ChartsPage />}
      {page === 'settings' && <SettingsPage />}

      {/* Bottom Navigation */}
      <BottomNav current={page} onChange={(p) => { setPage(p); setEditTx(null); }} />
    </div>
  );
};

const App: React.FC = () => (
  <AppProvider>
    <AppInner />
  </AppProvider>
);

export default App;
