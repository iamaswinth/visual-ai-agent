// Granular activity indexing for RAG.
//
// Turns every event and every screenshot into an embedded "document" so the
// chat can retrieve the actual activity (what was seen, where they navigated,
// what they did) — not just a session summary.

import { getPool } from "./db.js";
import { hasOpenAI, embedTexts, toPgVector } from "./embed.js";
import { captionBatch } from "./caption.js";

const host = (u) => {
  const m = /:\/\/([^/]+)/.exec(u || "");
  return m ? m[1] : null;
};

/**
 * Render one event as a natural-language sentence to embed. Every event type is
 * covered so "everything" is searchable.
 */
export function renderEvent(e) {
  const d = e.data || {};
  const at = e.url ? ` at ${host(e.url)}` : "";
  const page = e.title ? `"${e.title}"` : e.url || "a page";
  switch (e.type) {
    case "navigation":
      return `Navigated to ${page}${e.url ? ` (${e.url})` : ""}${d.transitionType ? ` via ${d.transitionType}` : ""}.`;
    case "click":
      return `Clicked ${d.button || "left"} on ${d.target?.text ? `"${d.target.text}"` : d.target?.tag || "an element"}${at}.`;
    case "scroll":
      return `Scrolled ${d.depthPct != null ? `to ${d.depthPct}%` : ""}${at}.`;
    case "selection":
      return `Selected ${d.length ?? "some"} characters of text${at}.`;
    case "copy":
      return `Copied ${d.length ?? "some"} characters${at}.`;
    case "download":
      return `Downloaded ${d.filename || "a file"}${d.mime ? ` (${d.mime})` : ""}.`;
    case "tab_created":
      return `Opened a new tab${e.url ? ` for ${e.url}` : ""}.`;
    case "tab_activated":
      return `Switched to the tab showing ${page}${e.url ? ` (${e.url})` : ""}.`;
    case "tab_updated":
      return `Tab updated to ${page}${d.status ? ` (${d.status})` : ""}.`;
    case "tab_closed":
      return `Closed a tab.`;
    case "tab_moved":
      return `Reordered a tab.`;
    case "window_focus":
      return d.focused ? "Focused the browser window." : "Left the browser window.";
    case "visibility":
      return `The tab became ${d.state || "visible/hidden"}${at}.`;
    case "idle_state":
      return `The user went ${d.state || "idle/active"}.`;
    case "session_start":
      return `Started a browsing session${d.reason ? ` (${d.reason})` : ""}.`;
    case "session_end":
      return `Ended the browsing session${d.reason ? ` (${d.reason})` : ""}.`;
    default:
      return `${e.type}${at}.`;
  }
}

/** Gather up to `limit` un-indexed units (events + captioned screenshots). */
async function pending(pool, limit) {
  const events = await pool.query(
    `SELECT e.id, e.session_id, e.install_id, e.type, e.ts, e.url, e.title, e.data
       FROM events e
      WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.event_id = e.id)
      ORDER BY e.ts ASC
      LIMIT $1`,
    [limit]
  );
  const shots = await pool.query(
    `SELECT sc.id, sc.session_id, sc.install_id, sc.ts, sc.caption,
            ev.url, ev.title
       FROM screenshots sc
       LEFT JOIN events ev ON ev.id = sc.event_id
      WHERE sc.caption IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM documents d WHERE d.screenshot_id = sc.id)
      ORDER BY sc.ts ASC
      LIMIT $1`,
    [limit]
  );
  return { events: events.rows, shots: shots.rows };
}

/**
 * Index a batch: caption a few screenshots, then build + embed documents for
 * un-indexed events and captioned screenshots. Idempotent (unique indexes).
 * @returns {Promise<{indexed:number, captioned:number, remaining:number}>}
 */
export async function indexBatch(limit = 80) {
  const pool = getPool();

  // Ensure some screenshots have descriptions (that's the "what they saw" text).
  const captioned = await captionBatch(6);

  const { events, shots } = await pending(pool, limit);

  // Build the document rows (without embeddings yet).
  const docs = [];
  for (const e of events) {
    docs.push({
      session_id: e.session_id,
      install_id: e.install_id,
      kind: e.type,
      event_id: e.id,
      screenshot_id: null,
      ts: e.ts,
      url: e.url,
      title: e.title,
      text: renderEvent(e),
    });
  }
  for (const s of shots) {
    const where = s.title || s.url ? ` on ${s.title || s.url}` : "";
    docs.push({
      session_id: s.session_id,
      install_id: s.install_id,
      kind: "screenshot",
      event_id: null,
      screenshot_id: s.id,
      ts: s.ts,
      url: s.url,
      title: s.title,
      text: `Screen viewed${where}: ${s.caption}`,
    });
  }

  if (docs.length === 0) return { indexed: 0, captioned, remaining: 0 };

  // Embed in sub-batches (OpenAI accepts arrays).
  let indexed = 0;
  const CHUNK = 96;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const slice = docs.slice(i, i + CHUNK);
    let vectors = [];
    if (hasOpenAI()) {
      try {
        vectors = await embedTexts(slice.map((d) => d.text));
      } catch (err) {
        console.error("[index] embedding failed:", err.message);
        break; // stop this run; already-inserted rows persist, rest retried later
      }
    }
    // Insert rows (with embeddings when available). ON CONFLICT does nothing so
    // re-runs are safe.
    for (let j = 0; j < slice.length; j++) {
      const d = slice[j];
      const vec = vectors[j] ? toPgVector(vectors[j]) : null;
      try {
        await pool.query(
          `INSERT INTO documents
             (session_id, install_id, kind, event_id, screenshot_id, ts, url, title, text, embedding)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,${vec ? "$10::vector" : "NULL"})
           ON CONFLICT DO NOTHING`,
          vec
            ? [d.session_id, d.install_id, d.kind, d.event_id, d.screenshot_id, d.ts, d.url, d.title, d.text, vec]
            : [d.session_id, d.install_id, d.kind, d.event_id, d.screenshot_id, d.ts, d.url, d.title, d.text]
        );
        indexed += 1;
      } catch (err) {
        console.error("[index] insert failed:", err.message);
      }
    }
  }

  // How much is still un-indexed (for the button's counter).
  const rem = await pool.query(
    `SELECT
       (SELECT count(*) FROM events e WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.event_id = e.id))
     + (SELECT count(*) FROM screenshots s WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.screenshot_id = s.id)) AS remaining`
  );
  return { indexed, captioned, remaining: Number(rem.rows[0].remaining) };
}

/** Count of activity units not yet indexed (for the dashboard button). */
export async function unindexedCount() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*) FROM events e WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.event_id = e.id))
     + (SELECT count(*) FROM screenshots s WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.screenshot_id = s.id)) AS n`
  );
  return Number(rows[0].n);
}
