// Popup UI controller. Talks to the background worker via runtime messages for
// capture state, and manages the signed-in user directly in chrome.storage.

import { getUser, setUser, clearUser } from "../shared/storage.js";

const els = {
  toggle: document.getElementById("enabledToggle"),
  hint: document.getElementById("toggleHint"),
  statusText: document.getElementById("statusText"),
  statusDot: document.getElementById("statusDot"),
  eventCount: document.getElementById("eventCount"),
  lastFlush: document.getElementById("lastFlush"),
  sessionId: document.getElementById("sessionId"),
  flushBtn: document.getElementById("flushBtn"),
  // auth
  signedOut: document.getElementById("signedOut"),
  signedIn: document.getElementById("signedIn"),
  nameInput: document.getElementById("nameInput"),
  emailInput: document.getElementById("emailInput"),
  signInBtn: document.getElementById("signInBtn"),
  authError: document.getElementById("authError"),
  userName: document.getElementById("userName"),
  userEmail: document.getElementById("userEmail"),
  signOutBtn: document.getElementById("signOutBtn"),
};

let signedIn = false;

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (resp) => {
      void chrome.runtime.lastError;
      resolve(resp);
    });
  });
}

function fmtTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderStatus(status) {
  if (!status) return;
  const on = status.enabled === true;
  els.toggle.checked = on;
  els.statusText.textContent = on ? "Recording activity" : signedIn ? "Idle" : "Signed out";
  els.statusDot.classList.toggle("recording", on);
  els.hint.textContent = !signedIn
    ? "Sign in to enable"
    : on
      ? "On — activity is being recorded"
      : "Off — nothing is being recorded";
  els.eventCount.textContent = status.stats?.totalEvents ?? 0;
  els.lastFlush.textContent = fmtTime(status.stats?.lastFlushAt);
  els.sessionId.textContent = status.sessionId ? status.sessionId.slice(0, 8) + "…" : "—";
  els.sessionId.title = status.sessionId || "";
}

function renderAuth(user) {
  signedIn = Boolean(user?.email);
  els.signedOut.style.display = signedIn ? "none" : "";
  els.signedIn.style.display = signedIn ? "" : "none";
  if (signedIn) {
    els.userName.textContent = user.name || user.email;
    els.userEmail.textContent = user.email;
  }
  // Capture controls are gated on being signed in.
  els.toggle.disabled = !signedIn;
  els.flushBtn.disabled = !signedIn;
}

async function refresh() {
  const status = await sendMessage({ type: "GET_STATUS" });
  renderStatus(status);
}

// ---- auth actions ---------------------------------------------------------

els.signInBtn.addEventListener("click", async () => {
  const name = els.nameInput.value.trim();
  const email = els.emailInput.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    els.authError.textContent = "Enter a valid email.";
    return;
  }
  els.authError.textContent = "";
  await setUser({ name, email });
  renderAuth({ name, email });
  await refresh();
});

els.signOutBtn.addEventListener("click", async () => {
  await sendMessage({ type: "SET_ENABLED", value: false }); // stop capture on sign out
  await clearUser();
  renderAuth(null);
  await refresh();
});

// ---- capture actions ------------------------------------------------------

els.toggle.addEventListener("change", async () => {
  if (!signedIn) {
    els.toggle.checked = false;
    return;
  }
  await sendMessage({ type: "SET_ENABLED", value: els.toggle.checked });
  await refresh();
});

els.flushBtn.addEventListener("click", async () => {
  els.flushBtn.textContent = "Uploading…";
  await sendMessage({ type: "FLUSH_NOW" });
  await refresh();
  els.flushBtn.textContent = "Upload now";
});

// ---- init -----------------------------------------------------------------

(async () => {
  renderAuth(await getUser());
  await refresh();
})();
const poll = setInterval(refresh, 2000);
window.addEventListener("unload", () => clearInterval(poll));
