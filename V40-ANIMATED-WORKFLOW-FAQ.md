# Prudent Redact v40 Animated Workflow and FAQ

## Review
The full v39 build was reviewed: the locked Power Automate submission file verified byte for byte, all 26 test files executed, and the homepage rendered and inspected at desktop and mobile. One release gate arrived failing because it still asserted the retired capability ribbon; the assertion now protects the workflow section instead. The retired document tools (Split PDF, Merge PDF, Scan to PDF) are confirmed absent from every public surface, and a gate check now keeps it that way.

## Animated workflow
The five step workflow section (Access, Process, Review, Meter, Govern) is now a living sequence rather than static cards.

- Steps activate one after another once the section scrolls into view: the active card lifts, its number badge fills with the brand gradient, and a progress bar sweeps beneath it before the highlight advances.
- The autoplay pauses while the pointer is over the board or while any step holds keyboard focus, and it never runs under reduced motion preferences, where every step simply renders complete.
- The animation is presentational only; no content depends on it.

## FAQ
A new FAQ section sits between the media showcase and the closing call to action, linked from the top navigation.

- Eight questions cover how redaction works, permanence, where documents are processed and stored, passwordless access, output evidence, metering, media privacy, and role based administration.
- Every answer is grounded in claims the product already makes on its public surfaces (Azure AI Document Intelligence, black box redaction, SHA 256 evidence, signed sessions, metered operations). No retention or deletion promise was invented, and a gate check enforces that.
- The accordion uses native details and summary elements: fully keyboard accessible, focus visible, zero script dependency, with a smooth chevron and open state styling. The first answer is open by default so the section never reads empty.

## Validation
- Locked jobs-submit SHA-256 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803, unchanged.
- New V40 gate: 21 of 21 checks, deterministic over 15 consecutive runs. All 26 test files pass on two consecutive full runs.
- Workflow animation, desktop FAQ and mobile FAQ rendered and visually verified. Progress bars confirmed to exist only on the five workflow steps after an initial patch leaked them into the proof cards and was repaired.
- No external assets, no em or en dash in maintained source, all JavaScript syntax valid.
