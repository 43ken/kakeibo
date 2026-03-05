import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { Category, Budget, PaymentMethod, PaymentAccount } from '../types';
import { formatAmount, getActiveBudgets } from '../utils/calculations';
import { exportToCSV, getMonthRange } from '../utils/export';

const PRESET_COLORS = [
  '#FF6B6B','#FF9500','#FFCC00','#34C759','#4ECDC4',
  '#007AFF','#5856D6','#AF52DE','#FF2D55','#8E8E93',
];
const PRESET_ICONS = [
  '🍽️','🚃','🛒','💊','🎮','💡','📱','👗','🍜','📦',
  '💰','🎁','💼','✨','🏠','📚','🐾','✈️','🎵','🏋️',
];
const PAYMENT_ICONS = ['💴','💳','📱','📲','🏧','💰','🪙','💵','🎴','📀'];

// ─── Category Modal ───────────────────────────────────────────────────────────
const CategoryModal: React.FC<{
  cat?: Category; onSave: (c: Omit<Category,'id'> | Category) => void; onClose: () => void;
}> = ({ cat, onSave, onClose }) => {
  const [name, setName] = useState(cat?.name ?? '');
  const [icon, setIcon] = useState(cat?.icon ?? '📦');
  const [color, setColor] = useState(cat?.color ?? '#007AFF');

  const handleSave = () => {
    if (!name.trim()) return;
    if (cat) onSave({ ...cat, name: name.trim(), icon, color, type: 'expense' });
    else onSave({ name: name.trim(), icon, color, type: 'expense' });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">{cat ? 'カテゴリを編集' : 'カテゴリを追加'}</div>
        <div className="form-section" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <label className="form-label">名前</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="カテゴリ名" maxLength={10} />
          </div>
        </div>
        <div className="section-label">アイコン</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {PRESET_ICONS.map(ic => (
            <button key={ic} onClick={() => setIcon(ic)} style={{ width: 44, height: 44, fontSize: 22, border: '2px solid', borderColor: icon === ic ? 'var(--blue)' : 'transparent', borderRadius: 10, background: 'var(--card2)', cursor: 'pointer' }}>{ic}</button>
          ))}
        </div>
        <div className="section-label">カラー</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!name.trim()}>保存</button>
        </div>
      </div>
    </div>
  );
};

// ─── Payment Method Modal ─────────────────────────────────────────────────────
const PaymentMethodModal: React.FC<{
  pm?: PaymentMethod; onSave: (p: Omit<PaymentMethod,'id'> | PaymentMethod) => void; onClose: () => void;
}> = ({ pm, onSave, onClose }) => {
  const [name, setName] = useState(pm?.name ?? '');
  const [icon, setIcon] = useState(pm?.icon ?? '💳');
  const [isCash, setIsCash] = useState(pm?.isCash ?? false);

  const handleSave = () => {
    if (!name.trim()) return;
    if (pm) onSave({ ...pm, name: name.trim(), icon, isCash });
    else onSave({ name: name.trim(), icon, isCash });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">{pm ? '支払方法を編集' : '支払方法を追加'}</div>
        <div className="form-section" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <label className="form-label">名前</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="例: Suica" maxLength={15} />
          </div>
          <div className="form-row">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15 }}>現金扱い</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>ONにすると引き落とし先選択が不要になります</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={isCash} onChange={e => setIsCash(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>
        <div className="section-label">アイコン</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {PAYMENT_ICONS.map(ic => (
            <button key={ic} onClick={() => setIcon(ic)} style={{ width: 44, height: 44, fontSize: 22, border: '2px solid', borderColor: icon === ic ? 'var(--blue)' : 'transparent', borderRadius: 10, background: 'var(--card2)', cursor: 'pointer' }}>{ic}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!name.trim()}>保存</button>
        </div>
      </div>
    </div>
  );
};

// ─── Payment Account Modal ────────────────────────────────────────────────────
const PaymentAccountModal: React.FC<{
  account?: PaymentAccount; onSave: (a: Omit<PaymentAccount,'id'> | PaymentAccount) => void; onClose: () => void;
}> = ({ account, onSave, onClose }) => {
  const [name, setName] = useState(account?.name ?? '');
  const [color, setColor] = useState(account?.color ?? '#007AFF');

  const handleSave = () => {
    if (!name.trim()) return;
    if (account) onSave({ ...account, name: name.trim(), color });
    else onSave({ name: name.trim(), color });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">{account ? '引き落とし先を編集' : '引き落とし先を追加'}</div>
        <div className="form-section" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <label className="form-label">名前</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="例: 楽天カード" maxLength={20} />
          </div>
        </div>
        <div className="section-label">カラー</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: '50%', background: c, border: color === c ? '3px solid var(--text)' : '3px solid transparent', cursor: 'pointer' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={!name.trim()}>保存</button>
        </div>
      </div>
    </div>
  );
};

// ─── Budget Modal ─────────────────────────────────────────────────────────────
const BudgetModal: React.FC<{
  categories: Category[]; budgets: Budget[];
  onSave: (b: Budget) => void; onDelete: (catId: string) => void; onClose: () => void;
}> = ({ categories, budgets, onSave, onDelete, onClose }) => {
  const expenseCats = categories.filter(c => c.type === 'expense');
  const [selectedCat, setSelectedCat] = useState(expenseCats[0]?.id ?? '');
  const existingBudget = budgets.find(b => b.categoryId === selectedCat);
  const [limit, setLimit] = useState(existingBudget?.monthlyLimit.toString() ?? '');

  const handleCatChange = (catId: string) => {
    setSelectedCat(catId);
    const b = budgets.find(b => b.categoryId === catId);
    setLimit(b?.monthlyLimit.toString() ?? '');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">月の予算を設定</div>
        <div className="section-label">カテゴリ</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {expenseCats.map(c => (
            <button key={c.id} onClick={() => handleCatChange(c.id)} style={{
              padding: '6px 12px', borderRadius: 20, border: '2px solid',
              borderColor: selectedCat === c.id ? c.color : 'var(--sep)',
              background: selectedCat === c.id ? `${c.color}20` : 'var(--card2)',
              fontSize: 13, cursor: 'pointer', color: 'var(--text)',
            }}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>
        <div className="form-section" style={{ marginBottom: 16 }}>
          <div className="form-row">
            <label className="form-label">上限額</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
              <span style={{ color: 'var(--text3)' }}>¥</span>
              <input type="number" className="form-input" value={limit} onChange={e => setLimit(e.target.value)}
                placeholder="30000" inputMode="numeric" min="1" style={{ maxWidth: 140 }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {existingBudget && <button className="btn btn-danger btn-sm" onClick={() => { onDelete(selectedCat); onClose(); }}>削除</button>}
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => { onSave({ categoryId: selectedCat, monthlyLimit: parseInt(limit.replace(/,/g,'')) }); onClose(); }} disabled={!limit || parseInt(limit) <= 0}>保存</button>
        </div>
      </div>
    </div>
  );
};

// ─── Export Modal ─────────────────────────────────────────────────────────────
const ExportModal: React.FC<{ onExport: (start: string, end: string) => void; onClose: () => void }> = ({ onExport, onClose }) => {
  const now = new Date();
  const [mode, setMode] = useState<'month'|'range'>('month');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`);
  const [endDate, setEndDate] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(new Date(now.getFullYear(),now.getMonth()+1,0).getDate()).padStart(2,'0')}`);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-title">CSVエクスポート</div>
        <div className="segment" style={{ marginBottom: 16 }}>
          <button className={`seg-btn${mode==='month'?' active':''}`} onClick={() => setMode('month')}>月別</button>
          <button className={`seg-btn${mode==='range'?' active':''}`} onClick={() => setMode('range')}>期間指定</button>
        </div>
        {mode === 'month' ? (
          <div className="form-section" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label className="form-label">年</label>
              <input type="number" className="form-input" value={year} onChange={e => setYear(parseInt(e.target.value))} min={2000} max={2100} style={{ maxWidth: 100 }} />
            </div>
            <div className="form-row">
              <label className="form-label">月</label>
              <select className="form-select" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}月</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="form-section" style={{ marginBottom: 16 }}>
            <div className="form-row">
              <label className="form-label">開始日</label>
              <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="form-row">
              <label className="form-label">終了日</label>
              <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} />
            </div>
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16, textAlign: 'center' }}>※ 個人費用は除外されます</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => { const r = mode==='month' ? getMonthRange(year,month) : { start: startDate, end: endDate }; onExport(r.start,r.end); }}>📥 ダウンロード</button>
        </div>
      </div>
    </div>
  );
};

// ─── Settings Page ────────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const { state, dispatch } = useApp();
  const { householdId } = useAuth();
  const now = new Date();
  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | undefined>();
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPmModal, setShowPmModal] = useState(false);
  const [editPm, setEditPm] = useState<PaymentMethod | undefined>();
  const [showPaModal, setShowPaModal] = useState(false);
  const [editPa, setEditPa] = useState<PaymentAccount | undefined>();
  const [inviteCode, setInviteCode] = useState('');
  const [copied, setCopied] = useState(false);

  const budgetStatus = getActiveBudgets(state.budgets, state.transactions, state.categories, now.getFullYear(), now.getMonth() + 1);

  useEffect(() => {
    if (!householdId) return;
    getDoc(doc(db, 'households', householdId)).then(snap => {
      if (snap.exists()) setInviteCode(snap.data().inviteCode ?? '');
    });
  }, [householdId]);

  const handleCopyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <main className="page fade-in">
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div style={{ fontSize: 36 }}>💰</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>家計簿アプリ</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>シンプル家計管理</div>
      </div>

      {/* 家族を招待 */}
      <div className="settings-section">
        <div className="settings-section-title">家族を招待</div>
        <div style={{ padding: '8px 16px 16px' }}>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            以下の招待コードを家族に共有してください
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1, textAlign: 'center', fontSize: 26, fontWeight: 700,
              letterSpacing: 6, fontFamily: 'monospace', color: 'var(--blue)',
              background: 'var(--card2)', borderRadius: 12, padding: '14px 8px',
            }}>
              {inviteCode || '------'}
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleCopyCode}
              style={{ flexShrink: 0, minWidth: 80 }}
            >
              {copied ? '✓ コピー済' : '📋 コピー'}
            </button>
          </div>
        </div>
      </div>

      {/* 月の予算 */}
      <div className="settings-section">
        <div className="settings-section-title">月の予算</div>
        <div className="settings-row">
          <span className="settings-row-label">毎月の予算額</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--text3)' }}>¥</span>
            <input
              type="number" inputMode="numeric" min="0" placeholder="300000"
              value={state.settings.monthlyBudget === 0 ? '' : state.settings.monthlyBudget}
              onChange={e => {
                const v = parseInt(e.target.value);
                const newBudget = isNaN(v) ? 0 : v;
                const payload: any = { monthlyBudget: newBudget };
                // Set budgetStartMonth when budget is first configured
                if (newBudget > 0 && !state.settings.budgetStartMonth) {
                  const now = new Date();
                  payload.budgetStartMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                }
                dispatch({ type: 'UPDATE_SETTINGS', payload });
              }}
              style={{ border: 'none', background: 'transparent', fontSize: 17, color: 'var(--text)', textAlign: 'right', outline: 'none', fontFamily: 'inherit', width: 120 }}
            />
          </div>
        </div>
        <div style={{ padding: '0 16px 12px', fontSize: 12, color: 'var(--text3)' }}>
          先月との差額が自動で繰り越されます
        </div>
      </div>

      {/* 外観 */}
      <div className="settings-section">
        <div className="settings-section-title">外観</div>
        <div className="settings-row">
          <span className="settings-row-label">ダークモード</span>
          <label className="toggle">
            <input type="checkbox" checked={state.settings.darkMode} onChange={e => dispatch({ type: 'UPDATE_SETTINGS', payload: { darkMode: e.target.checked } })} />
            <span className="toggle-slider" />
          </label>
        </div>
      </div>

      {/* カテゴリ管理 */}
      <div className="settings-section">
        <div className="settings-section-title">カテゴリ管理</div>
        {state.categories.map(cat => (
          <div key={cat.id} className="settings-row" style={{ cursor: 'pointer' }} onClick={() => { setEditCat(cat); setShowCatModal(true); }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cat.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{cat.icon}</div>
            <span className="settings-row-label">{cat.name}</span>
            <span className="settings-row-value" style={{ fontSize: 12 }}>支出</span>
            <span style={{ color: 'var(--text3)', fontSize: 18, marginLeft: 4 }}>›</span>
          </div>
        ))}
        <div className="settings-row">
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => { setEditCat(undefined); setShowCatModal(true); }}>+ カテゴリを追加</button>
        </div>
      </div>

      {/* 支払方法管理 */}
      <div className="settings-section">
        <div className="settings-section-title">支払方法</div>
        {state.paymentMethods.map(pm => (
          <div key={pm.id} className="settings-row" style={{ cursor: 'pointer' }} onClick={() => { setEditPm(pm); setShowPmModal(true); }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: pm.isCash ? 'rgba(52,199,89,0.15)' : 'rgba(0,122,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{pm.icon}</div>
            <span className="settings-row-label">{pm.name}</span>
            <span className="settings-row-value" style={{ fontSize: 11 }}>{pm.isCash ? '現金' : '非現金'}</span>
            <span style={{ color: 'var(--text3)', fontSize: 18, marginLeft: 4 }}>›</span>
          </div>
        ))}
        <div className="settings-row">
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => { setEditPm(undefined); setShowPmModal(true); }}>+ 支払方法を追加</button>
        </div>
      </div>

      {/* 引き落とし先管理 */}
      <div className="settings-section">
        <div className="settings-section-title">引き落とし先</div>
        {state.paymentAccounts.length === 0 ? (
          <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
            クレカや電子マネーの口座を追加してください
          </div>
        ) : (
          state.paymentAccounts.map(acc => (
            <div key={acc.id} className="settings-row" style={{ cursor: 'pointer' }} onClick={() => { setEditPa(acc); setShowPaModal(true); }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: acc.color, flexShrink: 0, marginRight: 4 }} />
              <span className="settings-row-label">{acc.name}</span>
              <span style={{ color: 'var(--text3)', fontSize: 18, marginLeft: 4 }}>›</span>
            </div>
          ))
        )}
        <div className="settings-row">
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => { setEditPa(undefined); setShowPaModal(true); }}>+ 引き落とし先を追加</button>
        </div>
      </div>

      {/* 予算管理 */}
      <div className="settings-section">
        <div className="settings-section-title">予算管理（今月）</div>
        {budgetStatus.length === 0 ? (
          <div style={{ padding: '16px', color: 'var(--text3)', fontSize: 14, textAlign: 'center' }}>予算が設定されていません</div>
        ) : (
          budgetStatus.map(b => {
            const pct = Math.min(b.percentage, 100);
            const color = b.isOver ? 'var(--red)' : b.isWarning ? 'var(--orange)' : 'var(--green)';
            return (
              <div key={b.categoryId} className="settings-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontSize: 14 }}>{b.cat.icon} {b.cat.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>¥{formatAmount(b.spent)} / ¥{formatAmount(b.monthlyLimit)}</span>
                </div>
                <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
              </div>
            );
          })
        )}
        <div className="settings-row">
          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => setShowBudgetModal(true)}>+ 予算を設定・編集</button>
        </div>
      </div>

      {/* データ */}
      <div className="settings-section">
        <div className="settings-section-title">データ</div>
        <div className="settings-row">
          <span className="settings-row-label">CSVエクスポート</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowExportModal(true)}>📥 出力</button>
        </div>
        <div className="settings-row">
          <span className="settings-row-label">記録件数</span>
          <span className="settings-row-value">{state.transactions.length}件</span>
        </div>
      </div>

      {/* リセット */}
      <div className="settings-section" style={{ marginBottom: 24 }}>
        <div className="settings-section-title">詳細</div>
        <div className="settings-row">
          <button className="btn btn-sm" style={{ width: '100%', background: 'rgba(255,59,48,0.1)', color: 'var(--red)' }}
            onClick={() => { if (confirm('すべてのデータを削除しますか？この操作は取り消せません。')) { window.location.reload(); } }}>
            🗑️ すべてのデータをリセット
          </button>
        </div>
      </div>

      {/* Modals */}
      {showCatModal && (
        <CategoryModal cat={editCat}
          onSave={c => { if ('id' in c) dispatch({ type: 'UPDATE_CATEGORY', payload: c }); else dispatch({ type: 'ADD_CATEGORY', payload: c }); setShowCatModal(false); setEditCat(undefined); }}
          onClose={() => { setShowCatModal(false); setEditCat(undefined); }} />
      )}
      {showPmModal && (
        <PaymentMethodModal pm={editPm}
          onSave={p => { if ('id' in p) dispatch({ type: 'UPDATE_PAYMENT_METHOD', payload: p }); else dispatch({ type: 'ADD_PAYMENT_METHOD', payload: p }); setShowPmModal(false); setEditPm(undefined); }}
          onClose={() => { setShowPmModal(false); setEditPm(undefined); }} />
      )}
      {showPaModal && (
        <PaymentAccountModal account={editPa}
          onSave={a => { if ('id' in a) dispatch({ type: 'UPDATE_PAYMENT_ACCOUNT', payload: a }); else dispatch({ type: 'ADD_PAYMENT_ACCOUNT', payload: a }); setShowPaModal(false); setEditPa(undefined); }}
          onClose={() => { setShowPaModal(false); setEditPa(undefined); }} />
      )}
      {showBudgetModal && (
        <BudgetModal categories={state.categories} budgets={state.budgets}
          onSave={b => { dispatch({ type: 'SET_BUDGET', payload: b }); }}
          onDelete={id => dispatch({ type: 'DELETE_BUDGET', payload: id })}
          onClose={() => setShowBudgetModal(false)} />
      )}
      {showExportModal && (
        <ExportModal
          onExport={(start, end) => { exportToCSV(state.transactions, state.categories, start, end, `家計簿_${start}_${end}.csv`); setShowExportModal(false); }}
          onClose={() => setShowExportModal(false)} />
      )}
    </main>
  );
};

export default SettingsPage;
