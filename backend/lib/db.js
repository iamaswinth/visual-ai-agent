// Postgres connection pool.
//
// Uses the standard `pg` driver, which works with Neon (via the pooled
// DATABASE_URL) and with a local/Docker Postgres for testing. For edge-runtime
// deployments you could swap this for @neondatabase/serverless, but on the
// Node runtime `pg` is the simplest thing that also runs locally.

import pg from "pg";

const { Pool } = pg;

let pool;

function needsSsl(connectionString) {
  // Local Postgres doesn't use SSL; Neon requires it.
  return !/localhost|127\.0\.0\.1/.test(connectionString);
}

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set (see backend/.env.example)");
    }
    pool = new Pool({
      connectionString,
      max: 5,
      ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}
