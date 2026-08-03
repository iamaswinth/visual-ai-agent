// POST /api/index/run — index a batch of activity (events + screenshot
// descriptions) into the vector store. Powers the "Index activity" button.

import { indexBatch } from "../../../../lib/documents.js";
import { hasApiKey } from "../../../../lib/ai.js";
import { hasOpenAI } from "../../../../lib/embed.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!hasOpenAI()) {
    return Response.json(
      { ok: false, error: "Set OPENAI_API_KEY to build the searchable activity index (embeddings)." },
      { status: 400 }
    );
  }
  if (!hasApiKey()) {
    return Response.json(
      { ok: false, error: "Set ANTHROPIC_API_KEY so screenshots can be described before indexing." },
      { status: 400 }
    );
  }
  try {
    const result = await indexBatch(80);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[index/run] failed:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
