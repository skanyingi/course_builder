import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

async function findOwnedCourse(id: string, userId: string) {
  return prisma.course.findFirst({
    where: { id, userId },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
  });
}

export async function GET(_request: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const course = await findOwnedCourse(params.id, session.user.id);
  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  return NextResponse.json({ course });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const course = await findOwnedCourse(params.id, session.user.id);
  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  await prisma.course.delete({ where: { id: course.id } });
  return NextResponse.json({ ok: true });
}
