// Direct end-to-end test of the ingestion path against the configured database,
// without booting Next.js. Inserts a sample batch (including a screenshot),
// then reads back counts and the stored screenshot byte length.
//
// Usage:  npm run test:ingest   (loads .env for DATABASE_URL)

import pg from "pg";
import { processBatch } from "../lib/ingest.js";

const { Client } = pg;

// A 1x1 red PNG as a data URL, standing in for a real screenshot.
const SAMPLE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const ssl = /localhost|127\.0\.0\.1/.test(connectionString)
    ? false
    : { rejectUnauthorized: false };

  const client = new Client({ connectionString, ssl });
  await client.connect();

  const installId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  const batch = {
    installId,
    sessionId,
    sentAt: now,
    events: [
      { type: "session_start", ts: now, data: { reason: "test" } },
      {
        type: "navigation",
        ts: now + 1,
        tabId: 5,
        windowId: 1,
        url: "https://example.com/checkout",
        title: "Checkout",
        data: { transitionType: "link" },
      },
      {
        type: "click",
        ts: now + 2,
        tabId: 5,
        windowId: 1,
        url: "https://example.com/checkout",
        data: { button: "left", target: { tag: "button", text: "Add to cart" } },
      },
      {
        type: "screenshot",
        ts: now + 3,
        tabId: 5,
        windowId: 1,
        url: "https://example.com/checkout",
        title: "Checkout",
        screenshot: SAMPLE_PNG,
        data: { trigger: "interval" },
      },
      { type: "session_end", ts: now + 4, data: { reason: "test_done" } },
    ],
  };

  const result = await processBatch(client, batch);
  console.log("processBatch ->", result);

  const events = await client.query("SELECT count(*)::int AS n FROM events WHERE session_id = $1", [sessionId]);
  const shots = await client.query(
    "SELECT byte_size, mime, trigger FROM screenshots WHERE session_id = $1",
    [sessionId]
  );
  const session = await client.query(
    "SELECT started_at, ended_at, last_event_at FROM sessions WHERE session_id = $1",
    [sessionId]
  );

  console.log("events stored:", events.rows[0].n);
  console.log("screenshots stored:", shots.rows);
  console.log("session row:", session.rows[0]);

  const ok =
    result.events === 5 &&
    result.screenshots === 1 &&
    events.rows[0].n === 5 &&
    shots.rows.length === 1 &&
    shots.rows[0].byte_size > 0 &&
    session.rows[0].ended_at !== null;

  await client.end();

  if (ok) {
    console.log("\nPASS: batch stored and verified end-to-end.");
    process.exit(0);
  } else {
    console.error("\nFAIL: verification did not match expectations.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
