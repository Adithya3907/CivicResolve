# CivicResolve

> **AI-powered civic grievance management platform for local governments.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Deployment](https://img.shields.io/badge/Deployment-Render-46E3B7)](https://civicresolve-tm96.onrender.com)

**Live Demo:** https://civicresolve-tm96.onrender.com  
**GitHub Repository:** https://github.com/Adithya3907/CivicResolve

---

## Overview

CivicResolve is an AI-powered civic grievance management platform that enables citizens to report local infrastructure and public service issues, including potholes, broken streetlights, water leaks, encroachments, and other civic problems.

Citizens can submit reports through a simple web interface with optional photo uploads. Google Gemini assists with report classification, priority assessment, language detection, translation, and department recommendations.

Municipal officers can access a staff dashboard to review incoming reports, monitor their status, and update resolution progress. Administrators can manage staff accounts and monitor platform activity.

The platform is designed for Indian municipalities, with support for 12 Indian languages and an architecture built around Firebase, Google Gemini, Node.js, and Express.

CivicResolve is currently deployed as a Node.js web service on **Render**, with Firebase providing authentication, database, and file storage services.

When Gemini is unavailable or an AI response cannot be processed, deterministic rule-based fallbacks allow supported workflows to continue with a result that requires manual review.

---

## Live Deployment

| Item | Details |
|---|---|
| Application | CivicResolve |
| Hosting platform | Render |
| Service type | Node.js Web Service |
| Deployment branch | `main` |
| Build command | `npm install` |
| Start command | `npm start` |
| Instance plan | Render Free |
| Live URL | https://civicresolve-tm96.onrender.com |
| Database | Firebase Firestore |
| Authentication | Firebase Authentication |
| AI engine | Google Gemini |

**Important:** The current deployment uses Render's Free instance. Free services spin down after 15 minutes without incoming traffic and typically take about a minute to start again when visited. The local filesystem is ephemeral, so persistent application data must be stored in Firebase or another external storage service.

The free hosting plan is subject to Render's usage limits and terms. It is not a guarantee of permanently free hosting.

---

## Problem Context, Chosen Vertical & Solution Approach

### 1. Chosen Vertical

**Civic Technology (GovTech) – Municipal Grievance Management**

CivicResolve focuses on improving how citizens report civic infrastructure and public service issues and how local government authorities manage, prioritise, and resolve those complaints.

The chosen problem area includes potholes, damaged roads, broken streetlights, water leakage, sanitation issues, encroachments, and other local civic grievances.

### 2. Approach and Logic

CivicResolve follows an AI-assisted, human-supervised grievance management approach.

Instead of treating every complaint as an isolated entry, the platform uses a structured workflow:

1. **Citizen Reporting:** Citizens submit a description of the issue, optionally attaching photographs and location information.
2. **Input Processing:** The application validates the submitted information and processes the report.
3. **AI-Assisted Triage:** Google Gemini analyses the description and available images to identify the issue category, subcategory, priority, impact, language, and recommended department.
4. **Fallback Handling:** If AI processing fails or returns an invalid result, deterministic rule-based logic provides a fallback classification. Such results are flagged for manual review.
5. **Centralised Storage:** Reports and their associated information are stored using Firebase services.
6. **Officer Review:** Municipal officers access the staff dashboard to review reports and take appropriate action.
7. **Status Tracking:** Officers update the report status, allowing citizens to follow the progress of their grievances.
8. **Resolution Assistance:** AI-assisted resolution verification can compare before-and-after images to help officers assess reported improvements.

AI recommendations support decision-making; municipal officers remain responsible for reviewing reports and updating their status.

### 3. How the Solution Works

The end-to-end workflow is:

**Citizen → Report Submission → AI Triage → Firebase Storage → Officer Dashboard → Action and Status Update → Citizen Tracking**

The system has three primary user roles:

- **Citizen:** Submits civic complaints and tracks personal reports.
- **Officer:** Reviews assigned or accessible reports and updates their progress.
- **Administrator:** Manages staff accounts, roles, and platform-level information.

The frontend communicates with a Node.js and Express backend. Firebase Authentication handles identity, Firestore stores application records, Firebase Storage handles uploaded images, and Google Gemini provides AI-assisted processing.

### 4. Assumptions Made

The solution is designed around the following assumptions:

1. Citizens can access the application through a web browser on a mobile device or computer.
2. Citizens provide reasonably accurate descriptions and, where possible, photographs and location information.
3. Municipal departments, issue categories, and priority rules are configured to reflect the requirements of the implementing authority.
4. Municipal officers and administrators have valid accounts with appropriate permissions.
5. AI-generated classifications and recommendations are advisory and may require human verification.
6. Firebase, Gemini, and other required external services are available within their respective usage quotas.
7. An internet connection is normally available for report submission, authentication, and synchronisation.
8. Actual grievance resolution depends on the relevant municipal authority and its available resources. CivicResolve facilitates reporting and tracking; it does not independently carry out physical repairs or guarantee resolution.

## Architecture

```text
                   CITIZENS / MUNICIPAL OFFICERS
                               |
                               | HTTPS
                               |
                               v
                 +---------------------------+
                 |       Browser / PWA       |
                 |    HTML / CSS / JavaScript|
                 +-------------+-------------+
                               |
                               v
                 +---------------------------+
                 |      RENDER WEB SERVICE   |
                 |                           |
                 |       Node.js 22          |
                 |       Express Server      |
                 |                           |
                 |  middleware/              |
                 |   - auth.js               |
                 |   - security.js           |
                 |   - validation.js         |
                 |   - errorHandler.js       |
                 |                           |
                 |  services/                |
                 |   - ai.js                 |
                 |   - store.js              |
                 |   - queue.js              |
                 |   - notifications.js      |
                 |   - analytics.js          |
                 |                           |
                 |  config/                  |
                 |   - constants.js          |
                 |   - firebase-admin.js     |
                 +------+---------+----------+
                        |         |
              +---------+         +----------------+
              |                                    |
              v                                    v
    +----------------------+            +----------------------+
    |  FIREBASE SERVICES   |            |     GEMINI API       |
    |                      |            |                      |
    | Firebase Auth        |            | Report triage         |
    | Cloud Firestore      |            | Translation           |
    | Firebase Storage     |            | Embeddings            |
    |                      |            | Resolution checking   |
    +----------------------+            | Staff briefings        |
                                        | Semantic search        |
                                        +----------------------+

              Optional integration:
              Google Cloud Tasks for durable
              background job processing
```

### Architecture Components

| Component | Responsibility |
|---|---|
| Browser / PWA | Citizen and staff interfaces |
| Render Web Service | Hosts the Express application and API |
| Firebase Authentication | User identity and authentication |
| Cloud Firestore | Reports, user records, audit logs, and notifications |
| Firebase Storage | Report images and uploaded files |
| Google Gemini | AI-powered processing and analysis |
| Google Cloud Tasks | Optional background job integration |

Cloud Tasks is an optional integration. The current Render deployment does not have a Cloud Tasks queue configured.

---

## Features

### 1. Citizen Grievance Reporting

- Submit civic issues through a web form.
- Upload supporting photographs.
- Provide issue descriptions and location information.
- View personal report history.
- Track report status and resolution progress.
- Access the application through a browser on desktop or mobile.

### 2. AI-Powered Report Triage

Google Gemini assists in processing submitted reports.

Capabilities include:

- Automatic issue categorisation.
- Subcategory identification.
- Priority assessment.
- Public impact scoring.
- Language detection.
- Translation into English for processing.
- Recommended municipal department assignment.
- Suggested corrective action.
- Image-based issue analysis.
- Text and image consistency checks.
- Spam detection assistance.

### 3. Multilingual Support

CivicResolve supports 12 Indian languages through its language interface and translation functionality.

Gemini assists with dynamic translation, while static locale files provide interface translations.

### 4. Officer Dashboard

Municipal officers can:

- View submitted reports.
- Filter reports by status, department, and priority.
- Review individual report details.
- Update grievance status.
- Add officer notes.
- Monitor department-level activity.
- Access AI-generated briefings and search functionality.

### 5. Administrator Management

Administrators can:

- View officer and administrator accounts.
- Create staff accounts.
- Change user roles.
- Assign or modify department responsibilities.
- Deactivate staff accounts.
- Access platform analytics.

### 6. Resolution Verification

The AI resolution verification workflow can compare before-and-after images and return an assessment of whether the reported issue appears to have been resolved.

The assessment is intended to assist human review, not replace official verification.

### 7. Analytics and Reporting

The platform provides:

- Report counts by status.
- Department-level statistics.
- Priority distribution.
- SLA compliance summaries.
- AI-generated staff briefings.
- Natural-language search over open tickets.

### 8. Fallback Processing

When Gemini is unavailable or produces an invalid response, CivicResolve uses deterministic rule-based processing for supported triage operations.

Fallback results are marked with low confidence so officers can identify reports that require manual assessment.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Node.js 22+, Express.js |
| AI | Google Gemini API |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore |
| File Storage | Firebase Storage / Google Cloud Storage |
| Hosting | Render Web Service |
| Background Jobs | In-process queue fallback; optional Google Cloud Tasks |
| Security | Helmet, Express sessions, Firebase authentication, validation middleware |
| Testing | Node.js Test Runner |
| Code Quality | ESLint |
| Version Control | Git and GitHub |

---

## External Services and Integrations

| Service | Purpose |
|---|---|
| Google Gemini 2.5 Flash | Multimodal triage, translation, semantic search, resolution verification |
| Firebase Authentication | Citizen, officer, and administrator authentication |
| Cloud Firestore | Primary application database |
| Firebase Storage | Report image storage |
| Render | Application hosting and deployment |
| Google Maps API | Location picker and map-related functionality |
| Google Cloud Tasks | Optional durable background job processing |

---

## Role & Permission Matrix

| Role | Submit Report | View Own Reports | View All Reports | Update Status | Manage Staff |
|---|:---:|:---:|:---:|:---:|:---:|
| **Citizen** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Officer** | ❌ | ✅ | ✅ | ✅ | ❌ |
| **Admin** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Unauthenticated** | ❌ | ❌ | 🔸 Public fields only | ❌ | ❌ |

Roles are stored as Firebase custom claims and are assigned server-side through the Firebase Admin SDK.

The application verifies user permissions through its authentication middleware before allowing protected operations.

---

## API Reference

### Authentication

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `POST` | `/api/auth/session` | Firebase ID token (Bearer) | Exchange Firebase ID token for a session cookie |
| `DELETE` | `/api/auth/session` | Session cookie | Sign out and clear server session |
| `GET` | `/api/auth/me` | Session cookie | Get current user details |

### Reports

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `POST` | `/api/reports` | Citizen | Submit a new civic report |
| `GET` | `/api/reports` | Officer / Admin | List reports with filtering and pagination |
| `GET` | `/api/reports/mine` | Citizen | List the authenticated citizen's reports |
| `GET` | `/api/reports/public` | Public | View limited public report information |
| `GET` | `/api/reports/:id` | Citizen (own) / Officer / Admin | Get report details |
| `PATCH` | `/api/reports/:id/status` | Officer / Admin | Update report status and add an officer note |
| `GET` | `/api/reports/:id/images/upload-url` | Citizen (own report) | Obtain a signed image upload URL |
| `POST` | `/api/reports/:id/verify` | Officer / Admin | Trigger AI resolution verification |

Report listing supports filters such as:

```text
?status=
&department=
&priority=
&page=
&limit=
```

### Staff and Administration

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `GET` | `/api/staff` | Admin | List officer and administrator accounts |
| `POST` | `/api/staff` | Admin | Create a staff account |
| `PATCH` | `/api/staff/:uid/role` | Admin | Change a user's role or department |
| `DELETE` | `/api/staff/:uid` | Admin | Deactivate a staff account |

### Analytics and AI

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `GET` | `/api/analytics/summary` | Officer / Admin | Aggregate statistics |
| `GET` | `/api/analytics/sla` | Officer / Admin | SLA compliance report |
| `POST` | `/api/ai/search` | Officer / Admin | Natural-language semantic search |
| `GET` | `/api/ai/briefing` | Officer / Admin | AI-generated daily briefing |

### Infrastructure

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `GET` | `/healthz` | Public | Application health check |
| `GET` | `/api/csrf-token` | Session | Get a fresh CSRF token |
| `POST` | `/api/tasks/worker` | Cloud Tasks OIDC | Internal task handler; optional integration |

---

## Gemini Usage Deep-Dive

### AI Functions

| Function | Model Operation | Input | Expected Output |
|---|---|---|---|
| `triage(report)` | `generateContent` | Description and image parts | Structured report triage JSON |
| `generateEmbedding(text)` | `embedContent` | Report description | 768-dimensional embedding |
| `translateNotification(text, lang, ...)` | `generateContent` | Status message and target language | Translated text |
| `verifyResolution(before[], after[])` | `generateContent` | Before-and-after images | Verification result |
| `generateDailyBriefing(tickets[])` | `generateContent` | Open ticket summaries | Markdown briefing |
| `naturalLanguageSearch(query, tickets[])` | `generateContent` | Search query and ticket data | Ranked report identifiers |

### Triage Response Schema

A representative triage response:

```json
{
  "detectedLanguage": "hi",
  "englishTranslation": "...",
  "category": "Road & Infrastructure",
  "subCategory": "Pothole",
  "priority": "High",
  "publicImpactScore": 7,
  "confidence": 0.91,
  "recommendedDepartment": "PWD",
  "suggestedAction": "...",
  "perImageFindings": [
    {
      "index": 0,
      "description": "...",
      "severity": "High"
    }
  ],
  "textImageConsistency": true,
  "spamFlag": false,
  "reasoning": "..."
}
```

Priority levels:

- Critical
- High
- Medium
- Low

The response is validated before being used by the application.

### Fallback Strategy

If Gemini is unavailable or its response fails validation, `services/ai.js` uses deterministic rules imported from `config/constants.js`.

The documented fallback process includes:

1. Keyword matching against configured category definitions.
2. Category and department selection.
3. Static priority assignment using category defaults.
4. Confidence set to `0.0`.
5. Detected language set to `"und"` when it cannot be determined.

Fallback results are flagged so that municipal officers can review them manually.

### Token Budget

A daily token counter is maintained in Firestore under `config/budgets`.

When the configured daily token limit is reached, supported AI triage operations fall back to deterministic rules.

The documented default budget is:

```text
GEMINI_DAILY_TOKEN_LIMIT = 1000000
```

Any scheduled reset or background processing that depends on Cloud Tasks requires that optional integration to be configured.

---

## Internationalisation Guide

CivicResolve supports multilingual citizen interaction through static locale files and AI-assisted translation.

To add a language:

1. Add its language code to the supported language configuration in `config/constants.js`.
2. Create a locale file under `public/locales/`, using `public/locales/en.json` as the reference.
3. Register the language name in the language-name configuration.
4. Add the corresponding option to the language selector in `public/index.html`.

For example:

```html
<option value="or">ଓଡ଼ିଆ</option>
```

Test the new language by verifying that:

- The language selector displays the new option.
- The interface loads the correct locale strings.
- The AI detects the correct language code.
- Status-update notifications are translated correctly.

---

## Environment Variables

Configure environment variables through the Render dashboard for the deployed service.

For local development, use a `.env` file based on `.env.example`.

**Never commit `.env`, a Firebase service-account JSON file, or private credentials to GitHub.**

### Gemini

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google AI Studio API key |
| `GEMINI_MODEL` | No | Gemini model ID; defaults to `gemini-2.5-flash` |

### Firebase Admin SDK

| Variable | Required | Description |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Yes for current credential-based deployment | Firebase service-account email |
| `FIREBASE_PRIVATE_KEY` | Yes for current credential-based deployment | Firebase service-account private key |
| `FIREBASE_STORAGE_BUCKET` | Yes | Firebase Storage bucket name |

The private key must be supplied with newline characters correctly represented as `\n` when entered as a single environment-variable value.

### Firebase Client SDK

These values are used by the browser-facing Firebase configuration.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase authentication domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase web application ID |

These client configuration values are exposed to the browser by design. They must not be treated as a substitute for proper Firebase Authentication, Firestore rules, and Storage rules.

### Google Maps

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | For map/location picker | Google Maps JavaScript API key |

### Optional Cloud Tasks Integration

| Variable | Required | Description |
|---|---|---|
| `CLOUD_TASKS_QUEUE` | No | Cloud Tasks queue name |
| `CLOUD_TASKS_LOCATION` | No | Cloud Tasks region |
| `CLOUD_TASKS_SERVICE_URL` | No | HTTPS URL used for task callbacks |

When Cloud Tasks is not configured, the application uses its available in-process job handling.

In-process background processing is not durable across service restarts or spin-downs. It should not be treated as a guaranteed job-delivery mechanism.

### Session

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes | At least 32 bytes of random secret material used for session signing |

Generate a secure secret using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Optional Admin Bootstrap Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_EMAIL` | No | Email for the admin seed script |
| `ADMIN_PASSWORD` | No | Password for the admin seed script |
| `ADMIN_NAME` | No | Display name for the admin seed script |

These are only for the administrator bootstrap script. They are not needed for normal application startup.

### Application

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP server port; Render supplies its own port |
| `NODE_ENV` | `development` | Application environment |
| `FIREBASE_EMULATOR` | `false` | Enable Firebase emulator mode |
| `DATA_FILE` | `./data/issues.json` | Development fallback JSON file path |

For the current Render deployment:

```text
NODE_ENV=production
FIREBASE_EMULATOR=false
```

---

## Local Development

### Prerequisites

- Node.js 22 or newer.
- npm.
- Git.
- A Firebase project.
- Firebase CLI for emulator and Firebase configuration tasks.

### 1. Clone the Repository

```bash
git clone https://github.com/Adithya3907/CivicResolve.git
cd CivicResolve
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and supply the required credentials for the mode you intend to run.

Do not commit this file.

### 4. Start Firebase Emulators

Install Firebase CLI if it is not already available:

```bash
npm install -g firebase-tools
```

Start the configured emulators:

```bash
firebase emulators:start
```

The default development emulator services are:

| Service | Local Port |
|---|---:|
| Emulator UI | 4000 |
| Firestore | 8085 |
| Authentication | 9099 |
| Storage | 9199 |

### 5. Start the Application

In another terminal:

```bash
npm run dev
```

The default local application URL is:

```text
http://localhost:8080
```

### 6. Run Tests

Run the complete test suite:

```bash
npm test
```

Run unit tests:

```bash
npm run test:unit
```

Run integration tests:

```bash
npm run test:integration
```

### 7. Run ESLint

```bash
npm run lint
```

---

## Firebase Setup

CivicResolve uses Firebase Authentication, Cloud Firestore, and Firebase Storage.

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Create or select the Firebase project.
3. Enable the required Authentication sign-in providers, including Email/Password and Google if used by the configured interface.
4. Create a Firestore database.
5. Enable Firebase Storage and configure its security rules.
6. Open **Project Settings → Service Accounts**.
7. Generate a service-account private key for the server-side Firebase Admin SDK.
8. Store the service-account credentials securely in your environment variables.
9. Configure the Firebase client SDK values from **Project Settings → General → Your apps**.
10. Confirm that the project ID matches the application environment configuration.

Deploy the configured Firestore and Storage rules from the repository:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Do not commit the downloaded service-account JSON file.

---

## Deployment on Render

CivicResolve is currently deployed on Render using its GitHub integration.

### Deployment Configuration

| Setting | Value |
|---|---|
| Platform | Render |
| Service type | Web Service |
| Repository | `Adithya3907/CivicResolve` |
| Branch | `main` |
| Runtime | Node |
| Build command | `npm install` |
| Start command | `npm start` |
| Instance type | Free |

### Deployment Steps

1. Push the application code to the GitHub repository.
2. Sign in to the [Render Dashboard](https://dashboard.render.com/).
3. Select **New → Web Service**.
4. Connect the CivicResolve GitHub repository.
5. Select the `main` branch.
6. Configure the build and start commands shown above.
7. Select the Free instance type.
8. Add the required environment variables in the Render dashboard.
9. Deploy the service.
10. Check the deployment logs and confirm that the service starts successfully.

### Live Application

**CivicResolve:**

https://civicresolve-tm96.onrender.com

### Post-Deployment Verification

- [ ] Open the live application.
- [ ] Confirm the homepage loads.
- [ ] Verify citizen authentication.
- [ ] Verify officer authentication.
- [ ] Submit a sample civic grievance.
- [ ] Confirm that the report is stored in Firestore.
- [ ] Check that Gemini-assisted triage works.
- [ ] Verify that an officer can view the report.
- [ ] Update the report status.
- [ ] Verify that the updated status is reflected in the application.
- [ ] Check `/healthz` for the application health response.

### Important Render Free-Plan Limitations

The current deployment uses Render's Free web service.

- The service spins down after 15 minutes without incoming traffic.
- The first request after spin-down can take approximately one minute to complete startup.
- The local filesystem is ephemeral. Data written only to local files can be lost after restart, redeployment, or spin-down.
- Free services can restart automatically.
- Free instance hours and other usage allowances apply.
- Background work running only in process may be interrupted by restarts.

CivicResolve therefore uses Firebase services for persistent application data rather than relying on the Render filesystem.

For the latest information, see [Render Free Instance Documentation](https://render.com/docs/free).

---

## Testing and Quality Checks

The project includes unit and integration tests.

Run the complete test suite:

```bash
npm test
```

Run only unit tests:

```bash
npm run test:unit
```

Run only integration tests:

```bash
npm run test:integration
```

Run linting:

```bash
npm run lint
```

The test suite covers application APIs, authentication, report operations, public and staff functionality, and AI-related processing.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
