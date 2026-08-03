// AI captioning — the "Visual AI" layer.
//
// Turns stored screenshots into one-sentence activity descriptions using a
// cheap/fast Claude vision model, and writes them back to screenshots.caption.

import { getPool } from "./db.js";
import { getAnthropic, captionModel, hasApiKey } from "./ai.js";

export { hasApiKey }; // re-exported for existing importers (caption/run route)

const SYSTEM_PROMPT =
  "You are a browser-activity analyst. You are given a screenshot of a web page " +
  "the user was viewing. Reply with ONE short, concrete sentence describing what " +
  "the user appears to be doing (e.g. 'Reading a Hacker News thread about databases' " +
  "or 'Filling out a checkout form on an online store'). No preamble, no markdown, " +
  "no quotes — just the sentence.";

// data: URLs accept only these image media types.
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/**
 * Caption a single screenshot.
 * @param {{bytes:Buffer, mime:string, url?:string, title?:string}} shot
 * @returns {Promise<string>} the caption text
 */
export async function captionScreenshot(shot) {
  const mime = ALLOWED_MIME.has(shot.mime) ? shot.mime : "image/jpeg";
  const context = [shot.title, shot.url].filter(Boolean).join(" — ");

  const resp = await getAnthropic().messages.create({
    model: captionModel(),
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mime, data: shot.bytes.toString("base64") },
          },
          ...(context ? [{ type: "text", text: `Page context: ${context}` }] : []),
        ],
      },
    ],
  });

  const text = (resp.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .replace(/<\/?thinking>/gi, "")
    .trim();

  return text || "(no caption produced)";
}

/**
 * Caption up to `limit` uncaptioned screenshots. Uses the partial index
 * idx_screenshots_uncaptioned. Returns how many were captioned.
 */
export async function captionBatch(limit = 10) {
  const pool = getPool();
  // url/title live on the linked event, not on screenshots — join for context.
  const { rows } = await pool.query(
    `SELECT sc.id, sc.mime, sc.bytes, ev.url, ev.title
       FROM screenshots sc
       LEFT JOIN events ev ON ev.id = sc.event_id
      WHERE sc.caption IS NULL
      ORDER BY sc.id ASC
      LIMIT $1`,
    [limit]
  );

  let done = 0;
  for (const row of rows) {
    try {
      const caption = await captionScreenshot(row);
      await pool.query(
        `UPDATE screenshots SET caption = $1, captioned_at = now() WHERE id = $2`,
        [caption, row.id]
      );
      done += 1;
    } catch (err) {
      console.error(`[caption] screenshot ${row.id} failed:`, err.message);
    }
  }
  return done;
}
