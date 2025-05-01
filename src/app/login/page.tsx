"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "~/lib/auth-context";
import Strings from "~/constants/strings";

export default function Login() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push("/");
    }
  }, [user, loading, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 text-gray-800">
        <h1 className="text-5xl font-medium tracking-tight sm:text-[5rem]">
          {Strings.appName.split(" ")[0]}{" "}
          <span className="text-blue-600">{Strings.appName.split(" ")[1]}</span>
        </h1>
        <div className="max-w-md text-center">
          <p className="mb-8 text-xl text-gray-600">{Strings.appTagline}</p>
          <button
            onClick={signInWithGoogle}
            className="rounded-md bg-blue-500 px-10 py-3 font-medium text-white shadow-sm transition hover:bg-blue-600"
          >
            {Strings.signInWithGoogle}
          </button>
        </div>
      </div>
    </div>
  );
}
