"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeleteCourseButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleDelete() {
    setError("");
    try {
      const response = await fetch(`/api/courses/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not delete the course.");
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the course.");
    } finally {
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${title}`}
        className="relative z-10 rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative z-20 text-right">
      <p className="text-xs font-medium text-red-700">Delete permanently?</p>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
      <div className="mt-1.5 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-ink-300 px-2 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? "…" : "Delete"}
        </button>
      </div>
    </div>
  );
}
