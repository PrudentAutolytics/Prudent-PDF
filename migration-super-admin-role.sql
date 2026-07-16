-- Prudent Redact role-based administration migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (LOWER(role) IN ('user', 'super_admin'));

UPDATE users SET role='user' WHERE role IS NULL OR TRIM(role)='';

-- Preserve access for the existing platform owner. Update this email if the
-- production users table stores a different address.
UPDATE users
SET role='super_admin'
WHERE LOWER(email)='kabileshvijayakumar@prudentautolytics.com';
