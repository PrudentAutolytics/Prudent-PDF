# Prudent Redact v37 Governance Control Center

## Governance redesign
- Replaces the previous card-heavy page with a modern enterprise control center.
- Adds a premium Microsoft Azure aligned hero and live control status.
- Adds explicit Microsoft Azure, Azure AI Document Intelligence, Azure Blob Storage, and Power Automate platform trust cards.
- Adds redaction-specific processing metrics, risk queue, lifecycle flow, processing volume, user concentration, administrative evidence, cost, and operator commands.
- Keeps the existing governance API and user-scoped data contract.
- Keeps evidence export and health summary copy actions.

## Retired workflow cleanup
- Removes the public workflow ribbon and its unused styling from the homepage.
- Removes Split PDF, Merge PDF, Scan to PDF, Image Face Privacy, Video Face Privacy, and generic Operation Cost workflow labels from maintained product surfaces.
- Replaces the dashboard retired operations empty state with a redaction-focused empty state.
- Removes unused retired operation icons from the shared shell.

## Responsive stability
- Desktop metric grid uses six controlled columns.
- Tablet and smaller desktop layouts collapse to one-column control sections.
- Mobile uses single-column cards and safe horizontal scrolling only for the risk table.
- No sidebar or shell scrolling ownership changes were introduced.

## Preserved
- Super-admin role authorization.
- Administration Governance bridge.
- Passwordless authentication and OTP.
- Redaction processing, Processing History, Document Viewer, and evidence export.
- Custom-domain CORS.
- Existing Power Automate URLs and static callback values.
- Locked jobs-submit SHA-256: 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.

## Validation
- Full repository regression suite passed twice.
- V37 Governance Control Center gate passed.
- JavaScript syntax validation passed.
- JSON validation passed.
- ZIP integrity passed.
