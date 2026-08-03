// POST /api/analyze/run — analyze a batch of not-yet-analyzed sessions.
// Powers the dashboard's "Analyze sessions" button.

import { analyzeBatch } from "../../../../lib/analyze.js";
import { hasApiKey } from "../../../../lib/ai.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!hasApiKey()) {
    return Response.json(
      { ok: false, error: "Set ANTHROPIC_API_KEY in the environment to enable session analysis." },
      { status: 400 }
    );
  }
  try {
    const analyzed = await analyzeBatch(8);
    return Response.json({ ok: true, analyzed });
  } catch (err) {
    console.error("[analyze/run] failed:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
