# Prudent PDF — Azure Static Web App v7.1 Enterprise

> Enterprise-grade PDF redaction platform built on Power Automate, Azure Document Intelligence, and Azure Blob Storage.
>
> **v7.1**: security hardening (20 fixes — see `ENTERPRISE-HARDENING.md`) + enterprise design system v11 (Prudent brand navy/blue, Schibsted Grotesk display type, Fluent-calibrated components). Run `migration-enterprise-hardening.sql` on the database before deploying.

> Enterprise-grade PDF redaction platform built on Power Automate, Azure Document Intelligence, and Azure Blob Storage.

## Quick Start

1. **Update PA flow URLs** in `js/config.js` (FLOWS section)
2. **Update Blob URL** in `js/config.js` (BLOB.CONTAINER_URL)
3. **Deploy** to Azure Static Web Apps

---

## Project Structure

```
prudent-pdf/
├── index.html                  ← Root redirect → /login
├── staticwebapp.config.json    ← SWA routing + security headers
├── css/
│   └── main.css                ← Full design system (1700+ lines)
│                                 Tokens · Layout · Components · Utilities
├── js/
│   ├── config.js               ← Single source of truth for ALL config
│   │                             PA endpoints · costs · session · helpers
│   └── shell.js                ← Topbar + sidebar injection on every page
└── pages/
    ├── login.html              ← Magic-link auth (no passwords)
    ├── dashboard.html          ← Upload, stats, recent jobs, activity feed
    ├── history.html            ← Full job history with filters + bulk export
    ├── viewer.html             ← Side-by-side original vs redacted + fields
    ├── pricing.html            ← Plans, cost calculator, FAQ
    └── contact.html            ← Contact form → PA flow → email
```

---

## Step 1 — Update PA Flow Endpoints

Open `js/config.js` and replace URLs in the `FLOWS` object:

```js
FLOWS: {
  AUTH_REQUEST : 'https://...powerautomate.../auth-request',
  AUTH_VERIFY  : 'https://...powerautomate.../auth-verify',
  QUOTA_GET    : 'https://...powerautomate.../quota-get',
  JOB_SUBMIT   : 'https://...powerautomate.../job-submit',
  JOB_STATUS   : 'https://...powerautomate.../job-status',   // ← New in v7
  JOB_LIST     : 'https://...powerautomate.../job-list',     // ← New in v7
  CONTACT_SEND : 'https://...powerautomate.../contact-send', // ← New in v7
  BLOB_SAS     : 'https://...powerautomate.../blob-sas',     // ← New in v7
}
```

Also update:
```js
BLOB: {
  CONTAINER_URL: 'https://YOUR_STORAGE.blob.core.windows.net/prudent-uploads',
}
```

---

## Step 2 — Deploy to Azure Static Web Apps

### Option A: GitHub Actions (recommended)

1. Push this folder to a GitHub repo
2. Azure Portal → Create Static Web App
3. Connect repo, set:
   - **App location**: `/`
   - **API location**: *(leave blank)*
   - **Output location**: `/`
4. Every push to `main` auto-deploys

### Option B: SWA CLI

```bash
npm install -g @azure/static-web-apps-cli
swa start . --host localhost --port 4280
swa deploy . --deployment-token YOUR_TOKEN
```

---

## Step 3 — Power Automate Flows to Build

| Flow name       | Trigger input                              | Output                                    |
|-----------------|-------------------------------------------|-------------------------------------------|
| `auth-request`  | `{ email, txId, ttlSeconds }`             | Sends magic-link email                    |
| `auth-verify`   | `{ txId, probe? }`                        | `{ status, email, token, userId, plan, creditsUsed, creditsLimit, trialExpiryDate }` |
| `quota-get`     | `{ email }`                               | `{ creditsUsed, creditsLimit, plan }`     |
| `blob-sas`      | `{ email, fileName }`                     | `{ sasUrl, blobUrl }`                     |
| `job-submit`    | `{ jobId, email, token, fileBase64 or blobUrl, fileName, fileSize, … }` | `{ jobId, status, resultUrl? }` |
| `job-status`    | `{ jobId, email }`                        | `{ status, resultUrl, pageCount, costTotal, extractedFields[] }` |
| `job-list`      | `{ email, days }`                         | `[ job array ]`                           |
| `contact-send`  | `{ name, email, company, message, planInterest }` | Sends email to VK             |

### auth-verify response schema (required)
```json
{
  "status": "approved",
  "email": "user@example.com",
  "token": "guid",
  "userId": "guid",
  "plan": "trial",
  "creditsUsed": 0,
  "creditsLimit": 5,
  "trialExpiryDate": "2025-09-01T00:00:00Z"
}
```

---

## Step 4 — SharePoint Lists

### PrudentPDF_Users
| Column          | Type     |
|-----------------|----------|
| Email (indexed) | Single line |
| Plan (Choice)   | trial / paid / expired |
| CreditsUsed     | Number |
| CreditsLimit    | Number |
| TrialStartDate  | Date/Time |
| TrialExpiryDate | Date/Time |
| IsActive        | Yes/No |

### PrudentPDF_Jobs
| Column           | Type     |
|------------------|----------|
| JobId (indexed)  | Single line |
| UserEmail        | Single line |
| FileName         | Single line |
| BlobUrl          | Single line |
| ResultUrl        | Single line |
| FileSize         | Number |
| PageCount        | Number |
| CostTotal        | Number |
| Status (Choice)  | Queued / Processing / Complete / Failed |
| SubmittedAt      | Date/Time |
| CompletedAt      | Date/Time |
| ErrorMessage     | Multi-line |
| ExtractedFieldsJSON | Multi-line |

### PrudentPDF_ContactRequests
| Column       | Type        |
|--------------|-------------|
| Name         | Single line |
| Email        | Single line |
| Company      | Single line |
| Message      | Multi-line  |
| PlanInterest | Choice      |
| SubmittedAt  | Date/Time   |
| IsFollowedUp | Yes/No      |

---

## Architecture Notes (v7 improvements over v6)

| Area | v6 | v7 |
|------|----|----|
| CSS  | 1112 lines | 1710 lines (full system) |
| config.js | 182 lines | 527 lines (full docs + helpers) |
| shell.js | 233 lines | 450 lines (ARIA, keyboard, quota update) |
| Login | Basic steps | Full polling + storage events + callback tab |
| Dashboard | Single upload modal | Stepper, Blob SAS, SHA-256 hash, cost preview |
| History | Table only | Filters, sort, bulk select, expandable rows |
| Viewer | Two-pane | Three-pane (orig + redacted + fields + cost) |
| Pricing | Static | Live cost calculator + FAQ accordion |
| Contact | Form only | Form + response times + service list |
| Accessibility | Minimal | Full ARIA labels, roles, live regions |
| Nav | 6 items | 9 items + 4 "Soon" slots for future features |

---

## Cost Defaults (editable in config.js)

| Service | Rate |
|---------|------|
| Azure Document Intelligence | $0.001 / page |
| Azure Blob Storage | $0.00002 / MB |
| Azure Functions | $0.000002 / run |
| Power Automate | $0.0006 / run |
| SendGrid | $0.00014 / email |
| Overhead | 1.20× (20%) |

---

## Support

**Kabilesh VijayaKumar (VK)**  
Prudent Autolytics — Power Platform & Automation Consultancy  
Kabileshvijayakumar@prudentautolytics.com  
Chennai, Tamil Nadu, India
