# Prudent Redact v38 Premium Viewer Command Bar

## Viewer header redesign
- Replaces the crowded single-line toolbar with three deliberate regions: document identity, document selection, and export actions.
- Replaces the ambiguous Original and Redacted PDF labels with Open original and Open redacted.
- Replaces the truncated Review CSV control with Export review CSV.
- Adds distinct document, redaction, and review export icons.
- Keeps the original button IDs and existing PDF opening behavior.

## Review hierarchy
- Adds a clear Secure document review identity and Processing History return control.
- Keeps file name, processing status, metadata, availability, and the 365-day history horizon visible without competing for the same space.
- Renames the two viewer panes Original document and Controlled redacted output.
- Simplifies the assurance strip around separation, integrity, and reviewer confirmation.
- Improves review tabs, zoom controls, pane borders, and visual hierarchy.

## Responsive behavior
- Large desktop uses a three-region command bar.
- Standard desktop uses shorter action labels.
- Tablet moves actions to a second toolbar row.
- Mobile stacks identity, selection, and actions.
- Narrow phones use a two-column export action grid.
- Existing shell scrolling ownership and PDF frame behavior remain unchanged.

## Preserved
- Original and redacted SAS loading.
- PDF preview frames and zoom controls.
- Entity review, audit, integrity, and review CSV generation.
- 365-day history and archived preview messaging.
- Governance Control Center and super-admin authorization.
- Existing Power Automate URLs and static callback values.
- Locked jobs-submit SHA-256: 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.

## Validation
- Full repository regression suite passed twice.
- V38 Viewer command bar gate passed.
- JavaScript syntax validation passed.
- JSON validation passed.
- ZIP integrity passed.
