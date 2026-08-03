// CLI: analyze every not-yet-analyzed session (title/summary/category/insights
// + embedding), in batches.
//
// Usage:  npm run analyze   (loads .env for DATABASE_URL + ANTHROPIC_API_KEY [+ OPENAI_API_KEY])

import { analyzeBatch } from "../lib/analyze.js";
import { hasApiKey } from "../lib/ai.js";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Copy backend/.env.example to .env first.");
    process.exit(1);
  }
  if (!hasApiKey()) {
    console.error("ANTHROPIC_API_KEY is not set. Add it to backend/.env to enable analysis.");
    process.exit(1);
  }

  let total = 0;
  for (;;) {
    const n = await analyzeBatch(8);
    if (n === 0) break;
    total += n;
    console.log(`  analyzed ${total} so far…`);
  }
  console.log(total > 0 ? `Done — analyzed ${total} session(s).` : "Nothing to analyze.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
