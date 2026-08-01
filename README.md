# Visual AI Agent

A Chrome extension (Manifest V3) that acts as a resident **monitoring agent** for the browser:
once installed and enabled, it tracks the user's browsing activity and posts it to a backend
for storage in a database (NeonDB / Postgres). Periodic screenshots are captured so a
vision model can later interpret *what* the user was doing — the "Visual AI" layer.

> **"Agent" here** means a background monitoring agent (in the sense of the Datadog or
> CrowdStrike agent), not an autonomous LLM loop. The extension is deliberately dumb and
> deterministic — it captures and ships events. All AI interpretation happens server-side, later.

## Architecture

```
┌─────────────────────────┐     batched POST /api/ingest     ┌──────────────────┐
│  Chrome Extension (MV3)  │ ───────────────────────────────► │  Ingestion API   │
│                          │                                  │  (Next.js, later)│
│  content script  ─┐      │                                  └────────┬─────────┘
│                   ▼      │                                           │
│  background service      │                                           ▼
│  worker (event hub,      │                                  ┌──────────────────┐
│  screenshots, uploader)  │                                  │   NeonDB (later) │
│                          │                                  └────────┬─────────┘
│  popup (on/off, REC)     │                                           │
└─────────────────────────┘                                           ▼
                                                             vision-model captioning
                                                             + dashboard (later)
```

This repo currently contains the **extension** and a **local test sink** for verifying it
end-to-end before the real backend exists. Backend, AI captioning, and dashboard are
separate follow-up milestones.

## Repo layout

```
visual-ai-agent/
  extension/            # the Chrome MV3 extension (see extension/README.md)
  tools/local-sink/     # throwaway Node server that logs POST /api/ingest for testing
```

## Quick start

1. **Run the local test sink** (so the extension has somewhere to post):
   ```bash
   node tools/local-sink/server.js
   # listens on http://localhost:8787, logs batches, saves screenshots to captures/
   ```
2. **Load the extension**: open `chrome://extensions`, enable *Developer mode*,
   click *Load unpacked*, and select the `extension/` folder.
3. Click the extension icon, flip the master toggle **ON** (a red **REC** badge appears).
4. Browse around — open/close/switch tabs, navigate, scroll, click, select text.
5. Watch batches arrive in the local sink's console.

See [`extension/README.md`](extension/README.md) for exactly what is and isn't captured,
permissions rationale, and the full event schema.

## Privacy stance

Capture is **OFF by default** and requires explicit opt-in. A visible **REC** badge is shown
whenever capture is active. The extension deliberately **excludes** raw keystrokes, clipboard
contents, and password/payment field values.
