// Upload queue: the single owner of all network I/O.
//
// Events from every source (background listeners + content scripts) are enqueued
// here. Batches flush when the queue reaches BATCH_MAX_EVENTS or on a timer.
// The queue is persisted to chrome.storage.local so nothing is lost when the
// service worker is suspended. Failed uploads retry with exponential backoff.

import { CONFIG, ingestUrl } from "./config.js";
import { KEYS, get, set, bumpStats, markFlushed } from "../shared/storage.js";
import { makeBatch } from "../shared/event-schema.js";
import { getContext } from "./session.js";

let flushing = false;

/**
 * Enqueue one normalized event. Persists immediately, then flushes if the
 * queue is large enough.
 */
export async function enqueue(event) {
  const queue = await get(KEYS.QUEUE, []);
  queue.push(event);

  // Safety valve: if we've buffered too much (e.g. offline for a long time),
  // drop the oldest entries, screenshots first, to bound storage use.
  if (queue.length > CONFIG.MAX_BUFFERED_EVENTS) {
    trimQueue(queue);
  }

  await set(KEYS.QUEUE, queue);
  await bumpStats(1);

  if (queue.length >= CONFIG.BATCH_MAX_EVENTS) {
    // Fire and forget; flush guards against concurrency.
    flush();
  }
}

function trimQueue(queue) {
  const overflow = queue.length - CONFIG.MAX_BUFFERED_EVENTS;
  if (overflow <= 0) return;
  // First strip screenshot payloads from the oldest events to reclaim space
  // while keeping the activity record.
  for (let i = 0; i < queue.length && i < overflow * 4; i++) {
    if (queue[i].screenshot) delete queue[i].screenshot;
  }
  // If still over, drop the oldest events outright.
  if (queue.length > CONFIG.MAX_BUFFERED_EVENTS) {
    queue.splice(0, queue.length - CONFIG.MAX_BUFFERED_EVENTS);
  }
}

/**
 * Attempt to send everything currently queued. Safe to call concurrently —
 * only one flush runs at a time.
 */
export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    const queue = await get(KEYS.QUEUE, []);
    if (queue.length === 0) return;

    const { installId, sessionId } = await getContext();
    const batch = makeBatch({ installId, sessionId, events: queue });

    const ok = await postWithRetry(batch);
    if (ok) {
      // Only clear the events we actually sent; new ones may have arrived.
      const after = await get(KEYS.QUEUE, []);
      const remaining = after.slice(queue.length);
      await set(KEYS.QUEUE, remaining);
      await markFlushed();
      console.log(`[uploader] flushed ${queue.length} events`);
    } else {
      console.warn("[uploader] flush failed; events kept for retry");
    }
  } finally {
    flushing = false;
  }
}

async function postWithRetry(batch) {
  for (let attempt = 0; attempt <= CONFIG.UPLOAD_MAX_RETRIES; attempt++) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (CONFIG.INGEST_TOKEN) headers["x-ingest-token"] = CONFIG.INGEST_TOKEN;
      const res = await fetch(ingestUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(batch),
      });
      if (res.ok) return true;
      console.warn(`[uploader] server returned ${res.status}`);
    } catch (err) {
      console.warn(`[uploader] network error (attempt ${attempt}):`, err.message);
    }

    if (attempt < CONFIG.UPLOAD_MAX_RETRIES) {
      const delay = Math.min(
        CONFIG.UPLOAD_BACKOFF_BASE_MS * 2 ** attempt,
        CONFIG.UPLOAD_BACKOFF_MAX_MS
      );
      await sleep(delay);
    }
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
