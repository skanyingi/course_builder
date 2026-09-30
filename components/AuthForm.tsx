"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

type Mode = "login" | "register";

const GITHUB_ENABLED = Boolean(process.env.NEXT_PUBLIC_GITHUB_ENABLED);

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isRegister = mode === "register";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function callbackUrl() {
    if (typeof window === "undefined") return "/dashboard";
    return new URLSearchParams(window.location.search).get("callbackUrl") ?? "/dashboard";
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      if (isRegister) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? "Could not create your account.");
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: callbackUrl(),
      });

      if (result?.error) {
        throw new Error(
          isRegister
            ? "Account created, but sign-in failed. Try signing in."
            : "Incorrect email or password.",
        );
      }

      router.push(result?.url ?? callbackUrl());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">
          {isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm text-ink-600">
          {isRegister
            ? "Save generated courses and expand lessons later."
            : "Sign in to access your saved courses."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {isRegister && (
            <div>
              <label htmlFor="name" className="label">
                Name <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                autoComplete="name"
                maxLength={80}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={isRegister ? 8 : undefined}
            />
            {isRegister && (
              <p className="mt-1 text-xs text-ink-500">At least 8 characters.</p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        {GITHUB_ENABLED && (
          <>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-ink-200" />
              <span className="text-xs uppercase tracking-wide text-ink-400">or</span>
              <span className="h-px flex-1 bg-ink-200" />
            </div>
            <button
              type="button"
              onClick={() => signIn("github", { callbackUrl: callbackUrl() })}
              className="btn-secondary w-full"
            >
              Continue with GitHub
            </button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-ink-600">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-brand-700 underline">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link href="/register" className="font-semibold text-brand-700 underline">
                Create an account
              </Link>
            </>
          )}
        </p>
      </div>

      <p className="mt-4 text-center text-sm text-ink-500">
        <Link href="/generate" className="hover:text-ink-800 hover:underline">
          ← Back to the generator
        </Link>
      </p>
    </div>
  );
}
