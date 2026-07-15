# Prudent Redact v27

Two requested additions, built on real data, validated, and shipped.

## 1. Advanced dashboard charts
A new analytics section sits directly under the KPI cards on the operations dashboard, with three charts:

- Daily Redaction Volume: a 14 day grouped bar chart showing jobs per day split by outcome (complete, in progress, failed), with per bar tooltips and a Y axis that scales to the data.
- Job Status Mix: a donut showing the distribution of complete, in progress, and failed jobs across the loaded window, with a legend and percentages and the total in the centre.
- Cumulative Spend Trend: an area line chart of running redaction cost over 14 days, built from the recorded cost of each job.

Design and safety notes:
- The charts are hand built SVG with no external chart library. The Content Security Policy is script-src 'self', so a CDN chart library is not permitted, and vendoring a large bundle is unnecessary. The charting engine is a single local file, js/charts.js.
- Every chart reads the same real job and operation data the KPI cards already use. No values are invented. Each chart shows an honest empty state when there is no data yet, rather than a fake baseline.
- Charts are theme aware. They read colours from CSS variables and re-render automatically when the light or dark theme changes.
- Charts carry accessible labels and update on every data refresh.

## 2. User image at the top right
The top right user chip already supported a profile picture. This build makes it prominent and consistent:

- The avatar now shows the user's uploaded profile picture on every page, falling back to initials when none is set.
- The picture is delivered to the shell through the quota endpoint, which was made schema aware so older databases without the column continue to work.
- The user menu opened from the chip now leads with an identity header: the avatar, the display name, the email, and the current plan, followed by a Profile and Settings link, pricing, contact, and sign out.
- Uploading a new picture on the Profile page updates the top right avatar live, with no reload.
- Profile picture uploads remain restricted to JPG, PNG, or WebP and capped in size.

## Validation
- The locked Power Automate jobs-submit file is byte for byte unchanged. SHA-256 5345cc76c6e06ad5bc9d5cb18b50ea0f4c039a7306a2e07d1e72db6a32702803.
- All locked Power Automate fields remain present, including fileBase64.
- The Content Security Policy still forbids external scripts.
- Full regression suite passed. V23 gate 50 of 50. V24 gate 80 of 80. V25 scroll gate 40 of 40. V25 media, admin, dashboard gate 50 of 50. V26 merged gate passed. New V27 charts and avatar gate 45 of 45, run 30 consecutive times with zero failures. All 18 test files pass on two consecutive full runs.
- The chart engine was verified in a DOM against realistic job data: valid SVG output, correct cumulative maths, working tooltips, and honest empty states.
- JavaScript and inline HTML script syntax valid. JSON valid. No em dash or en dash in maintained source.
