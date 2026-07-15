# Prudent Redact v22 Enterprise QA

Implemented in this release:

Responsive and mobile hardening
- Removed destructive generic mobile card padding that broke card header and body layouts.
- Added explicit responsive card header, body, and footer spacing.
- Added narrow-screen overflow guards for application workspaces, forms, catalog cards, and command bars.
- Document Operations search and category controls stack on mobile.
- Workflow cards use auto-fit sizing that cannot exceed the viewport.
- Dashboard recent jobs, Processing History, Administration users, and API keys use labelled mobile card layouts.
- Document Viewer uses a scrollable stacked mobile workspace with usable pane heights.
- Mobile workflow primary actions use a fixed safe-area-aware bottom action.
- Page header secondary actions expand cleanly on narrow screens.

Scan to PDF
- Separate Use camera for one page and Choose page images actions.
- Camera capture is only requested by the camera action instead of being forced on the generic source picker.
- Multi-page scan ordering with Up, Down, and Remove controls.
- Create scanned PDF is the task-specific primary action.
- A4 automatic orientation output with configurable page margins.
- Optional source-size page layout remains available.
- Unsupported mobile image formats are reported instead of silently ignored.
- Actual scan assembly was validated using portrait JPEG and landscape PNG fixtures. The generated PDF reloaded successfully with two pages sized 595 x 842 and 842 x 595.

Operation cost analysis
- The existing redaction calcJobCost model remains separate and unchanged.
- Added a dedicated non-redaction operation cost model with version 2026.07-op-v1.
- Server-side operation cost calculation is the source of truth for completed document and media operations.
- usage-track records an operation_usage cost ledger when the production database permits table creation.
- Usage events sent to the existing configured Power Automate URL now include additive estimatedPlatformCost, estimatedProductPrice, sourceCount, and costModelVersion fields.
- Added authenticated /api/operation-summary for 30-day operation cost totals and cost by operation.
- Dashboard 30-day cost now combines completed redaction cost with metered document and media operation cost.
- Dashboard cost analysis shows Redaction cost, Operation cost, and Combined cost separately.
- Governance total cost now includes operation cost and exposes redaction_cost, operation_cost, and operation_count.
- Advanced PDF workflows and Media Redaction show estimated operation cost before execution and server-calculated cost after successful metering.

Additional defects fixed
- Flatten PDF contained a duplicate execution branch that referenced an undefined variable. The broken branch was removed.
- Advanced workflow drop zones now support desktop drag and drop.
- PDF operation local records now retain the server-returned cost analysis and persist the updated usage event metadata.

Testing
- Full repository regression suite passed.
- Security, CORS, authentication, media, profile, governance, history, operation catalog, automatic face privacy, responsive, Scan to PDF, and operation cost unit tests passed.
- JavaScript syntax and JSON validation passed through the repository regression suite.
- Exact locked jobs-submit SHA-256 remains 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.
- A real PDF assembly harness generated and reloaded a two-page Scan to PDF output with correct portrait and landscape A4 orientation.

Testing limitation
- Automated headless Chromium screenshots could not complete in the execution container because Chromium was unable to run reliably under the container kernel and sandbox constraints. Responsive validation therefore used page-by-page source/CSS regression rules plus mobile layout-specific assertions. Live deployed-device testing remains necessary before calling a specific browser/device matrix certified.
