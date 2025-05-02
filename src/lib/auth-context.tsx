"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, googleProvider, db } from "~/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import Strings from "~/constants/strings";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authorized: boolean | null;
  authChecking: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [authChecking, setAuthChecking] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // 사용자 이메일이 members 컬렉션에 등록되어 있는지 확인
  const checkUserAuthorization = async (user: User) => {
    if (!user.email) return false;

    setAuthChecking(true);
    setAuthError(null);

    try {
      const membersRef = collection(db, "members");
      const q = query(membersRef, where("email", "==", user.email));
      const querySnapshot = await getDocs(q);

      const isAuthorized = !querySnapshot.empty;
      setAuthorized(isAuthorized);
      return isAuthorized;
    } catch (error) {
      console.error("Error checking member authorization:", error);
      setAuthError(Strings.authError);
      setAuthorized(false);
      return false;
    } finally {
      setAuthChecking(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);

      if (user) {
        // 사용자가 로그인했을 때 인증 확인
        void checkUserAuthorization(user);
      } else {
        setAuthorized(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      setAuthChecking(true);
      const result = await signInWithPopup(auth, googleProvider);

      // 로그인 성공 후 인증 확인
      if (result.user) {
        await checkUserAuthorization(result.user);
      }
    } catch (error) {
      console.error("Error signing in with Google", error);
      setAuthError(Strings.authError);
    } finally {
      setAuthChecking(false);
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
      setAuthorized(null);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authorized,
        authChecking,
        authError,
        signInWithGoogle,
        logOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
