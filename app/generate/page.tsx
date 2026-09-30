"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCompletion } from "ai/react";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { saveGuestCourse } from "@/lib/guestLibrary";

const SKILL_LEVELS = [
  { value: "beginner", label: "Beginner", hint: "No prior experience assumed" },
  { value: "intermediate", label: "Intermediate", hint: "Some fundamentals known" },
  { value: "advanced", label: "Advanced", hint: "Practitioner level depth" },
] as const;

const EXAMPLES = [
  "Practical SQL for product managers",
  "Introduction to watercolor painting",
  "Rust async programming",
  "Startup financial modelling",
  "Bird identification in Britain",
];

export default function GeneratePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const outputRef = useRef<HTMLDivElement>(null);

  const [topic, setTopic] = useState("");
  const [skillLevel, setSkillLevel] = useState<string>("beginner");
  const [goals, setGoals] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  const {
    completion,
    complete,
    isLoading,
    error,
    stop,
    setCompletion,
  } = useCompletion({
    api: "/api/generate-course",
    streamProtocol: "text",
    body: { topic: topic.trim(), skillLevel, goals: goals.trim() },
  });

  const hasOutput = completion.trim().length > 0;
  const needsSignIn = saveError.toLowerCase().includes("sign in");
  const [elapsed, setElapsed] = useState(0);

  // Show a running timer so a slow first token doesn't look like a hang.
  useEffect(() => {
    if (!isLoading) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading || !outputRef.current) return;
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [completion, isLoading]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!topic.trim() || isLoading) return;
    setCompletion("");
    setSaveState("idle");
    setSavedId(null);
    setSaveError("");
    // `complete` sends the topic as `prompt`; the route reads topic/skillLevel/goals
    // from the request body and ignores the prompt field.
    complete(topic.trim());
  }

  async function handleSave() {
    if (!completion.trim()) return;
    setSaveState("saving");
    setSaveError("");

    try {
      // Signed out: keep the course in this browser so the demo needs no account.
      if (!session?.user) {
        const response = await fetch("/api/parse-course", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            markdown: completion,
            topic: topic.trim(),
            skillLevel,
          }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? "Could not save the course.");
        }

        const course = saveGuestCourse({
          title: data.course.title,
          description: data.course.description,
          topic: data.course.topic,
          skillLevel: data.course.skillLevel,
          markdown: completion,
          modules: data.course.modules,
        });

        setSavedId(course.id);
        setSaveState("saved");
        return;
      }

      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown: completion,
          topic: topic.trim(),
          skillLevel,
        }),
      });
      const data = await response.json().catch(() => null);

      if (response.status === 401) {
        setSaveState("error");
        setSaveError("Sign in to save this course to your account.");
        return;
      }
      if (!response.ok) {
        throw new Error(data?.error ?? "Could not save the course.");
      }

      setSavedId(data.course.id);
      setSaveState("saved");
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Could not save the course.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
          Generate a course
        </h1>
        <p className="mt-2 text-ink-600">
          Enter a topic and skill level. The outline streams in as it&apos;s written.
        </p>
      </header>

      {/* Sidebar is pinned to the far left; the outline takes all remaining width. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        {/* ---------------- Form ---------------- */}
        <form
          onSubmit={handleSubmit}
          className="card h-fit p-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="topic" className="label">
                Topic
              </label>
              <input
                id="topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Intro to machine learning"
                className="input"
                maxLength={300}
                required
                disabled={isLoading}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setTopic(ex)}
                    disabled={isLoading}
                    className="rounded-full border border-ink-200 px-2.5 py-1 text-xs text-ink-600 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <fieldset>
              <legend className="label">Skill level</legend>
              <div className="space-y-2">
                {SKILL_LEVELS.map((level) => (
                  <label
                    key={level.value}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                      skillLevel === level.value
                        ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                        : "border-ink-200 hover:border-brand-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="skillLevel"
                      value={level.value}
                      checked={skillLevel === level.value}
                      onChange={() => setSkillLevel(level.value)}
                      disabled={isLoading}
                      className="mt-0.5 h-4 w-4 accent-brand-600"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink-900">
                        {level.label}
                      </span>
                      <span className="block text-xs text-ink-500">{level.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="goals" className="label">
                Focus / goals <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <textarea
                id="goals"
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="Anything specific to emphasise, or projects to build."
                className="input min-h-[96px] resize-y"
                maxLength={1000}
                disabled={isLoading}
              />
              <p className="mt-1 text-right text-xs text-ink-400">{goals.length}/1000</p>
            </div>

            <div className="flex flex-col gap-2">
              <button type="submit" className="btn-primary" disabled={isLoading || !topic.trim()}>
                {isLoading ? "Generating…" : hasOutput ? "Regenerate" : "Generate course"}
              </button>
              {isLoading && (
                <button type="button" onClick={stop} className="btn-secondary">
                  Stop
                </button>
              )}
              {!isLoading && hasOutput && (
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-secondary"
                  disabled={saveState === "saving"}
                >
                  {saveState === "saving"
                    ? "Saving…"
                    : saveState === "saved"
                      ? "Saved ✓"
                      : "Save to my courses"}
                </button>
              )}
            </div>

            {!session && !isLoading && (
              <p className="rounded-lg bg-ink-100 px-3 py-2 text-xs text-ink-600">
                No account needed. Save keeps this course in your browser;{" "}
                <Link href="/login" className="font-semibold text-brand-700 underline">
                  sign in
                </Link>{" "}
                to sync it to an account.
              </p>
            )}

            {saveError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {saveError}
                {needsSignIn && (
                  <>
                    {" "}
                    <Link href="/login" className="font-semibold underline">
                      Go to sign in
                    </Link>
                  </>
                )}
              </div>
            )}

            {saveState === "saved" && savedId && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                Saved.{" "}
                <button
                  type="button"
                  onClick={() => router.push(`/courses/${savedId}`)}
                  className="font-semibold underline"
                >
                  Open course
                </button>
              </div>
            )}
          </div>
        </form>

        {/* ---------------- Output ---------------- */}
        <div className="min-w-0 lg:sticky lg:top-20">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-6 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink-900">Course outline</h2>
                {isLoading && (
                  <span className="flex items-center gap-1.5 text-xs text-ink-500">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                    streaming
                    {!hasOutput && elapsed > 3 && (
                      <span className="tabular-nums text-ink-400">· {elapsed}s</span>
                    )}
                  </span>
                )}
              </div>
              {hasOutput && (
                <button
                  onClick={() => setShowRaw((v) => !v)}
                  className="text-xs font-medium text-ink-500 hover:text-ink-800"
                >
                  {showRaw ? "Show formatted" : "Show raw Markdown"}
                </button>
              )}
            </div>

            <div
              ref={outputRef}
              className="max-h-[calc(100vh-13rem)] min-h-[24rem] overflow-y-auto px-6 py-6 sm:px-8"
            >
              {!hasOutput && !isLoading && !error && <EmptyState onPick={setTopic} />}

              {isLoading && !hasOutput && <SkeletonLines elapsed={elapsed} />}

              {hasOutput && showRaw && (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-ink-700">
                  {completion}
                </pre>
              )}

              {hasOutput && !showRaw && <Markdown content={completion} />}

              {isLoading && hasOutput && (
                <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-brand-500 align-middle" />
              )}

              {error && (
                <div
                  className={
                    hasOutput ? "mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4" : "rounded-lg border border-red-200 bg-red-50 p-4"
                  }
                  role="alert"
                >
                  <p
                    className={
                      hasOutput
                        ? "text-sm font-medium text-amber-900"
                        : "text-sm font-medium text-red-800"
                    }
                  >
                    {hasOutput
                      ? "The stream was interrupted before finishing."
                      : error.message || "Generation failed."}
                  </p>
                  <p className="mt-1 text-xs text-ink-600">
                    This is usually temporary — the model may be rate limited.
                  </p>
                  <button
                    onClick={() => {
                      setSaveState("idle");
                      setSaveError("");
                      complete(topic.trim());
                    }}
                    className="btn-primary mt-3"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>

          {hasOutput && (
            <p className="mt-3 text-xs text-ink-500">
              Saving parses the outline into modules and lessons. Always review generated content
              before teaching it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (topic: string) => void }) {
  return (
    <div className="py-12 text-center">
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
      <p className="mt-4 text-sm font-medium text-ink-900">No course generated yet</p>
      <p className="mt-1 text-sm text-ink-500">
        Enter a topic on the left, or start from one of these.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {["Intro to Docker", "Financial accounting basics", "Spanish for travel"].map((ex) => (
          <button
            key={ex}
            onClick={() => onPick(ex)}
            className="rounded-full border border-ink-200 px-3 py-1.5 text-xs text-ink-600 transition hover:border-brand-400 hover:text-brand-700"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}

function SkeletonLines({ elapsed }: { elapsed: number }) {
  return (
    <div className="py-2" aria-label="Generating course">
      <div className="mb-4 flex items-center gap-2 text-xs text-ink-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
        {elapsed < 8
          ? "Drafting your course outline…"
          : "Still writing — larger courses can take up to a minute."}
        {elapsed > 3 && <span className="tabular-nums text-ink-400">· {elapsed}s</span>}
      </div>
      <div className="space-y-3">
        <div className="h-6 w-2/3 animate-pulse rounded bg-ink-100" />
        <div className="h-4 w-full animate-pulse rounded bg-ink-100" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-ink-100" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-ink-100" />
        <div className="h-6 w-1/2 animate-pulse rounded bg-ink-100" />
        <div className="h-4 w-full animate-pulse rounded bg-ink-100" />
      </div>
    </div>
  );
}
