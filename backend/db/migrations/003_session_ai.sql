-- Session intelligence + vector search.
-- Adds the AI-generated understanding of each session and a pgvector embedding
-- of that understanding for semantic retrieval (RAG chat).

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS ai_title       TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary     TEXT,
  ADD COLUMN IF NOT EXISTS ai_category    TEXT,
  ADD COLUMN IF NOT EXISTS ai_insights    JSONB,
  ADD COLUMN IF NOT EXISTS analyzed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS embedding      vector(1536),  -- OpenAI text-embedding-3-small
  ADD COLUMN IF NOT EXISTS embedding_hash TEXT;           -- sha256 of embedded source; re-embed only on change

-- Approximate-nearest-neighbour index for cosine similarity search.
CREATE INDEX IF NOT EXISTS idx_sessions_embedding
  ON sessions USING hnsw (embedding vector_cosine_ops);
