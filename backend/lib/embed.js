// OpenAI embeddings for the vector-RAG layer.
//
// Anthropic has no embeddings API, so retrieval uses OpenAI
// text-embedding-3-small (1536-dim) stored in pgvector. Uses raw fetch (no SDK
// dependency), with batching, timeout, and retry/backoff.

const ENDPOINT = "https://api.openai.com/v1/embeddings";
const TIMEOUT_MS = 20000;
const MAX_RETRIES = 3;

export function hasOpenAI() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function embedModel() {
  return process.env.EMBED_MODEL || "text-embedding-3-small";
}

/** Format a number[] as a pgvector literal: "[0.1,0.2,...]". */
export function toPgVector(arr) {
  return `[${arr.join(",")}]`;
}

async function call(input) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: embedModel(), input }),
        signal: ctrl.signal,
      });
      if (res.ok) {
        const json = await res.json();
        return json.data.map((d) => d.embedding);
      }
      // 429 / 5xx are retryable; 4xx (bad request/auth) are not.
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`OpenAI embeddings ${res.status}: ${await res.text()}`);
      }
      lastErr = new Error(`OpenAI embeddings ${res.status}`);
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw lastErr;
}

/** Embed a single string -> number[1536]. */
export async function embedText(text) {
  const [vec] = await call(text);
  return vec;
}

/** Embed many strings in one request -> number[][]. */
export async function embedTexts(texts) {
  if (texts.length === 0) return [];
  return call(texts);
}
