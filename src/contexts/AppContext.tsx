import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import {
  doc, collection, onSnapshot, setDoc, updateDoc, deleteDoc,
  query, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
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
  settings: { darkMode: false, monthlyBudget: 0, budgetStartMonth: '' },
  paymentMethods: DEFAULT_PAYMENT_METHODS,
  paymentAccounts: [],
};

const CONFIG_DOC = 'main';

type Action =
  | { type: 'SYNC_CONFIG'; payload: Partial<AppState> }
  | { type: 'SYNC_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'ADD_TRANSACTION';    payload: Omit<Transaction, 'id' | 'createdAt'> & { id?: string; createdAt?: string } }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'TOGGLE_TRANSACTION_CHECKED'; payload: string }
  | { type: 'ADD_CATEGORY';       payload: Omit<Category, 'id'> & { id?: string } }
  | { type: 'UPDATE_CATEGORY';    payload: Category }
  | { type: 'DELETE_CATEGORY';    payload: string }
  | { type: 'SET_BUDGET';         payload: Budget }
  | { type: 'DELETE_BUDGET';      payload: string }
  | { type: 'UPDATE_SETTINGS';    payload: Partial<Settings> }
  | { type: 'ADD_PAYMENT_METHOD';    payload: Omit<PaymentMethod, 'id'> & { id?: string } }
  | { type: 'UPDATE_PAYMENT_METHOD'; payload: PaymentMethod }
  | { type: 'DELETE_PAYMENT_METHOD'; payload: string }
  | { type: 'ADD_PAYMENT_ACCOUNT';    payload: Omit<PaymentAccount, 'id'> & { id?: string } }
  | { type: 'UPDATE_PAYMENT_ACCOUNT'; payload: PaymentAccount }
  | { type: 'DELETE_PAYMENT_ACCOUNT'; payload: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SYNC_CONFIG':
      return { ...state, ...action.payload };

    case 'SYNC_TRANSACTIONS':
      return { ...state, transactions: action.payload };

    case 'ADD_TRANSACTION':
      return {
        ...state,
        transactions: [
          ...state.transactions,
          {
            ...action.payload,
            id: action.payload.id ?? uuidv4(),
            createdAt: action.payload.createdAt ?? new Date().toISOString(),
          },
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

    case 'TOGGLE_TRANSACTION_CHECKED':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.payload ? { ...t, checked: !t.checked } : t
        ),
      };

    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, { ...action.payload, id: action.payload.id ?? uuidv4() }] };

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
      return { ...state, paymentMethods: [...state.paymentMethods, { ...action.payload, id: action.payload.id ?? uuidv4() }] };

    case 'UPDATE_PAYMENT_METHOD':
      return { ...state, paymentMethods: state.paymentMethods.map((p) => p.id === action.payload.id ? action.payload : p) };

    case 'DELETE_PAYMENT_METHOD':
      return { ...state, paymentMethods: state.paymentMethods.filter((p) => p.id !== action.payload) };

    case 'ADD_PAYMENT_ACCOUNT':
      return { ...state, paymentAccounts: [...state.paymentAccounts, { ...action.payload, id: action.payload.id ?? uuidv4() }] };

    case 'UPDATE_PAYMENT_ACCOUNT':
      return { ...state, paymentAccounts: state.paymentAccounts.map((a) => a.id === action.payload.id ? action.payload : a) };

    case 'DELETE_PAYMENT_ACCOUNT':
      return { ...state, paymentAccounts: state.paymentAccounts.filter((a) => a.id !== action.payload) };

    default:
      return state;
  }
}

// ─── Firestore Sync ────────────────────────────────────────────────────────────
async function syncToFirestore(
  action: Action,
  prevState: AppState,
  newState: AppState,
  householdId: string
): Promise<void> {
  const configRef = doc(db, 'households', householdId, 'config', CONFIG_DOC);
  const txCol = collection(db, 'households', householdId, 'transactions');

  const saveConfig = () => setDoc(configRef, {
    categories: newState.categories,
    settings: newState.settings,
    paymentMethods: newState.paymentMethods,
    paymentAccounts: newState.paymentAccounts,
    budgets: newState.budgets,
  });

  switch (action.type) {
    case 'ADD_TRANSACTION': {
      const p = action.payload as Transaction;
      await setDoc(doc(txCol, p.id), p);
      break;
    }
    case 'UPDATE_TRANSACTION':
      await setDoc(doc(txCol, action.payload.id), action.payload);
      break;
    case 'DELETE_TRANSACTION':
      await deleteDoc(doc(txCol, action.payload));
      break;
    case 'TOGGLE_TRANSACTION_CHECKED': {
      const tx = newState.transactions.find((t) => t.id === action.payload);
      if (tx) await updateDoc(doc(txCol, action.payload), { checked: tx.checked ?? false });
      break;
    }
    case 'ADD_CATEGORY':
    case 'UPDATE_CATEGORY':
    case 'DELETE_CATEGORY':
    case 'SET_BUDGET':
    case 'DELETE_BUDGET':
    case 'UPDATE_SETTINGS':
    case 'ADD_PAYMENT_METHOD':
    case 'UPDATE_PAYMENT_METHOD':
    case 'DELETE_PAYMENT_METHOD':
    case 'ADD_PAYMENT_ACCOUNT':
    case 'UPDATE_PAYMENT_ACCOUNT':
    case 'DELETE_PAYMENT_ACCOUNT':
      await saveConfig();
      break;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: (action: Action) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, baseDispatch] = useReducer(reducer, INITIAL_STATE);
  const { householdId } = useAuth();
  const stateRef = useRef(state);
  stateRef.current = state;
  const householdIdRef = useRef(householdId);
  householdIdRef.current = householdId;

  // ─── Firestore real-time listeners ───────────────────────────────────────────
  useEffect(() => {
    if (!householdId) return;

    let destroyed = false;
    let unsubConfig: (() => void) | null = null;
    let unsubTx: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const clearRetry = () => {
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    };

    const unsubscribeAll = () => {
      clearRetry();
      unsubConfig?.(); unsubConfig = null;
      unsubTx?.();     unsubTx     = null;
    };

    const setupListeners = () => {
      if (destroyed) return;

      // ── Config listener ──────────────────────────────────────────────────────
      unsubConfig = onSnapshot(
        doc(db, 'households', householdId, 'config', CONFIG_DOC),
        (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          baseDispatch({
            type: 'SYNC_CONFIG',
            payload: {
              categories: d.categories ?? DEFAULT_CATEGORIES,
              settings: {
                darkMode: false,
                monthlyBudget: 0,
                budgetStartMonth: '',
                ...d.settings,
              },
              paymentMethods: (d.paymentMethods && d.paymentMethods.length > 0)
                ? d.paymentMethods
                : DEFAULT_PAYMENT_METHODS,
              paymentAccounts: d.paymentAccounts ?? [],
              budgets: d.budgets ?? [],
            },
          });
        },
        (err) => {
          console.error('[Firestore] config listener error:', err.code, err.message);
          // Retry subscription after 3 s
          unsubscribeAll();
          if (!destroyed) {
            retryTimer = setTimeout(setupListeners, 3000);
          }
        }
      );

      // ── Transactions listener ─────────────────────────────────────────────────
      // orderBy('createdAt') ensures Firestore returns documents in insertion order
      // and also creates a consistent snapshot for both members.
      const txQuery = query(
        collection(db, 'households', householdId, 'transactions'),
        orderBy('createdAt', 'asc')
      );

      unsubTx = onSnapshot(
        txQuery,
        (snap) => {
          // snap.docs always reflects the current server state (plus local pending writes).
          // Using docChanges() would be more efficient but snap.docs is simpler and correct.
          const txs: Transaction[] = snap.docs.map((d) => ({
            ...(d.data() as Omit<Transaction, 'id'>),
            id: d.id,
          }));
          baseDispatch({ type: 'SYNC_TRANSACTIONS', payload: txs });
        },
        (err) => {
          console.error('[Firestore] transactions listener error:', err.code, err.message);
          // Retry subscription after 3 s
          unsubscribeAll();
          if (!destroyed) {
            retryTimer = setTimeout(setupListeners, 3000);
          }
        }
      );
    };

    setupListeners();

    return () => {
      destroyed = true;
      unsubscribeAll();
    };
  }, [householdId]);

  // ─── Custom dispatch ──────────────────────────────────────────────────────────
  // 1. Enrich the action with pre-generated IDs
  // 2. Apply optimistic local update immediately
  // 3. Persist to Firestore (if write fails, onSnapshot will eventually reconcile)
  const dispatch = useCallback((action: Action) => {
    let enriched = action;
    if (action.type === 'ADD_TRANSACTION' && !action.payload.id) {
      enriched = {
        ...action,
        payload: {
          ...action.payload,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
        },
      };
    } else if (action.type === 'ADD_CATEGORY' && !action.payload.id) {
      enriched = { ...action, payload: { ...action.payload, id: uuidv4() } };
    } else if (action.type === 'ADD_PAYMENT_METHOD' && !action.payload.id) {
      enriched = { ...action, payload: { ...action.payload, id: uuidv4() } };
    } else if (action.type === 'ADD_PAYMENT_ACCOUNT' && !action.payload.id) {
      enriched = { ...action, payload: { ...action.payload, id: uuidv4() } };
    }

    // Optimistic local update — keeps the UI snappy
    baseDispatch(enriched);

    // Persist to Firestore (skip internal sync actions)
    const hid = householdIdRef.current;
    if (hid && enriched.type !== 'SYNC_CONFIG' && enriched.type !== 'SYNC_TRANSACTIONS') {
      const newState = reducer(stateRef.current, enriched);
      syncToFirestore(enriched, stateRef.current, newState, hid).catch((err) => {
        // Write failed — log the error.
        // The onSnapshot listener will reconcile the local state with Firestore on next event.
        console.error('[Firestore] write error:', err.code ?? err.message, enriched.type);
      });
    }
  }, []);

  // ─── Dark mode ────────────────────────────────────────────────────────────────
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
