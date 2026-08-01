// Seed the database with realistic browsing sessions so the dashboard is
// demoable without loading the extension. Reuses the real ingestion path
// (processBatch) and generates small PNG "screenshots" so the gallery renders.
//
// Usage:  npm run seed   (loads .env for DATABASE_URL)
// Screenshots are left uncaptioned so the "Generate captions" step has work.

import zlib from "node:zlib";
import pg from "pg";
import { processBatch } from "../lib/ingest.js";

const { Client } = pg;

// ---- tiny dependency-free PNG generator -----------------------------------
// (same approach as extension/icons/generate-icons.js)

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A simplified "web page" mock: page bg, a colored header band, and a few
// content rows. Returns a data URL for processBatch to decode into bytea.
function mockScreenshot(headerColor) {
  const W = 320,
    H = 200;
  const rgba = Buffer.alloc(W * H * 4);
  const put = (x, y, [r, g, b]) => {
    const i = (y * W + x) * 4;
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = 255;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c = [246, 247, 249]; // page background
      if (y < 40) c = headerColor; // header band
      else if (x > 20 && x < 300 && ((y - 52) % 26 < 12) && y < 180) c = [225, 228, 232]; // rows
      put(x, y, c);
    }
  }
  return "data:image/png;base64," + encodePng(W, H, rgba).toString("base64");
}

// ---- session builders ------------------------------------------------------

function ev(type, offsetMs, base, fields = {}) {
  return { type, ts: base + offsetMs, ...fields };
}

function jobSearchSession(base) {
  const shotHN = mockScreenshot([255, 102, 0]); // orange
  const shotLinkedIn = mockScreenshot([10, 102, 194]); // blue
  const shotGmail = mockScreenshot([197, 34, 31]); // red
  return [
    ev("session_start", 0, base, { data: { reason: "browser_startup" } }),
    ev("navigation", 500, base, { tabId: 1, windowId: 1, url: "https://news.ycombinator.com/", title: "Hacker News", data: { transitionType: "typed", phase: "committed" } }),
    ev("screenshot", 900, base, { tabId: 1, windowId: 1, url: "https://news.ycombinator.com/", title: "Hacker News", screenshot: shotHN, data: { trigger: "navigation" } }),
    ev("scroll", 3000, base, { tabId: 1, data: { depthPct: 45 } }),
    ev("click", 5200, base, { tabId: 1, url: "https://news.ycombinator.com/", data: { button: "left", target: { tag: "a", text: "Who is hiring?" } } }),
    ev("tab_created", 8000, base, { tabId: 2, windowId: 1, data: { index: 1 } }),
    ev("navigation", 8400, base, { tabId: 2, url: "https://www.linkedin.com/jobs/", title: "LinkedIn Jobs", data: { transitionType: "link", phase: "committed" } }),
    ev("tab_activated", 8600, base, { tabId: 2, windowId: 1, url: "https://www.linkedin.com/jobs/", title: "LinkedIn Jobs" }),
    ev("screenshot", 9000, base, { tabId: 2, windowId: 1, url: "https://www.linkedin.com/jobs/", title: "LinkedIn Jobs", screenshot: shotLinkedIn, data: { trigger: "tab_activated" } }),
    ev("scroll", 12000, base, { tabId: 2, data: { depthPct: 70 } }),
    ev("navigation", 16000, base, { tabId: 3, url: "https://mail.google.com/mail/u/0/", title: "Inbox — Gmail", data: { transitionType: "typed", phase: "committed" } }),
    ev("tab_activated", 16200, base, { tabId: 3, windowId: 1, url: "https://mail.google.com/mail/u/0/", title: "Inbox — Gmail" }),
    ev("screenshot", 16600, base, { tabId: 3, windowId: 1, url: "https://mail.google.com/mail/u/0/", title: "Inbox — Gmail", screenshot: shotGmail, data: { trigger: "navigation" } }),
    ev("idle_state", 40000, base, { data: { state: "idle" } }),
  ];
}

function shoppingSession(base) {
  const shotAmazon = mockScreenshot([35, 47, 62]); // dark slate
  const shotReviews = mockScreenshot([255, 153, 0]); // amazon orange
  return [
    ev("session_start", 0, base, { data: { reason: "user_enabled" } }),
    ev("navigation", 400, base, { tabId: 1, windowId: 1, url: "https://www.amazon.com/", title: "Amazon.com", data: { transitionType: "typed", phase: "committed" } }),
    ev("screenshot", 800, base, { tabId: 1, windowId: 1, url: "https://www.amazon.com/", title: "Amazon.com", screenshot: shotAmazon, data: { trigger: "navigation" } }),
    ev("click", 3000, base, { tabId: 1, url: "https://www.amazon.com/", data: { button: "left", target: { tag: "input", text: "" }, x: 320, y: 44 } }),
    ev("navigation", 4200, base, { tabId: 1, url: "https://www.amazon.com/s?k=mechanical+keyboard", title: "mechanical keyboard", data: { transitionType: "form_submit", phase: "committed" } }),
    ev("scroll", 6500, base, { tabId: 1, data: { depthPct: 55 } }),
    ev("click", 8000, base, { tabId: 1, url: "https://www.amazon.com/dp/B0EXAMPLE", data: { button: "left", target: { tag: "span", text: "Keychron K2 Wireless" } } }),
    ev("screenshot", 9000, base, { tabId: 1, windowId: 1, url: "https://www.amazon.com/dp/B0EXAMPLE", title: "Keychron K2 — Amazon", screenshot: shotReviews, data: { trigger: "navigation" } }),
    ev("selection", 12000, base, { tabId: 1, data: { length: 68 } }),
    ev("copy", 12500, base, { tabId: 1, data: { length: 68 } }),
    ev("session_end", 30000, base, { data: { reason: "user_disabled" } }),
  ];
}

// ---- run -------------------------------------------------------------------

async function main() {
  const cs = process.env.DATABASE_URL;
  if (!cs) {
    console.error("DATABASE_URL is not set. Copy backend/.env.example to .env first.");
    process.exit(1);
  }
  const ssl = /localhost|127\.0\.0\.1/.test(cs) ? false : { rejectUnauthorized: false };
  const client = new Client({ connectionString: cs, ssl });
  await client.connect();

  const installId = crypto.randomUUID();
  const now = Date.now();

  const batches = [
    { installId, sessionId: crypto.randomUUID(), events: shoppingSession(now - 45 * 60 * 1000) },
    { installId, sessionId: crypto.randomUUID(), events: jobSearchSession(now - 10 * 60 * 1000) },
  ];

  let events = 0;
  let shots = 0;
  for (const b of batches) {
    const r = await processBatch(client, b);
    events += r.events;
    shots += r.screenshots;
  }

  await client.end();
  console.log(`Seeded ${batches.length} sessions, ${events} events, ${shots} screenshots.`);
  console.log("Open the dashboard and click “Generate captions” to add AI descriptions.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
