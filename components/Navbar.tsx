"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

const links = [
  { href: "/", label: "Home" },
  { href: "/generate", label: "Generate" },
  { href: "/dashboard", label: "My Courses" },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-ink-900">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white"
          >
            CF
          </span>
          <span className="hidden sm:inline">CourseForge</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {links.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          <div className="ml-1 border-l border-ink-200 pl-2 sm:ml-2 sm:pl-3">
            {status === "loading" ? (
              <div className="h-8 w-20 animate-pulse rounded-lg bg-ink-100" />
            ) : session?.user ? (
              <div className="flex items-center gap-2">
                <span className="hidden max-w-[10rem] truncate text-sm text-ink-600 md:inline">
                  {session.user.name ?? session.user.email}
                </span>
                <button onClick={() => signOut({ callbackUrl: "/" })} className="btn-ghost">
                  Sign out
                </button>
              </div>
            ) : (
              <Link href="/login" className="btn-primary">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
