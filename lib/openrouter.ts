import { createOpenAI } from "@ai-sdk/openai";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

export function getModelId() {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

export function getOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to your .env file — see .env.example.",
    );
  }

  const modelId = getModelId();

  // OpenRouter speaks the OpenAI wire format, so we reuse the OpenAI provider
  // with a different baseURL plus OpenRouter's attribution headers.
  const openrouter = createOpenAI({
    name: "openrouter",
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    headers: {
      "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      "X-Title": "CourseForge",
    },
  });

  return openrouter(modelId);
}

export const COURSE_SYSTEM_PROMPT = `You are an expert curriculum designer and instructional content creator. Generate a structured course with: Course Title, Course Description (2-3 sentences), Target Audience & Prerequisites, 3-6 Learning Objectives (measurable, action-verb based), a Module Breakdown (4-8 modules, each with a title, summary, 3-6 lesson topics, and estimated time), and a Suggested Assessment per module. Sequence content simple to complex, prefer applied/project-based objectives, calibrate to the given skill level, and output clean Markdown with headers and bullets — no filler text.`;

export const LESSON_SYSTEM_PROMPT = `You are an expert instructional designer and technical writer. Expand a single lesson into complete teaching material. Structure your response with these exact Markdown sections:

## Explanation
A clear, thorough explanation of the concept. Use short paragraphs and bullet points where it aids clarity. Define jargon on first use.

## Worked Example
A concrete, step-by-step worked example that demonstrates the concept applied to a realistic problem. Show intermediate reasoning, not just the answer.

## Practice Exercise
A hands-on exercise for the learner that reinforces the concept. State the task, the constraints, and what a good solution looks like.

## Solution
A complete worked solution to the practice exercise, with reasoning.

## Key Takeaways
3-5 bullet points summarizing the most important ideas.

Output clean Markdown only. No filler text, no preamble, no meta-commentary.`;
