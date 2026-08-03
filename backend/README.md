# Visual AI Agent — Backend

Next.js app that ingests browser-activity batches from the extension, stores them in Postgres
(local or NeonDB), captions screenshots with a Claude vision model, and serves a live
**dashboard** of the tracked activity. Screenshots are stored as raw bytes (`bytea`); the
`caption` column holds the AI-generated description.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/ingest` | Receive an activity batch from the extension; write it in one transaction. |
| `GET` | `/api/sessions` | List sessions with event/screenshot/captioned counts + domain summary. |
| `GET` | `/api/sessions/[id]` | One session's chronological event timeline (screenshot refs, no bytes). |
| `GET` | `/api/screenshots/[id]` | Stream a stored screenshot as an image (`<img src>` target). |
| `GET` | `/api/stats` | Header totals (sessions/events/screenshots/captioned). |
| `POST` | `/api/caption/run` | Caption a batch of uncaptioned screenshots (needs `ANTHROPIC_API_KEY`). |
| `GET` | `/api/health` | Liveness + database connectivity. |

The dashboard itself is served at `/`.

**Auth:** all routes require a Clerk login **except** `/api/ingest` and `/api/health`.
`/api/ingest` instead checks a shared `INGEST_TOKEN` header when that env var is set. See
`.env.example` for the Clerk + token variables and [`../DEPLOY.md`](../DEPLOY.md) for setup.

## Setup

```bash
cd backend
npm install
cp .env.example .env      # DATABASE_URL is prefilled for the Docker DB below
npm run demo              # migrate + seed + start on http://localhost:3100
```

`npm run demo` = `migrate` → `seed` → `dev`. Run the steps individually if you prefer:
`npm run migrate`, `npm run seed`, `npm run dev`.

### Database

```bash
docker run --name vaa-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=visual_ai_agent -p 5434:5432 -d postgres:16
```
`.env.example` points `DATABASE_URL` at this. For Neon, paste your **pooled** connection string
(host contains `-pooler`, keep `?sslmode=require`) instead — the `pg` driver handles both.

### AI captioning (the "Visual AI" layer)

Optional but recommended for the demo. Add to `.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
CAPTION_MODEL=claude-opus-5     # optional; any vision-capable Claude model
```
Then either click **"Generate captions"** in the dashboard, or run the CLI worker:
```bash
npm run caption                 # captions every uncaptioned screenshot in batches
```
Without a key the app still runs — the button just reports that no key is set.

## Data model

```
installs (install_id) 1───∞ sessions (session_id) 1───∞ events (id)
                                                          │
                                                          └──1───1 screenshots (bytea + caption)
```

`events.ts` is `timestamptz` (from the extension's epoch-ms); `events.data` is `jsonb`; screenshot
bytes live in `screenshots.bytes`, the AI description in `screenshots.caption`. A partial index
(`idx_screenshots_uncaptioned`) makes "caption the next batch" cheap. See
`db/migrations/001_init.sql`.

## Testing

```bash
npm run seed          # populate realistic sessions + screenshots (no Chrome needed)
npm run test:ingest   # insert a sample batch (with a screenshot) and assert rows exist
npm run caption       # (with a key) caption everything; verify captions appear on the dashboard
```

Point the extension here by setting `API_BASE` to `http://localhost:3100` in
`extension/src/background/config.js` (already the default), reload it, and browse.

## Deploy

Deploy to Vercel; set `DATABASE_URL` (Neon pooled) and `ANTHROPIC_API_KEY` as environment
variables. Run `npm run migrate` once against the same database to create the schema.
