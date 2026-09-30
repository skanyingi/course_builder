"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { listGuestCourses, deleteGuestCourse, type GuestCourse } from "@/lib/guestLibrary";

type ApiCourse = {
  id: string;
  title: string;
  description: string;
  topic: string;
  skillLevel: string;
  createdAt: string;
  _count?: { modules: number };
  modules?: { _count: { lessons: number } }[];
};

type Row = {
  id: string;
  title: string;
  description: string;
  skillLevel: string;
  createdAt: string;
  moduleCount: number;
  lessonCount: number;
  isGuest: boolean;
};

const LEVEL_STYLES: Record<string, string> = {
  beginner: "bg-emerald-100 text-emerald-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-rose-100 text-rose-700",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toRow(c: ApiCourse): Row {
  const modules = c.modules ?? [];
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    skillLevel: c.skillLevel,
    createdAt: c.createdAt,
    moduleCount: c._count?.modules ?? modules.length,
    lessonCount: modules.reduce((sum, m) => sum + (m._count?.lessons ?? 0), 0),
    isGuest: false,
  };
}

function guestToRow(c: GuestCourse): Row {
  return {
    id: c.id,
    title: c.title,
    description: c.description,
    skillLevel: c.skillLevel,
    createdAt: c.createdAt,
    moduleCount: c.modules.length,
    lessonCount: c.modules.reduce((s, m) => s + m.lessons.length, 0),
    isGuest: true,
  };
}

export function CourseLibrary() {
  const { status } = useSession();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");

    if (status === "authenticated") {
      try {
        const res = await fetch("/api/courses");
        if (!res.ok) throw new Error("Could not load your courses.");
        const data = await res.json();
        setRows((data.courses as ApiCourse[]).map(toRow));
        return;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load your courses.");
        setRows([]);
        return;
      }
    }

    if (status === "unauthenticated") {
      setRows(listGuestCourses().map(guestToRow));
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reflect courses saved in another tab.
  useEffect(() => {
    const onStorage = () => void load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  async function handleDelete(id: string, isGuest: boolean) {
    if (isGuest) {
      deleteGuestCourse(id);
      void load();
      return;
    }
    const res = await fetch(`/api/courses/${id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  if (rows === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card h-40 animate-pulse bg-ink-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card px-6 py-16 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
            />
          </svg>
        </div>
        <h2 className="mt-4 font-semibold text-ink-900">No saved courses yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-600">
          Generate a course and save it — no account needed. Saved courses stay in this browser.
        </p>
        <Link href="/generate" className="btn-primary mt-6">
          Generate your first course
        </Link>
      </div>
    );
  }

  return (
    <>
      {rows.some((r) => r.isGuest) && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
          <svg
            viewBox="0 0 24 24"
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
            />
          </svg>
          <span>
            You&apos;re browsing in <strong>demo mode</strong> — these courses are stored in
            this browser only, no account needed. Nothing leaves this device.
          </span>
        </p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((course) => {
          const level = course.skillLevel.toLowerCase();
          return (
            <li
              key={course.id}
              className="card group relative flex flex-col p-5 transition hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`badge ${LEVEL_STYLES[level] ?? "bg-ink-100 text-ink-700"}`}
                >
                  {level}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete(course.id, course.isGuest)}
                  aria-label={`Delete ${course.title}`}
                  className="relative z-10 -mr-1 rounded-lg p-1.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
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
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916"
                    />
                  </svg>
                </button>
              </div>

              <h2 className="mt-3 line-clamp-2 font-semibold text-ink-900">
                <Link href={`/courses/${course.id}`} className="hover:text-brand-700">
                  <span className="absolute inset-0" aria-hidden />
                  {course.title}
                </Link>
              </h2>

              {course.description && (
                <p className="mt-1.5 line-clamp-2 text-sm text-ink-600">
                  {course.description}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <span>
                  {course.moduleCount} module{course.moduleCount === 1 ? "" : "s"}
                </span>
                <span aria-hidden>·</span>
                <span>
                  {course.lessonCount} lesson{course.lessonCount === 1 ? "" : "s"}
                </span>
                <span aria-hidden>·</span>
                <span>{formatDate(course.createdAt)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
