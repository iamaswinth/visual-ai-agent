// Thin promise-based wrappers around chrome.storage.local.
//
// The MV3 service worker can be terminated by Chrome at any time, so nothing
// durable may live in memory. All settings, session state, and the unsent-event
// buffer are persisted here and re-read on wake.

const KEYS = Object.freeze({
  INSTALL_ID: "installId",
  ENABLED: "enabled",
  SESSION: "session", // { sessionId, startedAt, lastActivityAt }
  QUEUE: "eventQueue", // array of normalized events awaiting upload
  STATS: "stats", // { totalEvents, lastFlushAt }
  USER: "user", // { name, email } — the signed-in extension user
});

export { KEYS };

export async function get(key, fallback = null) {
  const res = await chrome.storage.local.get(key);
  return key in res ? res[key] : fallback;
}

export async function set(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export async function update(key, updater, fallback = null) {
  const current = await get(key, fallback);
  const next = updater(current);
  await set(key, next);
  return next;
}

export async function remove(key) {
  await chrome.storage.local.remove(key);
}

// ---- Settings -------------------------------------------------------------

export async function isEnabled() {
  return (await get(KEYS.ENABLED, false)) === true;
}

export async function setEnabled(value) {
  await set(KEYS.ENABLED, value === true);
}

// ---- Install id -----------------------------------------------------------

export async function getOrCreateInstallId() {
  let id = await get(KEYS.INSTALL_ID);
  if (!id) {
    id = crypto.randomUUID();
    await set(KEYS.INSTALL_ID, id);
  }
  return id;
}

// ---- Stats (for the popup counter) ---------------------------------------

export async function bumpStats(deltaEvents) {
  return update(
    KEYS.STATS,
    (s) => {
      const stats = s || { totalEvents: 0, lastFlushAt: null };
      stats.totalEvents += deltaEvents;
      return stats;
    },
    { totalEvents: 0, lastFlushAt: null }
  );
}

export async function markFlushed() {
  return update(
    KEYS.STATS,
    (s) => {
      const stats = s || { totalEvents: 0, lastFlushAt: null };
      stats.lastFlushAt = Date.now();
      return stats;
    },
    { totalEvents: 0, lastFlushAt: null }
  );
}

export async function getStats() {
  return get(KEYS.STATS, { totalEvents: 0, lastFlushAt: null });
}

// ---- Signed-in user -------------------------------------------------------

export async function getUser() {
  return get(KEYS.USER, null); // { name, email } or null
}

export async function setUser(user) {
  await set(KEYS.USER, user);
}

export async function clearUser() {
  await remove(KEYS.USER);
}
