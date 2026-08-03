// Backfill embeddings for analyzed sessions (e.g. after enabling OpenAI, or to
// refresh vectors). Hash-gated, so it's safe to re-run — unchanged sessions are
// skipped.
//
// Usage:  npm run embed   (loads .env for DATABASE_URL + OPENAI_API_KEY)

import pg from "pg";
import { hasOpenAI } from "../lib/embed.js";
import { embedSourceText, embedAndStore } from "../lib/analyze.js";

const { Client } = pg;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  if (!hasOpenAI()) {
    console.error("OPENAI_API_KEY is not set — nothing to embed.");
    process.exit(1);
  }

  const ssl = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? false
    : { rejectUnauthorized: false };
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl });
  await client.connect();

  const { rows } = await client.query(
    `SELECT session_id, ai_title, ai_summary, ai_category, ai_insights, embedding_hash
       FROM sessions WHERE analyzed_at IS NOT NULL`
  );

  let done = 0;
  for (const r of rows) {
    const source = embedSourceText({
      title: r.ai_title,
      summary: r.ai_summary,
      category: r.ai_category,
      insights: r.ai_insights || [],
    });
    if (await embedAndStore(client, r.session_id, source, r.embedding_hash)) done += 1;
  }

  await client.end();
  console.log(`Embedded ${done} session(s) (${rows.length} analyzed total).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
