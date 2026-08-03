// Read-side queries for the dashboard. Kept separate from the routes so the
// SQL is in one place and reusable. Counts come back from pg as strings
// (bigint); callers coerce with Number().

import { getPool } from "./db.js";

/**
 * List sessions newest-first with per-session counts and a domain summary.
 * Counts use scalar subqueries (not joins) to avoid cartesian inflation.
 */
export async function listSessions({ userId = null, limit = 100 } = {}) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       s.session_id,
       s.install_id,
       s.started_at,
       s.ended_at,
       s.last_event_at,
       s.ip,
       s.city,
       s.country,
       s.region,
       s.ai_title,
       s.ai_category,
       s.analyzed_at,
       (SELECT count(*) FROM events e WHERE e.session_id = s.session_id) AS event_count,
       (SELECT count(*) FROM screenshots sc WHERE sc.session_id = s.session_id) AS screenshot_count,
       (SELECT count(*) FROM screenshots sc
          WHERE sc.session_id = s.session_id AND sc.caption IS NOT NULL) AS captioned_count,
       (SELECT array_remove(array_agg(DISTINCT substring(e.url from '://([^/]+)')), NULL)
          FROM events e WHERE e.session_id = s.session_id) AS domains
     FROM sessions s
     ${userId ? "WHERE s.user_id = $2" : ""}
     ORDER BY s.started_at DESC
     LIMIT $1`,
    userId ? [limit, userId] : [limit]
  );

  return rows.map((r) => ({
    sessionId: r.session_id,
    installId: r.install_id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    lastEventAt: r.last_event_at,
    ip: r.ip,
    city: r.city,
    country: r.country,
    region: r.region,
    aiTitle: r.ai_title,
    aiCategory: r.ai_category,
    analyzedAt: r.analyzed_at,
    eventCount: Number(r.event_count),
    screenshotCount: Number(r.screenshot_count),
    captionedCount: Number(r.captioned_count),
    domains: (r.domains || []).slice(0, 6),
  }));
}

/**
 * One session's meta plus its events in chronological order. Screenshot events
 * are linked to their stored screenshot (id + caption) so the UI can render the
 * image and its AI caption; raw bytes are never included here.
 */
export async function getSession(sessionId) {
  const pool = getPool();

  const meta = await pool.query(
    `SELECT s.session_id, s.install_id, s.started_at, s.ended_at, s.last_event_at,
            s.ip, s.city, s.country, s.region,
            s.ai_title, s.ai_summary, s.ai_category, s.ai_insights, s.analyzed_at,
            s.user_id, u.name AS user_name, u.email AS user_email
       FROM sessions s
       LEFT JOIN users u ON u.id = s.user_id
      WHERE s.session_id = $1`,
    [sessionId]
  );
  if (meta.rows.length === 0) return null;

  const events = await pool.query(
    `SELECT e.id, e.type, e.ts, e.tab_id, e.window_id, e.url, e.title, e.data,
            e.has_screenshot,
            sc.id AS screenshot_id, sc.caption, sc.trigger
       FROM events e
       LEFT JOIN screenshots sc ON sc.event_id = e.id
      WHERE e.session_id = $1
      ORDER BY e.ts ASC, e.id ASC`,
    [sessionId]
  );

  const m = meta.rows[0];
  return {
    sessionId: m.session_id,
    installId: m.install_id,
    startedAt: m.started_at,
    endedAt: m.ended_at,
    lastEventAt: m.last_event_at,
    ip: m.ip,
    city: m.city,
    country: m.country,
    region: m.region,
    aiTitle: m.ai_title,
    aiSummary: m.ai_summary,
    aiCategory: m.ai_category,
    aiInsights: m.ai_insights || [],
    analyzedAt: m.analyzed_at,
    userId: m.user_id,
    userName: m.user_name,
    userEmail: m.user_email,
    events: events.rows.map((e) => ({
      id: Number(e.id),
      type: e.type,
      ts: e.ts,
      tabId: e.tab_id,
      windowId: e.window_id,
      url: e.url,
      title: e.title,
      data: e.data,
      screenshotId: e.screenshot_id ? Number(e.screenshot_id) : null,
      caption: e.caption,
      trigger: e.trigger,
    })),
  };
}

/** Header totals for the dashboard. */
export async function getStats() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT
       (SELECT count(*) FROM sessions) AS sessions,
       (SELECT count(*) FROM events) AS events,
       (SELECT count(*) FROM screenshots) AS screenshots,
       (SELECT count(*) FROM screenshots WHERE caption IS NOT NULL) AS captioned,
       (SELECT count(*) FROM documents) AS indexed`
  );
  const r = rows[0];
  return {
    sessions: Number(r.sessions),
    events: Number(r.events),
    screenshots: Number(r.screenshots),
    captioned: Number(r.captioned),
    indexed: Number(r.indexed),
  };
}

/** Raw bytes + mime for one screenshot, for the image route. */
export async function getScreenshotBytes(id) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT mime, bytes FROM screenshots WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/** List signed-in users with per-user counts + latest location. */
export async function listUsers() {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.name, u.summary, u.last_seen,
       (SELECT count(*) FROM sessions s WHERE s.user_id = u.id) AS session_count,
       (SELECT count(*) FROM documents d WHERE d.user_id = u.id) AS indexed,
       (SELECT max(started_at) FROM sessions s WHERE s.user_id = u.id) AS last_active,
       (SELECT city FROM sessions s WHERE s.user_id = u.id AND city IS NOT NULL
          ORDER BY started_at DESC LIMIT 1) AS city,
       (SELECT country FROM sessions s WHERE s.user_id = u.id AND country IS NOT NULL
          ORDER BY started_at DESC LIMIT 1) AS country
     FROM users u
     ORDER BY last_active DESC NULLS LAST`
  );
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    summary: r.summary,
    sessionCount: Number(r.session_count),
    indexed: Number(r.indexed),
    lastActive: r.last_active,
    city: r.city,
    country: r.country,
  }));
}

/** One user's profile + their sessions. */
export async function getUserWithSessions(userId) {
  const pool = getPool();
  const u = await pool.query(
    `SELECT id, email, name, summary, first_seen, last_seen FROM users WHERE id = $1`,
    [userId]
  );
  if (u.rows.length === 0) return null;
  const sessions = await listSessions({ userId });
  const m = u.rows[0];
  return {
    id: m.id,
    email: m.email,
    name: m.name,
    summary: m.summary,
    firstSeen: m.first_seen,
    lastSeen: m.last_seen,
    sessions,
  };
}
