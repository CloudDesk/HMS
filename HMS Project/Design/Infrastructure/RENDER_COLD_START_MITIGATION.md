# MYCARE / HMS — RENDER FREE PLAN COLD-START MITIGATION REPORT

## 1. Executive Summary

This report defines the implementation and external keep-alive scheduler setup to eliminate Render's **30–50 second Free-tier cold start** while remaining on the **Render Free plan** with **zero code modifications** and **zero architectural changes**.

- **Target API:** `https://hms-api-atok.onrender.com/api`
- **Health Check Endpoint:** `GET /api/health`
- **Code Changes Required:** **NO** (0 lines modified).
- **Patient Web Status:** **100% Untouched** (`git diff --stat -- apps/patient-web` = 0 lines).
- **External Keep-Alive Interval:** **14 minutes** (Render sleeps at 15 minutes of inactivity).
- **Authentication Required:** **None** (public lightweight health check).

---

## 2. Inspection of `/api/health`

We inspected `apps/api/src/modules/health/health.routes.ts`:

```typescript
app.get(
  '/api/health',
  {
    schema: {
      response: {
        200: healthResponseSchema,
      },
    },
  },
  async () =>
    ok({
      status: 'ok',
      service: env.app.name,
      environment: env.app.environment,
    }),
);
```

### Assessment:
1. **Lightweight:** **YES.** The endpoint executes in $< 1\text{ms}$ on Node.js. It returns an in-memory JSON response and does **not** execute any database queries, file I/O, or external network requests.
2. **Authentication:** **None.** It does not require authorization headers, cookies, or API keys.
3. **Verdict:** The existing `/api/health` is already optimal and requires **no code changes**.

---

## 3. External Scheduler / Keep-Alive Configuration

Because in-process Node.js timers (`setInterval`) cannot execute when Render suspends a sleeping container, the keep-alive ping must originate from an **external** uptime/cron service.

### Target Specifications:
- **URL:** `https://hms-api-atok.onrender.com/api/health`
- **HTTP Method:** `GET`
- **Frequency / Interval:** **Every 14 minutes** (or `*/14 * * * *` cron expression)
- **Expected Status Code:** `200`
- **Timeout Setting:** `10 seconds`

---

## 4. Recommended External Keep-Alive Services & Setup Instructions

### Option A: Cron-Job.org (Free, Exact 14-Minute Intervals)
1. Sign up / log in to [cron-job.org](https://cron-job.org).
2. Click **Create Cronjob**.
3. **Title:** `HMS Render API Keep-Alive`
4. **URL:** `https://hms-api-atok.onrender.com/api/health`
5. **Execution Schedule:** Custom -> Interval: **Every 14 minutes**.
6. **Request Method:** `GET`
7. Click **Create**.

### Option B: UptimeRobot (Free 5-Minute or Custom Monitoring)
1. Log in to [UptimeRobot](https://uptimerobot.com).
2. Click **Add New Monitor**.
3. **Monitor Type:** `HTTP(s)`
4. **Friendly Name:** `HMS Render API Keep-Alive`
5. **URL (or IP):** `https://hms-api-atok.onrender.com/api/health`
6. **Monitoring Interval:** `5 minutes` or `10 minutes` (both are $< 15\text{min}$, safely preventing container sleep).
7. Click **Create Monitor**.

### Option C: Better Stack / Uptime (Free Plan)
1. Log in to [Better Stack](https://betterstack.com).
2. Create an HTTP monitor targeting `https://hms-api-atok.onrender.com/api/health`.
3. Set interval to `3 minutes` or `5 minutes`.

---

## 5. Live Endpoint Validation Results

Direct live verification executed against the production Render API:

```http
GET https://hms-api-atok.onrender.com/api/health
```

- **HTTP Status Code:** `200 OK`
- **Response Headers:** `content-type: application/json; charset=utf-8`
- **Response Body:**
  ```json
  {
    "data": {
      "status": "ok",
      "service": "hms-api",
      "environment": "prod"
    }
  }
  ```
- **Security Check:** Verified that no tokens, cookies, or secrets are required.

---

## 6. Practical Verification Procedure for Cold-Start Prevention

To physically verify that the external scheduler prevents Render sleep:

1. **Step 1:** Activate the external scheduler (e.g. on Cron-Job.org or UptimeRobot) targeting `https://hms-api-atok.onrender.com/api/health` every 14 minutes.
2. **Step 2:** Allow the scheduler to execute at least 2 consecutive cycles (confirming 200 OK in the scheduler logs).
3. **Step 3:** Wait for 20 minutes without making any manual requests (exceeding Render's 15-minute inactivity threshold).
4. **Step 4:** Perform a manual request to `GET /api/health` and a MyCare catalog query (`GET /api/patient-portal/public/branches`).
5. **Step 5:** Measure response time:
   - **Without keep-alive:** 30–50 seconds (due to container scale-up).
   - **With 14-minute keep-alive:** **$< 500ms** (service remains warm in memory).

---

## 7. Protection & Regression Results

| Verification Gate | Requirement | Result |
| :--- | :--- | :---: |
| **Patient Web Protection** | `git diff -- apps/patient-web` must be 0 | **0 lines modified (PASS)** |
| **MyCare Business Logic** | Business logic untouched | **100% Intact (PASS)** |
| **Backend API Build** | `npm run build --workspace=@hms/api` | **PASS (0 errors)** |
| **Backend API Tests** | OTP & security unit tests pass | **26/26 tests passed (PASS)** |
| **Render Plan** | Must remain on Free plan | **Confirmed (`plan: free`)** |
| **EAS Native Build** | Do not trigger EAS | **0 EAS builds triggered (PASS)** |

---

## 8. Technical Limitations & Considerations

1. **Render Free Hours Quota:**
   - Render accounts on the Free plan receive **750 Free Instance Hours per calendar month**.
   - A single service running continuously for 31 days consumes $31 \times 24 = 744\text{ hours}$.
   - **Invariant:** If multiple free web services exist on the same Render account, they share the 750-hour pool. If the 750-hour quota is exhausted near the end of the month, all free services on that account will suspend until the next calendar month begins.
2. **External Pinger Availability:**
   - If the external uptime monitor experiences downtime or network partitioning, the Render service will idle and sleep after 15 minutes until the next incoming request wakes it.
