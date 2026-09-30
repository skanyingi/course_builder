"use client";

import { useState } from "react";
import { Markdown } from "@/components/Markdown";
import { updateGuestLesson } from "@/lib/guestLibrary";

export type LessonData = {
  id: string;
  title: string;
  order: number;
  content: string | null;
};

export type ModuleData = {
  id: string;
  title: string;
  summary: string;
  order: number;
  estimatedTime: string;
  lessons: LessonData[];
};

type LessonState = "idle" | "loading" | "done" | "error";

export function CourseModules({
  modules,
  courseTitle,
  skillLevel,
  courseId,
  isGuest = false,
}: {
  modules: ModuleData[];
  courseTitle: string;
  skillLevel: string;
  /** Present only for browser-local (demo mode) courses. */
  courseId?: string;
  isGuest?: boolean;
}) {
  const [openModules, setOpenModules] = useState<Set<string>>(
    () => new Set(modules.length ? [modules[0].id] : []),
  );

  function toggleModule(id: string) {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {modules.map((mod) => {
        const isOpen = openModules.has(mod.id);
        return (
          <section key={mod.id} className="card overflow-hidden">
            <h2>
              <button
                onClick={() => toggleModule(mod.id)}
                aria-expanded={isOpen}
                className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-ink-50"
              >
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
                  {mod.order + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink-900">{mod.title}</span>
                  {mod.summary && (
                    <span className="mt-0.5 block text-sm text-ink-600">{mod.summary}</span>
                  )}
                  <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                    <span>
                      {mod.lessons.length} lesson{mod.lessons.length === 1 ? "" : "s"}
                    </span>
                    {mod.estimatedTime && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{mod.estimatedTime}</span>
                      </>
                    )}
                  </span>
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className={`mt-1 h-5 w-5 shrink-0 text-ink-400 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </h2>

            {isOpen && (
              <div className="border-t border-ink-200">
                {mod.lessons.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-ink-500">
                    No lessons were parsed for this module.
                  </p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {mod.lessons.map((lesson) => (
                      <LessonRow
                        key={lesson.id}
                        lesson={lesson}
                        moduleTitle={mod.title}
                        courseTitle={courseTitle}
                        skillLevel={skillLevel}
                        courseId={courseId}
                        isGuest={isGuest}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function LessonRow({
  lesson,
  moduleTitle,
  courseTitle,
  skillLevel,
  courseId,
  isGuest,
}: {
  lesson: LessonData;
  moduleTitle: string;
  courseTitle: string;
  skillLevel: string;
  courseId?: string;
  isGuest: boolean;
}) {
  const [content, setContent] = useState(lesson.content ?? "");
  const [state, setState] = useState<LessonState>(lesson.content ? "done" : "idle");
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [saved, setSaved] = useState(Boolean(lesson.content));

  async function expand() {
    setIsOpen(true);
    setError("");
    setState("loading");
    setContent("");

    try {
      const response = await fetch("/api/expand-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonTitle: lesson.title,
          moduleTitle,
          courseTitle,
          skillLevel,
        }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not generate this lesson.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setContent(accumulated);
      }

      setState("done");

      // Persist so it survives a page reload — to the database for signed-in
      // users, or to browser storage in demo mode.
      if (isGuest && courseId) {
        updateGuestLesson(courseId, lesson.id, accumulated);
        setSaved(true);
        return;
      }

      const patch = await fetch(`/api/lessons/${lesson.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: accumulated }),
      });
      setSaved(patch.ok);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Could not generate this lesson.");
    }
  }

  const hasContent = content.trim().length > 0;

  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink-900">{lesson.title}</p>
          {saved && !isOpen && (
            <p className="mt-0.5 text-xs text-emerald-600">Expanded and saved</p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {hasContent && (
            <button
              onClick={() => setIsOpen((v) => !v)}
              className="btn-ghost text-xs"
              aria-expanded={isOpen}
            >
              {isOpen ? "Hide" : "Show"}
            </button>
          )}
          {state === "error" || (!hasContent && state !== "loading") ? (
            <button onClick={expand} className="btn-secondary text-xs">
              {state === "error" ? "Retry" : saved ? "Regenerate" : "Expand into full lesson"}
            </button>
          ) : (
            <button onClick={expand} disabled className="btn-secondary text-xs">
              {saved ? "Regenerate" : "Expand into full lesson"}
            </button>
          )}
        </div>
      </div>

      {state === "loading" && !hasContent && (
        <div className="mt-3 space-y-2" aria-label="Generating lesson">
          <div className="h-3.5 w-full animate-pulse rounded bg-ink-100" />
          <div className="h-3.5 w-11/12 animate-pulse rounded bg-ink-100" />
          <div className="h-3.5 w-4/5 animate-pulse rounded bg-ink-100" />
        </div>
      )}

      {isOpen && hasContent && (
        <div className="mt-4 rounded-lg border border-ink-200 bg-ink-50/60 p-4">
          <Markdown content={content} />
          {state === "loading" && (
            <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-brand-500 align-middle" />
          )}
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </li>
  );
}
