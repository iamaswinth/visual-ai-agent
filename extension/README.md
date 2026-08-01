# Visual AI Agent — Extension

A Manifest V3 Chrome extension that captures browser activity and posts it, in
batches, to an ingestion endpoint. This is the "agent" — a resident monitoring
client. AI interpretation of the captured screenshots happens server-side, later.

## Install (load unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this `extension/` folder.
4. Click the extension's toolbar icon and flip the toggle **ON**. A red **REC**
   badge appears on the icon while capturing.

By default the extension posts to `http://localhost:8787/api/ingest`. Start the
[local test sink](../tools/local-sink/README.md) to receive and inspect batches,
or change `API_BASE` in `src/background/config.js` to your backend.

## Layout

```
extension/
  manifest.json
  icons/                      generated placeholder icons + PNG generator
  src/
    background/
      service-worker.js       event hub: tabs/windows/nav/downloads/idle + screenshots
      session.js              installId + sessionId lifecycle
      uploader.js             persisted batch queue + retry/backoff
      config.js               all tunables (endpoint, intervals, batch sizes)
    content/
      content-script.js       DOM events: clicks, scroll, selection/copy, visibility, SPA routes
    popup/
      popup.html/js/css       opt-in toggle, REC indicator, live stats
    shared/
      event-schema.js         EVENT_TYPES + event/batch builders
      storage.js              chrome.storage.local wrappers
```

## What is captured

| Source | Activity |
| --- | --- |
| Background | tab created/activated/updated/moved/closed, window focus, navigation (with transition type), downloads, idle/active/locked state |
| Content script | clicks (left/middle/right + element descriptor), scroll depth, text selection & copy (length only), tab visibility, SPA route changes |
| Visual | screenshots of the visible tab every 15s and on navigation / tab switch (JPEG, quality ~50) |

### What is **not** captured (by design)

- Raw keystrokes
- Clipboard contents (only the length of selected/copied text)
- Password or form-field values
- Full selected/copied text

## Data contract

Batches are `POST`ed as JSON:

```jsonc
{
  "installId": "uuid",          // persistent per install
  "sessionId": "uuid",          // rotates on startup + after 30 min idle
  "sentAt": 1730000000000,
  "events": [
    {
      "type": "navigation | click | scroll | tab_activated | screenshot | ...",
      "ts": 1730000000000,
      "tabId": 12,
      "windowId": 3,
      "url": "https://example.com/path",
      "title": "Example",
      "data": { /* type-specific */ },
      "screenshot": "data:image/jpeg;base64,..." // screenshot events only
    }
  ]
}
```

Batching: flush at **25 events** or every **10s**. Unsent batches are persisted
to `chrome.storage.local` and retried with exponential backoff, so nothing is
lost when Chrome suspends the service worker.

## Design notes

- **Opt-in.** Capture is off until the user enables it; a REC badge shows when active.
- **Single network owner.** Content scripts never touch the network — they forward
  events to the worker, which owns the one upload queue.
- **Suspension-safe.** No durable state in memory; a `chrome.alarms` heartbeat
  re-arms the screenshot loop and flushes after the worker is revived.
- **No bundler.** Plain ES modules so the code loads unpacked and stays inspectable.

## Regenerate icons

```bash
node icons/generate-icons.js
```
