# Prudent Redact v15 Multimedia Redaction

This release adds a browser-based Media Redaction Studio for images and video while preserving the existing PDF redaction Power Automate contract.

Implemented:
- Image redaction with black, blur, and pixelation effects.
- Reviewer-drawn arbitrary sensitive regions.
- Face suggestion support when the browser exposes the Face Detection API.
- Video redaction with fixed reviewer-defined regions.
- Optional frame-sampled face masking during video export when browser face detection is available.
- Source-resolution video rendering through an export canvas.
- Audio track preservation when the browser exposes video captureStream audio tracks.
- Media operation evidence with output SHA-256.
- Existing usage metering and same configured Power Automate usage trigger after successful media exports.
- Responsive mobile, tablet, and desktop workspace.
- Accessible information buttons for processing, effects, face assistance, regions, video scope, and output behaviour.

Capability boundaries:
- Browser face detection is an assistive capability and is not guaranteed on every browser.
- Licence plate, screen, badge, paper, and arbitrary object regions can be manually reviewed and masked.
- Automatic licence plate or general object detection requires a dedicated computer vision model and is not fabricated by this build.
- Audio redaction remains capability-gated because permanent spoken-content removal requires transcription, time alignment, and audio rendering.

Locked dependency:
- api/jobs-submit/index.js remains byte-for-byte unchanged.
