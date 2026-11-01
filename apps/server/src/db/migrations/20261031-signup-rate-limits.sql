-- Apply before deploying the shared, fail-closed signup limiter.
CREATE TABLE IF NOT EXISTS signup_rate_limits (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
