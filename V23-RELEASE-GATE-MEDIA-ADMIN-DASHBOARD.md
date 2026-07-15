# Prudent Redact v23 Release Gate

Media Redaction Studio
- Corrected the workflow selector typography and spacing that caused Image Privacy and Video Privacy labels to concatenate visually.
- Media command bar now reserves a readable selector column on desktop, stacks at tablet width, and uses one workflow card per row on narrow phones.
- Workflow steps, effect buttons, checkbox copy, and control headings use explicit wrapping and line-height rules.
- Automatic face privacy now performs an aggressive multi-pass local scan.
- Full-frame 416 input pass at 0.24 threshold.
- Additional full-frame 608 pass for larger media at 0.30 threshold.
- Large images are scanned using overlapping 2x2 or 3x3 tiles with 22 percent overlap.
- Tile detections are mapped back to original coordinates and deduplicated using IoU.
- Face mask safety margin defaults to 22 percent and supports 10 to 50 percent.
- Video face detection refresh cadence increased from every five rendered frames to every three rendered frames.
- Reviewer confirmation remains required. The UI explicitly states that no face detector can guarantee zero missed or false detections.

Administration
- Administration entitlement is now database-aware.
- users.is_admin is supported when present.
- users.role values admin, administrator, and owner are supported when present.
- ADMIN_EMAILS remains a compatibility fallback.
- Login verification and quota refresh both calculate live administrator entitlement.
- Shell session stores refreshed isAdmin and rebuilds navigation when the entitlement changes.
- Administration retains Add User.
- User access action is presented as Remove access and Restore access. It uses the existing active-account control rather than destructive database deletion.
- The admin API itself validates the same database-aware entitlement.

Dashboard
- Recent Jobs is renamed Recent Redaction Jobs.
- Added a separate Recent Document and Media Operations section.
- Recent operation rows are sourced from the authenticated operation_usage ledger through /api/operation-summary.
- Split, merge, rotate, scan, document workflows, and media operations are visually separate from Power Automate redaction jobs.
- Recent operations show operation, source, output, cost, and completion time.
- Mobile labels are defined for each recent operation field.
- Dashboard recent redaction loading state now uses the correct four-column table span.

Release validation
- Existing repository regression suite passed.
- Dedicated v23 release gate contains exactly 50 assertions.
- Release gate pass 1: 50 of 50 passed.
- Release gate pass 2: 50 of 50 passed.
- Full security, CORS, authentication, media, automatic face privacy, profile, governance, history, origin, document workflow, responsive, Scan to PDF, and operation cost tests passed on both final runs.
- JavaScript syntax validation passed.
- JSON validation passed.
- Locked jobs-submit SHA-256 remains 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.

Important accuracy boundary
- Aggressive multi-pass scanning materially improves corner and small-face coverage, but no computer vision detector can honestly guarantee every face in every possible image or video frame. Prudent Redact therefore keeps reviewer confirmation as a release control.
