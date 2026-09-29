# HMS Backend — Hosting Latency & Performance Benchmark Plan

**Date:** 2026-09-29  
**Target Platforms:** Current Render Free Tier vs Cloudflare Workers Prototype  
**Scope:** Performance, Cold Start, and Latency Evaluation Protocol  

---

## 1. Benchmark Objectives

Before making any hosting migration decision, empirical performance data must be captured under controlled conditions. This test plan defines the exact metrics, methodology, endpoints, and statistical thresholds required to compare:
1. **Current Production Backend on Render (`plan: free`)**
2. **Cloudflare Workers Experimental Prototype**

---

## 2. Test Topology & Parameters

| Parameter | Specification | Notes |
| :--- | :--- | :--- |
| **Client Benchmark Location** | Distributed Client (e.g. Frankfurt, Mumbai, Virginia) | Test from geographic locations where patients and staff reside. |
| **Current API Host** | `https://hms-api-atok.onrender.com/api` | Render Web Service (US-East or EU-Central region). |
| **Database Host** | MongoDB Atlas Cluster | Primary region where database replica set is hosted. |
| **Warm Measurement Sample Size** | 20–30 consecutive requests per endpoint | Captures steady-state throughput and connection pool reuse. |
| **Cold Start Measurement Procedure** | Allow instance to sleep (15+ min inactivity on Render) | Measures first-request wake-up latency without artificial keep-alive pings. |
| **Statistical Percentiles** | Min, P50 (Median), P95, P99, Max, Error Rate (%) | Accurately identifies tail latencies and jitter. |

---

## 3. Evaluated Endpoints Matrix

| # | Endpoint & Method | Subsystem | Purpose & Characteristics |
| :-: | :--- | :--- | :--- |
| **1** | `GET /api/health` | Health Check | Baseline latency without database query. |
| **2** | `GET /api/health/db` | DB Health | Single `db.admin().ping()` round-trip to MongoDB. |
| **3** | `POST /api/auth/login` | Authentication | Scrypt password verification + JWT signing + Cookie generation. |
| **4** | `GET /api/patient-portal/overview` | Patient Overview | Aggregated query: patient profile, upcoming appointments, recent records. |
| **5** | `GET /api/patient-portal/appointments?scope=upcoming` | Appointments List | Filtered index query on appointment collection. |
| **6** | `POST /api/patient-portal/appointments` | Appointment Booking | Mongoose multi-document transaction + slot verification + sequence generation. |
| **7** | `GET /api/patient-portal/prescriptions` | Prescriptions | Joined patient prescription query. |
| **8** | `GET /api/patient-portal/invoices` | Billing Summary | Billing index lookup + status calculation. |
| **9** | `GET /api/patient-portal/documents` | Consent & Documents | Query patient documents collection with metadata filtering. |
| **10** | `GET /api/patient-portal/patients/:id/profile-photo` | Profile Photo Stream | Binary image streaming from storage driver with auth gate. |

---

## 4. Cold Start vs Warm Request Measurement Protocol

### A. Cold Start Test Protocol (Render)
1. Ensure no traffic hits `hms-api-atok.onrender.com` for at least 20 minutes.
2. Confirm instance has spun down to 0 active instances.
3. Fire a single HTTP request to `GET /api/health` and record:
   - DNS lookup time
   - TCP & TLS connection time
   - Time to First Byte (TTFB)
   - Total elapsed request duration
4. Fire a subsequent request to `GET /api/health/db` to measure cold database pool connection negotiation.

### B. Warm Request Test Protocol (Both Platforms)
1. Warm up the target instance with 5 initial requests.
2. Execute 25 sequential requests per endpoint using HTTP/1.1 and HTTP/2 connection reuse.
3. Capture full timing breakdown for each request:
   - `dns_lookup_ms`
   - `tcp_connect_ms`
   - `tls_handshake_ms`
   - `ttfb_ms`
   - `total_time_ms`
   - `status_code`

---

## 5. Reporting Template for Benchmark Results

When empirical tests are executed, results must be tabulated as follows:

| Endpoint | Render Cold Start (ms) | Render Warm P50 (ms) | Render Warm P95 (ms) | Worker Cold Start (ms) | Worker Warm P50 (ms) | Worker Warm P95 (ms) | Latency Delta (P50) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `GET /api/health` | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* |
| `GET /api/health/db` | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* |
| `POST /api/auth/login` | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* |
| `GET /api/patient-portal/overview` | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* |
| `GET /api/patient-portal/appointments`| *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* |
| `POST /api/patient-portal/appointments`| *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* | *(TBD)* |

*Note: No synthetic benchmark values are fabricated. Measurements must be recorded from live test executions.*
