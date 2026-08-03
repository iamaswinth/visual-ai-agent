// Session intelligence: Claude vision reasons over a session's screenshots +
// event timeline and produces a structured understanding (title, summary,
// category, insights). The understanding is also embedded (pgvector) for the
// RAG chat — re-embedded only when its source text changes (hash-gated).

import crypto from "node:crypto";
import { getPool } from "./db.js";
import { getAnthropic, reasoningModel } from "./ai.js";
import { hasOpenAI, embedText, toPgVector } from "./embed.js";

const CATEGORIES = ["work", "research", "shopping", "social", "media", "communication", "other"];
const MAX_SHOTS = 4; // cap images per analysis to bound cost/tokens
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const SYSTEM_PROMPT =
  "You are a Visual AI agent that monitors a user's web browsing. Given a session's " +
  "event timeline and a few screenshots, infer what the user was actually doing. " +
  "Respond with ONLY a JSON object (no markdown, no code fences) of the exact shape:\n" +
  '{"title": string (max ~8 words), "summary": string (2-3 sentences, plain English), ' +
  `"category": one of ${JSON.stringify(CATEGORIES)}, "insights": string[] (2-4 short bullet observations)}`;

function hostOf(url) {
  const m = /:\/\/([^/]+)/.exec(url || "");
  return m ? m[1] : null;
}

function stripFences(s) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

function parseJson(text) {
  try {
    return JSON.parse(stripFences(text));
  } catch {
    // Last resort: grab the first {...} block.
    const m = /\{[\s\S]*\}/.exec(text);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

async function loadSession(pool, sessionId) {
  const events = await pool.query(
    `SELECT type, ts, url, title, data FROM events
       WHERE session_id = $1 ORDER BY ts ASC LIMIT 200`,
    [sessionId]
  );
  const shots = await pool.query(
    `SELECT mime, bytes, caption FROM screenshots
       WHERE session_id = $1 ORDER BY ts DESC LIMIT $2`,
    [sessionId, MAX_SHOTS]
  );
  return { events: events.rows, shots: shots.rows };
}

function buildTimeline(events) {
  const lines = events.map((e) => {
    const bits = [e.type];
    if (e.title) bits.push(`"${e.title}"`);
    if (e.url) bits.push(e.url);
    const d = e.data || {};
    if (e.type === "click" && d.target?.text) bits.push(`clicked "${d.target.text}"`);
    if (e.type === "scroll" && d.depthPct != null) bits.push(`scroll ${d.depthPct}%`);
    return "- " + bits.join(" · ");
  });
  return lines.join("\n").slice(0, 8000); // bound prompt size
}

function domainsOf(events) {
  const set = new Set();
  for (const e of events) {
    const h = hostOf(e.url);
    if (h) set.add(h);
  }
  return [...set].slice(0, 8);
}

/**
 * Analyze one session: write ai_* fields and (re)embed if the understanding changed.
 * @returns {Promise<{title:string, category:string, embedded:boolean}>}
 */
export async function analyzeSession(pool, sessionId) {
  const { events, shots } = await loadSession(pool, sessionId);
  const domains = domainsOf(events);

  const imageBlocks = shots
    .filter((s) => s.bytes)
    .map((s) => ({
      type: "image",
      source: {
        type: "base64",
        media_type: ALLOWED_MIME.has(s.mime) ? s.mime : "image/jpeg",
        data: s.bytes.toString("base64"),
      },
    }));

  const textPrompt =
    `Domains visited: ${domains.join(", ") || "unknown"}\n\n` +
    `Event timeline (${events.length} events):\n${buildTimeline(events)}\n\n` +
    (shots.some((s) => s.caption)
      ? `Screenshot captions:\n${shots.filter((s) => s.caption).map((s) => "- " + s.caption).join("\n")}\n\n`
      : "") +
    "Return the JSON object described in the system prompt.";

  const resp = await getAnthropic().messages.create({
    model: reasoningModel(),
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: [...imageBlocks, { type: "text", text: textPrompt }] }],
  });

  const raw = (resp.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ");
  const parsed = parseJson(raw) || {};

  const title = String(parsed.title || "Browsing session").slice(0, 120);
  const summary = String(parsed.summary || "").slice(0, 2000);
  const category = CATEGORIES.includes(parsed.category) ? parsed.category : "other";
  const insights = Array.isArray(parsed.insights)
    ? parsed.insights.map((s) => String(s).slice(0, 300)).slice(0, 6)
    : [];

  await pool.query(
    `UPDATE sessions
        SET ai_title = $1, ai_summary = $2, ai_category = $3,
            ai_insights = $4, analyzed_at = now()
      WHERE session_id = $5`,
    [title, summary, category, JSON.stringify(insights), sessionId]
  );

  // Embed the understanding for RAG — hash-gated (re-embed only on change).
  const cur = await pool.query(`SELECT embedding_hash FROM sessions WHERE session_id = $1`, [sessionId]);
  const embedded = await embedAndStore(
    pool,
    sessionId,
    embedSourceText({ title, summary, category, insights }),
    cur.rows[0]?.embedding_hash
  );

  return { title, category, embedded };
}

/** The text we embed for a session (kept stable so the hash is reproducible). */
export function embedSourceText({ title, summary, category, insights }) {
  return [title, summary, category, ...(insights || [])].join(" | ");
}

/**
 * Embed `source` and store it on the session, but only when its hash differs
 * from `priorHash` (so unchanged sessions are never re-embedded). No-op without
 * an OpenAI key. Shared by analyzeSession and the embed-backfill script.
 * @returns {Promise<boolean>} whether a new embedding was written
 */
export async function embedAndStore(pool, sessionId, source, priorHash) {
  if (!hasOpenAI()) return false;
  const hash = crypto.createHash("sha256").update(source).digest("hex");
  if (priorHash === hash) return false;
  try {
    const vec = await embedText(source);
    await pool.query(
      `UPDATE sessions SET embedding = $1::vector, embedding_hash = $2 WHERE session_id = $3`,
      [toPgVector(vec), hash, sessionId]
    );
    return true;
  } catch (err) {
    console.error(`[embed] session ${sessionId} failed:`, err.message);
    return false;
  }
}

/**
 * Analyze up to `limit` not-yet-analyzed sessions that have events.
 * Per-session errors are isolated so one failure doesn't abort the run.
 */
export async function analyzeBatch(limit = 10) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT s.session_id
       FROM sessions s
      WHERE s.analyzed_at IS NULL
        AND EXISTS (SELECT 1 FROM events e WHERE e.session_id = s.session_id)
      ORDER BY s.started_at DESC
      LIMIT $1`,
    [limit]
  );

  let done = 0;
  for (const r of rows) {
    try {
      await analyzeSession(pool, r.session_id);
      done += 1;
    } catch (err) {
      console.error(`[analyze] session ${r.session_id} failed:`, err.message);
    }
  }
  return done;
}
