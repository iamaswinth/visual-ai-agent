// Central configuration for the Visual AI Agent extension.
// Everything tunable lives here so the capture behavior and backend target
// can be changed without touching the capture logic.

export const CONFIG = {
  // Ingestion endpoint. Point this at the local test sink during development,
  // or at the real backend (e.g. https://your-app.vercel.app) in production.
  API_BASE: "http://localhost:8787",
  INGEST_PATH: "/api/ingest",

  // Screenshot capture (LOCKED: interval + key events).
  SCREENSHOT_INTERVAL_MS: 15000, // periodic capture cadence
  SCREENSHOT_FORMAT: "jpeg",
  SCREENSHOT_QUALITY: 50, // 0-100, lower = smaller payloads
  // Chrome caps captureVisibleTab at ~2/sec (MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND).
  // Never capture more often than this many ms apart, regardless of triggers.
  SCREENSHOT_MIN_GAP_MS: 1000,

  // Upload batching.
  BATCH_MAX_EVENTS: 25, // flush when the queue reaches this size
  BATCH_FLUSH_INTERVAL_MS: 10000, // ...or at least this often
  UPLOAD_MAX_RETRIES: 5,
  UPLOAD_BACKOFF_BASE_MS: 2000, // exponential: base * 2^attempt (capped)
  UPLOAD_BACKOFF_MAX_MS: 60000,

  // Session boundaries (LOCKED: startup + idle timeout).
  IDLE_DETECTION_SECONDS: 60, // chrome.idle granularity
  SESSION_IDLE_RESET_MS: 30 * 60 * 1000, // 30 min idle -> new session

  // Safety valve: cap how many unsent events we buffer in storage before dropping
  // the oldest (screenshots dropped first).
  MAX_BUFFERED_EVENTS: 2000,
};

export function ingestUrl() {
  return `${CONFIG.API_BASE}${CONFIG.INGEST_PATH}`;
}
