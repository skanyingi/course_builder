import type { Metadata } from "next";
import Link from "next/link";
import { CourseLibrary } from "@/components/CourseLibrary";

export const metadata: Metadata = { title: "My Courses" };

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900">My courses</h1>
          <p className="mt-1 text-ink-600">
            Saved courses, ready to reopen and expand.
          </p>
        </div>
        <Link href="/generate" className="btn-primary">
          Generate a new course
        </Link>
      </header>

      <CourseLibrary />
    </div>
  );
}
