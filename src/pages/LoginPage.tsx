import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { user, signInWithGoogle, signOut, createHousehold, joinHousehold } = useAuth();
  const [step, setStep] = useState<'login' | 'setup' | 'created' | 'join'>('login');
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // After login, show household setup if user is logged in but has no household
  React.useEffect(() => {
    if (user) setStep('setup');
  }, [user]);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError('ログインに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      const code = await createHousehold();
      setInviteCode(code);
      setStep('created');
    } catch (e) {
      setError('作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setError('');
    setLoading(true);
    try {
      await joinHousehold(joinCode);
    } catch (e: any) {
      setError(e.message ?? '参加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '0 24px',
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>💰</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>家計簿アプリ</h1>
      <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 40 }}>夫婦で共有するシンプル家計管理</p>

      {step === 'login' && (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '14px 20px', borderRadius: 14,
              border: '1px solid var(--sep)', background: 'var(--card)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              fontSize: 16, fontWeight: 600, cursor: 'pointer', color: 'var(--text)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M47.5 24.6c0-1.6-.1-3.1-.4-4.6H24v8.7h13.2c-.6 3-2.3 5.5-4.9 7.2v6h7.9c4.6-4.3 7.3-10.6 7.3-17.3z"/>
              <path fill="#34A853" d="M24 48c6.5 0 12-2.2 16-5.9l-7.9-6c-2.2 1.5-5 2.3-8.1 2.3-6.2 0-11.5-4.2-13.4-9.9H2.5v6.2C6.5 42.5 14.7 48 24 48z"/>
              <path fill="#FBBC05" d="M10.6 28.5c-.5-1.5-.8-3-.8-4.5s.3-3 .8-4.5v-6.2H2.5C.9 16.7 0 20.2 0 24s.9 7.3 2.5 10.7l8.1-6.2z"/>
              <path fill="#EA4335" d="M24 9.6c3.5 0 6.6 1.2 9.1 3.5l6.8-6.8C35.9 2.4 30.4 0 24 0 14.7 0 6.5 5.5 2.5 13.3l8.1 6.2C12.5 13.8 17.8 9.6 24 9.6z"/>
            </svg>
            Googleでログイン
          </button>
          {error && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginTop: 12 }}>{error}</p>}
        </div>
      )}

      {step === 'setup' && (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <p style={{ fontSize: 14, color: 'var(--text2)', textAlign: 'center', marginBottom: 24 }}>
            {user?.displayName ?? 'ログイン済み'} でログイン中
          </p>
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }}
            onClick={handleCreate} disabled={loading}>
            🏠 新しい家計簿を作成
          </button>
          <button className="btn btn-ghost" style={{ width: '100%' }}
            onClick={() => setStep('join')}>
            🔑 招待コードで参加
          </button>
          <button onClick={() => { signOut(); setStep('login'); }}
            style={{ display: 'block', margin: '20px auto 0', background: 'none', border: 'none', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
            別のアカウントでログイン
          </button>
          {error && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginTop: 12 }}>{error}</p>}
        </div>
      )}

      {step === 'created' && (
        <div style={{ width: '100%', maxWidth: 320, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>家計簿を作成しました！</p>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
            パートナーに以下の招待コードを共有してください
          </p>
          <div style={{
            background: 'var(--card2)', borderRadius: 14, padding: '16px 20px',
            marginBottom: 20, border: '2px dashed var(--sep)',
          }}>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 8, color: 'var(--blue)' }}>
              {inviteCode}
            </div>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(inviteCode)}
            className="btn btn-ghost" style={{ width: '100%', marginBottom: 12 }}>
            📋 コードをコピー
          </button>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
            ※ パートナーはこのコードを使って「招待コードで参加」から参加できます
          </p>
          {/* This button triggers app entry — householdId is already set */}
        </div>
      )}

      {step === 'join' && (
        <div style={{ width: '100%', maxWidth: 320 }}>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 16 }}>パートナーから招待コードを受け取ってください</p>
          <input
            type="text"
            className="form-input"
            placeholder="招待コード（例: ABC123）"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{ width: '100%', fontSize: 24, textAlign: 'center', letterSpacing: 6, marginBottom: 16, textTransform: 'uppercase' }}
          />
          <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12 }}
            onClick={handleJoin} disabled={loading || joinCode.length < 6}>
            参加する
          </button>
          <button className="btn btn-ghost" style={{ width: '100%' }}
            onClick={() => setStep('setup')}>
            戻る
          </button>
          {error && <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginTop: 12 }}>{error}</p>}
        </div>
      )}
    </div>
  );
};

export default LoginPage;
