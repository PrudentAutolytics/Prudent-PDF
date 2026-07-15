# Prudent Redact v30 Brand Density and Custom Domain

Production origin
- Adds https://redact.prudentautolytics.com to the explicit CORS allow list.
- Preserves brave-cliff and nice-grass Azure origins.
- Preserves APP_URL and ALLOWED_ORIGINS configuration support.
- Does not use wildcard CORS.

Brand visibility
- Adds assets/pa-logo-light.svg for light surfaces.
- The light logo preserves the Prudent Autolytics symbol and changes the white wordmark to dark navy.
- Public home and login use the light-surface full wordmark.
- Existing dark logo asset remains unchanged.

Public home density
- Removes the forced full-viewport hero height that created a large empty lower canvas.
- Adds a four-card operating capability rail for privacy intake, evidence, economics and governance.
- Adds a compact privacy lifecycle strip.
- Adds live operational signal meters for coverage, evidence and control.
- Keeps the animated privacy canvas, moving face masks, scan beam, workflow cards and moving capability ribbon.
- Capability cards collapse to two columns on tablet and one column on mobile.

Login density and verification language
- Removes the left-brand auto margin that created a large visual gap.
- Enlarges and clearly displays the full Prudent Autolytics wordmark.
- Adds identity, processing and oversight cards beneath the animated privacy workspace.
- Adds transport, identity and authenticated control assurance cards below the sign-in form.
- Keeps passwordless authentication and OTP logic unchanged.
- Narrow phone layouts stack all information cards.

Validation
- Full repository regression suite passed twice.
- V23 release gate passed 50 of 50 checks.
- V24 product benchmark gate passed 80 of 80 checks.
- V25 scroll ownership gate passed 40 of 40 checks.
- V25 media, admin and dashboard gate passed 50 of 50 checks.
- V26 merged release gate passed.
- V29 public experience and CORS gate passed.
- V30 brand density and custom domain gate passed.
- JavaScript syntax validation passed.
- JSON validation passed.
- Changed v30 sources contain no en dash or em dash.
- Locked jobs-submit SHA-256 remains 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.
