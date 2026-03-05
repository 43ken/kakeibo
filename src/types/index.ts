export type TransactionType = 'expense';
export type Page = 'home' | 'input' | 'calendar' | 'charts' | 'settings';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'expense';
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  isCash: boolean;
}

export interface PaymentAccount {
  id: string;
  name: string;
  color: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  categoryId: string;
  amount: number;
  memo: string;
  isPersonal: boolean;
  paymentMethodId: string;
  paymentAccountId?: string;
  createdAt: string;
}

export interface Budget {
  categoryId: string;
  monthlyLimit: number;
}

export interface Settings {
  darkMode: boolean;
  monthlyBudget: number;
}

export interface AppState {
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  settings: Settings;
  paymentMethods: PaymentMethod[];
  paymentAccounts: PaymentAccount[];
}

export interface CategoryExpense {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
}
