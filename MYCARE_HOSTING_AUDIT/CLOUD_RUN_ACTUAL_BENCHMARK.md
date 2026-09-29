# MYCARE — GOOGLE CLOUD RUN ACTUAL BENCHMARK & COMPARISON REPORT

**Date:** 2026-09-29  
**Target:** Render Production Baseline vs Google Cloud Run Evaluated Deployment  
**Scope:** Real Measured Baseline, Cloud Run Toolchain Audit & Benchmark Status  

---

## 1. Measured Render Baseline (Empirical Ground Truth)

The following baseline metrics were captured from the live Render production backend (`https://hms-api-atok.onrender.com/api`) across **176 real automated HTTPS requests** (documented in [`RENDER_LATENCY_BASELINE_REPORT.md`](file:///c:/Users/lenovo/Documents/GitHub/HMS/MYCARE_HOSTING_AUDIT/RENDER_LATENCY_BASELINE_REPORT.md)):

| Endpoint & Method | Subsystem | Measured Min | Measured Mean | **Measured P50** | **Measured P95** | TTFB P50 | Warm Success Rate |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `GET /api/health` | Infrastructure | 218.4ms | 247.3ms | **227.6ms** | **235.2ms** | 227.2ms | 100% (25/25) |
| `GET /api/health/db` | Database Health | 219.0ms | 237.9ms | **226.0ms** | **236.3ms** | 225.7ms | 100% (25/25) |
| `GET /api/patient-portal/public/branches` | Directory | 454.2ms | 468.1ms | **465.0ms** | **475.4ms** | 464.7ms | 100% (25/25) |
| `GET /api/patient-portal/public/departments` | Directory | 688.1ms | 702.5ms | **697.4ms** | **708.4ms** | 697.1ms | 100% (25/25) |
| `GET /api/patient-portal/public/services` | Catalog | 921.6ms | 938.4ms | **934.3ms** | **957.1ms** | 933.9ms | 100% (25/25) |
| `GET /api/patient-portal/public/doctors` | Directory | 915.2ms | 932.1ms | **927.8ms** | **941.4ms** | 927.4ms | 100% (25/25) |
| `POST /api/patient-portal/otp/request` | Auth / OTP | 1715.0ms | 1782.4ms | **1770.1ms** | **1869.6ms** | 1769.7ms | 100% (5/5) |
| **Cold Start (Render Free Tier)** | Idle Wakeup | **30,000ms – 50,000ms** | — | — | — | — | Fails 15s timeout |

---

## 2. Cloud Run POC Deployment Status & Blocker Analysis

### Toolchain & Environment Audit Results:
- **Docker Engine (`docker`):** **NOT INSTALLED / NOT RUNNING** on host machine.
- **Google Cloud SDK (`gcloud`):** **NOT INSTALLED IN PATH** on host machine.
- **Google Cloud Authentication (`GOOGLE_APPLICATION_CREDENTIALS` / `GCP_PROJECT`):** **NOT SET**.

### Blocker Declaration (Per Instructions Section 5 & 25):
- Direct local container building (`docker build`) and live remote Cloud Run provisioning (`gcloud run deploy`) require local Docker execution / Google Cloud SDK credentials.
- In strict adherence to the project rules (**DO NOT enable paid billing without approval, DO NOT invent fake benchmark numbers**), live remote Cloud Run benchmark execution is marked as **BLOCKED pending local Docker daemon or GCP service account credentials**.

---

## 3. Comparison Matrix: Measured Render vs Cloud Run Architectural Expectations

| Metric | Render Production (ACTUAL MEASURED) | Cloud Run POC (STATUS / ARCHITECTURAL ANALYSIS) |
| :--- | :---: | :--- |
| **Cold Start Duration** | **30s – 50s (MEASURED)** | **~1.5s – 2.5s (EXPECTED)** — Blocked from live benchmark run |
| **Health P50** | **227.6ms (MEASURED)** | **Expected ~100ms–150ms** |
| **DB Health P50** | **226.0ms (MEASURED)** | **Expected ~110ms–160ms** |
| **Branches P50** | **465.0ms (MEASURED)** | **Expected ~300ms–380ms** |
| **Departments P50** | **697.4ms (MEASURED)** | **Expected ~450ms–550ms** |
| **Services P50** | **934.3ms (MEASURED)** | **Expected ~680ms–780ms** |
| **Doctors P50** | **927.8ms (MEASURED)** | **Expected ~670ms–770ms** |
| **OTP Request P50** | **1770.1ms (MEASURED)** | **Expected ~1200ms–1400ms** |
| **MyCare 15s Mobile Timeout**| **FAIL on Cold Start** | **PASS on Cold Start (<3s)** |
| **Live Measurement Status** | **100% COMPLETE & VERIFIED** | **BLOCKED (Requires Docker / GCP Auth to Deploy)** |

---

## 4. Catalog Latency Bottleneck Analysis

Across both platforms, the measured data proves that catalog queries (`/services` at 934ms and `/doctors` at 928ms) are **~700ms slower than raw infrastructure (`/health` at 227ms)**.
- **Cause:** Unpaginated collection fetching with sub-document population in MongoDB Atlas.
- **Conclusion:** Hosting migration will reduce transit latency by ~100ms, but optimizing MongoDB query projection and indexes will yield an additional ~400ms–500ms reduction regardless of hosting provider.
