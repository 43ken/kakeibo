import { Transaction, Category, Budget, CategoryExpense } from '../types';

export const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('ja-JP').format(amount);
};

export const formatDate = (dateStr: string): string => {
  const [, month, day] = dateStr.split('-');
  return `${parseInt(month)}/${parseInt(day)}`;
};

export const formatYearMonth = (year: number, month: number): string => {
  return `${year}年${month}月`;
};

export const getToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const getMonthTransactions = (
  transactions: Transaction[],
  year: number,
  month: number,
  excludePersonal = true
): Transaction[] => {
  return transactions.filter((t) => {
    const [y, m] = t.date.split('-').map(Number);
    const matchesMonth = y === year && m === month;
    if (excludePersonal) return matchesMonth && !t.isPersonal;
    return matchesMonth;
  });
};


export const getCategoryExpenses = (
  transactions: Transaction[],
  categories: Category[],
  year: number,
  month: number
): CategoryExpense[] => {
  const txs = getMonthTransactions(transactions, year, month).filter(
    (t) => t.type === 'expense'
  );
  const map = new Map<string, number>();
  txs.forEach((t) => {
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
  });
  return Array.from(map.entries())
    .map(([id, amount]) => {
      const cat = categories.find((c) => c.id === id);
      return cat
        ? { categoryId: id, name: cat.name, icon: cat.icon, color: cat.color, amount }
        : null;
    })
    .filter(Boolean) as CategoryExpense[];
};

export const getCategorySpent = (
  transactions: Transaction[],
  year: number,
  month: number,
  categoryId: string
): number => {
  return getMonthTransactions(transactions, year, month)
    .filter((t) => t.type === 'expense' && t.categoryId === categoryId)
    .reduce((sum, t) => sum + t.amount, 0);
};

export const getBudgetStatus = (
  spent: number,
  limit: number
): { percentage: number; isOver: boolean; isWarning: boolean } => {
  if (limit <= 0) return { percentage: 0, isOver: false, isWarning: false };
  const percentage = (spent / limit) * 100;
  return {
    percentage,
    isOver: percentage >= 100,
    isWarning: percentage >= 80 && percentage < 100,
  };
};

export const getLast6Months = (): { year: number; month: number; label: string }[] => {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${d.getMonth() + 1}月`,
    });
  }
  return result;
};

export const getActiveBudgets = (
  budgets: Budget[],
  transactions: Transaction[],
  categories: Category[],
  year: number,
  month: number
) => {
  return budgets
    .map((b) => {
      const cat = categories.find((c) => c.id === b.categoryId);
      if (!cat) return null;
      const spent = getCategorySpent(transactions, year, month, b.categoryId);
      const status = getBudgetStatus(spent, b.monthlyLimit);
      return { ...b, cat, spent, ...status };
    })
    .filter(Boolean) as {
    categoryId: string;
    monthlyLimit: number;
    cat: Category;
    spent: number;
    percentage: number;
    isOver: boolean;
    isWarning: boolean;
  }[];
};

export const getEffectiveBudget = (
  transactions: Transaction[],
  monthlyBudget: number,
  year: number,
  month: number
): { effectiveBudget: number; carryover: number } => {
  if (monthlyBudget <= 0) return { effectiveBudget: 0, carryover: 0 };
  const lastYear = month === 1 ? year - 1 : year;
  const lastMonth = month === 1 ? 12 : month - 1;
  const lastMonthSpent = getMonthTransactions(transactions, lastYear, lastMonth)
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const carryover = monthlyBudget - lastMonthSpent;
  return { effectiveBudget: monthlyBudget + carryover, carryover };
};
