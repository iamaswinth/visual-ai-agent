-- Granular activity index for RAG.
-- One embedded "document" per unit of activity: every event, and every
-- screenshot rendered as its vision description. This is what the chat searches
-- so it can answer detailed questions about what the user saw / navigated / did,
-- with citations to the exact page, screen, and time.

CREATE TABLE IF NOT EXISTS documents (
  id            BIGSERIAL PRIMARY KEY,
  session_id    UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  install_id    UUID,
  kind          TEXT NOT NULL,          -- event type, or 'screenshot'
  event_id      BIGINT REFERENCES events(id) ON DELETE CASCADE,
  screenshot_id BIGINT REFERENCES screenshots(id) ON DELETE CASCADE,
  ts            TIMESTAMPTZ NOT NULL,
  url           TEXT,
  title         TEXT,
  text          TEXT NOT NULL,          -- the content that is embedded
  embedding     vector(1536),           -- OpenAI text-embedding-3-small
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ANN index for cosine similarity search across all activity.
CREATE INDEX IF NOT EXISTS idx_documents_embedding
  ON documents USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_documents_session ON documents(session_id, ts);

-- Idempotent indexing: at most one document per source event / screenshot.
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_event
  ON documents(event_id) WHERE event_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_screenshot
  ON documents(screenshot_id) WHERE screenshot_id IS NOT NULL;
