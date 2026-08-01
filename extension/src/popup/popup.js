// Popup UI controller. Talks to the background worker via runtime messages;
// holds no capture logic itself.

const els = {
  toggle: document.getElementById("enabledToggle"),
  hint: document.getElementById("toggleHint"),
  statusText: document.getElementById("statusText"),
  statusDot: document.getElementById("statusDot"),
  eventCount: document.getElementById("eventCount"),
  lastFlush: document.getElementById("lastFlush"),
  sessionId: document.getElementById("sessionId"),
  flushBtn: document.getElementById("flushBtn"),
};

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      void chrome.runtime.lastError; // ignore if worker was asleep
      resolve(resp);
    });
  });
}

function fmtTime(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function render(status) {
  if (!status) return;
  const on = status.enabled === true;

  els.toggle.checked = on;
  els.statusText.textContent = on ? "Recording activity" : "Idle";
  els.statusDot.classList.toggle("recording", on);
  els.hint.textContent = on
    ? "On — activity is being recorded"
    : "Off — nothing is being recorded";

  els.eventCount.textContent = status.stats?.totalEvents ?? 0;
  els.lastFlush.textContent = fmtTime(status.stats?.lastFlushAt);
  els.sessionId.textContent = status.sessionId
    ? status.sessionId.slice(0, 8) + "…"
    : "—";
  els.sessionId.title = status.sessionId || "";
}

async function refresh() {
  const status = await sendMessage({ type: "GET_STATUS" });
  render(status);
}

els.toggle.addEventListener("change", async () => {
  await sendMessage({ type: "SET_ENABLED", value: els.toggle.checked });
  await refresh();
});

els.flushBtn.addEventListener("click", async () => {
  els.flushBtn.textContent = "Uploading…";
  await sendMessage({ type: "FLUSH_NOW" });
  await refresh();
  els.flushBtn.textContent = "Upload now";
});

// Keep the counter live while the popup is open.
refresh();
const poll = setInterval(refresh, 2000);
window.addEventListener("unload", () => clearInterval(poll));
