// Canonical event schema shared by the content script and the background worker.
// Every captured activity is normalized into one flat shape before batching so the
// backend has a single contract to store against.

export const EVENT_TYPES = Object.freeze({
  // Session lifecycle
  SESSION_START: "session_start",
  SESSION_END: "session_end",

  // Tabs & windows (background)
  TAB_CREATED: "tab_created",
  TAB_ACTIVATED: "tab_activated",
  TAB_UPDATED: "tab_updated",
  TAB_MOVED: "tab_moved",
  TAB_CLOSED: "tab_closed",
  WINDOW_FOCUS: "window_focus",

  // Navigation (background)
  NAVIGATION: "navigation",

  // Downloads (background)
  DOWNLOAD: "download",

  // Attention (background)
  IDLE_STATE: "idle_state",

  // DOM-level (content script)
  CLICK: "click",
  SCROLL: "scroll",
  SELECTION: "selection",
  COPY: "copy",
  VISIBILITY: "visibility",

  // Visual
  SCREENSHOT: "screenshot",
});

const KNOWN_TYPES = new Set(Object.values(EVENT_TYPES));

/**
 * Build a normalized event object.
 *
 * @param {string} type   one of EVENT_TYPES
 * @param {object} fields  { tabId, windowId, url, title, data, screenshot, ts }
 * @returns {object} normalized event
 */
export function makeEvent(type, fields = {}) {
  if (!KNOWN_TYPES.has(type)) {
    // Not fatal — we still record it, but flag it so bad callers are visible.
    console.warn("[event-schema] unknown event type:", type);
  }
  const evt = {
    type,
    ts: fields.ts ?? Date.now(),
    tabId: fields.tabId ?? null,
    windowId: fields.windowId ?? null,
    url: fields.url ?? null,
    title: fields.title ?? null,
    data: fields.data ?? {},
  };
  // Screenshots are large; only attach the field when present.
  if (fields.screenshot) {
    evt.screenshot = fields.screenshot;
  }
  return evt;
}

/**
 * Wrap a list of events into the batch envelope the ingestion API expects.
 */
export function makeBatch({ installId, sessionId, events }) {
  return {
    installId,
    sessionId,
    sentAt: Date.now(),
    events,
  };
}
