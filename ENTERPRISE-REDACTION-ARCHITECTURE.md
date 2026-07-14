# Prudent Redact - Enterprise Review Architecture v8.0

## Product lifecycle
UPLOAD → ANALYZE → REDACT → REVIEW → RELEASE READINESS → CONTROLLED EXPORT → AUDIT

## Implemented in v8.0
- Secure PDF byte fetch from short-lived SAS URLs; SAS is not assigned to the preview iframe.
- PDF magic-signature validation before preview.
- Browser-memory Blob preview and URL revocation.
- SHA-256 fingerprint prefixes displayed for original and redacted outputs.
- Side-by-side original/redacted review workspace.
- Entity search, confidence filtering, masked sensitive values, accept/reject reviewer decisions.
- Release-readiness quality gate based on preview verification and reviewer completion.
- Reviewer audit timeline.
- Redaction manifest and review dossier JSON exports.
- Dynamic deployment API base URL in Admin.
- Deployment health endpoint that reports configuration presence without returning secrets.
- Strict no-store, HSTS, CSP, permissions policy, CORP/COOP and anti-indexing headers.
- Power Automate jobs-submit payload contract preserved unchanged.

## Deliberately not faked
The following need server-side persistence and/or a redaction-rendering service before the UI may claim they are authoritative:
- Immutable audit ledger.
- Server-side reviewer decisions.
- Four-eyes approval / maker-checker release.
- Manual rectangle redaction written back into PDF bytes.
- Cryptographic signing of released PDFs.
- Legal hold and retention enforcement.
- Microsoft Entra tenant RBAC and Conditional Access policy enforcement.

The current browser review state is clearly labelled and exported in the reviewer dossier. A future backend should persist the same manifest schema and append immutable audit events.

## Required production migration path
1. Replace OTP auth with Microsoft Entra ID / Static Web Apps authentication for enterprise tenants.
2. Add `redaction_reviews`, `redaction_decisions`, `audit_events`, and `release_versions` tables.
3. Make audit events append-only and server-generated.
4. Add reviewer and approver roles; require a second user for controlled release where policy requires it.
5. Persist full SHA-256 hashes server-side on ingest and release.
6. Store secrets in Azure Key Vault and access downstream Azure services with Managed Identity where supported.
7. Add retention, deletion and legal-hold policies by tenant.
8. Add Azure Monitor / Application Insights alerts and a dead-letter/retry path for failed Power Automate callbacks.


## v9 operational governance layer

The Governance Command Center converts governance from a documentation surface into an operator workflow. It computes operational controls from live job data: failed states, active jobs older than 15 minutes, completed jobs outside the 15-minute control target, P95 processing time, throughput, cost, page volume, and risk concentration by user/tenant. Administrators can drill directly into the relevant review job and export a point-in-time JSON governance evidence snapshot.

The 15-minute threshold is currently an application control target used by the command center; it is not represented as a contractual SLA unless separately agreed with a customer.
