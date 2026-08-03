// GET /api/users/[id] — one user's profile (rolling summary) + their sessions.

import { getUserWithSessions } from "../../../../lib/queries.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const user = await getUserWithSessions(id);
    if (!user) return Response.json({ ok: false, error: "not found" }, { status: 404 });
    return Response.json({ ok: true, user });
  } catch (err) {
    console.error("[user detail] failed:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
