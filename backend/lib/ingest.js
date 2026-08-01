// Ingestion logic: turns one posted batch into database rows.
//
// Kept separate from the HTTP route so it can be unit-tested directly against a
// pg client (see scripts/test-ingest.js). The whole batch is written in a
// single transaction so a partial failure never leaves half a batch behind.

/**
 * Parse a data: URL into its mime type and raw bytes.
 * @param {string} dataUrl e.g. "data:image/jpeg;base64,...."
 * @returns {{mime:string, buffer:Buffer}|null}
 */
export function parseDataUrl(dataUrl) {
  if (typeof dataUrl !== "string") return null;
  const m = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

/**
 * Basic shape validation for an incoming batch.
 * @returns {string|null} an error message, or null if valid
 */
export function validateBatch(batch) {
  if (!batch || typeof batch !== "object") return "body must be a JSON object";
  if (!isUuidish(batch.installId)) return "installId must be a uuid";
  if (!isUuidish(batch.sessionId)) return "sessionId must be a uuid";
  if (!Array.isArray(batch.events)) return "events must be an array";
  return null;
}

function isUuidish(v) {
  return typeof v === "string" && v.length >= 8 && v.length <= 64;
}

function toTimestamp(ms) {
  const n = Number(ms);
  return Number.isFinite(n) ? new Date(n).toISOString() : new Date().toISOString();
}

/**
 * Write a batch to the database using the given pg client (or pool).
 * @returns {Promise<{events:number, screenshots:number}>}
 */
export async function processBatch(client, batch) {
  const { installId, sessionId, events } = batch;

  await client.query("BEGIN");
  try {
    // Upsert install.
    await client.query(
      `INSERT INTO installs (install_id)
         VALUES ($1)
         ON CONFLICT (install_id) DO UPDATE SET last_seen = now()`,
      [installId]
    );

    // Upsert session.
    await client.query(
      `INSERT INTO sessions (session_id, install_id)
         VALUES ($1, $2)
         ON CONFLICT (session_id) DO UPDATE SET install_id = EXCLUDED.install_id`,
      [sessionId, installId]
    );

    let screenshotCount = 0;
    let lastEventTs = null;

    for (const evt of events) {
      const ts = toTimestamp(evt.ts);
      lastEventTs = ts;
      const hasShot = evt.type === "screenshot" && typeof evt.screenshot === "string";

      const { rows } = await client.query(
        `INSERT INTO events
           (session_id, install_id, type, ts, tab_id, window_id, url, title, data, has_screenshot)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          sessionId,
          installId,
          String(evt.type || "unknown"),
          ts,
          intOrNull(evt.tabId),
          intOrNull(evt.windowId),
          evt.url ?? null,
          evt.title ?? null,
          JSON.stringify(evt.data ?? {}),
          hasShot,
        ]
      );
      const eventId = rows[0].id;

      // Store screenshot bytes.
      if (hasShot) {
        const parsed = parseDataUrl(evt.screenshot);
        if (parsed) {
          await client.query(
            `INSERT INTO screenshots
               (event_id, session_id, install_id, ts, mime, bytes, byte_size, trigger)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              eventId,
              sessionId,
              installId,
              ts,
              parsed.mime,
              parsed.buffer,
              parsed.buffer.length,
              evt.data?.trigger ?? null,
            ]
          );
          screenshotCount += 1;
        }
      }

      // Session lifecycle bookkeeping.
      if (evt.type === "session_start") {
        await client.query(
          `UPDATE sessions SET started_at = LEAST(started_at, $2) WHERE session_id = $1`,
          [sessionId, ts]
        );
      } else if (evt.type === "session_end") {
        await client.query(
          `UPDATE sessions SET ended_at = $2 WHERE session_id = $1`,
          [sessionId, ts]
        );
      }
    }

    if (lastEventTs) {
      await client.query(
        `UPDATE sessions SET last_event_at = $2 WHERE session_id = $1`,
        [sessionId, lastEventTs]
      );
    }

    await client.query("COMMIT");
    return { events: events.length, screenshots: screenshotCount };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

function intOrNull(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
