# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| Latest  | ✅ Yes             |
| Older   | ❌ No – update to latest |

CivicResolve is a continuously-deployed application. Only the latest commit on `main` receives security patches. If you are running a pinned deployment, update to the latest release before filing a report.

---

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

We follow a coordinated disclosure model:

1. **Email** `security@civicresolve.example` with subject `[SECURITY] <brief title>`.
2. Include: affected component, reproduction steps, potential impact, and any suggested fix.
3. You will receive an acknowledgement within **48 hours** and a status update within **7 days**.
4. We aim to release a patch within **30 days** of a confirmed critical vulnerability.
5. We will credit reporters in the release notes unless you request anonymity.

If you have not heard back within 48 hours, follow up by opening a **blank** GitHub issue titled "Security contact" — we will reach out privately.

---

## Security Architecture

### Authentication & Authorisation

| Layer | Technology | Detail |
|-------|-----------|--------|
| Identity | Firebase Authentication | Email/password + Google OAuth. Tokens are short-lived JWTs (1 h). |
| Custom claims | Firebase Admin SDK | `role` (`citizen`, `officer`, `admin`) and `department` are set server-side only; never accepted from client input. |
| Session | `express-session` with `httpOnly`, `secure`, `sameSite=lax` cookies | Server verifies the Firebase ID token on every request; sessions expire after 24 h of inactivity. |
| Authorisation | `middleware/auth.js` | Role checked after token verification; `requireRole()` middleware applied per-route. |

### Transport Security

- All production traffic must be served over **TLS 1.2+** (enforced by Cloud Run / load balancer).
- `Strict-Transport-Security` (HSTS) header with `max-age=63072000; includeSubDomains` is set by Helmet.

### HTTP Security Headers (Helmet)

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: storage.googleapis.com; connect-src 'self' https://*.googleapis.com; frame-ancestors 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=(), microphone=()
```

### CSRF Protection

A cryptographically random CSRF token is generated per session (`crypto.randomBytes(32)`), stored in the session, and validated on every mutating request (`POST`, `PUT`, `PATCH`, `DELETE`) via the `X-CSRF-Token` header. Requests without a valid token receive `403 Forbidden`.

### Rate Limiting

| Endpoint group | Limit |
|----------------|-------|
| All routes | 200 req / 15 min per IP |
| `POST /api/reports` | 10 req / hour per authenticated UID |
| `POST /api/auth/*` | 5 req / 15 min per IP |
| Gemini-backed endpoints | 20 req / hour per UID |

Limits enforced by `express-rate-limit` with in-memory store (or Redis in a clustered deployment).

### Input Validation

All request bodies are validated with **Zod** schemas before reaching business logic. Unrecognised keys are stripped (`strict()` mode). File uploads are validated for MIME type and size server-side; Firebase Storage rules enforce the same constraints client-side.

### Secrets Management

- Secrets are **never committed** to source control (`.env` is in `.gitignore`).
- In production, secrets are stored in **Google Cloud Secret Manager** and injected as environment variables at deploy time.
- The service account used by Cloud Run is granted only the minimum IAM roles required (see [IAM Least Privilege](#iam-least-privilege)).
- `serviceAccountKey.json` is explicitly listed in `.gitignore`.

### IAM Least Privilege

The Cloud Run service account is granted only:

| Role | Reason |
|------|--------|
| `roles/datastore.user` | Read/write Firestore |
| `roles/storage.objectCreator` + `roles/storage.objectViewer` | Report image access |
| `roles/cloudtasks.enqueuer` | Enqueue background jobs |
| `roles/secretmanager.secretAccessor` | Read secrets at runtime |

Admin / owner roles are **not** granted to the runtime service account.

### Gemini / AI Safety

- User-supplied text is always passed in the **data prefix** (`data: <content>`) of the prompt, never interpolated into the system instruction. This prevents prompt-injection attacks from altering triage logic.
- A per-user **daily token budget** is tracked in Firestore; requests exceeding the budget fall back to deterministic rule-based triage.
- Gemini responses are parsed against a strict JSON schema; unexpected output shapes are rejected and logged.

---

## Data Handling

### PII Minimisation

- Citizens are identified by a Firebase UID, not by name in most collections.
- Full name and contact details are stored only in the `users/{uid}` document, not duplicated in `reports`.
- Location data (coordinates) is stored at a neighbourhood level for public dashboards; exact coordinates are stored only in the report document and visible only to staff.

### Logging Policy

- Application logs do **not** contain passwords, tokens, Firebase private keys, or full PII.
- Request logs include: timestamp, method, path, response status, response time, and anonymous UID hash.
- Gemini prompt logs record token counts and categories, **not** the raw user description.
- Logs are retained for **90 days** in Cloud Logging.

### Data Retention

| Data type | Retention |
|-----------|-----------|
| Resolved reports | 3 years (statutory) |
| Audit logs | 7 years (statutory) |
| Notification records | 90 days |
| Translation cache | 30 days |
| Session data | 24 h inactivity TTL |

---

## Known Limitations and Mitigations

| Limitation | Mitigation |
|-----------|-----------|
| In-memory rate limit store resets on restart | Use Redis for clustered / multi-instance deployments. |
| Firebase ID tokens not revoked immediately on account deletion | Admin SDK `revokeRefreshTokens()` called on account deletion; session max-age caps exposure at 1 h. |
| Public report list exposes category and status | No PII fields (name, address, UID) are returned on the public list endpoint; server enforces field filtering in addition to Firestore rules. |
| Image EXIF metadata may contain GPS | Strip EXIF on upload using `sharp` before writing to Storage (planned for v2). |
| No MFA enforced for citizens | Multi-factor authentication is available in Firebase and may be enforced at the project level by the administrator. |
| Cloud Tasks retry may duplicate notifications | Notification service is idempotent — duplicate sends are de-duplicated by `notifId`. |
