# Prudent Redact v39 New User and New Redaction Fix

## First-time user path
- The email check now returns an explicit success state.
- When the email is new, the first Continue action opens the account-details panel and stops before requesting an OTP.
- The user can enter full name, company, and primary use case before creating the account.
- The second action submits those values to auth-request and sends the verification code.
- Changing the email resets the prior lookup and registration state.
- Lookup errors are shown rather than silently continuing.
- The account-details region has an accessible label and state.

## Dashboard New Redaction path
- New Redaction from the sidebar now works when the user is already on Dashboard.
- The shared shell dispatches a dedicated prudent:open-redaction event for same-page activation.
- Dashboard supports initial #upload deep links, repeated hash changes, and the custom navigation event.
- The modal opener is reusable and focuses the PDF drop zone after opening.
- Existing upload, Azure Blob, job submission, and Power Automate behavior remain unchanged.

## Preserved
- Super-admin role authorization.
- Governance Control Center.
- Premium Viewer command bar.
- Passwordless OTP verification.
- Existing Power Automate URLs, callback values, and static fallback values.
- Locked jobs-submit SHA-256: 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.

## Validation
- Full repository regression suite passed twice.
- V39 new-user and New Redaction gate passed.
- JavaScript syntax validation passed.
- JSON validation passed.
- ZIP integrity passed.
