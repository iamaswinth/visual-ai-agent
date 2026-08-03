// POST /api/chat — ask-the-agent, streamed (SSE).
//
// Clerk-protected (middleware). Retrieves relevant sessions via vector RAG,
// then streams a grounded answer. Emits SSE events: `sources` (once), `delta`
// (many), `done`, or `error`.

import { auth } from "@clerk/nextjs/server";
import { getPool } from "../../../lib/db.js";
import { getAnthropic, reasoningModel, hasApiKey } from "../../../lib/ai.js";
import { buildChat } from "../../../lib/chat.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Best-effort in-memory rate limit (per warm instance; not a hard guarantee on
// serverless). 20 questions / minute / user.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map();
function rateLimited(key) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > MAX_PER_WINDOW;
}

function sse(obj, event) {
  return `event: ${event}\ndata: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(request) {
  if (!hasApiKey()) {
    return Response.json(
      { ok: false, error: "Set ANTHROPIC_API_KEY to enable the agent chat." },
      { status: 400 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return Response.json({ ok: false, error: "question is required" }, { status: 400 });
  if (question.length > 2000)
    return Response.json({ ok: false, error: "question too long" }, { status: 400 });
  const history = Array.isArray(body?.messages) ? body.messages : [];
  const userId = typeof body?.userId === "string" ? body.userId : null;
  const tz = typeof body?.tz === "string" ? body.tz : null;

  try {
    const { userId } = await auth();
    if (rateLimited(userId || "anon")) {
      return Response.json({ ok: false, error: "rate limit — slow down" }, { status: 429 });
    }
  } catch {
    /* auth already enforced by middleware; ignore */
  }

  const pool = getPool();
  const { system, messages, sources } = await buildChat(pool, question, history, userId, tz);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(sse(sources, "sources")));
      try {
        const md = getAnthropic().messages.stream({
          model: reasoningModel(),
          max_tokens: 1024,
          system,
          messages,
        });
        for await (const event of md) {
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            controller.enqueue(encoder.encode(sse({ text: event.delta.text }, "delta")));
          }
        }
        controller.enqueue(encoder.encode(sse({}, "done")));
      } catch (err) {
        console.error("[chat] stream failed:", err);
        controller.enqueue(encoder.encode(sse({ error: "generation failed" }, "error")));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
