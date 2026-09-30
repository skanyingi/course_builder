import { streamText } from "ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOpenRouter, COURSE_SYSTEM_PROMPT } from "@/lib/openrouter";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { textStreamResponse, upstreamMessage } from "@/lib/streamText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  topic?: string;
  skillLevel?: string;
  goals?: string;
};

const SKILL_LEVELS = new Set(["beginner", "intermediate", "advanced"]);

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const topic = body.topic?.trim();
  if (!topic) {
    return Response.json({ error: "A topic is required." }, { status: 400 });
  }
  if (topic.length > 300) {
    return Response.json({ error: "Topic is too long (300 characters max)." }, { status: 400 });
  }

  const skillLevel = SKILL_LEVELS.has(body.skillLevel ?? "")
    ? (body.skillLevel as string)
    : "beginner";
  const goals = body.goals?.trim().slice(0, 1000) ?? "";

  // Generous limit when signed in, tighter for anonymous users.
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id as string | undefined;
  const limit = rateLimit(
    clientKey(request, userId),
    userId ? 20 : 5,
  );
  if (!limit.ok) {
    return Response.json(
      {
        error: `Rate limit reached. Please wait ${limit.retryAfterSeconds}s before trying again.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const userPrompt = [
    `Topic: ${topic}`,
    `Skill level: ${skillLevel}`,
    goals ? `Focus / goals: ${goals}` : null,
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

  // AI SDK surfaces provider failures via onError rather than by rejecting the
  // stream, so we capture it to report an accurate message.
  let capturedError: unknown = null;

  try {
    const result = await streamText({
      model,
      system: COURSE_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.7,
      onError: ({ error }) => {
        capturedError = error;
      },
    });

    // Plain-text stream so the client's useCompletion (streamProtocol: "text")
    // can consume it directly.
    return await textStreamResponse(result, {
      errorMessage: "Course generation failed. Please retry in a moment.",
      getError: () => capturedError,
    });
  } catch (error) {
    console.error("generate-course failed:", error);
    return Response.json(
      { error: upstreamMessage(error) ?? "Course generation failed. Please retry in a moment." },
      { status: 502 },
    );
  }
}
