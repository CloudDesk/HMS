# HMS Backend — Render Dependency Map & Coupling Analysis

**Date:** 2026-09-29  
**Target:** `@hms/api` Backend Services  
**Current Production Deployment:** Render Web Service (`https://hms-api-atok.onrender.com/api`)  
**Scope:** Portability & Coupling Audit  

---

## 1. Executive Summary

This document maps all dependencies, assumptions, and configurations in the HMS API backend that relate directly to **Render** hosting. Each finding is classified into one of four standardized portability categories:

- **Category A (Render-Specific — Must Change on Migration):** Items intrinsically tied to Render's deployment model, CLI, or container lifecycle.
- **Category B (Hosting-Neutral):** Standard web patterns that work identically across any container, VM, serverless, or edge platform.
- **Category C (Configurable via Environment / Adapter):** Platform parameters that adapt dynamically using environment variables or configuration switches.
- **Category D (Unknown / Platform-Specific Verification Needed):** Items requiring empirical verification on target platforms.

---

## 2. Render Dependency Inventory & Classification

| Item / Finding | Location | Why It Exists | Category | Migration Action / Alternative |
| :--- | :--- | :--- | :---: | :--- |
| **`render.yaml` Blueprint** | Repository root `/render.yaml` | Declarative infrastructure-as-code for Render deployment (`plan: free`, Node version, env vars). | **A** | Replace with target platform configuration (e.g. `wrangler.jsonc` for Cloudflare, `Dockerfile` for Fly.io/ECS). |
| **Node Version Specification (`22.14.0`)** | `render.yaml`, `.nvmrc` | Pins runtime to Node.js v22 LTS on the Render builder. | **C** | Configurable via `.nvmrc` or target platform runtime settings. |
| **Build Command (`npm install ...`)** | `render.yaml` (`npm install --include=dev && npm run build --workspace=@hms/api`) | Installs workspace dependencies and compiles TypeScript with `tsc`. | **B** | Standard npm build; works on any Node.js CI/CD builder. |
| **Start Command (`node apps/api/dist/server.js`)** | `render.yaml` (`startCommand: node apps/api/dist/server.js`) | Starts long-lived Node.js server binding to HTTP port. | **A** | Cloudflare Workers does not use `node server.js`; uses Worker fetch handler / entrypoint. |
| **Health Check Path (`/api/health`)** | `render.yaml` (`healthCheckPath: /api/health`), `apps/api/src/modules/health/` | Used by Render load balancer to verify zero-downtime deployment readiness. | **B** | Hosting-neutral REST route returning HTTP 200 `{ status: "ok" }`. |
| **Ephemeral Filesystem (`./storage/patient-documents`)** | `apps/api/src/config/env.ts`, `apps/api/src/shared/storage/` | Render Free Tier uses ephemeral root filesystem. Disk resets on restart/sleep. | **A** | Migrate binary storage to durable backend (e.g. Cloudflare R2, MongoDB GridFS, S3). |
| **Port Binding (`HOST=0.0.0.0`, `PORT=4000`)** | `apps/api/src/server.ts`, `apps/api/src/config/env.ts` | Listens on assigned TCP port provided by `$PORT` on Render. | **A** | Cloudflare Workers operates on standard Fetch `Request` / `Response` events without TCP port binding. |
| **Trust Proxy Configuration** | `apps/api/src/config/env.ts` (`TRUST_PROXY`) | Configures Fastify `trustProxy` for Render's reverse proxy headers (`X-Forwarded-For`). | **C** | Adjust proxy trust or derive client IP directly from platform headers (e.g. `CF-Connecting-IP`). |
| **CORS Origins Configuration** | `render.yaml`, `apps/api/src/config/env.ts` (`CORS_ORIGIN`) | Lists frontend domains (Firebase web app, localhost). | **B** | Pure configuration variable, 100% hosting-neutral. |
| **Persistent In-Memory Background Interval** | `apps/api/src/server.ts` (`setInterval(refreshDashboard, 300000)`) | Periodically recalculates administration dashboard metrics every 5 minutes. | **A** | Cloudflare Workers do not support long-running background intervals; requires Cloudflare Cron Triggers / Queues. |
| **Process Signal Handling (`SIGINT`, `SIGTERM`)** | `apps/api/src/server.ts` | Gracefully closes Fastify server and Mongoose connection when Render terminates container. | **A** | Not applicable to serverless/isolate runtimes; Workers terminate after request context completes. |
| **Idle Spin-Down / Cold Start Behavior** | Render Free Tier infrastructure | Render spins down instances after 15 minutes of inactivity; spins up on next HTTP request (takes 30-50s). | **A** | Platform-specific characteristic. Edge workers spin up in <50ms. |

---

## 3. Summary of Render Coupling

1. **Low Business Logic Coupling:** Zero business logic, data models, or service rules contain Render-specific code. All routes, controllers, and services are written in clean TypeScript with decoupled dependency injection.
2. **Infrastructure Coupling is Concentrated in 2 Files:**
   - [`render.yaml`](file:///c:/Users/lenovo/Documents/GitHub/HMS/render.yaml) (Render deployment blueprint)
   - [`apps/api/src/server.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/server.ts) (Long-running process lifecycle, TCP port listening, signal traps, and `setInterval`).
3. **Storage Coupling:** Local disk writing relies on the server container's disk, which is ephemeral on Render Free Tier and completely absent in Cloudflare Workers.
