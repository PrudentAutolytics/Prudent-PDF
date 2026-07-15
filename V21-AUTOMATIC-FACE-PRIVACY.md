# Prudent Redact v21

Media Redaction Studio fixes:
- Bundles a same-origin local Tiny Face Detector model instead of depending only on the browser FaceDetector API.
- Automatic face privacy scans an image immediately after upload when the existing automatic face option is enabled.
- Image loading waits briefly for local model readiness so the initial automatic scan is not silently skipped.
- Face boxes are mapped from original media coordinates into the scaled review canvas and padded for safer coverage.
- Preview rendering uses an immutable source frame so Blur and Pixelate do not recursively sample already-redacted canvas pixels.
- Full-resolution image export and video export also sample an original frame for every redaction effect.
- Native FaceDetector remains only as a fallback if the local model cannot be used.
- Existing Power Automate values and the locked jobs-submit contract remain unchanged.
