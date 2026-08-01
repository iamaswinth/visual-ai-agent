// CLI captioning worker: caption every uncaptioned screenshot, in batches.
//
// Usage:  npm run caption   (loads .env for DATABASE_URL + ANTHROPIC_API_KEY)

import { captionBatch, hasApiKey } from "../lib/caption.js";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Copy backend/.env.example to .env first.");
    process.exit(1);
  }
  if (!hasApiKey()) {
    console.error(
      "ANTHROPIC_API_KEY is not set. Add it to backend/.env to enable captioning."
    );
    process.exit(1);
  }

  console.log(`Captioning with model ${process.env.CAPTION_MODEL || "claude-opus-5"}…`);
  let total = 0;
  for (;;) {
    const n = await captionBatch(20);
    if (n === 0) break;
    total += n;
    console.log(`  captioned ${total} so far…`);
  }
  console.log(total > 0 ? `Done — captioned ${total} screenshot(s).` : "Nothing to caption.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
