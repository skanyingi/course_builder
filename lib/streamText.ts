type UpstreamResult = { textStream: ReadableStream<string> };


const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disable proxy buffering so chunks reach the browser as they are produced.
  "X-Accel-Buffering": "no",
};

export function upstreamMessage(error: unknown): string | null {
  // The AI SDK may wrap the provider error, so inspect the error, its cause
  // chain, and the message text for the common, actionable failures.
  const seen = new Set<unknown>();
  let blob = "";
  let status: number | undefined;

  let current: unknown = error;
  for (let depth = 0; current && depth < 5 && !seen.has(current); depth += 1) {
    seen.add(current);
    const err = current as {
      statusCode?: number;
      status?: number;
      message?: string;
      cause?: unknown;
    };
    status ??= err.statusCode ?? err.status;
    if (err.message) blob += ` ${err.message}`;
    current = err.cause;
  }

  const lower = blob.toLowerCase();

  if (status === 401 || status === 403 || /unauthorized|invalid.*(api )?key|authentication|401/.test(lower)) {
    return "OpenRouter rejected the API key. Check OPENROUTER_API_KEY in your .env file.";
  }
  if (status === 402 || /insufficient.*(credit|quota)|402/.test(lower)) {
    return "Your OpenRouter account has no remaining credit.";
  }
  if (status === 429 || /rate limit|429|too many requests/.test(lower)) {
    return "The model is rate limited right now. Please retry in a few seconds.";
  }
  if (/model.*(not found|no endpoints|404)/.test(lower)) {
    return "That model isn't available on your OpenRouter account. Check OPENROUTER_MODEL.";
  }
  if (status && status >= 500) {
    return "The model provider is having trouble. Please retry in a moment.";
  }
  return null;
}

/**
 * Wrap an AI SDK result as a plain-text streaming response.
 *
 * `streamText` is lazy: it returns before the provider responds, so an invalid
 * key or upstream error surfaces only when the stream is read. Without a
 * preflight the client would receive HTTP 200 and an empty body, leaving the
 * user staring at a blank outline with no error. We therefore await the first
 * chunk and convert early failures into a proper status code.
 *
 * The default deadline is generous because reasoning models emit internal
 * "reasoning" tokens before any user-visible text, so the first text chunk can
 * legitimately take tens of seconds.
 */
export async function textStreamResponse(
  result: UpstreamResult,
  {
    errorMessage,
    timeoutMs = 60_000,
    getError,
  }: {
    errorMessage: string;
    timeoutMs?: number;
    getError?: () => unknown;
  },
): Promise<Response> {
  const reader = result.textStream.getReader();

  // Bound the wait for the first chunk. Without this a stalled upstream
  // connection leaves the request hanging indefinitely and the browser spins.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  let first: ReadableStreamReadResult<string> | undefined;

  try {
    const outcome = await Promise.race([reader.read(), deadline]);

    if (outcome === "timeout") {
      void reader.cancel().catch(() => undefined);
      return Response.json(
        { error: "The model took too long to respond. Please retry." },
        { status: 504 },
      );
    }

    first = outcome;
  } catch (error) {
    console.error("AI stream failed before first chunk:", error);
    return Response.json({ error: upstreamMessage(error) ?? errorMessage }, { status: 502 });
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (first.done || !first.value) {
    // The stream closed without producing anything. AI SDK reports provider
    // failures through `onError` rather than by rejecting the stream, so we
    // consult the captured error to explain what actually went wrong.
    const captured = getError?.();
    if (captured) {
      console.error("AI stream ended with no output:", captured);
      return Response.json({ error: upstreamMessage(captured) ?? errorMessage }, { status: 502 });
    }
    return Response.json({ error: errorMessage }, { status: 502 });
  }

  const firstChunk = first.value;

  const body = new ReadableStream<string>({
    async start(controller) {
      controller.enqueue(firstChunk);
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        console.error("AI stream failed mid-stream:", error);
        // Errors after the first chunk can't change the status code, so we
        // close the stream; the client detects the truncated response and
        // offers a retry.
        controller.close();
      }
    },
    cancel(reason) {
      void reader.cancel(reason).catch(() => undefined);
    },
  });

  return new Response(body, { headers: BASE_HEADERS });
}
