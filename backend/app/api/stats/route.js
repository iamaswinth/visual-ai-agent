// GET /api/stats — header totals for the dashboard.

import { getStats } from "../../../lib/queries.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getStats();
    return Response.json({ ok: true, stats });
  } catch (err) {
    console.error("[stats] failed:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
