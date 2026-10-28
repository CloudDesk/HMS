# MYCARE & HMS — BACKEND HOSTING PORTABILITY & CLOUDFLARE WORKERS FEASIBILITY AUDIT

**Date:** 2026-09-29  
**Target:** HMS Backend Services (`@hms/api`), Clients (`@hms/patient-mobile`, `@hms/patient-web`, `@hms/web`)  
**Current Hosting:** Render Web Service (`https://hms-api-atok.onrender.com/api`)  
**Evaluated Target:** Cloudflare Workers (`workerd` Edge Runtime)  
**Status:** HOSTING PORTABILITY AUDIT COMPLETE — NO MIGRATION PERFORMED  

---

## 1. Executive Summary

This audit evaluates the architectural portability of the HMS backend (`@hms/api`) from its current deployment on Render to Cloudflare Workers or alternative cloud hosting platforms.

The audit rigorously inspected:
- All 136 backend source modules, bootstrap routines, repositories, services, and middleware.
- Runtime coupling to Node.js built-ins (`process`, `Buffer`, `node:crypto`, `node:dns`, `node:fs/promises`, `node:net`, `node:stream`).
- Framework constraints (Fastify v5 vs Edge Fetch handlers).
- Database layer (Mongoose v9 connection pooling, sessions, multi-document transactions, TCP sockets).
- Client stability across MyCare Native Mobile (`apps/patient-mobile`), Patient Web (`apps/patient-web`), and Staff Clinical Web (`apps/web`).

---

## 2. Answers to the 20 Core Audit Questions

### 1. How dependent is HMS on Render?
**Very low in code; coupled only by deployment infrastructure.**  
The backend codebase contains zero proprietary Render SDKs or hardcoded Render APIs. The coupling is confined to [`render.yaml`](file:///c:/Users/lenovo/Documents/GitHub/HMS/render.yaml) (blueprint configuration), standard `$PORT` / `$HOST` binding in [`server.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/server.ts), and reliance on local filesystem storage (which is ephemeral on Render Free Tier).

### 2. How dependent is HMS on Node.js?
**Moderately dependent.**  
The application uses 122 instances of Node.js-specific features across `node:crypto` (HMAC, SHA-256, scrypt), `node:fs/promises` (local file storage), `node:dns` (`setServers`), `node:stream` (CSV export), and `process.env`. However, the domain logic and business services are standard TypeScript.

### 3. How compatible is the current backend with Cloudflare Workers?
**~70% directly compatible; ~30% requires architectural adaptation.**  
Pure business logic, Zod validation schemas, JWT authentication, and route handlers are compatible. However, Mongoose stateful TCP connection pooling and local filesystem I/O cannot run directly on Cloudflare Workers without architectural changes.

### 4. Which exact modules prevent direct migration?
- [`apps/api/src/database/client.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/database/client.ts): Mongoose persistent TCP pool and `node:dns` configuration.
- [`apps/api/src/shared/storage/patient-document-storage.service.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/storage/patient-document-storage.service.ts): Local filesystem calls (`mkdir`, `writeFile`, `readFile`, `unlink`).
- [`apps/api/src/server.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/server.ts): `app.listen()` and background `setInterval()` timers.

### 5. Which modules require adapters?
- **HTTP Routing Layer (`apps/api/src/app.ts`):** Fastify needs an adapter bridge (like `@fastify/aws-lambda` or Fetch event adapter) or porting to a native edge router like Hono.
- **Storage Layer (`patient-document-storage.service.ts`):** Needs a Cloudflare R2 (S3 API) driver.
- **Background Tasks (`server.ts`):** The 5-minute dashboard refresh needs a Cloudflare Scheduled Cron Trigger.

### 6. Which modules are already portable?
- Authentication, JWT, and password hashing (`src/shared/security/jwt.ts`, `src/shared/security/hash.ts`).
- All 30 domain modules (Appointments, Admissions, Billing, Consents, Dental, OPD, Patients, Pharmacy, Surgery, Users, Roles, etc.).
- All Zod validation schemas and DTO contracts.
- HTML consent document rendering (`generateConsentHtml`).

### 7. Would the API contracts need to change?
**NO.**  
All API endpoints (`/api/patient-portal/...`, `/api/auth/...`, `/api/patients/...`), HTTP methods, JSON request/response formats, status codes, and error envelopes (`{ success, data, error }`) remain 100% identical.

### 8. Would MyCare mobile require changes?
**NO.**  
MyCare Native Mobile (`@hms/patient-mobile`) consumes standard HTTPS REST endpoints and multipart uploads. It requires **zero code changes** (only `EXPO_PUBLIC_HMS_API_URL` if the domain changes).

### 9. Would Patient Web require changes?
**NO.**  
Patient Web (`@hms/patient-web`) remains 100% protected and untouched (`git diff` = 0).

### 10. Would Clinical Web require changes?
**NO.**  
Clinical Web (`@hms/web`) communicates via standard HTTP API client and requires zero changes.

### 11. Would MongoDB architecture need to change?
**YES, if moving to Cloudflare Workers.**  
Mongoose assumes a persistent Node.js process with pooled TCP connections. On ephemeral Workers, connecting to MongoDB Atlas requires either:
- MongoDB Atlas Data API (HTTPS REST), OR
- Direct TCP sockets via `cloudflare:sockets` with single-connection handling, OR
- A database connection proxy (Hyperdrive / Prisma Accelerate).

### 12. Would authentication need to change?
**NO.**  
JWT signing (HMAC-SHA256), HttpOnly session cookies, bearer tokens, and OTP generation use standard crypto algorithms supported across both Node.js and Cloudflare Workers (`nodejs_compat` / Web Crypto).

### 13. Would PDF/image processing need to change?
**NO.**  
The backend currently uses pure TypeScript string-based HTML generation for consents and in-memory buffer handling for images. It does not use heavy native libraries like Puppeteer, Playwright, or Sharp.

### 14. Would background jobs need to change?
**YES.**  
The in-memory `setInterval` dashboard snapshot refresh must be moved to Cloudflare Cron Triggers or an external scheduler.

### 15. What is the migration effort?
**MEDIUM-HIGH for Cloudflare Workers; LOW for Container Platforms (e.g. AWS ECS / Fly.io / Render Paid).**

### 16. What is the recommended prototype scope?
A lightweight proof-of-concept implementing `/api/health`, `/api/health/db`, and `/api/auth/login` on Cloudflare Workers to validate Atlas TCP socket latency and connection stability.

### 17. What latency tests should be performed?
DNS resolution, TCP/TLS handshake, TTFB, and total duration across 10 critical endpoints (Health, Auth, Overview, Appointments, Prescriptions, Invoices, Documents, Profile Photo).

### 18. What cold-start tests should be performed?
Measure request latency after 20+ minutes of idle spin-down on Render (cold start baseline: ~30–50s) vs Worker isolate startup (<50ms).

### 19. What warm-request tests should be performed?
Execute 25 sequential requests per endpoint to measure steady-state P50, P95, and P99 latencies.

### 20. What needs to be proven before production migration?
1. Database query performance and connection reliability from Workers to MongoDB Atlas.
2. Binary file streaming performance via Cloudflare R2.
3. Zero regressions across existing automated test suites (221 mobile tests, 100+ API integration tests).

---

## 3. Related Audit Reports in `MYCARE_HOSTING_AUDIT/`

- [`RENDER_DEPENDENCY_MAP.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/MYCARE_HOSTING_AUDIT/RENDER_DEPENDENCY_MAP.md) — Comprehensive Render configuration and coupling map.
- [`CLOUDFLARE_WORKERS_COMPATIBILITY.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/MYCARE_HOSTING_AUDIT/CLOUDFLARE_WORKERS_COMPATIBILITY.md) — Deep-dive technical compatibility analysis of Cloudflare Workers runtime.
- [`HOSTING_LATENCY_TEST_PLAN.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/MYCARE_HOSTING_AUDIT/HOSTING_LATENCY_TEST_PLAN.md) — Complete benchmark test protocol and reporting framework.
- [`HOSTING_MIGRATION_IMPACT.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/MYCARE_HOSTING_AUDIT/HOSTING_MIGRATION_IMPACT.md) — Risk scorecard, client impact, and subsystem effort breakdown.

---

```
HOSTING PORTABILITY AUDIT COMPLETE — NO MIGRATION PERFORMED
```
