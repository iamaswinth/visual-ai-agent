// GET /api/sessions/[id] — one session's event timeline (no screenshot bytes;
// screenshot events carry a screenshotId + caption instead).

import { getSession } from "../../../../lib/queries.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const { id } = await params; // Next.js 15: params is async
    const session = await getSession(id);
    if (!session) {
      return Response.json({ ok: false, error: "not found" }, { status: 404 });
    }
    return Response.json({ ok: true, session });
  } catch (err) {
    console.error("[session detail] failed:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
