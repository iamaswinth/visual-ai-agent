// POST /api/users/[id]/process — run the full AI pipeline for one user:
// caption -> analyze sessions -> index activity -> update the rolling profile.
// Powers the "Index now" button on the user page.

import { getPool } from "../../../../../lib/db.js";
import { processUser } from "../../../../../lib/pipeline.js";
import { hasApiKey } from "../../../../../lib/ai.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_request, { params }) {
  if (!hasApiKey()) {
    return Response.json(
      { ok: false, error: "Set ANTHROPIC_API_KEY (and OPENAI_API_KEY for search) to process activity." },
      { status: 400 }
    );
  }
  try {
    const { id } = await params;
    const result = await processUser(getPool(), id);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[users/process] failed:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
