import { streamText } from "ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOpenRouter, LESSON_SYSTEM_PROMPT } from "@/lib/openrouter";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { textStreamResponse, upstreamMessage } from "@/lib/streamText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  lessonTitle?: string;
  courseTitle?: string;
  moduleTitle?: string;
  skillLevel?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const lessonTitle = body.lessonTitle?.trim();
  if (!lessonTitle) {
    return Response.json({ error: "A lesson title is required." }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;
  const limit = rateLimit(clientKey(request, userId), userId ? 30 : 8);
  if (!limit.ok) {
    return Response.json(
      {
        error: `Rate limit reached. Please wait ${limit.retryAfterSeconds}s before trying again.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const userPrompt = [
    `Lesson: ${lessonTitle}`,
    body.moduleTitle ? `Module: ${body.moduleTitle}` : null,
    body.courseTitle ? `Course: ${body.courseTitle}` : null,
    body.skillLevel ? `Learner level: ${body.skillLevel}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  let model;
  try {
    model = getOpenRouter();
  } catch {
    return Response.json(
      { error: "The server is missing OPENROUTER_API_KEY. Add it to .env and restart." },
      { status: 500 },
    );
  }

  let capturedError: unknown = null;

  try {
    const result = await streamText({
      model,
      system: LESSON_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.6,
      onError: ({ error }) => {
        capturedError = error;
      },
    });

    return await textStreamResponse(result, {
      errorMessage: "Lesson generation failed. Please retry in a moment.",
      getError: () => capturedError,
    });
  } catch (error) {
    console.error("expand-lesson failed:", error);
    return Response.json(
      { error: upstreamMessage(error) ?? "Lesson generation failed. Please retry in a moment." },
      { status: 502 },
    );
  }
}
