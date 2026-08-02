# Deploying the Visual AI Agent

The backend (Next.js) deploys to **Vercel**; the database runs on **Neon** (serverless
Postgres). The extension is loaded into Chrome and pointed at the deployed backend URL.

## 1. Database — Neon

1. Create a project at <https://neon.tech>.
2. Copy the **Pooled connection** string (host contains `-pooler`, keep `?sslmode=require`).
3. Apply the schema once from your machine, pointed at Neon:
   ```bash
   cd backend
   echo "DATABASE_URL=<your neon pooled url>" > .env
   npm run migrate
   ```

## 2. Backend — Vercel

1. Push this repo to GitHub and import it at <https://vercel.com/new>.
2. **Set the project's Root Directory to `backend`** (this is a monorepo; the Next.js app
   lives in `backend/`). Vercel auto-detects Next.js from there.
3. Add environment variables (Project → Settings → Environment Variables):
   - `DATABASE_URL` — the Neon pooled connection string.
   - `ANTHROPIC_API_KEY` — enables screenshot captioning (optional; the app runs without it).
   - `CAPTION_MODEL` — optional, defaults to `claude-opus-5`.
4. Deploy. Your dashboard is at `https://<project>.vercel.app`, the ingest endpoint at
   `https://<project>.vercel.app/api/ingest`.

> Uses the standard `pg` driver against Neon's pooled endpoint, which is safe on Vercel's
> serverless functions. `pg` and `@anthropic-ai/sdk` are marked as
> `serverExternalPackages` so they load at runtime rather than being bundled.

## 3. Extension — point at the deployed backend

In `extension/src/background/config.js` set:
```js
API_BASE: "https://<project>.vercel.app",
```
Reload the extension (`chrome://extensions` → reload), toggle it on, and browse. Activity flows
to the deployed backend and appears on the hosted dashboard.

## Local development

See the root `README.md` (`pwsh scripts/demo.ps1`, or `cd backend && npm run demo`), which uses
Docker Postgres on port 5434 and the backend on 3100.
