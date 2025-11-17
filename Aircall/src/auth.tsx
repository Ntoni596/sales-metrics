import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth } from "./firebase";
import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  getIdTokenResult,
} from "firebase/auth";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          const token = await getIdTokenResult(u, true);
          setIsAdmin(!!token.claims.admin);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      isAdmin,
      async signIn(email: string, password: string) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async resetPassword(email: string) {
        await sendPasswordResetEmail(auth, email);
      },
      async signOut() {
        await fbSignOut(auth);
      },
    }),
    [user, loading, isAdmin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
