"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
        Something went wrong
      </p>
      <h1 className="mt-3 text-2xl font-bold text-ink-900">
        We hit an unexpected error
      </h1>
      <p className="mt-2 text-ink-600">
        {error.message || "Please try again — this is usually temporary."}
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-ink-400">ref: {error.digest}</p>
      )}
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn-primary">
          Try again
        </button>
        <a href="/" className="btn-secondary">
          Go home
        </a>
      </div>
    </div>
  );
}
