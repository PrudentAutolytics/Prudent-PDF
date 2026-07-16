# Prudent Redact v35 Enterprise Redaction Focus

- Removes the general PDF operations module, routes, implementation files, catalog and module-specific tests.
- Keeps Media Redaction implementation but disables product access as Coming Soon.
- Uses only users.role = super_admin for Administration authorization and visibility.
- Adds a role migration and Administration role management.
- Explicitly identifies Microsoft Azure, Azure AI Document Intelligence, Azure Blob Storage and Power Automate on public access surfaces.
- Refocuses Dashboard and Governance on document redaction, audit evidence, processing health, cost and platform controls.
- Preserves the locked Power Automate submission file and existing integration values.
