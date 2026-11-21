# CivicResolve

> **AI-powered civic grievance management platform for local governments.**

[![CI](https://github.com/your-org/civicresolve/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/civicresolve/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

CivicResolve is a production-ready, full-stack web application that lets citizens report civic issues — potholes, broken streetlights, water leaks, encroachments, and more — through a simple web form with optional photo uploads. Reports are instantly triaged by **Google Gemini**, which categorises the issue, assesses priority, detects the citizen's language, and routes the report to the correct municipal department. Officers and admins then act on reports through a live dashboard with real-time status updates.

The platform is built for Indian municipalities but is fully internationalised (12 Indian languages supported out of the box). It runs on **Google Cloud Run** with **Firebase** as its auth and database backbone, making it cheap to operate at low volume and horizontally scalable at high volume. All AI calls go through Gemini with deterministic rule-based fallbacks, ensuring zero downtime even when the AI service is unavailable.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / PWA                        │
│         (HTML/CSS/JS served by Express, public/)            │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────────┐
│               Cloud Run  –  server.js (Node 22)             │
│                                                             │
│  middleware/        services/           config/             │
│  ├─ auth.js         ├─ ai.js            ├─ constants.js     │
│  ├─ security.js     ├─ store.js         └─ firebase-admin.js│
│  ├─ validation.js   ├─ queue.js                             │
│  └─ errorHandler.js ├─ notifications.js                     │
│                     └─ analytics.js                         │
└───┬──────────────┬────────────────┬────────────────┬────────┘
    │              │                │                │
    ▼              ▼                ▼                ▼
Firebase Auth  Firestore       Cloud Storage   Cloud Tasks
(JWT tokens)   (reports,       (report images) (triage/notify
               users, audit)                    background jobs)
                    │
                    ▼
              Gemini API
        (triage · translate ·
         embeddings · verify)
```

---

## Google Services Used

| Service | Purpose | Why chosen |
|---------|---------|-----------|
| **Gemini 2.5 Flash** | Multimodal triage, translation, semantic search, resolution verification | Best price/performance for structured JSON output with vision; native `responseSchema` avoids brittle regex parsing |
| **Firebase Authentication** | Citizen / officer / admin identity, JWT issuance | Handles OAuth, email/password, token refresh, and custom claims with zero infrastructure |
| **Cloud Firestore** | Primary database — reports, users, audit logs, notifications, translation cache | Real-time SDK, offline support, flexible schema, generous free tier, tight Firebase Auth integration |
| **Cloud Storage (GCS)** | Report photo storage and signed-URL delivery | Atomic consistency with Firestore, Firebase Storage Rules for auth-gated access |
| **Cloud Tasks** | Background triage and notification queue | Durable, retryable, rate-limited job execution without a separate worker service |
| **Cloud Run** | Container hosting | Scales to zero (zero cost at idle), no servers to manage, automatic TLS |
| **Cloud Secret Manager** | Secure secret injection at deploy time | Avoids secrets in environment variables baked into the container image |
| **Cloud Logging** | Structured application logs | Native Cloud Run integration, 90-day retention, alert policies |

---

## Role & Permission Matrix

| Role | Submit report | View own reports | View all reports | Update status | Manage staff |
|------|:---:|:---:|:---:|:---:|:---:|
| **citizen** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **officer** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **admin** | ❌ | ✅ | ✅ | ✅ | ✅ |
| *(unauthenticated)* | ❌ | ❌ | 🔸 public fields only | ❌ | ❌ |

> [!NOTE]
> Roles are stored as Firebase custom claims, set server-side only via the Admin SDK. They are verified on every request inside `middleware/auth.js`.

---

## API Reference

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/session` | Firebase ID token (Bearer) | Exchange Firebase ID token for a session cookie |
| `DELETE` | `/api/auth/session` | Session cookie | Sign out — clears server session |
| `GET` | `/api/auth/me` | Session cookie | Returns `{uid, email, role, department}` |

### Reports

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/reports` | citizen | Submit a new civic report (JSON body with optional `imagePaths[]`) |
| `GET` | `/api/reports` | officer / admin | List all reports with filter + pagination (`?status=&department=&priority=&page=&limit=`) |
| `GET` | `/api/reports/mine` | citizen | List the authenticated citizen's own reports |
| `GET` | `/api/reports/public` | public | Paginated public list — returns `id, category, status, createdAt` only |
| `GET` | `/api/reports/:id` | citizen (own) / officer / admin | Full report detail |
| `PATCH` | `/api/reports/:id/status` | officer / admin | Update report status and optionally add an officer note |
| `GET` | `/api/reports/:id/images/upload-url` | citizen (own report) | Get a signed GCS URL for direct browser upload |
| `POST` | `/api/reports/:id/verify` | officer / admin | Trigger AI resolution verification (before/after images) |

### Staff & Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/staff` | admin | List all officer and admin accounts |
| `POST` | `/api/staff` | admin | Create a new officer / admin account |
| `PATCH` | `/api/staff/:uid/role` | admin | Change a user's role or department assignment |
| `DELETE` | `/api/staff/:uid` | admin | Deactivate a staff account |

### Analytics & AI

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/analytics/summary` | officer / admin | Aggregate stats: counts by status, department, priority |
| `GET` | `/api/analytics/sla` | officer / admin | SLA compliance report (% resolved within target hours) |
| `POST` | `/api/ai/search` | officer / admin | Natural-language semantic search over open tickets |
| `GET` | `/api/ai/briefing` | officer / admin | AI-generated daily briefing for the requesting officer's department |

### Infrastructure

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/healthz` | public | Health check — returns `{status:"ok", uptime, version}` |
| `GET` | `/api/csrf-token` | session | Returns a fresh CSRF token for the current session |
| `POST` | `/api/tasks/worker` | Cloud Tasks OIDC | Internal task handler — not for public use |

---

## Gemini Usage Deep-Dive

### Calls Made

| Function | Model call | Input | Output schema | Temp | Timeout | Retry |
|----------|-----------|-------|---------------|------|---------|-------|
| `triage(report)` | `generateContent` (multimodal) | description + all image parts | Full triage JSON (see below) | 0.2 | 30 s | 3× exponential |
| `generateEmbedding(text)` | `embedContent` | report description | `number[]` (768-dim) | n/a | 10 s | 3× exponential |
| `translateNotification(text, lang, ...)` | `generateContent` | English status message + target language | Translated string | 0.1 | 15 s | 2× |
| `verifyResolution(before[], after[])` | `generateContent` (multimodal) | Before and after images | `{verified: bool, reason: string}` | 0.1 | 30 s | 2× |
| `generateDailyBriefing(tickets[])` | `generateContent` | Open ticket summaries | Markdown briefing text | 0.7 | 20 s | 1× |
| `naturalLanguageSearch(query, tickets[])` | `generateContent` | Query + ticket list | Ranked IDs with relevance scores | 0.0 | 20 s | 2× |

### Triage Response Schema

```jsonc
{
  "detectedLanguage": "hi",          // BCP-47 code
  "englishTranslation": "...",        // null if already English
  "category": "Road & Infrastructure",
  "subCategory": "Pothole",
  "priority": "High",                 // Critical | High | Medium | Low
  "publicImpactScore": 7,             // 1–10
  "confidence": 0.91,                 // 0–1
  "recommendedDepartment": "PWD",
  "suggestedAction": "...",
  "perImageFindings": [
    { "index": 0, "description": "...", "severity": "High" }
  ],
  "textImageConsistency": true,
  "spamFlag": false,
  "reasoning": "..."
}
```

### Fallback Strategy

If Gemini is unavailable or the response fails schema validation, `services/ai.js` falls back to deterministic rules imported from `config/constants.js`:

1. Keyword matching against category definitions → category + department
2. Static priority based on category defaults
3. `confidence` set to `0.0`; `detectedLanguage` set to `"und"` (undetermined)

The fallback result is flagged in the report so officers know manual review is needed.

### Token Budget

A per-day token counter is tracked in `Firestore config/budgets`. If the total token usage for the day exceeds `GEMINI_DAILY_TOKEN_LIMIT` (default: 1 000 000), triage falls back to rules and a warning is logged. Budget resets at UTC midnight via a Cloud Tasks cron-equivalent job.

---

## i18n Guide — Adding a New Language

CivicResolve supports dynamic translation via Gemini and static string bundles. To add language `xx` (e.g. Odia `or`):

1. **Add the language code** to `SUPPORTED_LANGUAGES` in `config/constants.js`:
   ```js
   export const SUPPORTED_LANGUAGES = [..., 'or'];
   ```

2. **Create a static strings file** at `public/locales/or.json` modelled on `public/locales/en.json`. Translate every key.

3. **Register the BCP-47 name** in the `LANGUAGE_NAMES` map in `config/constants.js`:
   ```js
   or: 'Odia',
   ```

4. **Add a UI option** in `public/index.html` inside the `<select id="language">` element:
   ```html
   <option value="or">ଓଡ଼ିଆ</option>
   ```

5. **Test**: submit a report in Odia text and verify that:
   - `detectedLanguage` equals `"or"` in the triage result
   - The status-update notification is returned in Odia
   - The UI renders the correct locale strings

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GEMINI_API_KEY` | ✅ | — | Gemini API key from Google AI Studio |
| `GEMINI_MODEL` | ❌ | `gemini-2.5-flash` | Gemini model ID |
| `FIREBASE_PROJECT_ID` | ✅ | — | Firebase / GCP project ID |
| `FIREBASE_CLIENT_EMAIL` | ✅ prod | — | Service account email (Admin SDK) |
| `FIREBASE_PRIVATE_KEY` | ✅ prod | — | Service account private key (newlines as `\n`) |
| `FIREBASE_STORAGE_BUCKET` | ✅ | — | GCS bucket name (e.g. `project.appspot.com`) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ | — | Client SDK API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ | — | Client SDK auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ | — | Client SDK project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ✅ | — | Client SDK storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | ✅ | — | Client SDK sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | ✅ | — | Client SDK app ID |
| `GOOGLE_MAPS_API_KEY` | ✅ | — | Maps JavaScript API key (location picker) |
| `CLOUD_TASKS_QUEUE` | ❌ | — | Cloud Tasks queue name (omit to use in-process jobs) |
| `CLOUD_TASKS_LOCATION` | ❌ | — | Cloud Tasks region (e.g. `asia-south1`) |
| `CLOUD_TASKS_SERVICE_URL` | ❌ | — | HTTPS URL Cloud Tasks calls for jobs |
| `SESSION_SECRET` | ✅ | — | 32+ byte random hex string for session signing |
| `ADMIN_EMAIL` | ❌ | — | Email for the seed admin account |
| `ADMIN_PASSWORD` | ❌ | — | Password for the seed admin account |
| `ADMIN_NAME` | ❌ | — | Display name for the seed admin account |
| `PORT` | ❌ | `8080` | HTTP port |
| `NODE_ENV` | ❌ | `development` | `development` / `production` / `test` |
| `FIREBASE_EMULATOR` | ❌ | `false` | Set `true` to point SDKs at local emulators |
| `DATA_FILE` | ❌ | `./data/issues.json` | Fallback JSON store path (dev only) |

---

## Local Development

### Prerequisites

- Node.js 22+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (see [Firebase Setup](#firebase-setup))

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-org/civicresolve.git
cd civicresolve

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — fill in GEMINI_API_KEY and Firebase client SDK vars.
# Leave FIREBASE_EMULATOR=true for local dev (no real Firebase needed).

# 4. Start Firebase emulators
firebase emulators:start
# Emulator UI: http://localhost:4000
# Firestore:   http://localhost:8085
# Auth:        http://localhost:9099
# Storage:     http://localhost:9199

# 5. Start the development server (in a second terminal)
npm run dev
# Server: http://localhost:8080
```

> [!TIP]
> Run `firebase emulators:export ./emulator-data` to persist emulator data across restarts, then `firebase emulators:start --import ./emulator-data` to restore it.

---

## Firebase Setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Enable **Authentication** → Sign-in methods → enable **Email/Password** and **Google**.
3. Enable **Firestore Database** → Start in **production mode** → choose region (e.g. `asia-south1`).
4. Enable **Storage** → Start in **production mode**.
5. Go to **Project Settings → Service accounts** → **Generate new private key** → save as `serviceAccountKey.json` (DO NOT commit this file).
6. Set the values from the downloaded key in your `.env` (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
7. Update `.firebaserc` → replace `YOUR_PROJECT_ID` with your actual project ID.
8. Deploy Firestore rules and indexes:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

---

## Google Cloud Setup

```bash
# 1. Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudtasks.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  logging.googleapis.com \
  --project YOUR_PROJECT_ID

# 2. Create a service account for Cloud Run
gcloud iam service-accounts create civicresolve-run \
  --display-name "CivicResolve Cloud Run"

# 3. Grant minimum roles
SA="civicresolve-run@YOUR_PROJECT_ID.iam.gserviceaccount.com"
PROJECT="YOUR_PROJECT_ID"

for ROLE in roles/datastore.user roles/storage.objectCreator \
            roles/storage.objectViewer roles/cloudtasks.enqueuer \
            roles/secretmanager.secretAccessor; do
  gcloud projects add-iam-policy-binding $PROJECT \
    --member="serviceAccount:$SA" --role="$ROLE"
done

# 4. Store secrets in Secret Manager
echo -n "your-gemini-key" | gcloud secrets create gemini-api-key --data-file=-
echo -n "your-session-secret" | gcloud secrets create session-secret --data-file=-
# Repeat for FIREBASE_PRIVATE_KEY, etc.

# 5. Create a Cloud Tasks queue
gcloud tasks queues create civicresolve-jobs \
  --location=asia-south1
```

---

## Deploy to Cloud Run

**One-command deploy** (from the project root):

```bash
gcloud run deploy civicresolve \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --service-account civicresolve-run@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars "GEMINI_API_KEY=$(gcloud secrets versions access latest --secret=gemini-api-key)" \
  --set-env-vars "SESSION_SECRET=$(gcloud secrets versions access latest --secret=session-secret)" \
  --set-env-vars "FIREBASE_PROJECT_ID=YOUR_PROJECT_ID" \
  --set-env-vars "NODE_ENV=production" \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10 \
  --port 8080
```

Cloud Build will build the multi-stage Docker image, push it to Artifact Registry, and deploy it. The first deploy takes ~3 minutes.

### Post-Deploy Checklist

- [ ] Visit `https://<service-url>/healthz` — should return `{"status":"ok"}`
- [ ] Open Firebase Console → Authentication → verify test sign-in works
- [ ] Open Firestore → verify `reports` collection is empty and rules are active
- [ ] Submit a test report and confirm it appears in the officer dashboard
- [ ] Check Cloud Tasks queue → verify a triage job was enqueued
- [ ] Check Cloud Logging → verify structured logs appear without PII
- [ ] Enable Cloud Run minimum instances = 1 if cold-start latency is unacceptable
- [ ] Set up a Cloud Monitoring uptime check on `/healthz`
- [ ] Configure a budget alert in GCP Billing for cost guardrails

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `PERMISSION_DENIED` from Firestore | Service account lacks `roles/datastore.user` | Re-run the IAM grant commands in [Google Cloud Setup](#google-cloud-setup) |
| `auth/id-token-expired` on every request | Server clock skew or session not refreshed | Ensure the Cloud Run instance has correct system time; client must refresh the ID token before it expires (1 h) |
| Gemini returns `400 INVALID_ARGUMENT` | Prompt too long or image too large | Compress images to < 1 MB before passing to triage; truncate description to 2000 chars |
| `ECONNREFUSED` on emulator startup | Ports 8085 / 9099 / 9199 already in use | Kill the conflicting process or change emulator ports in `firebase.json` |
| `npm ci` fails on `FIREBASE_PRIVATE_KEY` newlines | Windows line endings in `.env` | Wrap the value in double quotes: `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."` |
| Cloud Tasks job never fires | `CLOUD_TASKS_SERVICE_URL` is `localhost` in production | Set `CLOUD_TASKS_SERVICE_URL` to the Cloud Run public URL |
| `RateLimitError` on triage | Gemini free-tier RPM exceeded | Add a Gemini API key with a billing account, or reduce `GEMINI_DAILY_TOKEN_LIMIT` to spread requests |
| Storage upload fails with `403` | Firestore rules block the upload | Verify the user has `role == 'citizen'` custom claim set; check Storage rules deployment |

---

## Screenshots

> _Screenshots will be added after the first deployed demo._
>
> Planned captures:
> - Citizen report submission form (desktop + mobile)
> - Officer dashboard with real-time status board
> - Admin analytics view (SLA compliance chart)
> - AI triage result panel
> - Multi-language notification example (Hindi / Tamil)

---

## License

MIT © 2024 CivicResolve Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
