# Prudent Redact v32 Administration Bridge and Premium Login

## HAR-confirmed Administration failure
The supplied HAR showed six failing Administration calls:
- POST /api/admin-users returned HTTP 404 three times.
- POST /api/admin returned HTTP 404 three times.

These are route-level failures before the users table, signed-session administrator entitlement, or user query can execute.

## Administration bridge
- Administration now uses the already deployed /api/governance Function route.
- Every Administration request includes adminBridge=true.
- Governance delegates bridged requests to api/admin-service.js.
- admin-service re-runs signed-session verification.
- admin-service re-runs database-aware administrator entitlement.
- users.is_admin, users.role, and configured administrator fallback logic remain.
- Add user, enable or disable access, plan updates, credit updates, contacts, API keys, and Administration metrics remain in the shared service.
- The failed /api/admin-users experimental Function route is removed.
- The existing /api/admin handler remains intact for backward compatibility, but the current Administration client does not depend on it.

## Premium login
- Authentication and OTP behavior are unchanged.
- The left side is rebuilt as a privacy operations command center.
- Adds animated document redaction, moving media masks, scan motion, output evidence, operation metering, history state, control posture, media motion, and evidence-chain visuals.
- The main login message is now Enter the privacy operations control plane.
- The form is positioned as a Secure identity gateway.
- Work identity, short-lived OTP verification, and signed workspace access are visually connected.
- GDPR is no longer rendered as a certification-style login badge.
- The layout adapts to short desktop displays, tablets, phones, and narrow phones.
- Reduced motion remains supported.

## Preserved
- Power Automate jobs-submit contract and static fallback values are unchanged.
- Existing CORS custom-domain support remains.
- v31 video motion privacy remains.
- v31 365-day viewer history and archived preview state remain.
- Homepage v31 visual treatment remains unchanged because the user confirmed the homepage UI is good.

## Validation
- Full repository regression suite passed twice.
- V32 administration bridge and premium login release gate passed.
- JavaScript syntax validation passed.
- JSON validation passed.
- Changed v32 sources contain no en dash or em dash.
- Locked jobs-submit SHA-256 remains 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.
