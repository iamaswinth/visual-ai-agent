-- Add the ingesting client's IP and approximate geolocation to each session.
-- Populated from the request that posts the batch (source IP + Vercel geo
-- headers). All nullable — unknown locally / when headers are absent.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS ip      TEXT,
  ADD COLUMN IF NOT EXISTS city    TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS region  TEXT;
