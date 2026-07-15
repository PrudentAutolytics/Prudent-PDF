# Prudent Redact v18

Fixed now:
- Same-origin Azure Static Web App API requests are accepted by comparing the request Origin with the runtime forwarded host and protocol.
- A newly created Static Web App no longer requires APP_URL or ALLOWED_ORIGINS to be updated before its own Profile, Processing History, Governance, usage, media, and other same-origin APIs can call the backend.
- Explicit ALLOWED_ORIGINS and APP_URL values remain supported.
- The existing brave-cliff deployment origin remains preserved as a backward-compatible allowed origin.
- Foreign origins are still rejected with HTTP 403.
- Processing History is now scoped directly by the signed session user ID, not the mutable profile email.
- Processing History retains schema-aware optional column discovery.
- Governance now also discovers optional jobs columns before querying.
- The existing locked Power Automate redaction submission file remains byte-for-byte unchanged.

The Power Automate URL and static values previously provided were not replaced or removed.
