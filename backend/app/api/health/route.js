// GET /api/health — liveness + database connectivity check.

import { getPool } from "../../../lib/db.js";

export const runtime = "nodejs";

export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query("SELECT now() AS now");
    return Response.json({ ok: true, db: "up", now: rows[0].now });
  } catch (err) {
    return Response.json({ ok: false, db: "down", error: err.message }, { status: 500 });
  }
}
