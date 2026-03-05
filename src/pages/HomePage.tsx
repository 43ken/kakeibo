import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import {
  formatAmount, formatDate, getActiveBudgets, formatYearMonth,
  getMonthTransactions, getEffectiveBudget,
} from '../utils/calculations';
import { Transaction } from '../types';

interface Props {
  onNavigateToInput: (tx?: Transaction) => void;
}

const HomePage: React.FC<Props> = ({ onNavigateToInput }) => {
  const { state, dispatch } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);

  const monthTxsForSummary = getMonthTransactions(state.transactions, year, month);
  const expense = monthTxsForSummary.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const baseMonthlyBudget = state.settings.monthlyBudget;
  const { effectiveBudget: monthlyBudget, carryover } = getEffectiveBudget(state.transactions, baseMonthlyBudget, year, month, state.settings.budgetStartMonth);
  const remaining = monthlyBudget > 0 ? monthlyBudget - expense : null;
  const budgets = getActiveBudgets(state.budgets, state.transactions, state.categories, year, month);
  const overBudgets = budgets.filter(b => b.isOver);
  const warnBudgets = budgets.filter(b => b.isWarning);

  const monthTxs = monthTxsForSummary
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  };

  const getCatInfo = (catId: string) =>
    state.categories.find(c => c.id === catId) ?? { name: 'その他', icon: '📦', color: '#B2BEC3' };

  const getPayInfo = (tx: Transaction) => {
    const pm = state.paymentMethods.find(p => p.id === tx.paymentMethodId);
    const pa = tx.paymentAccountId ? state.paymentAccounts.find(a => a.id === tx.paymentAccountId) : null;
    return { pm, pa };
  };

  const confirmDelete = () => {
    if (deleteTarget) { dispatch({ type: 'DELETE_TRANSACTION', payload: deleteTarget.id }); setDeleteTarget(null); }
  };

  return (
    <main className="page fade-in">
      {/* Month Selector */}
      <div className="month-selector">
        <button className="month-btn" onClick={prevMonth}>‹</button>
        <h2>{formatYearMonth(year, month)}</h2>
        <button className="month-btn" onClick={nextMonth}>›</button>
      </div>

      {/* Summary */}
      <div className="summary-grid">
        <div className="summary-item">
          <div className="summary-label">予算</div>
          <div className="summary-amount" style={{ color: 'var(--blue)', fontSize: 16 }}>
            {baseMonthlyBudget === 0 ? '未設定' : `¥${formatAmount(monthlyBudget)}`}
          </div>
          {carryover !== 0 && baseMonthlyBudget > 0 && (
            <div style={{ fontSize: 10, color: carryover > 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
              {carryover > 0 ? `+¥${formatAmount(carryover)}繰越` : `-¥${formatAmount(Math.abs(carryover))}繰越`}
            </div>
          )}
        </div>
        <div className="summary-item">
          <div className="summary-label">支出</div>
          <div className="summary-amount expense" style={{ fontSize: 16 }}>¥{formatAmount(expense)}</div>
        </div>
        <div className="summary-item">
          <div className="summary-label">残り</div>
          {remaining === null
            ? <div className="summary-amount" style={{ color: 'var(--text3)', fontSize: 14 }}>—</div>
            : <div className={`summary-amount balance ${remaining >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: 16 }}>
                ¥{formatAmount(Math.abs(remaining))}
              </div>
          }
        </div>
      </div>

      {/* 繰越情報 */}
      {carryover !== 0 && baseMonthlyBudget > 0 && (
        <div style={{
          fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginBottom: 8,
          padding: '6px 12px', background: 'var(--card2)', borderRadius: 8,
        }}>
          {carryover > 0
            ? `先月の節約 ¥${formatAmount(carryover)} を繰越（基本予算 ¥${formatAmount(baseMonthlyBudget)}）`
            : `先月の超過 ¥${formatAmount(Math.abs(carryover))} を繰越（基本予算 ¥${formatAmount(baseMonthlyBudget)}）`}
        </div>
      )}

      {/* 予算超過アラート */}
      {remaining !== null && remaining < 0 && (
        <div className="budget-alert" style={{ marginBottom: 12 }}>
          <span>⚠️</span>
          <span>今月の予算を <strong>¥{formatAmount(Math.abs(remaining))}</strong> 超過しています</span>
        </div>
      )}
      {remaining !== null && remaining >= 0 && remaining < monthlyBudget * 0.1 && (
        <div className="budget-alert" style={{ borderColor: 'var(--orange)', background: 'rgba(255,149,0,0.08)', color: 'var(--orange)', marginBottom: 12 }}>
          <span>⚡</span>
          <span>予算残り <strong>¥{formatAmount(remaining)}</strong>（{Math.round((remaining / monthlyBudget) * 100)}%）</span>
        </div>
      )}

      {/* カテゴリ別予算アラート */}
      {overBudgets.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {overBudgets.map(b => (
            <div key={b.categoryId} className="budget-alert">
              <span>⚠️</span>
              <span><strong>{b.cat.icon} {b.cat.name}</strong> の予算を超過しています（{Math.round(b.percentage)}%使用）</span>
            </div>
          ))}
        </div>
      )}
      {warnBudgets.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {warnBudgets.map(b => (
            <div key={b.categoryId} className="budget-alert" style={{ borderColor: 'var(--orange)', background: 'rgba(255,149,0,0.08)', color: 'var(--orange)' }}>
              <span>⚡</span>
              <span><strong>{b.cat.icon} {b.cat.name}</strong> の予算が残りわずかです（{Math.round(b.percentage)}%使用）</span>
            </div>
          ))}
        </div>
      )}

      {/* 予算進捗 */}
      {budgets.length > 0 && (
        <>
          <div className="section-label">予算状況</div>
          <div style={{ marginBottom: 12 }}>
            {budgets.map(b => {
              const pct = Math.min(b.percentage, 100);
              const color = b.isOver ? 'var(--red)' : b.isWarning ? 'var(--orange)' : 'var(--green)';
              return (
                <div key={b.categoryId} className="budget-item">
                  <div className="budget-header">
                    <span className="budget-cat">{b.cat.icon} {b.cat.name}</span>
                    <span className="budget-amounts">¥{formatAmount(b.spent)} / ¥{formatAmount(b.monthlyLimit)}</span>
                  </div>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 取引履歴 */}
      <div className="section-label">取引履歴</div>
      {monthTxs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <div className="empty-title">取引がありません</div>
          <div className="empty-desc">下の「＋」ボタンから収支を入力しましょう</div>
        </div>
      ) : (
        <div className="tx-list">
          {monthTxs.map(tx => {
            const cat = getCatInfo(tx.categoryId);
            const { pm, pa } = getPayInfo(tx);
            return (
              <div key={tx.id} className="tx-item" onClick={() => onNavigateToInput(tx)}>
                <div className="tx-icon" style={{ background: `${cat.color}20` }}>{cat.icon}</div>
                <div className="tx-info">
                  <div className="tx-name">
                    {cat.name}
                    {tx.isPersonal && <span className="tx-personal-badge">個人</span>}
                    {tx.memo ? ` · ${tx.memo}` : ''}
                  </div>
                  <div className="tx-date">
                    {formatDate(tx.date)}
                    {pm && (
                      <span style={{
                        marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 8,
                        background: 'var(--card2)', color: 'var(--text3)',
                      }}>
                        {pm.icon} {pm.name}{pa ? ` · ${pa.name}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`tx-amount ${tx.type}`}>-¥{formatAmount(tx.amount)}</div>
                <button
                  style={{ border: 'none', background: 'none', color: 'var(--red)', fontSize: 20, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(tx); }}
                  aria-label="削除"
                >×</button>
              </div>
            );
          })}
        </div>
      )}

      {/* 削除確認 */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">この取引を削除しますか？</div>
            <div style={{ textAlign: 'center', color: 'var(--text2)', marginBottom: 24, fontSize: 14 }}>
              {getCatInfo(deleteTarget.categoryId).icon} {getCatInfo(deleteTarget.categoryId).name}・
              ¥{formatAmount(deleteTarget.amount)}・{formatDate(deleteTarget.date)}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>キャンセル</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmDelete}>削除</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default HomePage;
