import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, PieChart, Pie, Cell,
} from 'recharts';
import { useApp } from '../contexts/AppContext';
import {
  getCategoryExpenses, getLast6Months, formatAmount, formatYearMonth,
  getMonthTransactions, getEffectiveBudget,
} from '../utils/calculations';

const ChartsPage: React.FC = () => {
  const { state } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const baseMonthlyBudget = state.settings.monthlyBudget;
  const { effectiveBudget: monthlyBudget, carryover } = getEffectiveBudget(state.transactions, baseMonthlyBudget, year, month);

  const last6 = getLast6Months();
  const barData = last6.map(({ year: y, month: m, label }) => {
    const txs = getMonthTransactions(state.transactions, y, m);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { label, expense };
  });

  const catExpenses = getCategoryExpenses(state.transactions, state.categories, year, month)
    .filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const totalExpense = catExpenses.reduce((s, c) => s + c.amount, 0);

  const isDark = state.settings.darkMode;
  const gridColor = isDark ? '#38383A' : '#E5E5EA';
  const textColor = '#8E8E93';

  const formatYAxis = (v: number) => v >= 10000 ? `${v / 10000}万` : v > 0 ? `${v / 1000}k` : '0';

  const BarTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--card)', border: '0.5px solid var(--sep)', borderRadius: 10, padding: '8px 12px', fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div style={{ color: 'var(--red)' }}>支出: ¥{formatAmount(payload[0].value)}</div>
        {monthlyBudget > 0 && (
          <div style={{ color: 'var(--blue)', marginTop: 2 }}>
            予算: ¥{formatAmount(monthlyBudget)}（残 ¥{formatAmount(Math.max(monthlyBudget - payload[0].value, 0))}）
          </div>
        )}
      </div>
    );
  };

  const PieTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: 'var(--card)', border: '0.5px solid var(--sep)', borderRadius: 10, padding: '8px 12px', fontSize: 13 }}>
        <div style={{ fontWeight: 600 }}>{payload[0].name}</div>
        <div>¥{formatAmount(payload[0].value)}</div>
      </div>
    );
  };

  const currentTxs = getMonthTransactions(state.transactions, year, month);
  const currentExpense = currentTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const remaining = monthlyBudget > 0 ? monthlyBudget - currentExpense : null;
  const usagePct = monthlyBudget > 0 ? Math.min((currentExpense / monthlyBudget) * 100, 100) : 0;
  const barColor = remaining !== null && remaining < 0 ? 'var(--red)' : remaining !== null && remaining < monthlyBudget * 0.2 ? 'var(--orange)' : 'var(--green)';

  return (
    <main className="page fade-in">
      <div className="month-selector">
        <button className="month-btn" onClick={prevMonth}>‹</button>
        <h2>{formatYearMonth(year, month)}</h2>
        <button className="month-btn" onClick={nextMonth}>›</button>
      </div>

      {/* 予算進捗 */}
      {monthlyBudget > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>今月の予算進捗</span>
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>
              ¥{formatAmount(currentExpense)} / ¥{formatAmount(monthlyBudget)}
            </span>
          </div>
          {carryover !== 0 && baseMonthlyBudget > 0 && (
            <div style={{ fontSize: 11, color: carryover > 0 ? 'var(--green)' : 'var(--red)', marginBottom: 8 }}>
              {carryover > 0
                ? `先月節約 +¥${formatAmount(carryover)} 繰越（基本予算 ¥${formatAmount(baseMonthlyBudget)}）`
                : `先月超過 -¥${formatAmount(Math.abs(carryover))} 繰越（基本予算 ¥${formatAmount(baseMonthlyBudget)}）`}
            </div>
          )}
          <div className="progress-bar-bg" style={{ height: 10, borderRadius: 5 }}>
            <div className="progress-bar-fill" style={{ width: `${usagePct}%`, background: barColor, height: 10, borderRadius: 5 }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13 }}>
            <span style={{ color: 'var(--text3)' }}>使用率 {Math.round(usagePct)}%</span>
            <span style={{ color: remaining !== null && remaining < 0 ? 'var(--red)' : 'var(--text2)', fontWeight: 600 }}>
              {remaining !== null
                ? remaining >= 0 ? `残り ¥${formatAmount(remaining)}` : `超過 ¥${formatAmount(Math.abs(remaining))}`
                : ''}
            </span>
          </div>
        </div>
      )}

      {/* 月別棒グラフ */}
      <div className="chart-container">
        <div className="chart-title">📊 月別支出（直近6ヶ月）</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: textColor }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: textColor }} axisLine={false} tickLine={false} />
            <Tooltip content={<BarTooltip />} />
            {monthlyBudget > 0 && (
              <ReferenceLine y={monthlyBudget} stroke="var(--blue)" strokeDasharray="6 3" strokeWidth={1.5}
                label={{ value: '予算', fill: 'var(--blue)', fontSize: 10, position: 'insideTopRight' }} />
            )}
            <Bar dataKey="expense" name="支出" fill="var(--red)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
        {monthlyBudget > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--red)' }} /> 支出
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
              <div style={{ width: 16, height: 2, background: 'var(--blue)', borderRadius: 1 }} /> 予算ライン
            </div>
          </div>
        )}
      </div>

      {/* カテゴリ別円グラフ */}
      <div className="chart-container">
        <div className="chart-title">🥧 カテゴリ別支出</div>
        {catExpenses.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <div className="empty-icon">📊</div>
            <div className="empty-desc">支出データがありません</div>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={catExpenses} dataKey="amount" nameKey="name" cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {catExpenses.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ textAlign: 'center', marginTop: -4, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>合計支出</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--red)' }}>¥{formatAmount(totalExpense)}</div>
            </div>
            <div className="legend-list">
              {catExpenses.map(c => (
                <div key={c.categoryId} className="legend-item">
                  <div className="legend-dot" style={{ background: c.color }} />
                  <span style={{ fontSize: 16 }}>{c.icon}</span>
                  <span className="legend-name">{c.name}</span>
                  <span className="legend-amount">¥{formatAmount(c.amount)}</span>
                  <span style={{ fontSize: 12, color: 'var(--text3)', width: 38, textAlign: 'right' }}>
                    {totalExpense > 0 ? Math.round((c.amount / totalExpense) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
};

export default ChartsPage;
