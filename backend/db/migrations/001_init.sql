-- Visual AI Agent — initial schema.
--
-- Four tables model the activity stream posted by the extension:
--   installs     one row per installed agent (persistent installId)
--   sessions     one row per browsing session (rotates on startup / long idle)
--   events       one row per captured activity
--   screenshots  raw JPEG bytes for screenshot events (bytea), plus a caption
--                column the AI layer fills in later.

CREATE TABLE IF NOT EXISTS installs (
  install_id  UUID PRIMARY KEY,
  first_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  session_id     UUID PRIMARY KEY,
  install_id     UUID NOT NULL REFERENCES installs(install_id) ON DELETE CASCADE,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_event_at  TIMESTAMPTZ,
  ended_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS events (
  id              BIGSERIAL PRIMARY KEY,
  session_id      UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  install_id      UUID NOT NULL REFERENCES installs(install_id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  ts              TIMESTAMPTZ NOT NULL,
  tab_id          INTEGER,
  window_id       INTEGER,
  url             TEXT,
  title           TEXT,
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  has_screenshot  BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS screenshots (
  id           BIGSERIAL PRIMARY KEY,
  event_id     BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  session_id   UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  install_id   UUID NOT NULL REFERENCES installs(install_id) ON DELETE CASCADE,
  ts           TIMESTAMPTZ NOT NULL,
  mime         TEXT NOT NULL,
  bytes        BYTEA NOT NULL,
  byte_size    INTEGER NOT NULL,
  trigger      TEXT,
  caption      TEXT,          -- filled by the AI captioning layer, later
  captioned_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_session_ts  ON events(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_install_ts  ON events(install_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_type        ON events(type);
CREATE INDEX IF NOT EXISTS idx_sessions_install   ON sessions(install_id, started_at);
CREATE INDEX IF NOT EXISTS idx_screenshots_session ON screenshots(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_screenshots_uncaptioned
  ON screenshots(id) WHERE caption IS NULL;
