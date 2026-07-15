# Prudent Redact v16

Implemented now:
- Governance moved from administrator-only `/api/admin` dependency to authenticated user-scoped `/api/governance`.
- Governance metrics, risk queue, SLA, volume, and evidence export now work for the signed-in user's own processing data.
- Processing History now discovers optional `jobs` columns before selecting them, preventing older production schemas from failing the entire history query.
- History failures render a retryable service state with the actual safe API error rather than a generic permanent failure.
- Added My Profile navigation and responsive profile page.
- Users can edit full name, company, and unique email.
- Email changes issue a new signed session token immediately.
- Users can add, replace, or remove a JPG, PNG, or WebP profile picture up to 500 KB.
- Profile picture and profile update timestamp columns are created with `ADD COLUMN IF NOT EXISTS`.
- Existing locked Power Automate redaction submission file remains byte-for-byte unchanged.
