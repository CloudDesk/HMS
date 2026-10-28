# HMS Backend — Google Cloud Run Compatibility Audit

**Date:** 2026-09-29  
**Target:** `@hms/api` Backend Services vs Google Cloud Run Container Runtime  
**Scope:** Runtime, Framework, Database, Networking, Storage & Environment Compatibility  

---

## 1. Executive Summary

Google Cloud Run is a fully managed, serverless container execution platform that runs standard OCI container images. Unlike V8 isolate runtimes (such as Cloudflare Workers), Cloud Run provides a **standard Linux container environment** running a full Node.js v22 runtime with native TCP socket support, long-lived process execution, and seamless Mongoose/Fastify compatibility.

This audit evaluates the compatibility of the existing `@hms/api` codebase with Google Cloud Run.

---

## 2. Cloud Run Technical Compatibility Matrix

| Subsystem / Feature | Current HMS Implementation | Cloud Run Compatibility | Rating | Details & Requirements |
| :--- | :--- | :---: | :---: | :--- |
| **Node.js Runtime** | Node.js v22 (`22.14.0` in `.nvmrc` and `render.yaml`) | **100% Native** | 🟩 **GREEN** | Standard `node:22-alpine` or `node:22-slim` base image. Matches current production runtime. |
| **HTTP Framework** | Fastify v5 (`fastify`, `@fastify/cookie`, `@fastify/cors`, `@fastify/multipart`) | **100% Native** | 🟩 **GREEN** | Fastify runs natively on Node.js HTTP server. Zero adapters, bridges, or routing rewrites needed. |
| **Port & Host Binding** | `$PORT` (default: 4000), `$HOST` (`0.0.0.0`) in `server.ts` | **100% Native** | 🟩 **GREEN** | Cloud Run automatically injects `$PORT` (default 8080). Fastify binds directly to `0.0.0.0:$PORT`. |
| **Database ORM & Drivers** | Mongoose v9 (`mongoose.connect`, connection pool = 10) | **100% Native** | 🟩 **GREEN** | Full native TCP socket connectivity to MongoDB Atlas. Connection pooling operates normally during container lifetime. |
| **Multi-Document Transactions** | Mongoose Client Sessions (`session.withTransaction`) | **100% Native** | 🟩 **GREEN** | MongoDB replica set transactions run identically to Render. |
| **Graceful Shutdown** | `SIGTERM` / `SIGINT` handlers in `server.ts` closing Fastify & Mongoose | **100% Native** | 🟩 **GREEN** | Cloud Run sends `SIGTERM` before instance termination with a 10s grace period. Existing handlers shut down cleanly. |
| **Authentication & JWT** | `node:crypto` (HMAC-SHA256, scrypt password hashing, cookies) | **100% Native** | 🟩 **GREEN** | All `node:crypto` primitives execute natively in standard Node.js runtime. |
| **Multipart File Uploads** | `@fastify/multipart` stream to Buffer | **100% Native** | 🟩 **GREEN** | Cloud Run supports streaming HTTP requests up to 32MB payload limit (exceeds HMS 10MB limit). |
| **Background Timers** | `setInterval(refreshDashboard, 300000)` in `server.ts` | **Compatible with Warm Standby** | 🟨 **YELLOW** | When `min_instances = 1`, runs normally. When `min_instances = 0`, CPU is throttled during idle; can be triggered via Cloud Scheduler. |
| **Filesystem Storage** | `PatientDocumentStorageService` (`node:fs/promises`) | **Ephemeral on Container** | 🟨 **YELLOW** | Cloud Run container filesystem is in-memory ephemeral. Binary storage should use Google Cloud Storage (GCS) bucket or MongoDB GridFS. |
| **Health Endpoints** | `GET /api/health`, `GET /api/health/db` | **100% Native** | 🟩 **GREEN** | Used directly for Cloud Run startup and liveness HTTP probes. |
| **Environment Variables** | `env.ts` with Zod validation (`process.env`) | **100% Native** | 🟩 **GREEN** | Standard environment variables and Secret Manager integration. |

---

## 3. Key Findings

1. **Zero Architectural Redesign Required:**
   - Unlike Cloudflare Workers (which required refactoring Mongoose and Fastify), Cloud Run runs the **exact existing Node.js + Fastify + Mongoose codebase without modifying a single line of business logic**.
2. **Containerization is Direct:**
   - A standard multi-stage `Dockerfile` compiles TypeScript and runs `node apps/api/dist/server.js`.
3. **Cold-Start Latency Advantage:**
   - Render Free Tier cold start: **30s – 50s**.
   - Cloud Run cold start (`min_instances = 0`): **~1.5s – 3.0s**.
   - Cloud Run warm standby (`min_instances = 1`): **0ms cold start**.
