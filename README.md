# Visual AI Agent

A Chrome extension (Manifest V3) that acts as a resident **monitoring agent** for the browser:
the user signs in, flips it on, and it tracks their browsing activity and posts it to a backend
that stores everything in Postgres. Periodic screenshots are captured and interpreted by a Claude
vision model — the **"Visual AI"** layer — and every unit of activity is embedded into a vector
store so you can **ask an agent about any user in plain language**. The whole thing is browsable in
a live, users-first dashboard.

> **"Agent" here** means two things. The extension is a background monitoring agent (in the sense
> of the Datadog or CrowdStrike agent) — deliberately dumb and deterministic, it captures and ships
> events. The **"ask the agent"** chat is a retrieval-augmented LLM that answers grounded questions
> over a user's captured activity. All AI interpretation happens server-side.

## Architecture

```
┌─────────────────────────┐   batched POST /api/ingest   ┌──────────────────────────────┐
│  Chrome Extension (MV3)  │ ───────────────────────────► │   Next.js backend (:3100)    │
│  sign-in (name + email)  │   (x-ingest-token gated)     │                              │
│  content script          │                              │  /api/ingest    → store +    │
│  background worker        │                              │  /api/users       tag user   │
│   (events + screenshots) │                              │  /api/sessions/[id]          │
│  popup (on/off, REC)     │                              │  /api/chat  (per-user RAG)   │
└─────────────────────────┘                              │  /api/users/[id]/process     │
                                                          └───────────────┬──────────────┘
                                                                          │
                       ┌──────────────────────────────────────┬──────────┴─────────┐
                       ▼                                       ▼                    ▼
             Postgres + pgvector (Neon)              Dashboard UI (Clerk)      AI pipeline
      users · sessions · events · screenshots     users → sessions → chat   caption (Haiku) ·
        documents(vector 1536) · rolling profile   Airtable editorial UI    summarize (Sonnet) ·
                                                                             embed (OpenAI) → RAG
```

## What the dashboard shows

The dashboard is **users-first** (gated by Clerk):

1. **Users** — everyone running the extension, with location, session/indexed counts, last active.
2. **User** — a rolling **AI profile** of what that person does, their **sessions**, and an
   **"ask the agent"** chat scoped to just them ("Did they message anyone today?", "Any shopping?").
   An **Index now** button runs the AI pipeline on demand.
3. **Session** — an AI **title + summary + category + insights**, the full **activity timeline**,
   and the **screenshot gallery** with per-shot AI captions.

The UI follows an **Airtable-style editorial design** (white canvas, near-black ink type and CTAs,
hairline borders, signature accent cards).

## How the AI pipeline works

Every step is best-effort and gated on the relevant key — missing keys degrade gracefully.

- **Captions** (`CAPTION_MODEL`, default `claude-haiku-4-5`) — describe each screenshot: "what did
  the user see".
- **Session intelligence** (`REASONING_MODEL`, default `claude-sonnet-5`) — a title, summary,
  category, and insights per session.
- **Vector RAG** — every event and screenshot description is rendered to a sentence and embedded
  (`OPENAI_API_KEY`, `text-embedding-3-small`, 1536-dim) into a `documents` table with a pgvector
  HNSW index. The chat retrieves the most relevant items **for that user** and answers grounded in
  them, with sources. A **rolling per-user profile** gives the agent a reference to search from.
- **When it runs** — automatically when a **session ends**, or on demand via **Index now** on the
  user page. Ingestion is incremental (only new activity is embedded).

## Quick demo (Windows)

Prerequisites: **Docker**, **Node 20+**.

```powershell
pwsh scripts/demo.ps1
```

This starts pgvector Postgres, migrates, and launches the dashboard at
**http://localhost:3100**. The dashboard is gated by **Clerk**, so `backend/.env` needs your Clerk
keys (see [`backend/.env.example`](backend/.env.example)); sign in to view it.

> The users-first dashboard is best seen with the **real extension** signed in (below) — that's
> what creates users, sessions, and the activity the agent searches over.

### Add live data from the real extension
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `extension/`.
2. Click the extension icon → **sign in** with a name + email.
3. Flip the toggle **ON** (a red **REC** dot appears) and browse.
4. The extension posts to the backend (set in `extension/src/background/config.js`); the user
   appears in the dashboard, and when the session ends the AI pipeline runs automatically. Press
   **Index now** on the user page to process mid-session.

## AI keys

To light up captions, summaries, and the agent chat, add to `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...   # captions + session summaries + chat answers
OPENAI_API_KEY=sk-...          # embeddings for vector search (chat retrieval)
```

Without them the app still runs; AI features report that no key is set and the chat falls back to
recent-sessions context. See [`backend/.env.example`](backend/.env.example) for all variables.

## Repo layout

```
visual-ai-agent/
  extension/            # Chrome MV3 extension — the capture client (see extension/README.md)
  backend/              # Next.js: ingestion API + dashboard + AI pipeline (see backend/README.md)
  tools/local-sink/     # throwaway server for capture-only testing without the backend
  scripts/demo.ps1      # one-command demo launcher (Windows PowerShell)
```

## Manual startup (any OS)

```bash
# 1. Postgres WITH pgvector (the vector store needs it)
docker run --name vaa-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=visual_ai_agent \
  -p 5434:5432 -d pgvector/pgvector:pg16

# 2. Backend
cd backend
npm install
cp .env.example .env        # DATABASE_URL is prefilled for the Docker DB above; add your keys
npm run migrate             # apply db/migrations
npm run dev                 # start on :3100
```

See [`backend/README.md`](backend/README.md) for the API, schema, and Neon deploy notes,
[`extension/README.md`](extension/README.md) for what is and isn't captured, and
[`DEPLOY.md`](DEPLOY.md) for the hosted setup (Vercel + Neon + Clerk).

## Ports

`3000` and `5433` are commonly occupied, so the demo uses backend **:3100** and Postgres **:5434**.

## Privacy stance

Capture is **OFF by default** and requires explicit sign-in + opt-in. A visible **REC** dot shows
whenever capture is active. The extension deliberately **excludes** raw keystrokes, clipboard
contents, and password/payment field values — only the *shape* of activity is recorded
(e.g. "68 characters selected", not the text).
