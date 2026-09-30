# CourseForge — AI Course Builder

Turn any topic into a complete, structured course outline. Enter a topic and skill level and
the app streams back a curriculum of modules, lessons, learning objectives and assessments.
Sign in to save courses to your library, then expand any single lesson into a full lesson plan
(explanation, worked example, practice exercise and solution).

Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma + PostgreSQL, NextAuth.js,
the Vercel AI SDK and OpenRouter.

---

## Two ways to use it

**Demo mode (no setup).** Out of the box the entire app works with nothing but an
`OPENROUTER_API_KEY` — no database, no account. Signed-out visitors get a browser-local
library: generate a course, save it, browse the dashboard, expand lessons, and it all
persists in `localStorage`. Nothing leaves the browser.

**Signed-in mode.** With `DATABASE_URL` configured, accounts get the full Postgres-backed
library with cross-device sync. The two data shapes are deliberately identical, so the same
UI renders either.

This means the app is demo-able the moment you add an API key, while the database-backed
architecture is still there for real use.

---

## Features

- **Landing page** with hero and calls to action.
- **Course generation** — topic, skill level (beginner / intermediate / advanced) and optional
  focus goals. The outline streams into the page token by token, with a stop control, a retry
  on failure, and an elapsed timer so a slow first token doesn't look like a hang.
- **Markdown rendering** — the streamed outline renders as formatted Markdown as it arrives.
- **Save to library** — the Markdown is parsed into `Course` → `Module` → `Lesson` records; the
  original Markdown is always retained so nothing is lost even if parsing is imperfect.
- **Dashboard** — every saved course with module and lesson counts.
- **Course detail** — collapsible modules, per-lesson "Expand into full lesson" that streams a
  full lesson and persists it, plus the original outline.
- **Auth (optional)** — email/password (bcrypt-hashed) and optional GitHub OAuth.
- **Rate limiting** — anonymous users get a tighter budget than signed-in ones.
- **Graceful upstream errors** — invalid key, exhausted credit, rate limiting, unknown model and
  timeouts each produce a specific, actionable message.

---

## Requirements

- Node.js 18.17 or newer
- A PostgreSQL database (a free [Neon](https://neon.tech) database works well)
- An [OpenRouter](https://openrouter.ai/keys) API key

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill it in:

```bash
cp .env.example .env
```

> A `.env` with placeholder values may already exist so the project will build
> out of the box. **Replace `OPENROUTER_API_KEY` and `DATABASE_URL` with real
> values** — until you do, course generation returns
> *"OpenRouter rejected the API key"* and the dashboard cannot load.

| Variable            | Required | Description                                                     |
| ------------------- | -------- | --------------------------------------------------------------- |
| `OPENROUTER_API_KEY` | yes      | OpenRouter API key. Never exposed to the browser.               |
| `DATABASE_URL`      | yes      | PostgreSQL connection string. Neon-compatible.                   |
| `NEXTAUTH_SECRET`   | yes      | Generate with `openssl rand -base64 32`.                         |
| `NEXTAUTH_URL`      | yes      | e.g. `http://localhost:3000`.                                    |
| `OPENROUTER_MODEL`  | no       | Defaults to `anthropic/claude-sonnet-4.5`.                       |
| `GITHUB_ID`         | no       | Enable GitHub sign-in. Button is hidden when unset.              |
| `GITHUB_SECRET`     | no       | Enable GitHub sign-in.                                           |

### 3. Create the database schema

```bash
npx prisma migrate dev --name init
```

This generates the initial migration and runs it against `DATABASE_URL`. To inspect your data
afterwards, `npm run db:studio` opens Prisma Studio.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How AI generation works

All model calls happen **server-side** in Route Handlers — the API key is never sent to the
client.

- `POST /api/generate-course` — streams the course outline as `text/plain` using
  `streamText` from the `ai` package, pointed at OpenRouter's OpenAI-compatible endpoint
  (`https://openrouter.ai/api/v1`) via `@ai-sdk/openai-compatible`.
- `POST /api/expand-lesson` — streams a full lesson for a single lesson title.
- `POST /api/courses` — persists a generated outline (requires a session).
- `PATCH /api/lessons/:id` — saves expanded lesson content.
- `GET /api/courses` · `GET /api/courses/:id` · `DELETE /api/courses/:id` — library access,
  all scoped to the signed-in user.

The client uses the AI SDK's `useCompletion` hook with `streamProtocol: "text"` to consume the
stream. Swapping the default model is a one-line change:

```bash
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

### Parsing

`lib/parseCourse.ts` turns the Markdown outline into structured records. It is deliberately
tolerant — it keys off headings and labels rather than a rigid grammar, and degrades to empty
arrays instead of throwing. The raw Markdown is stored on `Course.content` regardless, and the
course detail page can fall back to rendering it directly.

---

## Project structure

```
app/
  api/
    auth/[...nextauth]/route.ts   NextAuth handler
    auth/register/route.ts        Account creation
    generate-course/route.ts      Streaming course outline
    expand-lesson/route.ts        Streaming full lesson
    courses/route.ts              List + create courses
    courses/[id]/route.ts         Read + delete a course
    lessons/[id]/route.ts         Persist expanded lesson
  courses/[id]/page.tsx           Course detail
  dashboard/page.tsx              Saved courses
  generate/page.tsx               Generation form + streaming UI
  login/ · register/              Auth pages
  layout.tsx · globals.css · error.tsx · not-found.tsx
components/
  AuthForm.tsx                    Login / register form
  CourseModules.tsx               Modules + lesson expansion
  DeleteCourseButton.tsx
  Markdown.tsx                    Dependency-free Markdown renderer
  Navbar.tsx
lib/
  auth.ts                         NextAuth options
  openrouter.ts                   Provider + system prompts
  parseCourse.ts                  Markdown → Course/Module/Lesson
  prisma.ts                       Prisma client singleton
  rateLimit.ts                    In-memory fixed-window limiter
  streamText.ts                   Streaming helper + error mapping
prisma/schema.prisma
types/next-auth.d.ts
```

---

## Scripts

| Command                | Description                                  |
| ---------------------- | -------------------------------------------- |
| `npm run dev`          | Start the dev server                          |
| `npm run build`        | Generate the Prisma client, then build        |
| `npm start`            | Run the production build                      |
| `npm run lint`         | ESLint via `next lint`                        |
| `npm run typecheck`    | `tsc --noEmit`                                |
| `npm run db:migrate`   | Create and apply a migration                  |
| `npm run db:studio`    | Open Prisma Studio                            |

---

## Deploying

1. Push the project to a Git provider and import it into Vercel (or run `npm run build`
   elsewhere).
2. Add the environment variables from `.env.example` in your host's dashboard.
3. Run `npx prisma migrate deploy` as part of your release step — the `build` script already
   runs `prisma generate`.

Set `NEXTAUTH_URL` to your production origin and register that same URL as the callback for
GitHub OAuth.

---

## Notes and limitations

- The rate limiter is in-memory, so it resets on redeploy and is per-instance. Swap
  `lib/rateLimit.ts` for Redis/Upstash if you run more than one instance.
- Course generation is unmetered for signed-in users beyond a simple per-window cap. Add real
  billing/quotas before exposing this publicly at scale.
- Markdown is parsed heuristically. Always review generated content before teaching it.
# course_builder
