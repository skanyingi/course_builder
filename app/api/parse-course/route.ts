import { parseCourseMarkdown, stripMarkdown } from "@/lib/parseCourse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  markdown?: string;
  topic?: string;
  skillLevel?: string;
};

/**
 * Parse a generated outline into structured records without persisting it.
 *
 * Used by the browser-local demo path: the client stores the result in
 * localStorage, so signing in is never required to save a course.
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const markdown = body.markdown ?? "";
  const topic = body.topic?.trim();
  if (!topic) {
    return Response.json({ error: "A topic is required." }, { status: 400 });
  }

  const parsed = parseCourseMarkdown(markdown);

  return Response.json({
    course: {
      title: parsed.title || stripMarkdown(markdown).slice(0, 80) || topic,
      description: parsed.description || stripMarkdown(markdown).slice(0, 400),
      topic,
      skillLevel: body.skillLevel?.trim() || "beginner",
      modules: parsed.modules.map((m) => ({
        title: m.title,
        summary: m.summary,
        order: m.order,
        estimatedTime: m.estimatedTime,
        lessons: m.lessons.map((l) => ({ title: l.title, order: l.order })),
      })),
    },
  });
}
