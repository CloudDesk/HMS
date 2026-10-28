# MYCARE — RENDER API LATENCY PROFILING & OPTIMIZATION REPORT

## 1. Executive Summary

This report documents the profiling, root-cause identification, and code/query optimizations performed on the HMS Backend (`apps/api`) hosted on **Render** (`https://hms-api-atok.onrender.com/api`).

- **Target Deployment:** Render (Zero hosting migration).
- **Patient Web Status:** **100% Untouched** (`git diff --stat apps/patient-web` = 0 lines).
- **Mobile Regression Status:** **221/221 Tests Passing** (`npm test --workspace=@hms/patient-mobile`).
- **Contracts & Business Logic:** 100% preserved. No schema breaking changes or authentication modifications.

---

## 2. Latency Profiling & Root-Cause Breakdown

From our baseline measurement of 176 live requests against Render (`MYCARE_HOSTING_AUDIT/RENDER_LATENCY_BASELINE_REPORT.md`):

| Endpoint | Baseline P50 | Profiled Root Causes & Bottlenecks |
| :--- | :--- | :--- |
| `GET /api/health` | 227.6ms | Geographic RTT / TLS handshake from local client to Render Oregon region. (Node.js event loop overhead: < 1ms). |
| `GET /api/health/db` | 226.0ms | Single `adminCommand({ ping: 1 })` ping to MongoDB Atlas. Network RTT dominates. |
| `GET /api/patient-portal/branches` | 465.0ms | Unindexed text search fallback + unprojected object fetching. |
| `GET /api/patient-portal/departments` | 697.4ms | Unindexed negative regex filter scan (`$not: /administration\|.../i`) without compound indexes on `[status, isClinical, branchIds, name]`. |
| `GET /api/patient-portal/services` | 934.3ms | Multi-step sequential queries for department resolution followed by unindexed service collection queries. |
| `GET /api/patient-portal/doctors` | 927.8ms | Multi-query sequential lookups across `DoctorModel`, `DepartmentModel`, and `BranchModel`. |
| `POST /api/patient-portal/otp/request` | 1770.1ms | **6 Sequential Network Round-Trips to MongoDB Atlas**: (1) `findLatest`, (2) `otp-resend` rate limit update, (3) `otp-request-identity` rate limit update, (4) `otp-request-ip` rate limit update, (5) `invalidateActive` updateMany, (6) `create` challenge insert. Each trip across Atlas added ~200ms latency sequentially. |

---

## 3. Applied Backend Optimizations

### 3.1 Parallelization of OTP Rate-Limit Verification (`patient-otp.service.ts`)
- **Optimization:** Refactored sequential rate-limit updates (`otp-resend`, `otp-request-identity`, `otp-request-ip`) to execute in parallel using `Promise.all`.
- **Latency Impact:** Eliminates 2 unnecessary sequential network round-trips to MongoDB Atlas per OTP request, reducing database wait time by **~400ms – 600ms**.

### 3.2 High-Efficiency Compound Mongoose Indexes
Added targeted compound indexes across high-traffic public catalog and authentication models:
1. **`OtpChallengeModel` (`otp-challenge.model.ts`)**:
   - Added: `{ phone: 1, createdAt: -1 }` (Index-covered sorting for `findLatest`)
   - Added: `{ phone: 1, verifiedAt: 1, expiresAt: 1 }` (Instant validation index)
2. **`DepartmentModel` (`department.model.ts`)**:
   - Added: `{ deletedAt: 1, status: 1, isClinical: 1, branchIds: 1, name: 1 }` (Compound index for public clinical catalogs)
3. **`ServiceModel` (`service.model.ts`)**:
   - Added: `{ deletedAt: 1, status: 1, departmentId: 1, name: 1 }` (Compound index for filtered service catalogs)
4. **`DoctorModel` (`doctor.model.ts`)**:
   - Added: `{ deletedAt: 1, status: 1, branchId: 1, departmentId: 1, displayName: 1 }` (Compound index for doctor directory lookups)

### 3.3 Query Projection & Array Filter Optimization (`patient-portal.repository.ts`)
- Added explicit `.select()` projections and `branchIds` array matching to avoid overfetching document payload in `listPublicDepartments`.
- Preserved all response fields (`code`, `name`, `description`, `branchId`, `branchIds`) and pagination metadata shape.

---

## 4. Verification & Safety Gates

| Gate / Invariant | Status | Details |
| :--- | :--- | :--- |
| **Render URL & Hosting** | ✅ **VERIFIED** | Stays on Render production. Zero hosting migration. |
| **Patient Web Protection** | ✅ **VERIFIED** | `git diff --stat apps/patient-web` = 0 lines modified. |
| **Patient Mobile Tests** | ✅ **VERIFIED** | 221/221 unit and integration tests passing in `@hms/patient-mobile`. |
| **API Typecheck** | ✅ **VERIFIED** | `npm run typecheck --workspace=@hms/api` passed with 0 errors. |
| **OTP Unit Tests** | ✅ **VERIFIED** | 26/26 tests passed in `src/modules/patient-portal/otp.test.ts`. |
| **API Contracts** | ✅ **VERIFIED** | All JSON response shapes and schemas identical. |
| **EAS Builds** | ✅ **VERIFIED** | Zero EAS builds run; 0 EAS credits consumed. |
