# Implementation Report: Centralized API Error & Diagnostic System

**Date:** 27 September 2026  
**Workspace:** `@hms/patient-mobile`  
**Branch:** `Dev-F-Release-5-Patient-Portal-Mobile`  

---

## 1. Executive Summary

A centralized API error handling and diagnostic system has been implemented for `@hms/patient-mobile`. This resolves physical device troubleshooting bottlenecks by providing transparent diagnostic metadata (`diagnosticId`, `requestId`, `category`, `status`, `endpoint`, `timestamp`, `retryable`) while keeping patient-facing error messages empathetic, safe, and actionable.

---

## 2. Verification Checklist & Compliance

| Rule / Requirement | Status | Verification Evidence |
| :--- | :--- | :--- |
| **Patient Web Protection** | **PASS** | `git diff -- apps/patient-web` returns 0 diffs. |
| **Backend Code Unchanged** | **PASS** | No modifications to `apps/api` or backend domain code. |
| **No EAS Build Consumed** | **PASS** | 0 EAS cloud builds triggered during implementation/testing. |
| **Render Backend Configuration** | **PASS** | `EXPO_PUBLIC_HMS_API_URL=https://hms-api-atok.onrender.com/api` preserved. |
| **Fixed OTP (1234)** | **PASS** | No changes to OTP behavior or authentication rules. |
| **Security & Redaction** | **PASS** | Tokens, passwords, cookies, and Mongo stack traces strictly omitted from diagnostics. |
| **Backward Compatibility** | **PASS** | All existing tests and legacy `ApiFailure(kind, status, code)` calls pass. |
| **Typecheck & Lint** | **PASS** | `tsc --noEmit` (0 errors), `eslint .` (0 errors). |
| **Test Suite** | **PASS** | 22 test files, 124 unit/integration tests passing. |

---

## 3. Implemented Components & Files

### 1. `apps/patient-mobile/src/api/errors.ts`
- Added 12 error categories (`NETWORK_ERROR`, `TIMEOUT`, `HTTP_400`, `HTTP_401`, `HTTP_403`, `HTTP_404`, `HTTP_409`, `HTTP_422`, `HTTP_429`, `HTTP_5XX`, `INVALID_RESPONSE`, `UNKNOWN_ERROR`).
- Client diagnostic ID generator: `generateDiagnosticId()` (`MOB-XXXXXX`).
- Enhanced `ApiFailure` class supporting both legacy arguments and options object.
- Helper functions: `friendlyError`, `getDiagnosticId`, `isRetryable`, `formatDiagnosticDetails`, `toApiFailure`.

### 2. `apps/patient-mobile/src/api/transport.ts`
- Separated timeout vs offline network error detection via `AbortController` timer.
- Server correlation ID extraction: `x-request-id` header & JSON `error.requestId` / `requestId`.
- Error payload parsing: extracts server `error.code` and `error.message`.
- Method and sanitized endpoint tracking on all failures.

### 3. `apps/patient-mobile/src/ui/components/ErrorDiagnosticView.tsx`
- Reusable diagnostic UI component with banner, reference ID badge, and "Technical Details" accordion.
- Integrated native `Share.share` for one-tap diagnostic copy/sharing on Android & iOS.
- Optional retry action for retryable network/timeout/5xx errors.

### 4. Screen Updates
- `LoginScreen.tsx` & `OtpScreen.tsx`: Integrated `ErrorDiagnosticView` for instant error diagnostics on physical devices.
- `session-manager.ts`: Stores normalized `errorDetails: ApiFailure` on `AuthState`.

### 5. Automated Tests
- `apps/patient-mobile/src/api/errors.test.ts`: 17 unit tests covering taxonomy, legacy constructors, diagnostic IDs, user messages, redaction, and helper normalization.
- `apps/patient-mobile/src/api/transport.test.ts`: 8 integration tests covering status mappings, timeout vs network errors, request ID extraction, and contract mismatch.

---

## 4. Test & Quality Summary

```text
> @hms/patient-mobile@0.1.0 test
> vitest run --config vitest.config.ts

Test Files  22 passed (22)
Tests       124 passed (124)
Duration    8.10s

> @hms/patient-mobile@0.1.0 typecheck
> tsc --noEmit
(0 errors)

> @hms/patient-mobile@0.1.0 lint
> eslint .
(0 errors)
```
