# Deploying the Visual AI Agent

The backend (Next.js) deploys to **Vercel**, the database to **Neon** (serverless Postgres),
and the dashboard is gated by **Clerk** auth. The extension is loaded into Chrome and pointed at
the deployed backend, sending a shared `INGEST_TOKEN`.

## 1. Database — Neon

1. Create a project at <https://neon.tech>.
2. Copy the **Pooled connection** string (host contains `-pooler`, keep `?sslmode=require`).
3. Apply the schema once from your machine, pointed at Neon:
   ```bash
   cd backend
   echo "DATABASE_URL=<your neon pooled url>" > .env
   npm run migrate
   ```

## 2. Auth — Clerk

1. Create an application at <https://dashboard.clerk.com>.
2. From **API keys**, copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_...`)
   - `CLERK_SECRET_KEY` (`sk_...`)
3. Sign-up is open by default — anyone can register and view the dashboard. To limit it to the
   interviewer, use Clerk's **Restrictions / Allowlist** settings (add their email), or share a
   single set of credentials.

## 3. Pick an ingest token

Choose any random secret, e.g. `openssl rand -hex 16`. This is your `INGEST_TOKEN` — the backend
and the extension must use the **same** value.

## 4. Backend — Vercel

1. Push this repo to GitHub and import it at <https://vercel.com/new>.
2. **Set the project's Root Directory to `backend`** (monorepo; the Next.js app is in `backend/`).
3. Add environment variables (Project → Settings → Environment Variables):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Neon pooled connection string |
   | `INGEST_TOKEN` | the secret from step 3 |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
   | `CLERK_SECRET_KEY` | Clerk secret key |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/` |
   | `ANTHROPIC_API_KEY` | *(optional)* enables captions, session summaries, and chat |
   | `OPENAI_API_KEY` | *(optional)* embeddings for vector-RAG chat retrieval |
   | `CAPTION_MODEL` | *(optional)* default `claude-haiku-4-5` |
   | `REASONING_MODEL` | *(optional)* default `claude-sonnet-5` (analysis + chat) |
   | `EMBED_MODEL` | *(optional)* default `text-embedding-3-small` |

4. Deploy. The dashboard is at `https://<project>.vercel.app` (redirects to sign-in), the ingest
   endpoint at `https://<project>.vercel.app/api/ingest`.

> `pg` and `@anthropic-ai/sdk` are marked `serverExternalPackages` so they load at runtime.
> `/api/ingest` and `/api/health` are the only public routes; everything else needs a Clerk login.

## 5. Extension — point at the deployed backend

In `extension/src/background/config.js`:
```js
API_BASE: "https://<project>.vercel.app",
INGEST_TOKEN: "<the same secret from step 3>",
```
Reload the extension (`chrome://extensions` → reload), toggle it on, and browse. Activity flows to
the deployed backend; the interviewer logs in at the Vercel URL and sees it on the dashboard.

## Local development

`.env` (see `.env.example`) needs `DATABASE_URL`, the Clerk keys (the dashboard won't run without
them now), and optionally `INGEST_TOKEN`. Then `pwsh scripts/demo.ps1`, or
`cd backend && npm run demo`. With no `INGEST_TOKEN` set, ingest is open for easy local testing.
