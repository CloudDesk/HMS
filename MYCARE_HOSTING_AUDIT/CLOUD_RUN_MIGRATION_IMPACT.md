# HMS Backend — Google Cloud Run Migration Impact & Implementation Scope

**Date:** 2026-09-29  
**Target:** HMS Multi-Platform Stack (`@hms/api`, `@hms/patient-mobile`, `@hms/patient-web`, `@hms/web`)  
**Scope:** Scope of Change, File Impact, and Rollout Verification  

---

## 1. Scope of Impact by Application

| Application / Workspace | Code Changes Required? | Files Impacted | API Contract Impact | Risk Level |
| :--- | :---: | :---: | :---: | :---: |
| **Patient Web Portal (`@hms/patient-web`)** | **NO** | **0 files** | None (`git diff` = 0) | 🟢 **NONE** |
| **MyCare Native Mobile (`@hms/patient-mobile`)** | **NO** | **0 files** | None. Only `EXPO_PUBLIC_HMS_API_URL` points to new URL if custom domain is not used. | 🟢 **NONE** |
| **Clinical Staff Web (`@hms/web`)** | **NO** | **0 files** | None. Only `VITE_API_BASE_URL` points to new URL. | 🟢 **NONE** |
| **HMS API Backend (`@hms/api`)** | **NO (Code)** / **YES (Build config)** | **1 file** (`Dockerfile`) | Zero changes to routes, models, services, or authentication. | 🟢 **VERY LOW** |

---

## 2. Categorized Migration Changes

### 🟢 GREEN (Zero Code Modifications):
- All 30 domain modules (`patients`, `appointments`, `consents`, `billing`, `opd`, `admissions`, `users`, etc.).
- Authentication, JWT, and session management (`auth.service.ts`, `jwt.ts`, `hash.ts`).
- Fastify server configuration (`app.ts`).
- Mongoose schemas, indexes, and database models.
- Environment variable parsing (`env.ts`).

### 🟡 YELLOW (Deployment & Configuration Additions):
- Add multi-stage `Dockerfile` in repository root or `apps/api/Dockerfile`.
- Set Cloud Run environment variables: `APP_ENV=prod`, `NODE_ENV=production`, `MONGODB_URI`, `JWT_ACCESS_TOKEN_SECRET`, `JWT_REFRESH_TOKEN_SECRET`, `CORS_ORIGIN`.
- Configure custom domain (e.g. `api.hms.yourdomain.com`) to avoid mobile client rebuilds.

### 🔴 RED (Architectural Redesign):
- **NONE.** Cloud Run requires zero architectural changes.

---

## 3. Isolated POC Dockerfile Specification

The following multi-stage Dockerfile builds and runs the HMS API backend in standard Node.js v22 without modifying existing Render or development files:

```dockerfile
# Multi-stage Dockerfile for HMS API on Google Cloud Run
# Stage 1: Build & TypeScript Compilation
FROM node:22-alpine AS builder
WORKDIR /app

# Copy root workspace and api package definitions
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Install dependencies for compilation
RUN npm ci --workspace=@hms/api --include=dev

# Copy source files and compile
COPY tsconfig*.json ./
COPY apps/api ./apps/api
RUN npm run build --workspace=@hms/api

# Stage 2: Production Container
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

# Install production runtime dependencies only
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci --workspace=@hms/api --omit=dev --ignore-scripts

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Expose container port
EXPOSE 8080

# Launch Fastify API server
CMD ["node", "apps/api/dist/server.js"]
```

---

## 4. Rollback & Dual-Hosting Safety

Because Google Cloud Run and Render both point to the same external MongoDB Atlas cluster, **dual-hosting during migration is 100% safe**:
1. Cloud Run can be deployed and verified in parallel under a staging/POC domain.
2. Render remains the active primary production backend.
3. Once verified, traffic can be cut over via DNS with zero downtime and instant rollback capability.
