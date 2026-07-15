# Prudent Redact v19 Enterprise Media Privacy

Implemented:
- Clear Image Privacy and Video Privacy workflow choices.
- Automatic image face detection after image selection when the browser exposes FaceDetector.
- Automatic image face re-detection when Black, Blur, or Pixelate is selected.
- Automatic image face privacy enabled by default.
- Video face masking enabled by default when face detection is supported.
- Repeated video face region refresh during export.
- Configurable 5 to 40 percent face safety margin.
- Multi-file media selection with an in-browser next-file queue.
- Every successful image or video export is added to a controlled output batch.
- Download Batch ZIP creates a real standards-compatible ZIP in the browser.
- The batch ZIP contains all outputs plus prudent-redact-evidence-manifest.json with SHA-256, operation, output size, and timestamp evidence.
- Individual output downloads remain available.
- Existing usage tracking and the locked Power Automate fallback remain preserved.
- Existing jobs-submit Power Automate contract remains byte-for-byte unchanged.

Capability boundary:
Automatic face detection uses the browser FaceDetector capability. Browsers without that capability retain manual reviewer-drawn redaction. This build does not falsely claim a bundled computer vision model where none is present.
