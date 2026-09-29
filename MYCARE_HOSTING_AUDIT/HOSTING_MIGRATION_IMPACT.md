# HMS Backend — Hosting Migration Impact & Risk Assessment

**Date:** 2026-09-29  
**Target:** HMS Multi-Platform Architecture (`apps/api`, `apps/patient-mobile`, `apps/patient-web`, `apps/web`)  
**Scope:** Migration Impact Analysis, Scope of Change & Risk Scorecard  

---

## 1. Migration Impact by Application

| Application / Client | Changes Required? | Files Impacted | Contract Impact | Risk Level |
| :--- | :---: | :---: | :---: | :---: |
| **MyCare Native Mobile (`@hms/patient-mobile`)** | **NO** | 0 files | Zero API contract changes. Only `EXPO_PUBLIC_HMS_API_URL` changes if domain changes. | 🟢 **NONE** |
| **Patient Web Portal (`@hms/patient-web`)** | **NO** | 0 files | Zero API contract changes. Protected boundary preserved (`git diff` = 0). | 🟢 **NONE** |
| **Clinical Staff Web (`@hms/web`)** | **NO** | 0 files | Zero API contract changes. | 🟢 **NONE** |
| **HMS API Backend (`@hms/api`)** | **YES** | ~15–25 backend files (if migrating to Workers) | Server bootstrap, database client, storage adapter, background worker. | 🟡 **MEDIUM-HIGH** |

---

## 2. Subsystem Effort Breakdown for Cloudflare Workers Migration

| Subsystem | Effort Rating | Files Affected | Description of Work |
| :--- | :---: | :--- | :--- |
| **1. Server Entrypoint & Framework** | 🟡 **MEDIUM** | `src/server.ts`, `src/app.ts` | Replace Fastify listener / wrap in Fetch handler, or adapt routes using Hono. |
| **2. Database & Connection Layer** | 🔴 **HIGH** | `src/database/client.ts`, `src/config/env.ts` | Configure TCP outbound sockets (`cloudflare:sockets`), manage connection lifecycles across ephemeral isolates, or adapt to Atlas Data API. |
| **3. File Storage Driver** | 🟡 **MEDIUM** | `src/shared/storage/patient-document-storage.service.ts` | Implement Cloudflare R2 / S3 storage driver or GridFS driver to eliminate local filesystem dependency. |
| **4. Background Timer Tasks** | 🟢 **LOW** | `src/server.ts`, `src/modules/administration-dashboard/` | Decouple `setInterval` dashboard refresh into Cloudflare Scheduled Cron Trigger. |
| **5. Authentication & Security** | 🟢 **LOW** | `src/shared/security/jwt.ts`, `src/shared/security/hash.ts` | Ensure Web Crypto compatibility for scrypt/PBKDF2; verify JWT and cookie signing. |
| **6. Environment Configuration** | 🟢 **LOW** | `src/config/env.ts` | Map Cloudflare Worker secrets and env bindings into standard `env` configuration object. |

---

## 3. Comparative Hosting Scorecard

| Evaluation Dimension | Current Render (Free Plan) | Render (Paid Starter $7/mo) | Cloudflare Workers | Traditional Container (AWS ECS / Fly.io) |
| :--- | :---: | :---: | :---: | :---: |
| **Node.js Runtime Compatibility** | 100% Native | 100% Native | ~85% (via `nodejs_compat`) | 100% Native |
| **Fastify Compatibility** | 100% Native | 100% Native | Requires adapter / rewrite | 100% Native |
| **Mongoose & Pool Reuse** | 100% Native | 100% Native | ⚠️ High connection overhead | 100% Native |
| **Cold Start Duration** | 30s – 50s (idle spin down) | 0s (always on) | <50ms (Edge isolate) | 0s (always on) |
| **Warm Request Latency** | 50ms – 150ms | 30ms – 80ms | 10ms – 40ms (Edge) | 20ms – 60ms |
| **Filesystem Persistence** | Ephemeral | Persistent Disk ($0.25/GB) | None (Requires R2/S3) | Persistent Volume / EFS |
| **Migration Effort** | None (Current) | Zero (1-click upgrade) | **HIGH** (Refactor DB & HTTP) | **LOW** (Standard Dockerfile) |
| **Client Impact** | None | None | None | None |

---

## 4. Recommended Prototype Scope & Proof of Concept

Before committing to a full production migration to Cloudflare Workers, the following isolated proof-of-concept (POC) should be executed:
1. **Scope:** Build a standalone Worker endpoint implementing `/api/health`, `/api/health/db`, and `/api/auth/login`.
2. **Key Metric to Prove:** Verify whether MongoDB Atlas TCP socket connections establish reliably under load within Cloudflare Worker isolates without connection pooling exhaustion.
3. **Storage Verification:** Verify Cloudflare R2 binary streaming for patient profile photos and consent documents.
