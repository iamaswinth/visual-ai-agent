// POST /api/ingest — receive an activity batch from the extension and store it.
//
// The extension has <all_urls> host permission, so cross-origin isn't an issue
// for it, but we set permissive CORS + an OPTIONS handler so the endpoint can
// also be exercised from anywhere during testing.

import { getPool } from "../../../lib/db.js";
import { processBatch, validateBatch } from "../../../lib/ingest.js";

export const runtime = "nodejs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-ingest-token",
};

// When INGEST_TOKEN is configured, the extension must send it as x-ingest-token.
// If unset (local dev), ingest is open so test:ingest and the local flow work.
function tokenOk(request) {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) return true;
  return request.headers.get("x-ingest-token") === expected;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request) {
  if (!tokenOk(request)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let batch;
  try {
    batch = await request.json();
  } catch {
    return json({ ok: false, error: "invalid JSON" }, 400);
  }

  const invalid = validateBatch(batch);
  if (invalid) return json({ ok: false, error: invalid }, 400);

  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await processBatch(client, batch);
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("[ingest] failed:", err);
    return json({ ok: false, error: "internal error" }, 500);
  } finally {
    client.release();
  }
}
