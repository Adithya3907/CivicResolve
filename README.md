# CivicResolve: AI-Powered Citizen Grievance Management and Resolution

> **Report. Track. Resolve.**
> Citizens describe a civic problem in any language, by text, voice or photo. **Google Gemini** understands it, classifies it, judges its urgency, routes it to the right department and starts a public SLA clock. Administrators work from an AI-prioritised queue, and everyone can watch progress on a transparent dashboard.

Built for the **PromptWars × GDGoC PSG iTech** hackathon (CivicResolve challenge).

---

## Table of contents
1. [The problem](#1-the-problem)
2. [Our solution](#2-our-solution)
3. [Feature walkthrough](#3-feature-walkthrough)
4. [How we use Google Gemini](#4-how-we-use-google-gemini)
5. [Architecture](#5-architecture)
6. [Project structure](#6-project-structure)
7. [Data model](#7-data-model)
8. [API reference](#8-api-reference)
9. [Usage guide](#9-usage-guide)
10. [Run locally](#10-run-locally)
11. [Configuration](#11-configuration)
12. [Deployment](#12-deployment)
13. [Security](#13-security)
14. [Accessibility](#14-accessibility)
15. [Testing](#15-testing)
16. [Requirement-to-feature map](#16-requirement-to-feature-map)
17. [Limitations and roadmap](#17-limitations-and-roadmap)
18. [Screenshots](#18-screenshots)

---

## 1. The problem
Potholes, overflowing bins, dead streetlights and leaking pipes hurt communities every day, yet reporting them is disconnected:
- Citizens do not know **which department** owns the problem, and may not be comfortable writing in English.
- Authorities receive unstructured complaints that must be **read, categorised and prioritised by hand**.
- Nobody sees **whether or when** an issue will be fixed, so trust erodes.

## 2. Our solution
CivicResolve turns a messy complaint into a structured, routed, time-boxed ticket in seconds:

1. The citizen reports with free text (any language), optional voice, GPS and a photo.
2. **Gemini** reads the text *and* image and returns category, priority, public-impact score, confidence, an English summary and a suggested action.
3. The app routes the ticket to a department and starts an **SLA timer** based on priority.
4. Nearby reports of the same problem are **merged**, so crews are not flooded and the issue gains weight.
5. Admins see the most urgent work first, update statuses, and ask Gemini for a **dispatch briefing**.
6. Citizens track progress and ask Gemini to **explain the status in their own language**.

## 3. Feature walkthrough
| Area | What it does |
|---|---|
| Report form | Title, description, location, category (or "Let AI decide"), optional photo, optional name. GPS button, voice dictation (Web Speech API), photos compressed client-side. |
| AI triage preview | "Preview AI triage" shows the result before submitting. |
| Ticket confirmation | Unique ID such as `CR-4D5E6F`, AI result, SLA clock, link to tracking. |
| Duplicate guard | Same category within 150 m of an open issue is merged and its "me too" count rises. |
| Tracking | Search by ID or keyword, filter by status and category, three-step status tracker, timeline, Google Maps embed, "Me too" button. |
| Explain status | Gemini writes a short plain-language update in English, Tamil or Hindi. |
| Impact dashboard | Resolution rate, average time to resolve, SLA breaches, breakdown by category, priority and status. |
| Admin dashboard | Password sign-in, issues sorted by priority, SLA state, status update with note, Gemini dispatch briefing. |
| Offline-safe | If Gemini is unavailable, a keyword-based triage keeps the app working. |

## 4. How we use Google Gemini
Gemini is the core of the product, used in four distinct places through the Gemini API (`generativelanguage.googleapis.com`, default model `gemini-2.5-flash`, configurable with `GEMINI_MODEL`).

| # | Touchpoint | Gemini capability | Where |
|---|---|---|---|
| 1 | **Complaint triage** | Multimodal input (text plus photo) with **structured JSON output** enforced by a `responseSchema` with enums for category and priority | `lib/ai.js` → `analyze` |
| 2 | **Multilingual understanding** | Complaints in Tamil, Hindi, English or mixed are understood; summary and action are always produced in English for staff | same call, system instruction |
| 3 | **Citizen status explainer** | Generates a warm, jargon-free update in the citizen's chosen language from the ticket timeline | `explain` → `GET /api/issues/:id/explain` |
| 4 | **Admin dispatch briefing** | Reads all open tickets and produces today's top actions, hotspots and SLA risks | `briefing` → `GET /api/admin/briefing` |

Design decisions that make the usage robust:
- **Schema-constrained output:** the response is validated again in `normalize()` (enum checks, clamped scores) so a bad model reply can never corrupt data.
- **Photo evidence:** the compressed image is sent as `inline_data`, so Gemini can judge severity from what it sees, not only what was typed.
- **Explainable AI:** every triage includes `reasoning`, `confidence` and a `source` tag (`gemini` or `rules`) shown in the UI.
- **Prompt-injection resistance:** system instructions tell Gemini to treat the complaint and ticket JSON strictly as data. Output is length-limited, validated and HTML-escaped.
- **Graceful degradation:** 20-second timeout, and on any error the app falls back to deterministic rules (`fallbackAnalyze`), so citizens are never blocked.
- **Low temperature (0.2)** for classification, higher (0.4) for natural-language text.

## 5. Architecture
```
 Browser (vanilla JS SPA, no build step)
   │  fetch /api/*                     ┌───────────────────────────┐
   ▼                                   │  Google Gemini API        │
 Express server (server.js)  ────────▶ │  triage · explain · brief │
   │  helmet CSP · rate limits         └───────────────────────────┘
   │  validation · HMAC admin auth
   ├── lib/core.js   categories, departments, SLA, validation, rule-based fallback, geo distance
   ├── lib/ai.js     Gemini client: analyze / explain / briefing
   └── lib/store.js  in-memory map persisted to data/issues.json (seeded demo data)
 Google Maps embed ← issue location in the tracking view
 Google Cloud Run  ← container hosting (Dockerfile)
```
Request flow for a new report: `POST /api/issues` → validate → Gemini triage (or fallback) → duplicate check → create ticket with SLA and timeline → return ticket → UI shows AI card.

## 6. Project structure
```
civicresolve/
├── server.js            Express app, routes, security middleware
├── lib/
│   ├── ai.js            Gemini integration (triage, explain, briefing)
│   ├── core.js          domain rules, validation, fallback triage
│   └── store.js         persistence and demo seed data
├── public/
│   ├── index.html       app shell (landmarks, skip link)
│   ├── style.css        responsive, dark-mode, reduced-motion styles
│   └── app.js           SPA views: home, report, track, impact, admin
├── test/api.test.js     automated tests (node:test)
├── Dockerfile           Cloud Run–ready, non-root
├── .env.example         configuration template
└── package.json
```

## 7. Data model
Each issue is a JSON object:
`id`, `title`, `description`, `location`, `lat`, `lng`, `name` (private), `image` (private data URL), `category`, `priority`, `department`, `publicImpact` (1-10), `confidence` (0-1), `summary`, `suggestedAction`, `reasoning`, `language`, `source`, `supporters`, `status` (`Reported` | `In Progress` | `Resolved`), `createdAt`, `dueAt`, `timeline[]` (`status`, `at`, `note`).

SLA by priority: Critical 24 h, High 72 h, Medium 7 days, Low 14 days.

Category → department: Roads & Potholes → Public Works · Garbage & Sanitation → Solid Waste Management · Streetlights & Electrical → Electricity Board · Water & Drainage → Water Supply & Drainage Board · Parks & Trees → Parks & Horticulture · Traffic & Signals → Traffic Police · Other → Municipal Helpline.

## 8. API reference
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/healthz` | none | Health check |
| GET | `/api/config` | none | AI availability, categories |
| POST | `/api/analyze` | none | Preview Gemini triage without saving |
| POST | `/api/issues` | none | Submit a report (triage, dedupe, SLA). Returns `{duplicate, issue}` |
| GET | `/api/issues` | none | List issues, urgent first (private fields removed) |
| GET | `/api/issues/:id` | none | One issue |
| POST | `/api/issues/:id/support` | none | "Me too" |
| GET | `/api/issues/:id/explain?lang=English\|Tamil\|Hindi` | none | Gemini status explainer |
| GET | `/api/stats` | none | Dashboard numbers |
| POST | `/api/admin/login` | none | `{password}` → signed token (8 h) |
| PATCH | `/api/admin/issues/:id` | Bearer | `{status, note}` |
| GET | `/api/admin/briefing` | Bearer | Gemini dispatch briefing |
| GET | `/api/admin/issues/:id/image` | Bearer | Private photo of an issue |

## 9. Usage guide
**As a citizen**
1. Open **Report**. Enter a title and description in any language, tap 🎤 to dictate, and use 📍 to capture your location.
2. Optionally attach a photo and tap **Preview AI triage** to see category, priority and department.
3. Tap **Submit report** and save the ticket ID. If someone already reported the same problem nearby, your report is merged.
4. Open **Track**, search your ID, expand the card for timeline and map, and tap **✨ Explain status** for a plain-language update in English, Tamil or Hindi.

**As an administrator**
1. Open **Admin** and sign in with `ADMIN_PASSWORD`.
2. Tap **Generate with Gemini** for today's priorities, hotspots and SLA risks.
3. Change a ticket's status, add a note and **Save**. The change appears in the citizen's timeline instantly.

**Try the demo:** four seeded issues around Coimbatore are loaded on first start.

## 10. Run locally
Requires Node.js 20+.
```bash
npm install
cp .env.example .env            # add GEMINI_API_KEY from https://aistudio.google.com/apikey
set -a; . ./.env; set +a
npm start                       # http://localhost:8080
npm test
```
Without `GEMINI_API_KEY` the app runs in rules mode, so you can develop offline.

## 11. Configuration
| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | none | Enables all Gemini features |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Any Gemini model that supports JSON schema output |
| `ADMIN_PASSWORD` | `admin123` | **Change in production** |
| `SESSION_SECRET` | random per start | Signs admin tokens; set a fixed value so sessions survive restarts |
| `PORT` | `8080` | Server port |
| `DATA_FILE` | `data/issues.json` | Persistence file |

## 12. Deployment
### Option A: Google Cloud Run (recommended)
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
gcloud run deploy civicresolve --source . --region asia-south1 --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=YOUR_KEY,ADMIN_PASSWORD=YOUR_PASSWORD,SESSION_SECRET=$(openssl rand -hex 16)
```
Cloud Run prints the public URL (`https://civicresolve-xxxx.a.run.app`). Verify `/healthz`, then submit a test report.
Tip: use `--min-instances 1` during evaluation so the saved reports are not reset by cold starts. For stored secrets, use Secret Manager with `--set-secrets`.

### Option B: Docker anywhere
```bash
docker build -t civicresolve .
docker run -p 8080:8080 -e GEMINI_API_KEY=YOUR_KEY -e ADMIN_PASSWORD=YOUR_PASSWORD civicresolve
```
### Option C: Render / Railway
Create a Web Service from the GitHub repo. Build `npm install`, start `npm start`, and add the environment variables above.

## 13. Security
- Helmet with a strict Content-Security-Policy (only Google Maps may be framed); `x-powered-by` disabled.
- Rate limits: 120 requests/min on the API, 15/min on AI, submit and login routes.
- Server-side validation of every field; images limited to JPEG/PNG/WebP data URLs under about 1 MB; JSON body limit 2 MB.
- Admin tokens are HMAC-SHA256 signed with expiry; password and signature comparisons use `timingSafeEqual`.
- Reporter names and photos are never returned by public endpoints.
- All UI rendering escapes user content; no `innerHTML` with raw input.
- Prompt-injection hardening for every Gemini call, plus output validation.
- Container runs as a non-root user.

## 14. Accessibility
Semantic landmarks and headings, skip link, every control labelled, `aria-live` regions for AI results and toasts, `role="alert"` errors, visible focus rings, keyboard-operable everywhere, colour never the only signal (text labels on priority and status), responsive layout, automatic dark mode, and `prefers-reduced-motion` support.

## 15. Testing
`npm test` runs the Node built-in test runner against a real in-process server:
validation and image rejection, rule-based triage, geo-distance, submit → track → duplicate merge → admin auth → resolve, wrong password and unknown ticket handling, Gemini-free explain and admin-only briefing.

## 16. Requirement-to-feature map
| Challenge requirement | Where |
|---|---|
| Citizen issue reporting with title, description, location, category, image | Report view |
| AI classification with Gemini | `analyze` (#1) |
| Priority detection | `priority`, `publicImpact`, SLA |
| Department recommendation | `department` routing |
| Issue tracking dashboard with statuses | Track view |
| Admin dashboard | Admin view plus Gemini briefing |
| Submission → tracking → resolution | Full flow covered by tests |

## 17. Limitations and roadmap
- Storage is a JSON file; production should use **Firestore** or Cloud SQL.
- Admin auth is a single shared password; production should use Google Identity or Firebase Auth.
- Roadmap: map of all issues, push or WhatsApp notifications, Gemini-based photo verification of resolutions, department-level roles, analytics export.

## 18. Screenshots
Add images to `docs/` and reference them here (keep the repository under 10 MB):
`docs/report.png` · `docs/triage.png` · `docs/track.png` · `docs/admin.png` · `docs/impact.png`

## License
MIT
