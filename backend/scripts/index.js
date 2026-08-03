// CLI: index all activity (events + screenshot descriptions) into the vector
// store, in batches, until nothing remains.
//
// Usage:  npm run index   (loads .env for DATABASE_URL + ANTHROPIC_API_KEY + OPENAI_API_KEY)

import { indexBatch } from "../lib/documents.js";
import { hasApiKey } from "../lib/ai.js";
import { hasOpenAI } from "../lib/embed.js";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  if (!hasOpenAI()) {
    console.error("OPENAI_API_KEY is not set — needed for embeddings.");
    process.exit(1);
  }
  if (!hasApiKey()) {
    console.error("ANTHROPIC_API_KEY is not set — needed to describe screenshots.");
    process.exit(1);
  }

  let total = 0;
  for (;;) {
    const { indexed, remaining } = await indexBatch(80);
    total += indexed;
    console.log(`  indexed ${total} documents (${remaining} remaining)…`);
    if (indexed === 0) break;
  }
  console.log(`Done — ${total} documents indexed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
