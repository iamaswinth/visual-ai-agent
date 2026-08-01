# Visual AI Agent

A Chrome extension (Manifest V3) that acts as a resident **monitoring agent** for the browser:
once installed and enabled, it tracks the user's browsing activity and posts it to a backend
that stores everything in Postgres. Periodic screenshots are captured and then interpreted by a
Claude vision model — the **"Visual AI"** layer — and the whole activity stream is browsable in a
live dashboard.

> **"Agent" here** means a background monitoring agent (in the sense of the Datadog or
> CrowdStrike agent), not an autonomous LLM loop. The extension is deliberately dumb and
> deterministic — it captures and ships events. All AI interpretation happens server-side.

## Architecture

```
┌─────────────────────────┐   batched POST /api/ingest   ┌────────────────────────────┐
│  Chrome Extension (MV3)  │ ───────────────────────────► │  Next.js backend (:3100)   │
│  content script          │                              │                            │
│  background worker       │                              │  /api/ingest   → writes    │
│   (events + screenshots) │                              │  /api/sessions │  events + │
│  popup (on/off, REC)     │                              │  /api/screenshots[bytea]   │
└─────────────────────────┘                              │  /api/caption/run (Claude) │
                                                          └──────────────┬─────────────┘
                                                                         │
                                          ┌──────────────────────────────┼────────────┐
                                          ▼                              ▼             ▼
                                    Postgres / NeonDB            Dashboard UI    Claude vision
                                 installs·sessions·events·        (timeline +      captions the
                                    screenshots(bytea)         screenshot gallery)  screenshots
```

## Repo layout

```
visual-ai-agent/
  extension/            # Chrome MV3 extension — the capture client (see extension/README.md)
  backend/              # Next.js: ingestion API + dashboard + AI captioning (see backend/README.md)
  tools/local-sink/     # throwaway server for capture-only testing without the backend
  scripts/demo.ps1      # one-command demo launcher (Windows PowerShell)
```

## Quick demo (Windows)

Prerequisites: **Docker**, **Node 20+**. One command:

```powershell
pwsh scripts/demo.ps1
```

This starts Postgres, migrates, seeds realistic demo data, and launches the dashboard at
**http://localhost:3100**. You'll immediately see seeded sessions with screenshots.

To light up the **AI captions**, add a key to `backend/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```
then click **"Generate captions"** in the dashboard (or run `npm run caption` in `backend/`).

### Add live data from the real extension
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `extension/`.
2. Click the extension icon → flip the toggle **ON** (a red **REC** badge appears).
3. Browse. The extension posts to `http://localhost:3100` (set in
   `extension/src/background/config.js`); a new session appears in the dashboard and the
   timeline auto-refreshes.

## Manual startup (any OS)

```bash
# 1. Postgres (or use your own / a Neon connection string)
docker run --name vaa-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=visual_ai_agent -p 5434:5432 -d postgres:16

# 2. Backend
cd backend
npm install
cp .env.example .env        # DATABASE_URL is prefilled for the Docker DB above
npm run demo                 # migrate + seed + start on :3100
```

See [`backend/README.md`](backend/README.md) for the API, schema, captioning, and Neon deploy
notes, and [`extension/README.md`](extension/README.md) for what is and isn't captured.

## Ports

`3000` and `5433` are commonly occupied, so the demo uses backend **:3100** and Postgres **:5434**.

## Privacy stance

Capture is **OFF by default** and requires explicit opt-in. A visible **REC** badge shows
whenever capture is active. The extension deliberately **excludes** raw keystrokes, clipboard
contents, and password/payment field values — only the *shape* of activity is recorded
(e.g. "68 characters selected", not the text).
