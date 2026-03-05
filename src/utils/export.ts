import { Transaction, Category } from '../types';

export const exportToCSV = (
  transactions: Transaction[],
  categories: Category[],
  startDate: string,
  endDate: string,
  filename: string
): void => {
  const filtered = transactions
    .filter((t) => t.date >= startDate && t.date <= endDate && !t.isPersonal)
    .sort((a, b) => a.date.localeCompare(b.date));

  const getCatName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'その他';

  const BOM = '\uFEFF';
  const header = '日付,種別,カテゴリ,金額,メモ\n';
  const rows = filtered
    .map((t) =>
      [
        t.date,
        '支出',
        getCatName(t.categoryId),
        t.amount,
        `"${t.memo.replace(/"/g, '""')}"`,
      ].join(',')
    )
    .join('\n');

  const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const getMonthRange = (year: number, month: number): { start: string; end: string } => {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
};
