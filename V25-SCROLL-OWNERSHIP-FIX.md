# Prudent Redact v25 Scroll Ownership Fix

Root cause
- The desktop shell was allowed to grow with content while the sidebar also used sticky positioning and its own viewport-sized box.
- Long pages could continue scrolling through the document while the sidebar reached the boundary of its sticky or grid containing block.
- The result was the blank left column shown on long Governance pages even though the center workspace continued to scroll.

Desktop fix
- The authenticated shell is a fixed 100dvh grid.
- Grid rows are the top bar plus minmax(0, 1fr).
- Sidebar and main workspace occupy the same fixed second row.
- The sidebar stretches to 100 percent of that row and no longer relies on sticky positioning.
- The sidebar itself never scrolls.
- Only the sidebar navigation region scrolls when navigation content exceeds available height.
- The plan and usage footer and collapse control remain fixed at the bottom of the sidebar.
- The main workspace owns vertical content scrolling.
- Desktop html and body scrolling are disabled so the left and center columns cannot diverge.
- The Redaction Review viewer keeps its controlled fixed-height workspace.

Mobile and tablet
- At 1100px and below, the shell returns to normal document flow.
- Shell height becomes auto and overflow becomes visible.
- Main workspace height becomes auto and normal page scrolling is restored.
- The existing full-height navigation drawer remains fixed and independently scrollable.
- Safe-area behavior remains preserved.

Validation
- Full repository regression suite passed twice.
- V23 release gate passed 50 of 50 checks.
- V24 product benchmark gate passed 80 of 80 checks.
- V25 scroll ownership gate passed 40 of 40 checks.
- JavaScript syntax validation passed.
- JSON validation passed.
- No en dash or em dash was added to the changed shell source.
- Locked jobs-submit SHA-256 remains 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.
