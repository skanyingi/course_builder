/**
 * Zero-setup, browser-local course library.
 *
 * Lets the whole app be demoed without a database or an account: generated
 * outlines, saved courses and expanded lessons are kept in localStorage. Users
 * who sign in get the Postgres-backed library instead — these two shapes are
 * deliberately identical so the same UI can render either.
 */

export type GuestLesson = {
  id: string;
  title: string;
  order: number;
  content: string | null;
  expandedAt: string | null;
};

export type GuestModule = {
  id: string;
  title: string;
  summary: string;
  order: number;
  estimatedTime: string;
  lessons: GuestLesson[];
};

export type GuestCourse = {
  id: string;
  title: string;
  description: string;
  topic: string;
  skillLevel: string;
  markdown: string;
  createdAt: string;
  modules: GuestModule[];
};

const KEY = "courseforge.library.v1";

export const GUEST_MODE_MESSAGE =
  "Saved in this browser only. Sign in to keep courses on your account.";

function available(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function listGuestCourses(): GuestCourse[] {
  if (!available()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GuestCourse[]) : [];
  } catch {
    return [];
  }
}

function write(courses: GuestCourse[]) {
  if (!available()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(courses));
  } catch {
    // Quota exceeded — drop the oldest course and retry once.
    try {
      const trimmed = courses.slice(0, Math.max(0, courses.length - 1));
      window.localStorage.setItem(KEY, JSON.stringify(trimmed));
    } catch {
      /* give up silently; the UI still reports success for this session */
    }
  }
}

export function saveGuestCourse(input: {
  title: string;
  description: string;
  topic: string;
  skillLevel: string;
  markdown: string;
  modules: {
    title: string;
    summary: string;
    order: number;
    estimatedTime: string;
    lessons: { title: string; order: number }[];
  }[];
}): GuestCourse {
  const course: GuestCourse = {
    id: uuid(),
    title: input.title,
    description: input.description,
    topic: input.topic,
    skillLevel: input.skillLevel,
    markdown: input.markdown,
    createdAt: new Date().toISOString(),
    modules: input.modules.map((m) => ({
      id: uuid(),
      title: m.title,
      summary: m.summary,
      order: m.order,
      estimatedTime: m.estimatedTime,
      lessons: m.lessons.map((l) => ({
        id: uuid(),
        title: l.title,
        order: l.order,
        content: null,
        expandedAt: null,
      })),
    })),
  };

  const all = [course, ...listGuestCourses()];
  write(all);
  return course;
}

export function getGuestCourse(id: string): GuestCourse | null {
  return listGuestCourses().find((c) => c.id === id) ?? null;
}

export function deleteGuestCourse(id: string) {
  write(listGuestCourses().filter((c) => c.id !== id));
}

export function updateGuestLesson(
  courseId: string,
  lessonId: string,
  content: string,
) {
  const all = listGuestCourses();
  let found = false;

  const next = all.map((course) => {
    if (course.id !== courseId) return course;
    return {
      ...course,
      modules: course.modules.map((mod) => ({
        ...mod,
        lessons: mod.lessons.map((lesson) => {
          if (lesson.id !== lessonId) return lesson;
          found = true;
          return { ...lesson, content, expandedAt: new Date().toISOString() };
        }),
      })),
    };
  });

  if (found) write(next);
  return found;
}
