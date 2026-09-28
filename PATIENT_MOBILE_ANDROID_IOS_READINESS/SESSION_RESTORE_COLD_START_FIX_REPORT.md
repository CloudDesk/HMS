# Session Restoration Cold-Start Fix Report — Patient Mobile

**Date:** 28 September 2026  
**Application:** MyCare Patient Mobile (`apps/patient-mobile`)  
**Backend:** Render Backend (`https://hms-api-atok.onrender.com/api`)  
**Branch:** `Dev-F-Release-5-Patient-Portal-Mobile`  
**EAS Build Status:** `EAS build NOT executed.`

---

## 1. Root Cause Summary

When the mobile app launched with an existing saved session while the Render free-tier instance was asleep, the refresh request experienced a cold-start delay of 35–50 seconds.

In the previous implementation:
1. When the HTTP fetch aborted or failed due to timeout/network disruption during the cold start, `SessionManager.rotate()` misclassified the transient connection failure as an unrecoverable `status: 'uncertain'` state.
2. It overwrote the session in SecureStore with `status: 'uncertain'`, transitioned the UI to `status: 'error'`, `recovery: 'reauth'`, and rendered *"Attention Required: We could not confirm your session refresh... Return to Sign In"*.
3. Once stored as `'uncertain'` in SecureStore, all subsequent app launches immediately read `saved.status === 'uncertain'` and permanently blocked any future refresh attempts without user re-authentication.

---

## 2. Before vs After Behavior

| Scenario | Before Fix | After Fix |
| :--- | :--- | :--- |
| **No Stored Session** | Shows Login immediately | Shows Login immediately |
| **Valid Stored Session + Warm Backend** | Refreshes and reaches Home in ~1.5s | Refreshes and reaches Home in ~1.5s |
| **Valid Stored Session + Render Cold Start (Timeout/502/503/504)** | Waited ~40s, wrote `status: 'uncertain'` to SecureStore, locked into `"Attention Required — Return to Sign In"` permanently | Preserves `status: 'ready'` in SecureStore, transitions to recoverable error with `"Retry Connection"` button. Session remains completely valid and intact. |
| **User Taps "Retry Connection"** | Forced to sign in again | Safely retries `refresh()` using the existing single-flight mechanism. Once Render is awake, seamlessly logs in. |
| **App Relaunched after Cold-Start Timeout** | Permanently stuck on `"Attention Required"` | Reads `status: 'ready'` from SecureStore and automatically attempts session restoration afresh. |
| **Explicit 401 / 403 (Invalid / Revoked Session)** | Cleared storage → Login | Cleared storage → Login |

---

## 3. Connection Failure Handling

In [`apps/patient-mobile/src/auth/session-manager.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/auth/session-manager.ts), the catch block in `rotate()` was updated to identify connection-related failures:
- `kind: 'timeout'` / `code: 'TIMEOUT'`
- `kind: 'network'` / `code: 'NETWORK_ERROR'`
- `kind: 'offline'`
- HTTP 429 (`AUTH_RATE_LIMITED`)
- HTTP 502, 503, 504 (or any 500-504 gateway error during server cold-start)

**Handling Rules:**
1. **Preserve Session:** Restores the saved session in SecureStore as `status: 'ready'` (`await this.store.save(saved)`).
2. **Preserve In-Memory State:** Keeps `this.saved = saved` ready for subsequent retries.
3. **Set Recoverable UI State:**
   - `status: 'error'`
   - `recovery: 'restore'`
   - `message: friendlyError(error)`
   - `errorDetails: error`
4. **No Destruction:** Does NOT clear credentials and does NOT write `status: 'uncertain'`.

---

## 4. Authentication Rejection Handling

When the server explicitly rejects the refresh token (`401 INVALID_REFRESH_TOKEN` or `403 SESSION_REVOKED`):
- `invalidate()` is invoked immediately.
- SecureStore is cleared via `this.store.clear()`.
- State transitions to `status: 'unauthenticated'` with message: *"Your session has expired. Please sign in again."*
- User is cleanly returned to the Login screen.

---

## 5. Retry Behavior & In-Flight Recovery

- **Single-Flight Concurrency:** `refreshFlight` promise deduplication ensures multiple concurrent callers (e.g. startup + background hooks + user taps) share a single network request without duplicate rotations.
- **In-Flight Crash Recovery:** In `SessionManager.initialize()`, if a session is read with `status: 'in-flight'` (e.g., if the app was killed while a previous request was mid-air), it safely resets the status to `'ready'` before attempting refresh, eliminating startup deadlocks.

---

## 6. Security Preservation

All existing security controls and invariants are preserved:
- Single-use refresh token rotation with SHA-256 server verification.
- Replay detection and session revocation on token reuse.
- Access tokens remain exclusively in-memory and are never written to disk or SecureStore.
- Installation binding via hardware-isolated UUID marker and SecureStore accessibility flags.
- Zero credential leakage in logs or error diagnostics.

---

## 7. Verification & Test Results

### Automated Unit Tests (`apps/patient-mobile/src/auth/session-manager.test.ts`)

| # | Test Scenario | Result |
| :---: | :--- | :---: |
| 1 | Starts unauthenticated when no saved session exists | **PASS** |
| 2 | Restores authenticated session on startup with valid refresh credential | **PASS** |
| 3 | Preserves stored credential when refresh fails due to timeout (Render cold-start) | **PASS** |
| 4 | Preserves stored credential when refresh fails due to network error | **PASS** |
| 5 | Preserves stored credential and sets restore state on HTTP 502/503/504 gateway errors | **PASS** |
| 6 | Clears storage and sets unauthenticated on definitive auth rejection (401 INVALID_REFRESH_TOKEN) | **PASS** |
| 7 | Clears storage and sets unauthenticated on 403 SESSION_REVOKED | **PASS** |
| 8 | Allows user to retry connection after a timeout and successfully authenticate | **PASS** |
| 9 | Recovers in-flight status to ready on startup without permanently latching into uncertain | **PASS** |
| 10 | Performs single-flight refresh when multiple callers request refresh concurrently | **PASS** |
| 11 | Handles full login flow (request OTP -> verify OTP -> authenticated) | **PASS** |
| 12 | Logout clears local credentials and sets signedOut tombstone | **PASS** |
| 13 | AuthenticatedRequest attaches bearer token and executes | **PASS** |
| 14 | Offline connectivity preserves stored credential with recovery restore | **PASS** |

### Suite Summary

- **Mobile Unit Tests:** `23/23` test suites passed, `141/141` tests passed (`npm test --workspace=@hms/patient-mobile`).
- **Mobile TypeScript Typecheck:** `0` errors (`npm run typecheck --workspace=@hms/patient-mobile`).
- **Mobile ESLint:** `0` errors, `0` warnings (`npm run lint --workspace=@hms/patient-mobile`).
- **Protected `apps/patient-web`:** `git diff --stat apps/patient-web` is **0** (100% untouched).
- **Backend Protection:** No backend changes introduced in this cold-start fix.
- **EAS Build Isolation:** **0** EAS cloud builds executed.
