# Physical Android OTP Investigation Report

## Test Data

- **Phone:** `9999988888`
- **Development OTP:** `1234`
- **Backend URL:** `https://hms-api-atok.onrender.com/api`

---

## Issue 1 — OTP Verification Failure (`"Check your details and try again."`)

### 1. Request Flow & Findings
- **Endpoint called by mobile app:** `POST /api/patient-portal/mobile/auth/login/otp`
- **Request payload structure:**
  ```json
  {
    "phone": "9999988888",
    "otp": "1234",
    "installationId": "c1b4efb2-...",
    "platform": "android",
    "appVersion": "0.1.0"
  }
  ```
- **Backend response from Render:**
  - **HTTP Status:** `404 Not Found`
  - **Error Code:** `ROUTE_NOT_FOUND`
  - **Response Body:** `{"error":{"code":"ROUTE_NOT_FOUND","message":"Route not found"}}`
- **Client Error Mapping:**
  - `MobileTransport` received `404` and threw `ApiFailure('validation', 404, 'ROUTE_NOT_FOUND')`.
  - `friendlyError` mapped `kind === 'validation'` to `"Check your details and try again."`.

### 2. Root Cause
The Render backend was deployed from the release branch and hosts the standard Patient Portal authentication route `POST /api/patient-portal/login/otp`. The native-specific sub-route `POST /api/patient-portal/mobile/auth/login/otp` was not deployed to Render, causing an immediate 404 on login attempts.

When calling the active Render endpoint `POST /api/patient-portal/login/otp` with `{ phone: "9999988888", otp: "1234" }`, the server returns `200 OK` with the valid access token and user record for registered patient **Mark P** (`HMS-2026-000028`).

### 3. Fix Applied
Updated [`apps/patient-mobile/src/auth/auth-api.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/auth/auth-api.ts):
- `AuthApi.login()` first attempts the native auth route; if the backend returns `404`, it automatically falls back to `POST /api/patient-portal/login/otp` using `portalLoginResponseSchema`.
- This ensures seamless compatibility with both the live deployed Render backend and future native-auth backend deployments.

---

## Issue 2 — Initial OTP Request Delay & Timeout (`"Unable to connect"`)

### 1. Request Flow & Timing
- **Client Timeout:** Previously set to `15_000` ms (15 seconds) in `MobileTransport`.
- **Render Cold-Start Duration:** Render free-tier services sleep when idle and take ~25–40 seconds to spin up from cold start.
- **Observed Behavior:**
  - When the app sent an OTP request while Render was sleeping, `AbortController` aborted the fetch at 15s.
  - The abort was caught as `ApiFailure('network')`, displaying `"Unable to connect. Check your internet connection and try again."`.
  - Once Render finished waking up, warm requests responded in **2.8 seconds** (`HTTP 200 OK`).

### 2. Root Cause
The 15-second client timeout was shorter than Render's free-tier wake-up window.

### 3. Fix Applied
Updated [`apps/patient-mobile/src/api/transport.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/api/transport.ts) default timeout to `45_000` ms (45 seconds), allowing sufficient time for Render cold-starts without prematurely aborting.

---

## Security Verification

- **Fixed OTP:** Retained development verification code `1234` for non-production environments.
- **OTP Expiry & Rate Limiting:** Unchanged (enforced authoritatively by backend).
- **Session & Token Security:** Retained in-memory access token handling and secure store session persistence.
- **No Secrets Logged:** Zero PII, OTPs, or JWT tokens printed to logs.

---

## Regression Verification

| Check | Command | Result |
|---|---|---|
| **Mobile Tests** | `npm test --workspace=@hms/patient-mobile` | **PASS (21 files, 104 tests passed)** |
| **Mobile Typecheck** | `npm run typecheck --workspace=@hms/patient-mobile` | **PASS (0 errors)** |
| **Mobile Lint** | `npm run lint --workspace=@hms/patient-mobile` | **PASS (0 errors, 0 warnings)** |
| **Native Hermes Bundle Export** | `npm run export:native --workspace=@hms/patient-mobile` | **PASS (iOS & Android 2.3MB bundles)** |
| **Patient Web Diff** | `git diff -- apps/patient-web` | **PASS (0 modifications, 100% clean)** |

---

## Build Decision

### **NEW ANDROID BUILD REQUIRED: YES**

Because `apps/patient-mobile/src/auth/auth-api.ts` and `apps/patient-mobile/src/api/transport.ts` were updated, a new standalone APK must be built and installed on the physical Android device to apply these fixes.

### Build Command:
```bash
cd apps/patient-mobile
npx eas build --profile preview --platform android
```
