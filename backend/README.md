# Visual AI Agent — Backend

Next.js app that ingests browser-activity batches from the extension and stores
them in Postgres (NeonDB). Screenshots are stored as raw bytes (`bytea`), with a
`caption` column reserved for the AI layer to fill in later.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/ingest` | Receive an activity batch and write it to the DB (one transaction). |
| `GET` | `/api/health` | Liveness + database connectivity. |

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then paste your Neon connection string into .env
npm run migrate           # create tables
npm run dev               # http://localhost:3000
```

### Getting a Neon connection string

1. Create a free project at <https://neon.tech>.
2. Copy the **Pooled connection** string (host contains `-pooler`).
3. Paste it into `.env` as `DATABASE_URL` (keep `?sslmode=require`).

> This backend uses the standard `pg` driver, which talks to Neon over its
> pooled endpoint and also to a local Postgres. For an edge-runtime deployment
> you can swap `lib/db.js` for `@neondatabase/serverless`.

## Data model

```
installs (install_id) 1───∞ sessions (session_id) 1───∞ events (id)
                                                          │
                                                          └──1───1 screenshots (bytea)
```

`events.ts` is stored as `timestamptz` (converted from the extension's epoch-ms).
`events.data` is `jsonb`. See `db/migrations/001_init.sql`.

## Testing

### Against local/Docker Postgres (no Neon needed)

```bash
# start a throwaway Postgres on port 5433
docker run --name vaa-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=visual_ai_agent -p 5433:5432 -d postgres:16

# point .env at it
echo 'DATABASE_URL=postgresql://postgres:postgres@localhost:5433/visual_ai_agent' > .env

npm run migrate
npm run test:ingest     # inserts a sample batch (with a screenshot) and verifies rows
```

`npm run test:ingest` exercises the exact `processBatch` code the API route uses,
so it verifies the full storage path — including decoding a screenshot data URL
into `bytea` — without booting Next.

### Point the extension at this backend

The extension defaults to `http://localhost:8787`. To send real activity here,
set `API_BASE` to `http://localhost:3000` in
`extension/src/background/config.js`, reload the extension, and browse.

## Deploy

Deploy to Vercel and set `DATABASE_URL` to your Neon pooled string in the
project's environment variables. Run `npm run migrate` once against the same
database (locally, pointed at Neon) to create the schema.
