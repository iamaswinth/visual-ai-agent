// Background service worker: the central event hub.
//
// Responsibilities:
//   - register chrome.* listeners for tabs, windows, navigation, downloads, idle
//   - receive DOM events forwarded from content scripts
//   - drive the screenshot loop (interval + key events)
//   - hand everything to the uploader queue
//
// The worker can be suspended by Chrome at any time. It is written to be fully
// re-entrant: no important state lives in module memory (it lives in
// chrome.storage via storage.js / session.js), and periodic work is backed by
// chrome.alarms so it survives suspension.

import { CONFIG } from "./config.js";
import { EVENT_TYPES, makeEvent } from "../shared/event-schema.js";
import {
  isEnabled,
  setEnabled,
  getOrCreateInstallId,
  getStats,
} from "../shared/storage.js";
import { getSession, startNewSession, touchSession } from "./session.js";
import { enqueue, flush } from "./uploader.js";

const ALARM_HEARTBEAT = "heartbeat"; // backup flush + screenshot when worker wakes

let lastScreenshotAt = 0;
let screenshotTimer = null;

// ---------------------------------------------------------------------------
// Recording gate: every capture path funnels through record().
// ---------------------------------------------------------------------------

async function record(type, fields) {
  if (!(await isEnabled())) return;

  const { rotated, previous } = await touchSession(fields?.ts);
  if (rotated && previous) {
    // Close out the old session, then open the new one, around this event.
    await enqueue(
      makeEvent(EVENT_TYPES.SESSION_END, { ts: fields?.ts, data: { reason: "idle_timeout" } })
    );
    await enqueue(
      makeEvent(EVENT_TYPES.SESSION_START, { ts: fields?.ts, data: { reason: "resumed" } })
    );
  }

  await enqueue(makeEvent(type, fields));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  await getOrCreateInstallId();
  await setEnabled(false); // opt-in: capture is OFF until the user enables it
  chrome.idle.setDetectionInterval(CONFIG.IDLE_DETECTION_SECONDS);
  ensureHeartbeat();
  await refreshBadge();
  console.log("[agent] installed");
});

chrome.runtime.onStartup.addListener(async () => {
  // New browser session on startup.
  await startNewSession();
  chrome.idle.setDetectionInterval(CONFIG.IDLE_DETECTION_SECONDS);
  ensureHeartbeat();
  if (await isEnabled()) {
    await record(EVENT_TYPES.SESSION_START, { data: { reason: "browser_startup" } });
    startScreenshotLoop();
  }
  await refreshBadge();
  console.log("[agent] startup");
});

function ensureHeartbeat() {
  // Minimum alarm period is 30s; used as a safety net for flush + screenshot
  // in case the in-memory interval was torn down with the worker.
  chrome.alarms.create(ALARM_HEARTBEAT, { periodInMinutes: 0.5 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_HEARTBEAT) return;
  if (await isEnabled()) {
    await maybeScreenshot("heartbeat");
    startScreenshotLoop(); // re-arm the fine-grained interval if worker was revived
  }
  await flush();
});

// ---------------------------------------------------------------------------
// Enable / disable via popup messages
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case "SET_ENABLED": {
        await setEnabled(msg.value);
        if (msg.value) {
          await startNewSession();
          await record(EVENT_TYPES.SESSION_START, { data: { reason: "user_enabled" } });
          startScreenshotLoop();
        } else {
          await record(EVENT_TYPES.SESSION_END, { data: { reason: "user_disabled" } });
          stopScreenshotLoop();
          await flush();
        }
        await refreshBadge();
        sendResponse({ ok: true });
        break;
      }
      case "GET_STATUS": {
        const [enabled, stats, session] = await Promise.all([
          isEnabled(),
          getStats(),
          getSession(),
        ]);
        sendResponse({ enabled, stats, sessionId: session.sessionId });
        break;
      }
      case "DOM_EVENT": {
        // Forwarded from a content script. Stamp the sender's tab context.
        const evt = msg.event || {};
        await record(evt.type, {
          ts: evt.ts,
          tabId: sender.tab?.id ?? null,
          windowId: sender.tab?.windowId ?? null,
          url: sender.tab?.url ?? evt.url ?? null,
          title: sender.tab?.title ?? evt.title ?? null,
          data: evt.data || {},
        });
        sendResponse({ ok: true });
        break;
      }
      case "FLUSH_NOW": {
        await flush();
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: "unknown message" });
    }
  })();
  return true; // keep the message channel open for the async response
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

chrome.tabs.onCreated.addListener((tab) => {
  record(EVENT_TYPES.TAB_CREATED, {
    tabId: tab.id,
    windowId: tab.windowId,
    url: tab.pendingUrl || tab.url,
    title: tab.title,
    data: { index: tab.index },
  });
});

chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await record(EVENT_TYPES.TAB_ACTIVATED, {
      tabId,
      windowId,
      url: tab.url,
      title: tab.title,
    });
  } catch {
    await record(EVENT_TYPES.TAB_ACTIVATED, { tabId, windowId });
  }
  await maybeScreenshot("tab_activated"); // key-event screenshot
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only record meaningful transitions to avoid noise.
  if (changeInfo.status === "complete" || changeInfo.title || changeInfo.url) {
    record(EVENT_TYPES.TAB_UPDATED, {
      tabId,
      windowId: tab.windowId,
      url: tab.url,
      title: tab.title,
      data: { status: changeInfo.status ?? null },
    });
  }
});

chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
  record(EVENT_TYPES.TAB_MOVED, {
    tabId,
    windowId: moveInfo.windowId,
    data: { fromIndex: moveInfo.fromIndex, toIndex: moveInfo.toIndex },
  });
});

chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  record(EVENT_TYPES.TAB_CLOSED, {
    tabId,
    windowId: removeInfo.windowId,
    data: { windowClosing: removeInfo.isWindowClosing },
  });
});

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  const focused = windowId !== chrome.windows.WINDOW_ID_NONE;
  await record(EVENT_TYPES.WINDOW_FOCUS, {
    windowId,
    data: { focused },
  });
  if (focused) await maybeScreenshot("window_focus");
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return; // top frame only
  await record(EVENT_TYPES.NAVIGATION, {
    tabId: details.tabId,
    url: details.url,
    data: {
      transitionType: details.transitionType,
      transitionQualifiers: details.transitionQualifiers,
      phase: "committed",
    },
  });
  await maybeScreenshot("navigation"); // key-event screenshot
});

chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return;
  record(EVENT_TYPES.NAVIGATION, {
    tabId: details.tabId,
    url: details.url,
    data: { phase: "completed" },
  });
});

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------

chrome.downloads.onCreated.addListener((item) => {
  record(EVENT_TYPES.DOWNLOAD, {
    url: item.url,
    data: {
      id: item.id,
      filename: item.filename,
      mime: item.mime,
      phase: "created",
    },
  });
});

chrome.downloads.onChanged.addListener((delta) => {
  if (!delta.state) return;
  record(EVENT_TYPES.DOWNLOAD, {
    data: { id: delta.id, state: delta.state.current, phase: "changed" },
  });
});

// ---------------------------------------------------------------------------
// Idle / attention
// ---------------------------------------------------------------------------

chrome.idle.onStateChanged.addListener((state) => {
  record(EVENT_TYPES.IDLE_STATE, { data: { state } });
});

// ---------------------------------------------------------------------------
// Screenshots (LOCKED: interval + key events)
// ---------------------------------------------------------------------------

function startScreenshotLoop() {
  if (screenshotTimer) return;
  screenshotTimer = setInterval(() => {
    maybeScreenshot("interval");
  }, CONFIG.SCREENSHOT_INTERVAL_MS);
}

function stopScreenshotLoop() {
  if (screenshotTimer) {
    clearInterval(screenshotTimer);
    screenshotTimer = null;
  }
}

/**
 * Capture the visible tab, respecting the enabled gate and the rate cap.
 */
async function maybeScreenshot(trigger) {
  if (!(await isEnabled())) return;

  const now = Date.now();
  if (now - lastScreenshotAt < CONFIG.SCREENSHOT_MIN_GAP_MS) return; // rate cap
  lastScreenshotAt = now;

  try {
    // Capture the active tab of the currently focused window.
    const [win] = await chrome.windows.getAll({ populate: false, windowTypes: ["normal"] });
    const focused = (await chrome.windows.getLastFocused({ populate: true })) || win;
    if (!focused || focused.id == null) return;

    const dataUrl = await chrome.tabs.captureVisibleTab(focused.id, {
      format: CONFIG.SCREENSHOT_FORMAT,
      quality: CONFIG.SCREENSHOT_QUALITY,
    });

    const activeTab = (focused.tabs || []).find((t) => t.active);
    await record(EVENT_TYPES.SCREENSHOT, {
      tabId: activeTab?.id ?? null,
      windowId: focused.id,
      url: activeTab?.url ?? null,
      title: activeTab?.title ?? null,
      screenshot: dataUrl,
      data: { trigger },
    });
  } catch (err) {
    // captureVisibleTab fails on chrome:// pages, the extensions page, or when
    // no window is focused. That's expected — just skip this frame.
    // console.debug("[agent] screenshot skipped:", err.message);
  }
}

// ---------------------------------------------------------------------------
// Toolbar badge: visible "REC" indicator while capturing.
// ---------------------------------------------------------------------------

async function refreshBadge() {
  const on = await isEnabled();
  await chrome.action.setBadgeText({ text: on ? "REC" : "" });
  if (on) {
    await chrome.action.setBadgeBackgroundColor({ color: "#d93025" });
  }
}

// Revive periodic work if the worker was restarted mid-session.
(async () => {
  ensureHeartbeat();
  if (await isEnabled()) startScreenshotLoop();
  await refreshBadge();
})();
