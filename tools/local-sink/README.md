# Local test sink

A throwaway, dependency-free Node server that stands in for the real ingestion
backend so you can verify the extension end-to-end before the backend exists.

## Run

```bash
node tools/local-sink/server.js
```

It listens on `http://localhost:8787` — the same origin the extension's
`config.js` points at by default (`API_BASE`).

## What it does

- Accepts `POST /api/ingest` (with permissive CORS).
- Logs each batch: session id, total events, a per-type breakdown, and a few
  sample events.
- Decodes any `screenshot` data URLs and writes them to `./captures/` as JPEGs
  so you can open them and confirm the visual capture works.

`captures/` is git-ignored.

## Override the port

```bash
PORT=9000 node tools/local-sink/server.js
```

Remember to update `extension/src/background/config.js` → `API_BASE` to match.
