import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

type Body = { content?: string };

/** Persist the full lesson content generated for a lesson the user owns. */
export async function PATCH(request: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const content = body.content?.trim();
  if (!content) {
    return NextResponse.json({ error: "Lesson content is required." }, { status: 400 });
  }

  const lesson = await prisma.lesson.findFirst({
    where: { id: params.id, module: { course: { userId: session.user.id } } },
    include: { module: true },
  });
  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const updated = await prisma.lesson.update({
    where: { id: lesson.id },
    data: { content, expandedAt: new Date() },
  });

  return NextResponse.json({ lesson: updated });
}
