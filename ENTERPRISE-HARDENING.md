# Prudent PDF - Enterprise Hardening Report (v7.1)

Scope: same stack, same tools (Azure Static Web Apps, Azure Functions, Supabase Postgres, Azure Blob, Power Automate). No architecture or feature changes. Every fix is a hardening of what already exists.

---

## CRITICAL - do these BEFORE the next deploy

### 1. Rotate every exposed credential (secrets were in the repo folder)
The zip contained live secrets in `api/.env` and `api/local.settings.json`, and a live PA flow SAS URL was hardcoded in `jobs-submit/index.js` source (that one WAS in git history). Treat all of the following as compromised and rotate:

- Azure Storage account key for `redacta01f` (Portal, Storage account, Access keys, Rotate key1 and key2)
- Supabase database password (`postgres.xoemsngmqryuoqsbunjh`)
- Both Power Automate trigger URLs (regenerate the SAS: open each flow, delete and re-add the HTTP trigger, or use "Regenerate" on the trigger URL)
- `JWT_SECRET` / `SESSION_SECRET` (generate new: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- Set a real `PA_CALLBACK_SECRET` (random, 16+ chars)

Because the PA fallback URL sat in committed source, also scrub git history before making the repo public or sharing it (BFG or `git filter-repo`), or simply start a fresh repo from this cleaned folder.

The package now ships `api/.env.example` with placeholders. `api/.env` was removed and `local.settings.json` sanitised.

### 2. Set the new/required app settings in Azure (SWA, Environment variables)
Required, fail-closed (API returns errors if missing):

| Setting | Purpose |
|---|---|
| `SESSION_SECRET` | Session token signing. No default fallback any more. Min 32 chars. |
| `PA_CALLBACK_SECRET` | Authenticates PA status callbacks. No "change-me" default any more. Min 16 chars. |
| `PA_JOB_SUBMIT_FLOW` | Job flow trigger URL. Hardcoded fallback removed from source. |

Recommended:

| Setting | Purpose |
|---|---|
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (custom domain ready). |
| `ADMIN_EMAILS` | Comma-separated admin allowlist (was hardcoded). |
| `APP_URL` | Used to build the PA callback URL. |

Also update the PA job flow to read `paSecret` from the trigger body and send it back on the callback, since the callback is now rejected without it.

### 3. Run the migration
`migration-enterprise-hardening.sql` against Supabase. Adds `users.otp_attempts`, `rate_limits` table, `audit_log` table, indexes. Then revoke and re-issue any existing API keys (they are now stored hashed).

---

## Security fixes implemented (code)

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | Critical | `blob-sas` read mode issued a read SAS for ANY blob in ANY container to any logged-in user. On a redaction product that is cross-tenant access to other customers' documents. | Ownership check: the blob must match `blob_url` or `result_url` of a job owned by the authenticated user. Container whitelist. Read SAS lifetime cut to 30 min. |
| 2 | Critical | Stored XSS in the admin panel: contact-form `name`/`company` and signup `full_name`/`company` were rendered via `innerHTML` unescaped. A visitor could plant script that runs with the admin session token in localStorage. | `esc()` output encoding on every DB value in `admin.html` renderers, plus `jsArg()` sanitiser for inline handler arguments. Server side, all fields are now escaped in the notification email HTML too (was a phishing vector into VK's inbox). |
| 3 | Critical | Default secrets: `SESSION_SECRET` fell back to a string published in the source; `PA_CALLBACK_SECRET` fell back to `prudent-pa-secret-change-me`. If either app setting was missing in production, session tokens and job callbacks were forgeable by anyone reading the repo. | Fail closed. `auth.js` refuses to verify or issue tokens without a real secret; `jobs-status` rejects callbacks unless a real secret is configured and matches (timing-safe compare). |
| 4 | Critical | Live PA flow SAS URL hardcoded in `jobs-submit` source. | Removed. Endpoint returns 503 if `PA_JOB_SUBMIT_FLOW` is unset. |
| 5 | High | OTP brute force: 6-digit code, 10-minute window, unlimited guesses, no rate limit on verify, code stored in plaintext. | Max 5 attempts per code (`otp_attempts`), PG-backed rate limit on verify (20/15 min per email), OTP stored as SHA-256 hash, constant-time comparison. Legacy plaintext rows still verify during transition. |
| 6 | High | In-memory rate limiting on `auth-request` resets on every cold start and is per-instance, so it silently stops limiting under scale-out. Contact endpoint had none at all. | New `api/ratelimit.js`, PG-backed, per email AND per IP, used by auth-request, auth-verify and contact-send. Honeypot field added to contact-send. |
| 7 | High | `jobs-submit` fired the PA trigger fire-and-forget after responding. Azure Functions can kill the invocation once the response is set, leaving jobs stuck in "queued" forever with the credit consumed. | PA trigger is awaited (20 s cap). On failure: job marked failed, credit refunded, client gets a clear 502. |
| 8 | High | Quota race: check-then-increment let concurrent submissions both pass. Credits were consumed even when everything after failed. | Atomic `UPDATE ... WHERE credits_used < credits_limit RETURNING`, refund on any failure path. |
| 9 | High | Viewer routed live SAS URLs through Google Docs Viewer, sending clients' (pre-redaction) documents to a third party. | Native browser PDF rendering in the same iframe. CSP `frame-src` updated to blob storage. Zero new dependencies. |
| 10 | Medium | API keys generated with `Math.random()` (predictable) and stored in plaintext. | `crypto.randomBytes`, only the SHA-256 hash persisted, plaintext shown once at creation. |
| 11 | Medium | Admin authorisation read the email from the request body; identity should come from the verified token. Also hardcoded allowlist. | Authorises on `auth.email` from the verified session. Allowlist via `ADMIN_EMAILS` app setting. |
| 12 | Medium | No audit trail for admin actions. | `audit_log` table; every mutating admin action (plan change, credits, activate, add user, key generate/revoke) is recorded. Non-blocking. |
| 13 | Medium | `jobs-list` / `quota-get` / `blob-sas` / `jobs-submit` read identity from the request body. | All now use `auth.email` from the verified session. |
| 14 | Medium | Malformed session token crashed `timingSafeEqual` with a RangeError (500 instead of clean 401). | HMAC shape validated before comparison. |
| 15 | Medium | `db.js` used `ssl: { rejectUnauthorized: false }` - accepts any certificate (MITM exposure). | Verification ON by default; explicit `PG_SSL_REJECT_UNAUTHORIZED=false` opt-out for debugging only. |
| 16 | Medium | `auth-request` returned raw internal error messages (DB errors) to the client. | Generic 500 message; details go to logs only. |
| 17 | Low | PA callback stamped `completed_at` even for "processing"; status unvalidated. | Terminal-state-only stamping; status whitelist; error message length-capped. |
| 18 | Low | `fileBase64` was forwarded to PA alongside the SAS URL (double handling, oversized payloads). | Dropped; the flow reads via `inputSasUrl`. If your current flow still uses `fileBase64`, switch its source action to the SAS URL. |
| 19 | Low | `submittedAt` on contact was client-supplied; input fields uncapped. | Server timestamp; length caps on all inputs across auth and contact. |
| 20 | Low | CORS origins hardcoded. | `ALLOWED_ORIGINS` app setting with sensible fallback. |

---

## Things intentionally NOT changed

- Stack, endpoints, request/response shapes, token format, UI: all unchanged. Existing sessions survive only until you rotate `SESSION_SECRET` (rotation logs everyone out once, which is desirable here).
- Token in localStorage: kept, because moving to httpOnly cookies changes the SWA/Functions contract. The stored-XSS fix (item 2) closes the realistic theft path. Cookie-based sessions are a sensible v8 item.
- CSP still needs `'unsafe-inline'` because pages use inline scripts. Moving scripts to files and adding a nonce is a v8 item, not a blocker.

## Deploy checklist (in order)

1. Rotate all credentials listed above.
2. Run `migration-enterprise-hardening.sql` on Supabase.
3. Set app settings: `SESSION_SECRET`, `PA_CALLBACK_SECRET`, `PA_JOB_SUBMIT_FLOW`, `ALLOWED_ORIGINS`, `ADMIN_EMAILS`, `APP_URL`, plus the rotated storage/DB/PA values.
4. Update the PA job flow: send `paSecret` back on the `jobs-status` callback; read input via `inputSasUrl` instead of `fileBase64`.
5. Deploy. Verify: login, upload, job completes, viewer renders both panes, admin panel loads, contact form sends.
6. Revoke and regenerate any previously issued API keys.
