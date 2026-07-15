# Prudent Redact v31

## Document viewer and retention
- Viewer now discovers 365 days of signed-session job history instead of only 30 days.
- Each selector item identifies whether the preview is available, processing, or archived.
- Jobs older than the 30 day preview retention window remain visible for historical context.
- Archived jobs show a clear explanation and direct the user to reprocess the source to create a new controlled output.

## Administration
- Adds a dedicated `/api/admin-users` Azure Function route using the existing administration handler.
- Administration now calls the dedicated route first.
- A 404 from the dedicated route automatically retries the legacy `/api/admin` route.
- Authorization and schema-aware administrator checks remain unchanged.

## Video motion privacy
- Existing browser video export is upgraded from independent face refreshes to matched motion tracking.
- Face regions are rescanned every two rendered frames during export.
- IoU matching associates moving face boxes between scans.
- Exponential smoothing reduces mask jitter as subjects move.
- Live tracking telemetry reports active tracked regions and scan count.
- Black, Blur, and Pixelate continue to apply throughout the exported video.
- Manual boxes remain fixed for the full clip.

## Visual polish
- Public home adds layered floating document graphics and an animated evidence orbit.
- Login adds a visual Work Email to OTP Verify to Signed Workspace access route.
- Pricing calculator now uses its full width as a deliberate two-column decision surface and removes the large dead area around the monthly cost result.

## Safety and validation
- Full regression suite passed twice.
- V31 release gate passed.
- JavaScript syntax validation passed.
- JSON validation passed.
- Locked Power Automate jobs-submit SHA-256 remains `5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803`.
