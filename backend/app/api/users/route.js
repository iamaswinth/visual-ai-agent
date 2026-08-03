// GET /api/users — list signed-in users with per-user counts + location.

import { listUsers } from "../../../lib/queries.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await listUsers();
    return Response.json({ ok: true, users });
  } catch (err) {
    console.error("[users] failed:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
