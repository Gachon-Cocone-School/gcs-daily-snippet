"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/lib/auth-context";
import Strings from "~/constants/strings";

export default function Login() {
  const {
    user,
    loading,
    authorized,
    authChecking,
    authError,
    signInWithGoogle,
  } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 사용자가 로그인되어 있고, 인증되었을 때만 메인 페이지로 이동
    if (user && !loading && authorized === true) {
      router.push("/");
    }
  }, [user, loading, authorized, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 text-gray-800">
        <h1 className="text-5xl font-medium tracking-tight sm:text-[5rem]">
          {Strings.appName.split(" ")[0]}{" "}
          <span className="text-blue-600">{Strings.appName.split(" ")[1]}</span>
        </h1>
        <div className="max-w-md text-center">
          <p className="mb-8 text-xl text-gray-600">{Strings.appTagline}</p>

          {/* 인증 상태에 따른 메시지 표시 */}
          {user && authorized === false && (
            <div className="mb-6 rounded-md bg-red-100 p-4 text-red-700">
              {Strings.notAuthorized}
            </div>
          )}

          {authError && (
            <div className="mb-6 rounded-md bg-red-100 p-4 text-red-700">
              {authError}
            </div>
          )}

          {/* 로그인 버튼 또는 로딩 상태 표시 */}
          {!user ? (
            <button
              onClick={signInWithGoogle}
              className="rounded-md bg-blue-500 px-10 py-3 font-medium text-white shadow-sm transition hover:bg-blue-600 disabled:bg-blue-300"
              disabled={authChecking}
            >
              {authChecking ? Strings.authChecking : Strings.signInWithGoogle}
            </button>
          ) : authorized === false ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-gray-500">{Strings.memberOnly}</p>
              <button
                onClick={signInWithGoogle}
                className="rounded-md bg-blue-500 px-10 py-3 font-medium text-white shadow-sm transition hover:bg-blue-600 disabled:bg-blue-300"
                disabled={authChecking}
              >
                {Strings.signInWithGoogle}
              </button>
            </div>
          ) : (
            <div className="rounded-md bg-gray-100 px-10 py-3 text-gray-600">
              {Strings.authChecking}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
