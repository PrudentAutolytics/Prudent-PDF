-- ============================================================
-- Prudent PDF - Enterprise Hardening Migration
-- Run once against the Supabase/Postgres database.
-- Safe to re-run (IF NOT EXISTS everywhere).
-- ============================================================

-- 1. OTP brute-force protection: attempt counter per issued code
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts INT NOT NULL DEFAULT 0;

-- 2. Cross-instance rate limiting (replaces in-memory Maps that reset
--    on every Azure Functions cold start / scale-out)
CREATE TABLE IF NOT EXISTS rate_limits (
  key       TEXT PRIMARY KEY,
  count     INT NOT NULL DEFAULT 1,
  reset_at  TIMESTAMPTZ NOT NULL
);

-- Optional housekeeping: clear expired counters periodically
-- (run manually or via a scheduled PA flow / pg_cron)
-- DELETE FROM rate_limits WHERE reset_at < NOW() - INTERVAL '1 day';

-- 3. Admin audit trail - every mutating admin action is recorded
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  admin_email TEXT NOT NULL,
  action      TEXT NOT NULL,
  target      TEXT,
  details     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log (created_at DESC);

-- 4. Notes on existing data (no schema change required):
--    * users.otp now stores a SHA-256 hex hash of the code, not the
--      code itself. auth-verify handles legacy plaintext rows during
--      the transition, so no backfill is needed - old codes simply
--      expire within 10 minutes.
--    * api_keys.api_key now stores a SHA-256 hex hash of the key.
--      Existing plaintext keys should be revoked and re-issued:
--      UPDATE api_keys SET revoked = true WHERE api_key NOT LIKE '%' || repeat('0',0) AND length(api_key) <> 64;
--      (or simply revoke all and regenerate from the admin panel)

-- 5. Helpful indexes if not already present
CREATE INDEX IF NOT EXISTS idx_jobs_user_submitted ON jobs (user_id, submitted_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
