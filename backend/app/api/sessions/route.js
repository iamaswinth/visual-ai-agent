// GET /api/sessions — list sessions with counts + domain summary, newest first.

import { listSessions } from "../../../lib/queries.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await listSessions();
    return Response.json({ ok: true, sessions });
  } catch (err) {
    console.error("[sessions] failed:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
