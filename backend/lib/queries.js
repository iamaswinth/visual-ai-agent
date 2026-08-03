// Read-side queries for the dashboard. Kept separate from the routes so the
// SQL is in one place and reusable. Counts come back from pg as strings
// (bigint); callers coerce with Number().

import { getPool } from "./db.js";

/**
 * List sessions newest-first with per-session counts and a domain summary.
 * Counts use scalar subqueries (not joins) to avoid cartesian inflation.
 */
export async function listSessions(limit = 100) {
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
     ORDER BY s.started_at DESC
     LIMIT $1`,
    [limit]
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
    `SELECT session_id, install_id, started_at, ended_at, last_event_at,
            ip, city, country, region,
            ai_title, ai_summary, ai_category, ai_insights, analyzed_at
       FROM sessions WHERE session_id = $1`,
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
       (SELECT count(*) FROM screenshots WHERE caption IS NOT NULL) AS captioned`
  );
  const r = rows[0];
  return {
    sessions: Number(r.sessions),
    events: Number(r.events),
    screenshots: Number(r.screenshots),
    captioned: Number(r.captioned),
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
