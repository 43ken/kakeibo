import React, { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { formatAmount, formatYearMonth } from '../utils/calculations';
import { Transaction } from '../types';

const WEEK_DAYS = ['日', '月', '火', '水', '木', '金', '土'];

const CalendarPage: React.FC = () => {
  const { state } = useApp();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  // Build daily expense map (personal excluded)
  const dayData: Record<number, { total: number; txs: Transaction[] }> = {};
  state.transactions.forEach((tx) => {
    if (tx.isPersonal) return;
    const [y, m, d] = tx.date.split('-').map(Number);
    if (y !== year || m !== month) return;
    if (!dayData[d]) dayData[d] = { total: 0, txs: [] };
    dayData[d].total += tx.amount;
    dayData[d].txs.push(tx);
  });

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // Build grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const getDateStr = (d: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const monthTotal = Object.values(dayData).reduce((s, d) => s + d.total, 0);

  // Selected day data
  const selectedTxs = selectedDate
    ? (state.transactions.filter((tx) => tx.date === selectedDate && !tx.isPersonal))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const selectedTotal = selectedTxs.reduce((s, t) => s + t.amount, 0);
  const selectedDayNum = selectedDate ? parseInt(selectedDate.split('-')[2]) : 0;

  const getCatInfo = (catId: string) =>
    state.categories.find((c) => c.id === catId) ?? { name: 'その他', icon: '📦', color: '#B2BEC3' };

  const getPayInfo = (tx: Transaction) => {
    const pm = state.paymentMethods.find(p => p.id === tx.paymentMethodId);
    const pa = tx.paymentAccountId ? state.paymentAccounts.find(a => a.id === tx.paymentAccountId) : null;
    return { pm, pa };
  };

  return (
    <main className="page fade-in">
      {/* Month Selector */}
      <div className="month-selector">
        <button className="month-btn" onClick={prevMonth}>‹</button>
        <h2>{formatYearMonth(year, month)}</h2>
        <button className="month-btn" onClick={nextMonth}>›</button>
      </div>

      {/* Monthly summary */}
      <div style={{ textAlign: 'center', marginBottom: 12, fontSize: 13, color: 'var(--text3)' }}>
        今月の合計支出:{' '}
        <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 15 }}>
          ¥{formatAmount(monthTotal)}
        </span>
      </div>

      {/* Calendar grid */}
      <div className="card" style={{ padding: '12px 8px' }}>
        {/* Week day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {WEEK_DAYS.map((d, i) => (
            <div
              key={d}
              style={{
                textAlign: 'center', fontSize: 12, fontWeight: 600,
                color: i === 0 ? 'var(--red)' : i === 6 ? 'var(--blue)' : 'var(--text3)',
                padding: '2px 0',
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} style={{ minHeight: 52 }} />;

            const data = dayData[day];
            const dateStr = getDateStr(day);
            const isToday = dateStr === todayStr;
            const isSelected = selectedDate === dateStr;
            const col = (firstDayOfWeek + day - 1) % 7; // 0=Sun, 6=Sat
            const isWeekend = col === 0 || col === 6;

            return (
              <div
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '4px 2px', borderRadius: 8, cursor: 'pointer',
                  background: isSelected
                    ? 'var(--blue)'
                    : isToday
                    ? 'rgba(0,122,255,0.1)'
                    : data
                    ? 'rgba(255,59,48,0.06)'
                    : 'transparent',
                  minHeight: 52,
                  transition: 'background 0.15s',
                }}
              >
                <div
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: isToday ? 700 : 400,
                    color: isSelected
                      ? '#fff'
                      : isToday
                      ? 'var(--blue)'
                      : col === 0
                      ? 'var(--red)'
                      : col === 6
                      ? 'var(--blue)'
                      : 'var(--text)',
                  }}
                >
                  {day}
                </div>
                {data && data.total > 0 && (
                  <div
                    style={{
                      fontSize: 9, fontWeight: 600, marginTop: 2, lineHeight: 1,
                      textAlign: 'center', overflow: 'hidden', maxWidth: '100%',
                      color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--red)',
                    }}
                  >
                    {data.total >= 10000
                      ? `${(data.total / 10000).toFixed(1)}万`
                      : `¥${formatAmount(data.total)}`}
                  </div>
                )}
                {!isWeekend && !isToday && !data && (
                  <div style={{ flex: 1 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="card" style={{ marginTop: 12 }}>
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: selectedTxs.length > 0 ? 10 : 0,
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              {selectedDayNum}日の支出
            </span>
            <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: 15 }}>
              {selectedTxs.length > 0 ? `¥${formatAmount(selectedTotal)}` : ''}
            </span>
          </div>

          {selectedTxs.length === 0 ? (
            <div
              style={{
                color: 'var(--text3)', fontSize: 14,
                textAlign: 'center', padding: '12px 0',
              }}
            >
              支出はありません
            </div>
          ) : (
            selectedTxs.map((tx) => {
              const cat = getCatInfo(tx.categoryId);
              const { pm } = getPayInfo(tx);
              return (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0',
                    borderBottom: '0.5px solid var(--sep)',
                  }}
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: `${cat.color}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, flexShrink: 0,
                    }}
                  >
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cat.name}{tx.memo ? ` · ${tx.memo}` : ''}
                      {pm && (
                        <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>
                          {pm.icon}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ color: 'var(--red)', fontWeight: 600, fontSize: 15, flexShrink: 0 }}>
                    -¥{formatAmount(tx.amount)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </main>
  );
};

export default CalendarPage;
