# Prudent Redact v26 Merged Product Stabilization

This build uses the v25 scroll ownership release as the baseline and selectively merges the stronger validated media, dashboard, and history recovery changes.

Preserved
- Fixed 100dvh desktop shell.
- Sidebar and main workspace share the same fixed grid row.
- Sidebar remains full height on long pages.
- Sidebar navigation scrolls only when required.
- Sidebar quota and collapse footer remains fixed.
- Main workspace owns desktop scrolling.
- Mobile and tablet return to normal document flow.
- Existing Power Automate URL, static values, and locked jobs-submit contract are unchanged.

Merged media hardening
- Media command bar uses a bounded 300 to 400 pixel workflow column and collapses below 1180 pixels.
- Security note headings no longer force nowrap.
- Workflow labels, subtitles, buttons, hints, costs, evidence hashes, and filenames have explicit overflow protection.
- Automatic face scanning uses full-frame 416 and 512 passes, a 608 pass for larger media, denser overlapping 2x2, 3x3, or 4x4 tile coverage, and dedicated top, bottom, left, and right edge bands.
- Tile overlap is 34 percent.
- Face detection deduplication retains distinct nearby faces using a 0.45 IoU threshold.
- Default face safety margin is 28 percent with a 10 to 60 percent range.
- Reviewer confirmation remains required because no detector can guarantee zero missed or false detections.

Merged dashboard and history fixes
- Recent Redaction Jobs explicitly explains that it contains PDFs submitted to the redaction workflow.
- Recent Document and Media Operations remains a separate dashboard section.
- Processing History remains scoped to signed session identity and can recover older job rows attached to an earlier users row with the same verified session email.
- History never accepts a client supplied email for that recovery.

Validation
- Full repository regression suite passed twice.
- V23 release gate passed 50 of 50 checks.
- V24 product benchmark gate passed 80 of 80 checks.
- V25 scroll ownership gate passed 40 of 40 checks.
- V25 media, admin, and dashboard gate passed 50 of 50 checks.
- V26 merged release gate passed.
- JavaScript syntax validation passed.
- JSON validation passed.
- Maintained merged sources contain no en dash or em dash.
- Locked jobs-submit SHA-256 remains 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.
