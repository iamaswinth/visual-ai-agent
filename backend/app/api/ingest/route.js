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
  "Access-Control-Allow-Headers": "Content-Type",
};

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
