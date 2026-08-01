// Session lifecycle management (LOCKED: startup + idle timeout).
//
// installId  : persistent per install, never rotates.
// sessionId  : new on browser startup, and a new one after >= 30 min of idle/locked.
//
// State is persisted so it survives the service worker being suspended.

import { CONFIG } from "./config.js";
import {
  KEYS,
  get,
  set,
  getOrCreateInstallId,
} from "../shared/storage.js";

/**
 * Return the current session, creating one if none exists.
 * @returns {Promise<{sessionId:string, startedAt:number, lastActivityAt:number}>}
 */
export async function getSession() {
  let session = await get(KEYS.SESSION);
  if (!session) {
    session = await startNewSession();
  }
  return session;
}

export async function getContext() {
  const [installId, session] = await Promise.all([
    getOrCreateInstallId(),
    getSession(),
  ]);
  return { installId, sessionId: session.sessionId };
}

/**
 * Start a brand new session and persist it.
 */
export async function startNewSession() {
  const now = Date.now();
  const session = {
    sessionId: crypto.randomUUID(),
    startedAt: now,
    lastActivityAt: now,
  };
  await set(KEYS.SESSION, session);
  return session;
}

/**
 * Called on any recorded activity. If the gap since last activity exceeds the
 * idle-reset threshold, rotate to a new session.
 *
 * @returns {Promise<{rotated:boolean, previous:object|null, current:object}>}
 */
export async function touchSession(ts = Date.now()) {
  const session = await get(KEYS.SESSION);
  if (!session) {
    const current = await startNewSession();
    return { rotated: false, previous: null, current };
  }

  const gap = ts - (session.lastActivityAt ?? session.startedAt);
  if (gap >= CONFIG.SESSION_IDLE_RESET_MS) {
    const previous = session;
    const current = await startNewSession();
    return { rotated: true, previous, current };
  }

  session.lastActivityAt = ts;
  await set(KEYS.SESSION, session);
  return { rotated: false, previous: null, current: session };
}
