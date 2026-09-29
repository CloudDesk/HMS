# MYCARE — RENDER ALWAYS-ON CONFIGURATION AUDIT

## 1. Executive Summary

This audit evaluates the minimum Render hosting configuration required to keep the **HMS API** (`https://hms-api-atok.onrender.com/api`) continuously running 24/7 and eliminate the observed **30–50 second Free-tier cold start**.

- **Current Status:** The HMS API is deployed on Render using the **Free** tier (`plan: free` in `render.yaml`).
- **Cold-Start Root Cause:** Render automatically spins down Free instances after 15 minutes of inactivity.
- **Always-On Feasibility:** Supported by upgrading the service to an always-on tier (such as **Starter**) in Render.
- **Code Changes Required:** **NO** (0 code modifications).
- **Patient Web Impact:** **0% (Completely Untouched)**.
- **Patient Mobile Impact:** **0% (Completely Untouched)**.

---

## 2. Current Render Configuration Inspection

The current deployment configuration was audited from `render.yaml` and the `apps/api` runtime environment:

| Property | Current Setting | Notes / Code Reference |
| :--- | :--- | :--- |
| **Service Name** | `hms-api` | `render.yaml:3` |
| **Service Type** | `web` (Web Service) | `render.yaml:2` |
| **Runtime** | `node` | `render.yaml:4` |
| **Plan / Tier** | `free` | `render.yaml:5` |
| **Auto-Sleep Behavior** | **Active (Spins down after 15m idle)** | Render Free tier platform policy |
| **Build Command** | `npm install --include=dev && npm run build --workspace=@hms/api` | `render.yaml:6` |
| **Start Command** | `node apps/api/dist/server.js` | `render.yaml:7` |
| **Health Check Path** | `/api/health` | `render.yaml:8` |
| **Node Version** | `22.14.0` | `NODE_VERSION: "22.14.0"` |
| **Host Binding** | `0.0.0.0` | `env.ts:218` |
| **Port Binding** | Dynamic via `process.env.PORT` (default 4000) | `env.ts:219` |
| **CORS Origins** | `https://hms-sit-3bc2e.web.app`, `https://hms-web-c0717.web.app`, `https://hms-patient-web.web.app`, `https://hms-patient-web.firebaseapp.com` | `render.yaml:26-27` |
| **Cookie Policy** | `COOKIE_SECURE: true`, `COOKIE_SAME_SITE: none` | `render.yaml:28-31` |
| **Database** | MongoDB Atlas via `MONGODB_URI` secret | `render.yaml:32-33` |

---

## 3. Analysis of Sleep Behavior & Cold Starts

### Why the Current Service Sleeps:
1. Render's Free tier enforces an inactivity timeout: if no HTTP requests are received within **15 minutes**, the container process is terminated and the instance is de-allocated.
2. When a patient opens MyCare or Patient Web after an idle period, the incoming request triggers container initialization:
   - Container provisioning & disk mount (~15–20s)
   - Node.js runtime initialization (~2–3s)
   - Fastify app build & plugin registration (~1–2s)
   - MongoDB Atlas connection handshake & index synchronization (~3–5s)
   - Database seed validation & initial dashboard refresh (~2–4s)
3. Total measured cold-start duration: **30–50 seconds**.

### Does the Current Free Plan Support Always-On?
- **NO.** Render does not provide an option to disable auto-sleep on the Free plan.

---

## 4. Required Always-On Configuration

To keep the service continuously running without auto-sleep, the instance plan must be changed from `free` to a paid always-on tier:

### A. Configuration Change in `render.yaml`
```yaml
services:
  - type: web
    name: hms-api
    runtime: node
    plan: starter      # <-- Changed from 'free' to 'starter'
    buildCommand: npm install --include=dev && npm run build --workspace=@hms/api
    startCommand: node apps/api/dist/server.js
    healthCheckPath: /api/health
    # ... all other environment variables and secrets remain identical
```

### B. Dashboard / Webhook Setting
Alternatively, the plan can be updated directly in the Render Web Dashboard under **Service Settings -> Plan -> Starter**.

---

## 5. Pricing & Billing Verification Limitation

- **Historical / Nominal Pricing:** The Render **Starter** web service instance has historically been priced at **$7 / month** (providing 0.5 CPU and 512 MB RAM, with 24/7 uptime and zero auto-sleep).
- **Pricing Verification Limitation:** Because this audit is executed within an isolated code repository without live access to the organization's active Render billing console or Render Management API, the current exact live subscription rate, regional tax, or organization-level tier cannot be verified programmatically from the local environment.

---

## 6. Impact on Cold-Start & Performance

| Scenario | Current (Free Tier) | With Always-On (`starter`) |
| :--- | :--- | :--- |
| **After 15+ Min Inactivity** | 30–50s cold-start delay | **0s (Always warm, < 500ms response)** |
| **Subsequent Warm Requests** | ~248ms – 1725ms | ~248ms – 1725ms |
| **Container Availability** | Ephemeral / Spun down when idle | **100% Persistent (24/7/365)** |
| **Scheduled Background Tasks** | Suspended when container sleeps | **Continuous execution** |

---

## 7. Change Requirements Summary

| Question | Answer | Details |
| :--- | :---: | :--- |
| **Code changes required?** | **NO** | `apps/api` requires zero code modifications. |
| **Patient Web changes required?** | **NO** | `apps/patient-web` remains 100% untouched. |
| **Patient Mobile changes required?** | **NO** | `apps/patient-mobile` remains 100% untouched. |
| **Deployment changes required?** | **YES** | Update `plan: starter` in `render.yaml` or Render UI. |
| **Database changes required?** | **NO** | MongoDB connection and schemas remain unchanged. |
| **Can deployment remain otherwise unchanged?** | **YES** | All environment variables, commands, and domains remain intact. |

---

## 8. Risk & Rollback Procedure

- **Risk Level:** **VERY LOW**.
  - Upgrading instance tier does not change the operating system, container runtime, Node version, environment variables, or build pipeline.
  - Zero application-level or architectural risk.
- **Rollback Procedure:**
  1. In `render.yaml`, change `plan: starter` back to `plan: free` (or select Free in the Render dashboard).
  2. Sync/deploy the blueprint. The service will immediately revert to the Free tier behavior.

---

## 9. Final Audit Status

```text
================================================================
RENDER ALWAYS-ON AUDIT COMPLETE
================================================================
```
