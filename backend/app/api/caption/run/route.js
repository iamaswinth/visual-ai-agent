// POST /api/caption/run — caption a batch of uncaptioned screenshots on demand.
// Powers the dashboard's "Generate captions" button.

import { captionBatch, hasApiKey } from "../../../../lib/caption.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!hasApiKey()) {
    return Response.json(
      { ok: false, error: "Set ANTHROPIC_API_KEY in backend/.env to enable captioning." },
      { status: 400 }
    );
  }
  try {
    const captioned = await captionBatch(12);
    return Response.json({ ok: true, captioned });
  } catch (err) {
    console.error("[caption/run] failed:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
