# HMS Backend — Cloudflare Workers Compatibility Technical Deep-Dive

**Date:** 2026-09-29  
**Target:** `@hms/api` Backend Services vs Cloudflare Workers (`workerd` Runtime)  
**Scope:** Runtime, Framework, Database, Cryptography & Storage Compatibility Audit  

---

## 1. Executive Summary

Cloudflare Workers executes code inside lightweight **V8 Isolates** (`workerd` runtime) distributed globally across Cloudflare's edge network, unlike traditional Node.js container runtimes (such as Render, Docker, or AWS ECS). While Cloudflare provides extensive `nodejs_compat` support, architectural differences fundamentally impact long-lived database connections, HTTP frameworks, filesystem I/O, and background timers.

This document evaluates the feasibility of running the existing `@hms/api` stack on Cloudflare Workers across all core subsystems.

---

## 2. Subsystem Compatibility Matrix

| Subsystem | Current Implementation | Cloudflare Workers Compatibility | Rating | Required Adapter / Redesign |
| :--- | :--- | :--- | :---: | :--- |
| **HTTP Framework** | Fastify v5 (`fastify`, `@fastify/cookie`, `@fastify/cors`, `@fastify/multipart`) | **Partially Compatible** via adapter, or native Fetch router (e.g. Hono) | 🟨 **YELLOW** | Fastify requires Node `http.IncomingMessage` / `http.ServerResponse`. Running on Workers requires `@fastify/aws-lambda` bridge with Fetch event adapter or migrating route definitions to a Fetch-native framework (e.g. Hono). |
| **Database ORM** | Mongoose v9 (`mongoose`, `mongoose.model`) | **Incompatible / High Latency** | 🟥 **RED** | Mongoose requires continuous TCP connection pooling, replica set monitoring, and stateful sockets. Cold isolate initialization with Mongoose handshake adds 500ms–1500ms per cold request. |
| **Database Connectivity** | MongoDB Atlas over TCP (`node:dns`, `node:net`, `node:tls`) | **Partially Compatible** via `nodejs_compat` + `cloudflare:sockets` | 🟨 **YELLOW** | Cloudflare Workers supports outbound TCP sockets via `cloudflare:sockets`. However, opening a direct MongoDB TLS socket per request without persistent pooling introduces high latency. Better suited for MongoDB Atlas Data API (HTTPS) or Prisma/Hyperdrive proxy. |
| **Authentication & JWT** | Custom lightweight HMAC-SHA256 (`node:crypto`) | **100% Compatible** | 🟩 **GREEN** | Uses pure `createHmac`, `timingSafeEqual`, and `base64url` encoding. Fully supported in Workers under `nodejs_compat` or Web Crypto API (`crypto.subtle`). |
| **Password Hashing** | `scrypt` via `node:crypto` + `node:util.promisify` | **100% Compatible** | 🟩 **GREEN** | Supported in Workers with `nodejs_compat_v2` or replaceable with standard Web Crypto / PBKDF2 / Argon2 WASM. |
| **Session Cookies** | Fastify Cookie (`@fastify/cookie`), HttpOnly, SameSite | **100% Compatible** | 🟩 **GREEN** | Pure HTTP header manipulation (`Set-Cookie`, `Cookie`). Hosting-neutral. |
| **Multipart Uploads** | `@fastify/multipart` (streams in-memory Buffer) | **Compatible** | 🟩 **GREEN** | Web standard `request.formData()` in Workers natively parses multipart requests. |
| **File Storage** | `PatientDocumentStorageService` (`node:fs/promises`) | **Incompatible with local disk** | 🟥 **RED** | Workers have no persistent or local disk filesystem. Must be backed by Cloudflare R2 (S3 API) or MongoDB GridFS. |
| **Consent HTML Generation** | Pure TypeScript string interpolation (`generateConsentHtml`) | **100% Compatible** | 🟩 **GREEN** | Pure memory / string operations without external dependencies or native binaries. |
| **Background Cron / Jobs** | `setInterval(refreshDashboard, 300000)` in `server.ts` | **Incompatible in-process** | 🟨 **YELLOW** | Workers cannot maintain long-running `setInterval` timers. Must use Cloudflare Cron Triggers (`scheduled` event). |
| **Environment Variables** | `process.env` parsed in `env.ts` via Zod | **100% Compatible** | 🟩 **GREEN** | Workers expose environment variables and secrets via `env` binding or `process.env` under `nodejs_compat`. |

---

## 3. Deep-Dive: Database & Mongoose on Edge Isolates (The Primary Blocker)

### The Challenge with Mongoose on Edge Workers
1. **Connection Lifecycle:**
   - In Render, Node.js boots once, opens a pool of 10 TCP connections to MongoDB Atlas, and keeps them open permanently.
   - In Cloudflare Workers, isolates are ephemeral and distributed across hundreds of edge locations. Each incoming request from a new edge data center would instantiate a new connection handshake (DNS SRV lookup, TLS handshake, SCRAM authentication, replica set topology ping).
2. **Execution Time & CPU Limits:**
   - Cloudflare Workers Free Tier limits CPU time to 10ms–50ms. Mongoose model schema compilation and connection negotiation can exceed CPU limits during cold starts.
3. **Alternative Architecture for Edge MongoDB:**
   - **Option A (Atlas Data API):** Use HTTPS REST calls to MongoDB Atlas instead of direct TCP Mongoose connections. (Requires rewriting repositories from Mongoose queries to Data API REST payloads).
   - **Option B (Serverless Connection Manager / Proxy):** Deploy a connection pooling proxy (like MongoDB Prisma Driver or Hyperdrive).
   - **Option C (Dedicated Container Backend + Edge CDN):** Keep backend on a container platform (Render, Fly.io, AWS ECS) with persistent Mongoose pooling, while using Cloudflare for Edge Caching, WAF, and DNS routing.

---

## 4. Deep-Dive: Fastify vs Fetch-Native Edge Routers

1. **Fastify on Node:** Fastify is built around Node's event-loop HTTP server (`http.createServer`).
2. **Fastify on Workers:** While adapters like `fastify-worker` or `@fastify/aws-lambda` exist to simulate Node HTTP requests from Fetch `Request`, they introduce wrapper overhead.
3. **If Migrating to Workers:** Frameworks like **Hono** provide identical syntax (`app.get`, `app.post`, middleware, Zod validation, JWT, cookies) but are natively built for Cloudflare Workers, achieving <5ms cold starts.

---

## 5. Compatibility Rating Breakdown

- **Total Backend Subsystems Audited:** 11
- **🟩 GREEN (Ready with 0/minor changes):** 6 subsystems (55%)
  - Authentication (JWT, OTP, passwords)
  - Security headers & cookies
  - Multipart upload parsing
  - HTML consent snapshot rendering
  - Request validation schemas (Zod)
  - Environment variable structure
- **🟨 YELLOW (Requires Adapter / Refactoring):** 3 subsystems (27%)
  - Fastify routing layer
  - Background dashboard refresh interval
  - Direct TCP outbound socket configuration
- **🟥 RED (Architectural Redesign Required):** 2 subsystems (18%)
  - Local filesystem storage (`node:fs/promises`)
  - Stateful Mongoose ORM connection pooling across distributed edge isolates
