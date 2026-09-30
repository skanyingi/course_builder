"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { getGuestCourse, type GuestCourse } from "@/lib/guestLibrary";
import { CourseModules } from "@/components/CourseModules";
import { Markdown } from "@/components/Markdown";

type Props = { params: { id: string } };

type Loaded = {
  title: string;
  description: string;
  topic: string;
  skillLevel: string;
  markdown: string;
  isGuest: boolean;
  modules: {
    id: string;
    title: string;
    summary: string;
    order: number;
    estimatedTime: string;
    lessons: { id: string; title: string; order: number; content: string | null }[];
  }[];
};

export default function CourseDetailPage({ params }: Props) {
  const { status } = useSession();
  const [course, setCourse] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;

    async function load() {
      // Browser-local courses first — they only exist on this device.
      const guest = getGuestCourse(params.id);
      if (guest) {
        if (!cancelled) {
          setCourse(toLoaded(guest, true));
          setState("ready");
        }
        return;
      }

      if (status === "unauthenticated") {
        if (!cancelled) setState("missing");
        return;
      }

      try {
        const res = await fetch(`/api/courses/${params.id}`);
        if (!res.ok) {
          if (!cancelled) setState("missing");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const c = data.course as {
          title: string;
          description: string;
          topic: string;
          skillLevel: string;
          content: string;
          modules: Loaded["modules"];
        };
        setCourse({
          title: c.title,
          description: c.description,
          topic: c.topic,
          skillLevel: c.skillLevel,
          markdown: c.content,
          isGuest: false,
          modules: c.modules,
        });
        setState("ready");
      } catch {
        if (!cancelled) setState("missing");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id, status]);

  if (state === "loading") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <div className="h-8 w-64 animate-pulse rounded bg-ink-100" />
        <div className="mt-8 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-24 animate-pulse bg-ink-100" />
          ))}
        </div>
      </div>
    );
  }

  if (state === "missing" || !course) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Course not found</h1>
        <p className="mt-2 text-ink-600">
          {status === "unauthenticated"
            ? "Courses saved in demo mode live in this browser. If you opened this on another device or in a private window, it won't be here."
            : "This course may have been deleted."}
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/dashboard" className="btn-primary">
            My courses
          </Link>
          <Link href="/generate" className="btn-secondary">
            Generate a course
          </Link>
        </div>
      </div>
    );
  }

  const lessonCount = course.modules.reduce((s, m) => s + m.lessons.length, 0);
  const expandedCount = course.modules.reduce(
    (s, m) => s + m.lessons.filter((l) => l.content).length,
    0,
  );
  const level = course.skillLevel.toLowerCase();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/dashboard" className="btn-ghost -ml-2 text-sm">
          ← My courses
        </Link>
      </div>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`badge ${
              level === "beginner"
                ? "bg-emerald-100 text-emerald-700"
                : level === "intermediate"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
            }`}
          >
            {level}
          </span>
          <span className="text-xs text-ink-500">
            {course.modules.length} module{course.modules.length === 1 ? "" : "s"} ·{" "}
            {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
          </span>
        </div>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          {course.title}
        </h1>

        {course.description && <p className="mt-3 text-ink-600">{course.description}</p>}

        <p className="mt-3 text-sm text-emerald-600">
          {expandedCount} of {lessonCount} lessons expanded.
        </p>
      </header>

      {course.isGuest && (
        <p className="mb-6 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
          Demo mode — this course is stored in your browser. Expanded lessons are saved here too.
        </p>
      )}

      {course.modules.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <h2 className="font-semibold text-ink-900">No modules were parsed</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-600">
            The original outline is preserved below exactly as the model produced it.
          </p>
          {course.markdown && (
            <div className="mt-6 rounded-lg border border-ink-200 bg-ink-50 p-5 text-left">
              <Markdown content={course.markdown} />
            </div>
          )}
        </div>
      ) : (
        <CourseModules
          modules={course.modules}
          courseTitle={course.title}
          skillLevel={course.skillLevel}
          courseId={course.isGuest ? params.id : undefined}
          isGuest={course.isGuest}
        />
      )}

      {course.modules.length > 0 && course.markdown && (
        <details className="card mt-8 group">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-ink-700 transition hover:text-ink-900">
            <span className="inline-flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 transition-transform group-open:rotate-90"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              View the original outline
            </span>
          </summary>
          <div className="border-t border-ink-200 px-5 py-5">
            <Markdown content={course.markdown} />
          </div>
        </details>
      )}
    </div>
  );
}

function toLoaded(guest: GuestCourse, isGuest: boolean): Loaded {
  return {
    title: guest.title,
    description: guest.description,
    topic: guest.topic,
    skillLevel: guest.skillLevel,
    markdown: guest.markdown,
    isGuest,
    modules: guest.modules.map((m) => ({
      id: m.id,
      title: m.title,
      summary: m.summary,
      order: m.order,
      estimatedTime: m.estimatedTime,
      lessons: m.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        order: l.order,
        content: l.content,
      })),
    })),
  };
}
