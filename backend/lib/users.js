// Per-user rolling summary.
//
// Regenerates a short profile of what a user does across their sessions and
// embeds it. The chat uses it as extra grounding when answering about a user,
// and it refreshes as sessions complete. Hash-gated so unchanged history is not
// re-summarized.

import crypto from "node:crypto";
import { getAnthropic, reasoningModel, hasApiKey } from "./ai.js";
import { hasOpenAI, embedText, toPgVector } from "./embed.js";

const SYSTEM_PROMPT =
  "You are the Visual AI agent. Given a user's browsing history across sessions, write a short " +
  "profile (2-4 sentences) of who this user appears to be and what they mainly do online — the " +
  "kinds of sites, tasks, and interests. Be concrete and neutral. No preamble, no markdown.";

/** Build the compact history text we summarize + hash for a user. */
async function historyText(pool, userId) {
  const { rows } = await pool.query(
    `SELECT ai_title, ai_summary, ai_category, city, country, started_at,
            (SELECT array_remove(array_agg(DISTINCT substring(e.url from '://([^/]+)')), NULL)
               FROM events e WHERE e.session_id = s.session_id) AS domains
       FROM sessions s
      WHERE user_id = $1
      ORDER BY started_at DESC
      LIMIT 40`,
    [userId]
  );
  return rows
    .map((r, i) => {
      const bits = [
        `Session ${i + 1}`,
        r.ai_title ? `"${r.ai_title}"` : null,
        r.ai_category ? `(${r.ai_category})` : null,
        (r.domains || []).slice(0, 6).join(", ") || null,
        r.ai_summary || null,
      ].filter(Boolean);
      return "- " + bits.join(" — ");
    })
    .join("\n")
    .slice(0, 8000);
}

/**
 * Regenerate + store a user's rolling summary (and its embedding), only when the
 * underlying history changed. No-op without an Anthropic key.
 * @returns {Promise<boolean>} whether the summary was updated
 */
export async function updateUserSummary(pool, userId) {
  if (!userId || !hasApiKey()) return false;

  const history = await historyText(pool, userId);
  if (!history.trim()) return false;
  const hash = crypto.createHash("sha256").update(history).digest("hex");

  const cur = await pool.query(`SELECT summary_hash FROM users WHERE id = $1`, [userId]);
  if (cur.rows[0]?.summary_hash === hash) return false;

  let summary;
  try {
    const resp = await getAnthropic().messages.create({
      model: reasoningModel(),
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `User's browsing history:\n${history}` }],
    });
    summary = (resp.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
  } catch (err) {
    console.error(`[users] summary ${userId} failed:`, err.message);
    return false;
  }
  if (!summary) return false;

  let embedding = null;
  if (hasOpenAI()) {
    try {
      embedding = toPgVector(await embedText(summary));
    } catch (err) {
      console.error(`[users] summary embed ${userId} failed:`, err.message);
    }
  }

  await pool.query(
    `UPDATE users
        SET summary = $1, summary_hash = $2,
            summary_embedding = ${embedding ? "$4::vector" : "summary_embedding"}
      WHERE id = $3`,
    embedding ? [summary, hash, userId, embedding] : [summary, hash, userId]
  );
  return true;
}
