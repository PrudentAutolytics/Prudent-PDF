# Prudent Redact v11 Responsive and Security Implementation

## Implemented

- Adaptive desktop, tablet, and mobile application shell.
- Accessible mobile navigation drawer with focus containment, Escape support, backdrop, scroll lock, and 44px touch controls.
- Collapsible desktop navigation with a non-sensitive UI preference persisted locally.
- Mobile top command bar and context-aware New Redaction shortcut.
- Responsive KPI grids, tool workspaces, viewer panels, forms, dialogs, and compact mobile table cards.
- Mobile safe-area support and dynamic viewport units.
- Reduced-motion accessibility support and strong focus-visible states.
- Skip-to-main-content navigation.
- 30-minute local inactivity sign-out with a 2-minute warning and sensitive preview cleanup.
- Blob object URL revocation during page lifecycle cleanup.
- Safer toast and contextual-help rendering using textContent rather than untrusted innerHTML.
- Strict CORS origin matching. Unapproved origins are rejected instead of reflected or silently substituted.
- No-store API response headers and origin variance.
- Distributed OTP request and verification throttling using the existing PostgreSQL rate-limit helper, with compatibility fallback behaviour retained.
- OTP format and contact field validation.
- Callback job ID, status, page count, cost, and extracted-field limits.
- Timing-safe callback secret comparison through a SHA-256 normalized secret comparison.
- SAS request input validation and lower-sensitivity SAS logs that omit file names, email addresses, and query strings.
- Health posture checks for CORS configuration and strong session/callback secrets without exposing values.
- `frame-ancestors 'none'`, DNS prefetch disablement, origin agent clustering, and existing secure Blob PDF preview compatibility.
- Conservative PWA manifest. No service worker was added, so sensitive PDFs, SAS URLs, API data, and admin data are not cached offline.
- Privacy-mode compatibility for local PDF operation records through `sessionStorage` flag `pr_privacy_mode=1`.
- Removed obsolete hardcoded Static Web App host reference.
- Removed Unicode em dash and en dash characters from product-controlled source and copy. Vendored third-party minified libraries are unchanged.

## Power Automate contract

The `JSON.stringify` request body passed to `PA_JOB_SUBMIT_FLOW` was compared to the uploaded v10 source and is identical. Existing fields, order, names, capitalization, and values are preserved.

## Important production settings

Set these in Azure Static Web App environment variables:

- `APP_URL`
- `ALLOWED_ORIGINS`
- `SESSION_SECRET` with at least 32 random characters
- `PA_CALLBACK_SECRET` with at least 32 random characters
- `PA_EMAIL_SEND`
- `PA_JOB_SUBMIT_FLOW`
- PostgreSQL settings
- Azure Storage settings
- `ADMIN_EMAILS`

## Infrastructure-level next steps

A migration from localStorage session tokens to HttpOnly Secure SameSite cookies should only be done as one coordinated API and client authentication migration. Managed Identity, Key Vault, private endpoints, Entra ID, and centralized Application Insights are Azure infrastructure changes and are not falsely represented as completed by this source-only build.
