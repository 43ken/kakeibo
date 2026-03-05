import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, googleProvider } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';

interface AuthContextValue {
  user: User | null;
  householdId: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  createHousehold: () => Promise<string>;
  joinHousehold: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Generate a short 6-character uppercase invite code
function genCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Check if user has a household
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists() && userDoc.data().householdId) {
          setHouseholdId(userDoc.data().householdId);
        } else {
          setHouseholdId(null);
        }
      } else {
        setHouseholdId(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setHouseholdId(null);
  };

  const createHousehold = async (): Promise<string> => {
    if (!user) throw new Error('Not logged in');
    const householdId = uuidv4();
    const inviteCode = genCode();

    // Create household document
    await setDoc(doc(db, 'households', householdId), {
      members: [user.uid],
      inviteCode,
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
    });

    // Create default config
    await setDoc(doc(db, 'households', householdId, 'config', 'main'), {
      categories: [
        { id: 'food', name: '食費', icon: '🍽️', color: '#FF6B6B', type: 'expense' },
        { id: 'living', name: '日用品', icon: '🛒', color: '#45B7D1', type: 'expense' },
      ],
      settings: { darkMode: false, monthlyBudget: 0, budgetStartMonth: '' },
      paymentMethods: [
        { id: 'cash',    name: '現金',    icon: '💴', isCash: true  },
        { id: 'paypay',  name: 'PayPay',  icon: '📱', isCash: false },
        { id: 'quicpay', name: 'QUICPay', icon: '📲', isCash: false },
        { id: 'credit',  name: 'クレカ',  icon: '💳', isCash: false },
      ],
      paymentAccounts: [],
      budgets: [],
    });

    // Register invite code
    await setDoc(doc(db, 'inviteCodes', inviteCode), {
      householdId,
      createdAt: new Date().toISOString(),
    });

    // Save householdId to user profile
    await setDoc(doc(db, 'users', user.uid), {
      householdId,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
    });

    setHouseholdId(householdId);
    return inviteCode;
  };

  const joinHousehold = async (code: string): Promise<void> => {
    if (!user) throw new Error('Not logged in');
    const upperCode = code.trim().toUpperCase();
    const codeDoc = await getDoc(doc(db, 'inviteCodes', upperCode));
    if (!codeDoc.exists()) throw new Error('招待コードが見つかりません');

    const hid = codeDoc.data().householdId;

    // Add user to household members
    await updateDoc(doc(db, 'households', hid), {
      members: arrayUnion(user.uid),
    });

    // Save to user profile
    await setDoc(doc(db, 'users', user.uid), {
      householdId: hid,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
    });

    setHouseholdId(hid);
  };

  return (
    <AuthContext.Provider value={{ user, householdId, loading, signInWithGoogle, signOut, createHousehold, joinHousehold }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
