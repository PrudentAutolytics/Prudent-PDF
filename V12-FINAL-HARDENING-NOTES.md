# Prudent Redact v12 final hardening notes

This pass preserves the existing Power Automate URL fallback and all previously configured static application values.

Implemented now:

- Power Automate submission body verified unchanged against the v11 baseline.
- OTP values are SHA-256 protected at rest in the existing `users.otp` column. Verification remains backward compatible with already-issued plaintext OTP values.
- Authentication logs no longer include user email addresses for OTP request or verification success events.
- Protected APIs now accept the existing body token contract and standard Bearer authentication. Identity is always derived from the signed token.
- Detailed `/api/health` configuration posture is administrator-only and POST-only.
- Governance uses the authenticated health call.
- The shared HTTP client sends Bearer authentication in addition to the existing body token for backward compatibility.
- The global 401 handler correctly recognizes same-origin relative `/api/...` requests.
- Idle-security cleanup clears document viewer object URLs, sensitive fields, cached recent-job metadata, and browser-local review/operation state.
- Sidebar collapsed state is session-scoped instead of persistent across browser sessions.
- Automated repository regression checks were added under `tests/regression-check.js`.

No Power Automate URL, static product value, storage account name, plan value, company identity, email routing value, or locked workflow parameter was intentionally replaced.
