import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { AppState, Transaction, Category, Budget, Settings, PaymentMethod, PaymentAccount } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: '食費', icon: '🍽️', color: '#FF6B6B', type: 'expense' },
  { id: 'living', name: '日用品', icon: '🛒', color: '#45B7D1', type: 'expense' },
];

export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'cash',    name: '現金',    icon: '💴', isCash: true  },
  { id: 'paypay',  name: 'PayPay',  icon: '📱', isCash: false },
  { id: 'quicpay', name: 'QUICPay', icon: '📲', isCash: false },
  { id: 'credit',  name: 'クレカ',  icon: '💳', isCash: false },
];

const INITIAL_STATE: AppState = {
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  budgets: [],
  settings: { darkMode: false, monthlyBudget: 0 },
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  paymentAccounts: [],
};

const STORAGE_KEY = 'kakeibo_v4';

type Action =
  | { type: 'LOAD'; payload: AppState }
  | { type: 'ADD_TRANSACTION';    payload: Omit<Transaction, 'id' | 'createdAt'> }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'ADD_CATEGORY';       payload: Omit<Category, 'id'> }
  | { type: 'UPDATE_CATEGORY';    payload: Category }
  | { type: 'DELETE_CATEGORY';    payload: string }
  | { type: 'SET_BUDGET';         payload: Budget }
  | { type: 'DELETE_BUDGET';      payload: string }
  | { type: 'UPDATE_SETTINGS';    payload: Partial<Settings> }
  | { type: 'ADD_PAYMENT_METHOD';    payload: Omit<PaymentMethod, 'id'> }
  | { type: 'UPDATE_PAYMENT_METHOD'; payload: PaymentMethod }
  | { type: 'DELETE_PAYMENT_METHOD'; payload: string }
  | { type: 'ADD_PAYMENT_ACCOUNT';    payload: Omit<PaymentAccount, 'id'> }
  | { type: 'UPDATE_PAYMENT_ACCOUNT'; payload: PaymentAccount }
  | { type: 'DELETE_PAYMENT_ACCOUNT'; payload: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD': {
      const pm = action.payload.paymentMethods ?? DEFAULT_PAYMENT_METHODS;
      return {
        ...action.payload,
        settings: {
          darkMode: action.payload.settings?.darkMode ?? false,
          monthlyBudget: action.payload.settings?.monthlyBudget ?? 0,
        },
        categories: action.payload.categories
          .filter((c) => c.type === 'expense')
          .map((c) => c.id === 'living' && c.name === '生活費' ? { ...c, name: '日用品', icon: '🛒' } : c),
        paymentMethods: pm.length > 0 ? pm : DEFAULT_PAYMENT_METHODS,
        paymentAccounts: action.payload.paymentAccounts ?? [],
        transactions: action.payload.transactions.map((t) => ({
          ...t,
          paymentMethodId: (t as Transaction).paymentMethodId ?? 'cash',
        })),
      };
    }

    case 'ADD_TRANSACTION':
      return {
        ...state,
        transactions: [
          ...state.transactions,
          { ...action.payload, id: uuidv4(), createdAt: new Date().toISOString() },
        ],
      };

    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };

    case 'DELETE_TRANSACTION':
      return { ...state, transactions: state.transactions.filter((t) => t.id !== action.payload) };

    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, { ...action.payload, id: uuidv4() }] };

    case 'UPDATE_CATEGORY':
      return { ...state, categories: state.categories.map((c) => c.id === action.payload.id ? action.payload : c) };

    case 'DELETE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.payload),
        budgets: state.budgets.filter((b) => b.categoryId !== action.payload),
      };

    case 'SET_BUDGET': {
      const exists = state.budgets.find((b) => b.categoryId === action.payload.categoryId);
      return {
        ...state,
        budgets: exists
          ? state.budgets.map((b) => b.categoryId === action.payload.categoryId ? action.payload : b)
          : [...state.budgets, action.payload],
      };
    }

    case 'DELETE_BUDGET':
      return { ...state, budgets: state.budgets.filter((b) => b.categoryId !== action.payload) };

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };

    case 'ADD_PAYMENT_METHOD':
      return { ...state, paymentMethods: [...state.paymentMethods, { ...action.payload, id: uuidv4() }] };

    case 'UPDATE_PAYMENT_METHOD':
      return { ...state, paymentMethods: state.paymentMethods.map((p) => p.id === action.payload.id ? action.payload : p) };

    case 'DELETE_PAYMENT_METHOD':
      return { ...state, paymentMethods: state.paymentMethods.filter((p) => p.id !== action.payload) };

    case 'ADD_PAYMENT_ACCOUNT':
      return { ...state, paymentAccounts: [...state.paymentAccounts, { ...action.payload, id: uuidv4() }] };

    case 'UPDATE_PAYMENT_ACCOUNT':
      return { ...state, paymentAccounts: state.paymentAccounts.map((a) => a.id === action.payload.id ? action.payload : a) };

    case 'DELETE_PAYMENT_ACCOUNT':
      return { ...state, paymentAccounts: state.paymentAccounts.filter((a) => a.id !== action.payload) };

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  // 初回マウント時のINITIAL_STATEによる上書きを防ぐフラグ
  const isLoadedRef = React.useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        dispatch({ type: 'LOAD', payload: JSON.parse(raw) });
      } else {
        // データなし（初回起動）→ 今すぐ保存してよい
        isLoadedRef.current = true;
      }
    } catch {
      isLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    // LOADが完了するまで保存しない（初回INITIAL_STATEの上書きを防止）
    if (!isLoadedRef.current) {
      isLoadedRef.current = true;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.darkMode ? 'dark' : 'light');
  }, [state.settings.darkMode]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
