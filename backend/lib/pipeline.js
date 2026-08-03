// End-to-end AI pipeline: caption screens -> analyze sessions -> index activity
// -> update the user's rolling profile. Used both automatically on session end
// and by the manual "Index now" button. Every step is best-effort and gated on
// the relevant key, so missing keys degrade gracefully.

import { hasApiKey } from "./ai.js";
import { captionBatch } from "./caption.js";
import { analyzeSession } from "./analyze.js";
import { indexSession } from "./documents.js";
import { updateUserSummary } from "./users.js";

const safe = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    console.error("[pipeline]", err.message);
    return undefined;
  }
};

/** Process one ended session (auto path on session_end). */
export async function processSession(pool, sessionId, userId) {
  if (hasApiKey()) {
    await safe(() => captionBatch(10)); // describe screens ("what they saw")
    await safe(() => analyzeSession(pool, sessionId)); // session summary + embedding
  }
  await safe(() => indexSession(pool, sessionId)); // documents for chat
  if (userId) await safe(() => updateUserSummary(pool, userId)); // rolling profile
}

/**
 * Process a whole user (manual "Index now"): caption their screens, analyze any
 * un-analyzed sessions, (re)index their activity, and refresh their profile.
 * @returns {Promise<{captioned:number, analyzed:number, indexed:number, summary:boolean}>}
 */
export async function processUser(pool, userId) {
  const out = { captioned: 0, analyzed: 0, indexed: 0, summary: false };

  if (hasApiKey()) {
    out.captioned = (await safe(() => captionBatch(24))) || 0;
    const un = await pool.query(
      `SELECT session_id FROM sessions WHERE user_id = $1 AND analyzed_at IS NULL`,
      [userId]
    );
    for (const r of un.rows) {
      if (await safe(() => analyzeSession(pool, r.session_id))) out.analyzed += 1;
    }
  }

  const sessions = await pool.query(`SELECT session_id FROM sessions WHERE user_id = $1`, [userId]);
  for (const r of sessions.rows) {
    out.indexed += (await safe(() => indexSession(pool, r.session_id))) || 0;
  }

  out.summary = Boolean(await safe(() => updateUserSummary(pool, userId)));
  return out;
}
