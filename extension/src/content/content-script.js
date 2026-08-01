// Content script: captures DOM-level activity for a single tab and forwards it
// to the background worker, which owns session context and the upload queue.
//
// This file is intentionally self-contained (no ES module imports): content
// scripts injected via the manifest cannot use module imports. Event type
// strings are duplicated here to match ../shared/event-schema.js.
//
// PRIVACY: we capture *shapes* of activity, never sensitive content — no
// keystrokes, no clipboard text, no form field values. Text selection and copy
// record only a length, never the text.

(() => {
  "use strict";

  const TYPES = {
    CLICK: "click",
    SCROLL: "scroll",
    SELECTION: "selection",
    COPY: "copy",
    VISIBILITY: "visibility",
    NAVIGATION: "navigation", // used for SPA route changes
  };

  // ---- forwarding ---------------------------------------------------------

  function send(type, data) {
    const event = { type, ts: Date.now(), url: location.href, title: document.title, data };
    try {
      chrome.runtime.sendMessage({ type: "DOM_EVENT", event }, () => {
        // Swallow "Extension context invalidated" errors that happen when the
        // extension reloads while this page is open.
        void chrome.runtime.lastError;
      });
    } catch {
      // sendMessage can throw if the extension was reloaded; ignore.
    }
  }

  // ---- helpers ------------------------------------------------------------

  function describeElement(el) {
    if (!el || el.nodeType !== 1) return null;
    const text = (el.innerText || el.value || "").trim().slice(0, 80);
    return {
      tag: el.tagName ? el.tagName.toLowerCase() : null,
      id: el.id || null,
      classes: typeof el.className === "string" ? el.className.slice(0, 120) : null,
      role: el.getAttribute ? el.getAttribute("role") : null,
      href: el.tagName === "A" ? el.getAttribute("href") : null,
      // A short label helps the dashboard read like "clicked 'Add to cart'".
      text: text || null,
    };
  }

  function throttle(fn, ms) {
    let last = 0;
    let pending = null;
    return (...args) => {
      const now = Date.now();
      const remaining = ms - (now - last);
      if (remaining <= 0) {
        last = now;
        fn(...args);
      } else {
        clearTimeout(pending);
        pending = setTimeout(() => {
          last = Date.now();
          fn(...args);
        }, remaining);
      }
    };
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // ---- clicks -------------------------------------------------------------

  function onClick(e) {
    const button = e.button === 1 ? "middle" : e.button === 2 ? "right" : "left";
    send(TYPES.CLICK, {
      button,
      target: describeElement(e.target),
      // Coarse coordinates only.
      x: Math.round(e.clientX),
      y: Math.round(e.clientY),
    });
  }

  document.addEventListener("click", onClick, true);
  document.addEventListener("auxclick", onClick, true);
  document.addEventListener(
    "contextmenu",
    (e) => send(TYPES.CLICK, { button: "context", target: describeElement(e.target) }),
    true
  );

  // ---- scroll depth -------------------------------------------------------

  const onScroll = throttle(() => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const depth = max > 0 ? Math.round((doc.scrollTop / max) * 100) : 0;
    send(TYPES.SCROLL, { depthPct: depth, scrollY: Math.round(window.scrollY) });
  }, 750);

  window.addEventListener("scroll", onScroll, { passive: true });

  // ---- text selection (length only) --------------------------------------

  const onSelectionChange = debounce(() => {
    const sel = document.getSelection();
    const len = sel ? sel.toString().length : 0;
    if (len > 0) send(TYPES.SELECTION, { length: len });
  }, 600);

  document.addEventListener("selectionchange", onSelectionChange);

  // ---- copy (length only) -------------------------------------------------

  document.addEventListener("copy", () => {
    const sel = document.getSelection();
    send(TYPES.COPY, { length: sel ? sel.toString().length : 0 });
  });

  // ---- visibility ---------------------------------------------------------

  document.addEventListener("visibilitychange", () => {
    send(TYPES.VISIBILITY, { state: document.visibilityState });
  });

  // ---- SPA route changes --------------------------------------------------
  // Patch history so client-side navigations (no full reload) are recorded.

  let lastUrl = location.href;
  function reportUrlChange(method) {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      send(TYPES.NAVIGATION, { phase: "spa", method });
    }
  }

  const origPush = history.pushState;
  history.pushState = function (...args) {
    const r = origPush.apply(this, args);
    reportUrlChange("pushState");
    return r;
  };

  const origReplace = history.replaceState;
  history.replaceState = function (...args) {
    const r = origReplace.apply(this, args);
    reportUrlChange("replaceState");
    return r;
  };

  window.addEventListener("popstate", () => reportUrlChange("popstate"));

  // Signal that this tab's content instrumentation is live.
  send(TYPES.VISIBILITY, { state: document.visibilityState, phase: "content_ready" });
})();
