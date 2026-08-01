// Local test sink for the Visual AI Agent extension.
//
// A dependency-free Node HTTP server that stands in for the real ingestion
// backend during development. It accepts POST /api/ingest, logs a summary of
// each batch, and saves any screenshots to ./captures so you can eyeball them.
//
// Usage:
//   node tools/local-sink/server.js
//   (listens on http://localhost:8787 — matches extension config API_BASE)

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const CAPTURES_DIR = path.join(__dirname, "captures");

fs.mkdirSync(CAPTURES_DIR, { recursive: true });

let batchNo = 0;

const server = http.createServer((req, res) => {
  // CORS so the extension (any origin) can post here.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && req.url === "/api/ingest") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const batch = JSON.parse(body);
        handleBatch(batch);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, received: batch.events?.length ?? 0 }));
      } catch (err) {
        console.error("  ! failed to parse batch:", err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

function handleBatch(batch) {
  batchNo += 1;
  const events = batch.events || [];
  const counts = {};
  let screenshots = 0;

  for (const evt of events) {
    counts[evt.type] = (counts[evt.type] || 0) + 1;
    if (evt.type === "screenshot" && evt.screenshot) {
      saveScreenshot(evt);
      screenshots += 1;
    }
  }

  const stamp = new Date().toLocaleTimeString();
  console.log(
    `\n[batch #${batchNo}] ${stamp}  session=${(batch.sessionId || "?").slice(0, 8)}  events=${events.length}`
  );
  console.log(
    "  " +
      Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => `${t}:${n}`)
        .join("  ")
  );
  if (screenshots) console.log(`  saved ${screenshots} screenshot(s) -> captures/`);

  // Show a couple of sample non-screenshot events for readability.
  const samples = events.filter((e) => e.type !== "screenshot").slice(0, 3);
  for (const s of samples) {
    const where = s.url ? ` ${trunc(s.url, 50)}` : "";
    console.log(`    · ${s.type}${where} ${compact(s.data)}`);
  }
}

function saveScreenshot(evt) {
  const m = /^data:image\/(\w+);base64,(.+)$/s.exec(evt.screenshot || "");
  if (!m) return;
  const ext = m[1];
  const buf = Buffer.from(m[2], "base64");
  const name = `shot_${evt.ts || Date.now()}.${ext}`;
  fs.writeFileSync(path.join(CAPTURES_DIR, name), buf);
}

function trunc(s, n) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function compact(data) {
  if (!data || Object.keys(data).length === 0) return "";
  return trunc(JSON.stringify(data), 80);
}

server.listen(PORT, () => {
  console.log(`Visual AI Agent — local sink listening on http://localhost:${PORT}`);
  console.log(`POST batches to http://localhost:${PORT}/api/ingest`);
  console.log(`Screenshots saved to ${CAPTURES_DIR}\n`);
});
