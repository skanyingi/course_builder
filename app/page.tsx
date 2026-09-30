import Link from "next/link";

const features = [
  {
    title: "Structured outlines, not just text",
    body: "Every course arrives as modules, lessons, measurable objectives and per-module assessments — ready to teach or edit.",
  },
  {
    title: "Calibrated to your level",
    body: "Beginner, intermediate or advanced. Content is sequenced simple to complex and skewed toward applied, project-based objectives.",
  },
  {
    title: "Expand any lesson",
    body: "Click a single lesson to generate a full treatment: explanation, worked example, practice exercise and solution.",
  },
  {
    title: "Keep your library",
    body: "Save courses and reopen them any time. Works with no account — everything is kept in your browser, or sign in to sync to a real account.",
  },
];

const steps = [
  { n: "1", title: "Pick a topic", body: "Anything from Rust async to Renaissance art history." },
  { n: "2", title: "Set the level", body: "Add optional focus areas to steer the curriculum." },
  { n: "3", title: "Watch it draft", body: "The outline streams in token by token." },
  { n: "4", title: "Save & expand", body: "Keep it in your library, then deepen single lessons." },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-ink-200 bg-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,theme(colors.brand.100),transparent)]"
        />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="badge bg-brand-100 text-brand-700">AI curriculum designer</span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink-900 sm:text-6xl">
              Turn any topic into a
              <span className="block text-brand-600">teachable course outline</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-600">
              Give CourseForge a topic and a skill level. Get a complete curriculum — modules,
              lessons, learning objectives and assessments — in seconds, then expand any single
              lesson into a full lesson plan.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/generate" className="btn-primary w-full px-6 py-3 text-base sm:w-auto">
                Start building — no sign-up
              </Link>
              <Link href="/dashboard" className="btn-secondary w-full px-6 py-3 text-base sm:w-auto">
                View saved courses
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-500">
              Try the whole thing without an account — courses save straight to your browser.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="card p-6">
              <h3 className="text-lg font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-ink-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-ink-900">
            How it works
          </h2>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <li key={s.n} className="relative">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 font-semibold text-ink-900">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-ink-900">
          Ready to build your course?
        </h2>
        <p className="mt-3 text-ink-600">
          The first draft takes about thirty seconds. Edit and expand as much as you like.
        </p>
        <Link href="/generate" className="btn-primary mt-8 px-8 py-3 text-base">
          Generate a course
        </Link>
      </section>
    </>
  );
}
