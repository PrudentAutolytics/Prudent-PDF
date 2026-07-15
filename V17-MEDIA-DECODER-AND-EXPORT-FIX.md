# Prudent Redact v17 Media Reliability Fix

Fixed and verified now:
- Added `blob:` to the CSP `img-src` directive. Uploaded image object URLs were previously blocked by the portal CSP and surfaced as an image decode error.
- Media selection now accepts image and video formats from the same selector and auto-detects the selected media type. Users no longer need to switch to Video mode before choosing a video.
- Image loading uses `createImageBitmap` with an `HTMLImageElement` fallback.
- MIME type and filename extension are both considered, improving selection from Windows and mobile browsers that provide an empty or generic file MIME type.
- File input state is reset after selection and failure so the same file can be retried.
- Image export now supports both `ImageBitmap.width/height` and `HTMLImageElement.naturalWidth/naturalHeight`.
- Added a canvas Blob fallback when `toBlob()` returns no output.
- Video loading uses metadata and can-play readiness events with a bounded decode timeout and actionable codec errors.
- Video export completion now listens to the actual media `ended` event instead of depending on a final animation-frame callback.
- Existing locked Power Automate redaction submission file remains unchanged.

Browser media verification performed in headless Chromium with generated fixtures:
- PNG load: pass
- JPEG load: pass
- WebP load: pass
- WebM load: pass
- H.264 MP4 load: pass
- PNG redaction export and usage call: pass
- JPEG redaction export and usage call: pass
- WebP redaction export and usage call: pass
- WebM redaction export and usage call: pass
- H.264 MP4 redaction export to WebM and usage call: pass
