import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-bold text-ink-900">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-ink-600">
        The course may have been deleted, or the link may be wrong.
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
