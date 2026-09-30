import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCourseMarkdown, stripMarkdown } from "@/lib/parseCourse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  markdown?: string;
  topic?: string;
  skillLevel?: string;
  title?: string;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const courses = await prisma.course.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      topic: true,
      skillLevel: true,
      createdAt: true,
      _count: { select: { modules: true } },
    },
  });

  return NextResponse.json({ courses });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "You must be signed in to save a course." },
      { status: 401 },
    );
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const markdown = body.markdown ?? "";
  const topic = body.topic?.trim();
  if (!topic) {
    return NextResponse.json({ error: "A topic is required." }, { status: 400 });
  }

  // Parse the AI's Markdown into structured records. If the model produced no
  // recognisable modules we still keep the course, storing the raw Markdown so
  // the outline is never lost.
  const parsed = parseCourseMarkdown(markdown);
  const title =
    body.title?.trim() || parsed.title || stripMarkdown(markdown).slice(0, 80) || topic;
  const description =
    parsed.description || stripMarkdown(markdown).slice(0, 400);

  const course = await prisma.course.create({
    data: {
      userId: session.user.id,
      title,
      description,
      topic,
      skillLevel: body.skillLevel?.trim() || "beginner",
      content: markdown,
      modules: {
        create: parsed.modules.map((m) => ({
          title: m.title,
          summary: m.summary,
          order: m.order,
          estimatedTime: m.estimatedTime,
          lessons: {
            create: m.lessons.map((l) => ({ title: l.title, order: l.order })),
          },
        })),
      },
    },
    include: { modules: { include: { lessons: true } } },
  });

  return NextResponse.json({ course }, { status: 201 });
}
