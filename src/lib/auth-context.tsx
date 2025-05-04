"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, googleProvider, db } from "~/lib/firebase";
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import Strings from "~/constants/strings";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authorized: boolean | null;
  authChecking: boolean;
  authError: string | null;
  teamName: string | null; // Add teamName to context
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
  const [teamName, setTeamName] = useState<string | null>(null); // Add teamName state

  // 사용자 이메일이 허용 목록에 등록되어 있는지 확인
  const checkUserAuthorization = async (user: User) => {
    if (!user.email) return false;

    setAuthChecking(true);
    setAuthError(null);

    try {
      // NEXT_PUBLIC_ALLOW_LIST 환경 변수에서 허용된 이메일 목록 가져오기
      const allowList = process.env.NEXT_PUBLIC_ALLOW_LIST ?? "";
      const allowedEmails = allowList.split(",").map((email) => email.trim());

      // 사용자 이메일이 목록에 있는지 확인
      const isAuthorized = allowedEmails.includes(user.email);
      setAuthorized(isAuthorized);
      return isAuthorized;
    } catch (error) {
      console.error("Error checking user authorization:", error);
      setAuthError(Strings.authError);
      setAuthorized(false);
      return false;
    } finally {
      setAuthChecking(false);
    }
  };

  // 사용자 정보를 Firestore의 users 컬렉션에 저장
  const saveUserToFirestore = async (user: User) => {
    if (!user) return;

    try {
      // users 컬렉션에 사용자 문서 생성 또는 업데이트
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          lastLogin: new Date(),
        },
        { merge: true }, // merge: true를 사용하면 문서가 이미 존재할 경우 병합됩니다
      );
      console.log("User info saved to Firestore");
    } catch (error) {
      console.error("Error saving user to Firestore:", error);
    }
  };

  // Find the user's team based on their email
  const findUserTeam = async (userEmail: string | null) => {
    if (!userEmail) return null;

    try {
      // Query the teams collection for documents where the emails array contains the user's email
      const teamsQuery = query(
        collection(db, "teams"),
        where("emails", "array-contains", userEmail),
      );

      const teamsSnapshot = await getDocs(teamsQuery);

      // If we found a matching team, get its name
      if (!teamsSnapshot.empty && teamsSnapshot.docs[0]) {
        const teamDoc = teamsSnapshot.docs[0]; // Take the first matching team
        const teamData = teamDoc.data();
        const userTeamName = teamData.teamName as string;
        setTeamName(userTeamName);

        console.log(`Found team for user: ${userTeamName}`);
        return userTeamName;
      } else {
        console.log("No team found for user");
        setTeamName(null);
        return null;
      }
    } catch (error) {
      console.error("Error finding user team:", error);
      setTeamName(null);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);

      if (user) {
        // 사용자가 로그인했을 때 인증 확인
        void checkUserAuthorization(user);
        // 사용자 정보를 Firestore에 저장
        void saveUserToFirestore(user);
        // Find the user's team
        void findUserTeam(user.email);
      } else {
        setAuthorized(null);
        setTeamName(null);
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
        await saveUserToFirestore(result.user); // Firestore에 사용자 정보 저장
        await findUserTeam(result.user.email); // Find the user's team
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
        teamName,
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
