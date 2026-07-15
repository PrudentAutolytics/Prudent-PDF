# Prudent Redact v28

Three deliverables in this build, validated and shipped.

## 1. Redesigned homepage
The login and landing screen is now self-explanatory and graphics led, in the spirit of the reference redaction products, while staying on the Prudent brand and keeping the existing passwordless email flow untouched.

New on the left panel:
- A live redaction preview that animates real looking document lines, sweeps permanent black boxes over the sensitive values, and tags each one with the detected data type (Name, Phone, IBAN, ID). It ends with a confirmation that four items were detected and permanently masked with no metadata and no recovery.
- A three step how it works strip: Detect, Redact, Verify, each with a short description.
- Clearer hero copy that names the product surface (PDFs, images, and video) and the audiences (legal, HR, finance, healthcare, compliance).

The sign in form, OTP flow, and all existing behaviour are unchanged. The animations respect reduced motion preferences, and the whole layout reflows cleanly at tablet and phone widths: on small screens the hero, the preview, the steps, and the form stack in a single readable column.

## 2. Favicon and app icons from the logo
The favicon was a generic blue document. It is now generated from the actual Prudent Autolytics PA symbol, using the logo's own gradient (from #0A8CFF through #4169F6 to #B218F4) on a dark rounded badge. The 192, 512, and Apple touch icons were regenerated from the same source so the entire icon set is consistent and on brand.

## 3. Administration user retrieval fix
The administration portal could fail to load users. The root cause was that the administrator check lowercased the session email but did not trim it, so a stored or session email with stray leading or trailing whitespace would not match the administrator allowlist and the request was refused, leaving the user table empty.

Fixes:
- The administrator check now trims as well as lowercases the email, so whitespace and case variations resolve correctly. Non administrators are still refused.
- The administration page now shows clear, specific states instead of a blank or vague table: an access denied message that tells the user to sign out and back in, a session expired message, and a distinct schema or configuration error message.
- The administrator API path, schema aware user listing, and per request authorization are unchanged and were verified end to end against a simulated database: the user list, totals, and capability flags all return correctly.

If Administration still shows access denied after this change, the account simply is not on the administrator list. Sign out and back in first to refresh the session admin flag.

## Validation
- The locked Power Automate jobs-submit file is byte for byte unchanged. SHA-256 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.
- All locked Power Automate fields remain present, including fileBase64.
- Full regression and all release gates pass. New V28 gate 34 of 34, deterministic over 10 runs. All 19 test files pass on two consecutive full runs.
- The homepage was rendered at desktop and mobile and visually reviewed. The favicon was rendered and visually confirmed to show the PA symbol.
- The administrator flow was simulated end to end, including the whitespace and case edge cases that previously caused the empty user table.
- JavaScript and inline HTML script syntax valid. No em dash or en dash in maintained source.
