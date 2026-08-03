-- User identity + per-user rolling summary.
-- Extension users sign in (name + email); their activity is tagged to a user,
-- and each user carries a rolling AI summary (embedded) the agent uses to scope
-- retrieval to that user's sessions.

CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT UNIQUE NOT NULL,
  name              TEXT,
  first_seen        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen         TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary           TEXT,
  summary_embedding vector(1536),
  summary_hash      TEXT
);

ALTER TABLE sessions  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_sessions_user  ON sessions(user_id, started_at);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
