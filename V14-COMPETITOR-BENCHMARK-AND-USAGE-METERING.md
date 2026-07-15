# Prudent Redact v14

This release expands the enterprise document workflow catalog using the public feature surfaces of PDFAid, Smallpdf, PDFgear, and Adobe Acrobat as product benchmarks without copying their branding or interface.

Key implementation:
- Expanded workflow catalog and search/filter experience.
- Information button and accessible help dialog for every workflow card.
- Additional workflow categories covering annotations, fill and sign, flattening, e-signature workflow surfaces, AI document interaction, accessibility, image/text conversions, and legal document controls.
- New authenticated `/api/usage-track` endpoint.
- Successful local PDF operations increment `users.credits_used` by one.
- Successful local PDF operations trigger the same configured Power Automate URL used by the existing redaction submission configuration.
- Usage event payload excludes PDF bytes and SHA-256 fingerprints.
- The existing `api/jobs-submit/index.js` file remains byte-for-byte unchanged.

Power Automate usage event:
- eventType: DOCUMENT_OPERATION_USAGE
- eventId
- operationType
- usageIncrement: 1
- email
- sourceFileName
- outputFileName
- pageCount
- fileSizeMB
- occurredAt
- product
- source

The application increments portal plan usage in PostgreSQL after successful document operations. The same configured Power Automate trigger is also called for each successful metered operation.
