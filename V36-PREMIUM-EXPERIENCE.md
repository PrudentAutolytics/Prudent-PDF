# Prudent Redact v36 Premium Experience

## What was reviewed
The full v35 build was reviewed: locked contract verified byte for byte, all pages rendered and visually inspected at desktop and mobile, and the complete test suite executed. Four release gates arrived failing in the uploaded v35 because their assertions still encoded pre-v35 design (the retired PDF operations module, the old email-allowlist admin model, and the previous homepage markup). Each stale assertion was updated to protect the v35 design equivalent: role based super_admin authorization with its bootstrap migration, the redaction focused dashboard, and the v34 login transformation markup. No product behaviour was changed to make a test pass.

## Premium experience layer
A motion and depth layer was added across the product. It is local, CSP safe, and fails open: if the script never loads, everything remains visible, and every animation is disabled under reduced motion preferences.

- Ambient aurora: slow drifting brand gradient glows behind the homepage hero, the closing call to action, and the login panel. The dark surfaces now have depth instead of a flat backdrop.
- Scan beam: a light sweep passes over the redaction demonstrations on the homepage and login, making the transformation read as live processing.
- Scroll reveal: homepage sections rise in as they enter the viewport. Content is only hidden when the script confirms it is running.
- Count up KPIs: the dashboard document, completed, cost and credit numbers animate to their values when data lands.
- Card life: stat cards lift on hover with a cursor tracked glow, primary buttons carry a sheen sweep and a tactile press, tables gain row hover, and the top bar gains a frosted blur.

## Files
- css/premium.css and js/premium.js (new), wired into every page including the public homepage and pricing.
- Dashboard KPI values carry count up hooks; hero, demo, and login containers carry ambience hooks.

## Validation
- Locked Power Automate jobs-submit file byte for byte unchanged: SHA-256 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.
- All 22 test files pass on two consecutive full runs. New V36 gate: 21 of 21, deterministic over 15 consecutive runs.
- Homepage, login and dashboard re-rendered and visually verified at desktop and mobile after the layer was applied, including the full page mobile scroll.
- No external assets, no em or en dash in maintained source, all JavaScript syntax valid.
