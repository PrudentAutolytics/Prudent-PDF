# Prudent PDF — Azure Static Web App

Production-ready PDF redaction platform built for Azure Static Web Apps.

## Project Structure

```
prudent-pdf/
├── staticwebapp.config.json   ← SWA routing rules
├── css/
│   └── main.css               ← Full design system (shared across all pages)
├── js/
│   ├── config.js              ← PA flow endpoints + cost calculator + utilities
│   └── shell.js               ← Topbar + sidebar injected on every page
├── pages/
│   ├── login.html             ← Magic link auth
│   ├── dashboard.html         ← Upload + stats + recent jobs
│   ├── history.html           ← 30-day job history, filters, bulk export
│   ├── viewer.html            ← Side-by-side original vs redacted
│   ├── pricing.html           ← Plans + cost transparency + FAQ
│   └── contact.html           ← Contact form → PA flow → your email
└── assets/                    ← (place logo/favicon here)
```

## Step 1 — Update Flow Endpoints

Open `js/config.js` and replace every `YOUR_PA_FLOW/...` URL with your actual Power Automate HTTP trigger URLs:

```js
FLOWS: {
  AUTH_REQUEST:  'https://...powerautomate.../auth-request',
  AUTH_VERIFY:   'https://...powerautomate.../auth-verify',
  QUOTA_GET:     'https://...powerautomate.../quota-get',
  JOB_SUBMIT:    'https://...powerautomate.../job-submit',
  JOB_STATUS:    'https://...powerautomate.../job-status',
  JOB_LIST:      'https://...powerautomate.../job-list',
  CONTACT_SEND:  'https://...powerautomate.../contact-send',
  BLOB_SAS:      'https://...powerautomate.../blob-sas',
}
```

Also update:
```js
BLOB: {
  CONTAINER_URL: 'https://YOUR_STORAGE.blob.core.windows.net/prudent-uploads',
}
```

## Step 2 — Deploy to Azure Static Web Apps

### Option A: GitHub Actions (recommended)

1. Push this folder to a GitHub repo
2. In Azure Portal → Create Static Web App
3. Connect your GitHub repo, set:
   - **App location**: `/`
   - **API location**: leave blank (no Azure Functions in this project)
   - **Output location**: `/`
4. Azure automatically creates a GitHub Actions workflow
5. Every push to `main` auto-deploys

### Option B: Azure CLI

```bash
az staticwebapp create \
  --name prudent-pdf \
  --resource-group your-rg \
  --source https://github.com/yourrepo \
  --location "West Europe" \
  --branch main \
  --app-location "/" \
  --output-location "/"
```

### Option C: SWA CLI (local dev + deploy)

```bash
npm install -g @azure/static-web-apps-cli
swa start . --host localhost --port 4280
swa deploy . --deployment-token YOUR_TOKEN
```

## Step 3 — Power Automate Flows to Build

Build these 8 flows as HTTP-triggered instant flows in Power Automate:

| Flow Name         | Trigger Input                         | What it does                                              |
|-------------------|---------------------------------------|-----------------------------------------------------------|
| `auth-request`    | `{ email, txId, ttlSeconds }`         | Create/lookup SP user, send magic link email              |
| `auth-verify`     | `{ txId, probe? }`                    | Check if token approved, return session + quota           |
| `quota-get`       | `{ email }`                           | Return `{ creditsUsed, creditsLimit, plan }`              |
| `blob-sas`        | `{ email, fileName }`                 | Generate SAS upload URL for Azure Blob                    |
| `job-submit`      | `{ email, token, blobUrl, fileName, fileSize, pageCount, estCost }` | Create SP job record, trigger processing |
| `job-status`      | `{ jobId, email }`                    | Return job status from SP                                 |
| `job-list`        | `{ email, days }`                     | Return all jobs for user in last N days from SP           |
| `contact-send`    | `{ name, email, company, message, planInterest }` | Save to SP + email you                     |

### Response Schemas

**auth-verify** must return:
```json
{
  "status": "approved",
  "email": "user@example.com",
  "token": "...",
  "userId": "...",
  "plan": "trial",
  "creditsUsed": 2,
  "creditsLimit": 5,
  "trialExpiryDate": "2025-08-01"
}
```

**job-list** must return:
```json
[
  {
    "jobId": "guid",
    "fileName": "document.pdf",
    "fileSize": 102400,
    "pageCount": 3,
    "status": "Complete",
    "submittedAt": "2025-07-01T10:00:00Z",
    "completedAt": "2025-07-01T10:02:30Z",
    "blobUrl": "https://...",
    "resultUrl": "https://...",
    "costTotal": 0.0075,
    "extractedFields": [],
    "errorMessage": null
  }
]
```

## Step 4 — SharePoint Lists

Create these lists in your SharePoint site:

**PrudentPDF_Users**
- Email (Single line, indexed)
- Plan (Choice: trial, paid, expired)
- CreditsUsed, CreditsLimit (Number)
- TrialStartDate, TrialExpiryDate (Date/Time)
- IsActive (Yes/No)

**PrudentPDF_Jobs**
- JobId (Single line, indexed)
- UserEmail (Single line)
- FileName, BlobUrl, ResultUrl (Single line)
- FileSize, PageCount, CostTotal (Number)
- Status (Choice: Queued, Processing, Complete, Failed)
- SubmittedAt, CompletedAt (Date/Time)
- ErrorMessage (Multi-line)
- ExtractedFieldsJSON (Multi-line)

**PrudentPDF_ContactRequests**
- Name, Email, Company, Message (text)
- PlanInterest (Choice)
- SubmittedAt, IsFollowedUp

## Features Implemented

- ✅ Magic link email auth (no passwords)
- ✅ Trial plan (5 files, 30 days) with quota bar
- ✅ Direct-to-Blob upload via SAS (no base64 size limits)
- ✅ Job submission → Power Automate → Azure Doc Intelligence
- ✅ 30-day job history with filters, sort, search
- ✅ Bulk select + CSV export (all / filtered / selected)
- ✅ Side-by-side original vs redacted document viewer
- ✅ Extracted fields panel with confidence scores
- ✅ Per-job cost breakdown (Doc Intelligence + Blob + Functions + PA + Email)
- ✅ Live job status polling (every 5s)
- ✅ Contact Us form → PA flow → your email
- ✅ Pricing page with FAQ and plan comparison
- ✅ Dark/light theme toggle (persisted)
- ✅ Fully responsive (mobile-friendly)
- ✅ Azure SWA routing config included

## Cost Defaults (editable in config.js)

| Service                      | Rate                  |
|------------------------------|-----------------------|
| Azure Doc Intelligence       | $0.001 / page         |
| Azure Blob Storage           | $0.00002 / MB         |
| Azure Functions              | $0.000002 / run       |
| Power Automate               | $0.0006 / run         |
| SendGrid                     | $0.00014 / email      |
| Overhead multiplier          | 1.2× (20%)            |
