import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppProvider, useApp } from './contexts/AppContext';
import BottomNav from './components/layout/BottomNav';
import HomePage from './pages/HomePage';
import InputPage from './pages/InputPage';
import ReviewPage from './pages/ReviewPage';
import CalendarPage from './pages/CalendarPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import { Page, Transaction } from './types';

const pageTitles: Record<Page, string> = {
  home: '家計簿',
  input: '収支入力',
  review: '確認',
  calendar: 'カレンダー',
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
            >+</button>
          )}
        </div>
      </header>

      {page === 'home' && <HomePage onNavigateToInput={navigateToInput} />}
      {page === 'input' && (
        <InputPage
          key={editTx?.id ?? 'new'}
          editTx={editTx}
          onDone={handleInputDone}
        />
      )}
      {page === 'review' && <ReviewPage />}
      {page === 'calendar' && <CalendarPage />}
      {page === 'settings' && <SettingsPage />}

      <BottomNav current={page} onChange={(p) => { setPage(p); setEditTx(null); }} />
    </div>
  );
};

const AuthGate: React.FC = () => {
  const { user, householdId, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg)', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>💰</div>
        <div style={{ color: 'var(--text3)', fontSize: 14 }}>読み込み中...</div>
      </div>
    );
  }

  if (!user || !householdId) {
    return <LoginPage />;
  }

  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <AuthGate />
  </AuthProvider>
);

export default App;
