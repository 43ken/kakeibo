import React, { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { formatAmount, formatDate, formatYearMonth, getEffectiveBudget, getMonthTransactions } from '../utils/calculations';
import { Transaction } from '../types';

const ReviewPage: React.FC = () => {
  const { state, dispatch } = useApp();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [filterUnchecked, setFilterUnchecked] = useState(false);

  // Budget progress
  const baseMonthlyBudget = state.settings.monthlyBudget;
  const { effectiveBudget, carryover } = getEffectiveBudget(
    state.transactions, baseMonthlyBudget, year, month, state.settings.budgetStartMonth
  );
  const monthTxs = getMonthTransactions(state.transactions, year, month);
  const expense = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const remaining = effectiveBudget > 0 ? effectiveBudget - expense : null;
  const progressPct = effectiveBudget > 0 ? Math.min((expense / effectiveBudget) * 100, 100) : 0;
  const isOver = remaining !== null && remaining < 0;

  // All expense transactions (non-personal), sorted newest first
  const allExpenseTxs = useMemo(() => {
    return state.transactions
      .filter(t => t.type === 'expense' && !t.isPersonal)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [state.transactions]);

  const displayTxs = filterUnchecked ? allExpenseTxs.filter(t => !t.checked) : allExpenseTxs;

  // Group by year-month
  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    displayTxs.forEach(tx => {
      const [y, m] = tx.date.split('-').map(Number);
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [displayTxs]);

  const getCatInfo = (catId: string) =>
    state.categories.find(c => c.id === catId) ?? { name: 'その他', icon: '📦', color: '#B2BEC3' };

  const getPayInfo = (tx: Transaction) => {
    const pm = state.paymentMethods.find(p => p.id === tx.paymentMethodId);
    const pa = tx.paymentAccountId ? state.paymentAccounts.find(a => a.id === tx.paymentAccountId) : null;
    return { pm, pa };
  };

  const handleToggle = (tx: Transaction) => {
    dispatch({ type: 'TOGGLE_TRANSACTION_CHECKED', payload: tx.id });
  };

  const uncheckedCount = allExpenseTxs.filter(t => !t.checked).length;

  return (
    <main className="page fade-in">
      {/* Budget progress card */}
      <div style={{
        background: 'var(--card)', borderRadius: 16, padding: '16px',
        marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>
          {formatYearMonth(year, month)} の予算進捗
          {carryover !== 0 && baseMonthlyBudget > 0 && (
            <span style={{ marginLeft: 8, color: carryover > 0 ? 'var(--green)' : 'var(--red)' }}>
              ({carryover > 0 ? '+' : ''}¥{formatAmount(carryover)} 繰越)
            </span>
          )}
        </div>
        {baseMonthlyBudget === 0 ? (
          <div style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>
            予算が未設定です（設定タブで設定できます）
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: isOver ? 'var(--red)' : 'var(--text)' }}>
                ¥{formatAmount(expense)}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                / ¥{formatAmount(effectiveBudget)}
              </div>
            </div>
            <div style={{ height: 8, background: 'var(--card2)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', borderRadius: 4, transition: 'width 0.3s',
                width: `${progressPct}%`,
                background: isOver ? 'var(--red)' : progressPct >= 80 ? 'var(--orange)' : 'var(--green)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text3)' }}>
              <span>{Math.round(progressPct)}% 使用</span>
              {remaining !== null && (
                <span style={{ color: isOver ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                  {isOver ? `¥${formatAmount(Math.abs(remaining))} オーバー` : `残り ¥${formatAmount(remaining)}`}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button
          onClick={() => setFilterUnchecked(false)}
          style={{
            padding: '6px 16px', borderRadius: 20, border: '1.5px solid',
            borderColor: !filterUnchecked ? 'var(--blue)' : 'var(--sep)',
            background: !filterUnchecked ? 'rgba(0,122,255,0.1)' : 'var(--card2)',
            color: !filterUnchecked ? 'var(--blue)' : 'var(--text2)',
            fontSize: 13, cursor: 'pointer', fontWeight: !filterUnchecked ? 600 : 400,
          }}
        >全て</button>
        <button
          onClick={() => setFilterUnchecked(true)}
          style={{
            padding: '6px 16px', borderRadius: 20, border: '1.5px solid',
            borderColor: filterUnchecked ? 'var(--blue)' : 'var(--sep)',
            background: filterUnchecked ? 'rgba(0,122,255,0.1)' : 'var(--card2)',
            color: filterUnchecked ? 'var(--blue)' : 'var(--text2)',
            fontSize: 13, cursor: 'pointer', fontWeight: filterUnchecked ? 600 : 400,
          }}
        >
          未確認のみ
          {uncheckedCount > 0 && (
            <span style={{
              marginLeft: 6, background: 'var(--red)', color: '#fff',
              borderRadius: 10, padding: '1px 6px', fontSize: 11, fontWeight: 700,
            }}>{uncheckedCount}</span>
          )}
        </button>
      </div>

      {/* Transaction list */}
      {grouped.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <div className="empty-title">
            {filterUnchecked ? '未確認の取引はありません' : '取引がありません'}
          </div>
          <div className="empty-desc">
            {filterUnchecked ? 'すべての取引を確認済みです' : '入力タブから支出を記録しましょう'}
          </div>
        </div>
      ) : (
        grouped.map(([key, txs]) => {
          const [ky, km] = key.split('-').map(Number);
          return (
            <div key={key} style={{ marginBottom: 16 }}>
              <div className="section-label">{formatYearMonth(ky, km)}</div>
              <div style={{ background: 'var(--card)', borderRadius: 12, overflow: 'hidden' }}>
                {txs.map((tx, idx) => {
                  const cat = getCatInfo(tx.categoryId);
                  const { pm, pa } = getPayInfo(tx);
                  const isChecked = !!tx.checked;
                  return (
                    <div
                      key={tx.id}
                      style={{
                        display: 'flex', alignItems: 'center', padding: '12px 16px',
                        gap: 12, cursor: 'pointer',
                        borderTop: idx > 0 ? '1px solid var(--sep)' : 'none',
                        opacity: isChecked ? 0.5 : 1,
                        transition: 'opacity 0.2s',
                      }}
                      onClick={() => handleToggle(tx)}
                    >
                      {/* Checkbox */}
                      <div style={{
                        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                        border: `2px solid ${isChecked ? 'var(--blue)' : 'var(--sep)'}`,
                        background: isChecked ? 'var(--blue)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                      }}>
                        {isChecked && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>

                      {/* Category icon */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: `${cat.color}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      }}>{cat.icon}</div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 14, color: 'var(--text)',
                          textDecoration: isChecked ? 'line-through' : 'none',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {tx.memo || cat.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                          {formatDate(tx.date)}
                          {pm && (
                            <span style={{ marginLeft: 6 }}>
                              {pm.icon} {pm.name}{pa ? ` · ${pa.name}` : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <div style={{
                        fontSize: 15, fontWeight: 600,
                        color: isChecked ? 'var(--text3)' : 'var(--red)',
                        textDecoration: isChecked ? 'line-through' : 'none',
                        flexShrink: 0,
                      }}>
                        -¥{formatAmount(tx.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </main>
  );
};

export default ReviewPage;
