import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: {
    default: "CourseForge — AI Course Builder",
    template: "%s · CourseForge",
  },
  description:
    "Generate a complete, structured course outline from any topic. Modules, lessons, objectives and assessments — drafted by AI, saved to your library.",
  keywords: ["AI", "course builder", "curriculum", "lesson generator", "education"],
  openGraph: {
    title: "CourseForge — AI Course Builder",
    description: "Turn any topic into a structured, teachable course outline in seconds.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-ink-200 bg-white">
            <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-ink-500 sm:px-6">
              <p>CourseForge — AI-assisted curriculum design. Review generated content before teaching.</p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
