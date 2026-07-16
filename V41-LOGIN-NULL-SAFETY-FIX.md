# Prudent Redact v41 Login Null Safety Fix

## Root cause
- During account lookup, the Continue button is temporarily replaced by a loading spinner.
- That temporary button markup does not contain the contBtnTxt span.
- The returning-user and new-user lookup branches attempted to set contBtnTxt.textContent while the span was absent.
- The browser raised Cannot set properties of null and stopped the login flow.

## Fix
- Removes the dependency on the temporary contBtnTxt child during account lookup.
- resetBtn recreates the correct button label after lookup completes.
- Adds null-safe helpers for text, attributes, and class state.
- Guards optional registration, OTP, resend, success, and email-change controls.
- Filters absent OTP inputs before wiring events.
- Keeps both returning-user and first-time-user flows intact.

## Preserved
- Current v40 visual design and animation.
- New-user details collection.
- Passwordless OTP authentication.
- Microsoft Azure and Azure AI Document Intelligence messaging.
- Existing authentication APIs and Power Automate values.
- Locked jobs-submit SHA-256: 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.

## Validation
- Full regression suite passed twice.
- V41 login null-safety gate passed.
- JavaScript syntax validation passed.
- JSON validation passed.
- ZIP integrity passed.
