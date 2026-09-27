# HMS Patient Mobile — Centralized API Error & Diagnostic System

## 1. Overview & Architecture

The HMS Patient Mobile application communicates with the deployed Render backend (`https://hms-api-atok.onrender.com/api`). In mobile environments (especially physical Android and iOS devices), developers and QA testers do not have browser DevTools open. Generic error messages (like `"Unable to connect"`) obscure whether an issue is caused by:
- Device connectivity loss (`NETWORK_ERROR`)
- Backend cold start / slow request (`TIMEOUT`)
- Invalid credentials or OTP (`HTTP_401`)
- Permission or authorization failure (`HTTP_403`)
- Missing route or resource (`HTTP_404`)
- Appointment or account conflict (`HTTP_409`)
- Request parameter validation failure (`HTTP_422`)
- Rate limiting / throttle (`HTTP_429`)
- Server 5xx crash or gateway timeout (`HTTP_5XX`)
- Contract schema mismatch (`INVALID_RESPONSE`)

The Centralized API Error & Diagnostic System provides:
1. **Taxonomy & Classification:** Standardized error categorization.
2. **Correlation Identifiers:** Server `x-request-id` extraction + Client `MOB-XXXXXX` diagnostic ID generation.
3. **Dual Messaging:** Patient-safe, compassionate user messages paired with technical diagnostic metadata.
4. **Security & Redaction:** Guaranteed zero leakage of tokens, cookies, passwords, Mongo IDs, or stack traces.
5. **Physical Device Diagnostic UI (`ErrorDiagnosticView`):** Collapsible technical details with native one-tap "Share / Copy Diagnostic" sheet.

---

## 2. Error Taxonomy & Status Code Mapping

| Error Category | HTTP Status | Retryable | Default Patient Message | Example Codes |
| :--- | :--- | :--- | :--- | :--- |
| `NETWORK_ERROR` | `undefined` | Yes | *Unable to connect. Check your internet connection and try again.* | `NETWORK_ERROR`, `OFFLINE` |
| `TIMEOUT` | `408` / `undefined` | Yes | *The service is taking longer than expected to respond. Please check your connection and try again.* | `TIMEOUT` |
| `HTTP_400` | `400` | No | *Check your details and try again.* | `INVALID_PATH`, `BAD_REQUEST` |
| `HTTP_401` | `401` | No | *Invalid phone number or verification code. Please try again.* (or session expired) | `INVALID_OTP`, `INVALID_CREDENTIALS` |
| `HTTP_403` | `403` | No | *You do not have permission to perform this action. Please check your patient profile.* | `FORBIDDEN`, `WRONG_PATIENT_CONTEXT` |
| `HTTP_404` | `404` | No | *The requested information or service could not be found.* | `NOT_FOUND`, `ROUTE_NOT_FOUND` |
| `HTTP_409` | `409` | No | *This appointment slot is no longer available. Please select another time.* / *Complete account setup in Patient Web.* | `SLOT_ALREADY_BOOKED`, `CONFLICT` |
| `HTTP_422` | `422` | No | *Please check your details and try again.* | `UNPROCESSABLE_ENTITY`, `VALIDATION_ERROR` |
| `HTTP_429` | `429` | Yes (cooldown) | *Too many attempts. Please wait before trying again.* | `AUTH_RATE_LIMITED`, `MAX_ATTEMPTS_EXCEEDED` |
| `HTTP_5XX` | `500..599` | Yes | *Service is temporarily unavailable. Please try again.* | `SERVER_ERROR`, `INTERNAL_SERVER_ERROR`, `GATEWAY_TIMEOUT` |
| `INVALID_RESPONSE` | `200..299` (bad data) | No | *Received an unexpected response from the service. Please try again.* | `CONTRACT_MISMATCH` |
| `UNKNOWN_ERROR` | `undefined` | No | *Unable to complete this action. Please try again.* | `UNKNOWN_ERROR` |

---

## 3. Data Model (`ApiFailure`)

The centralized `ApiFailure` class extends JavaScript's native `Error` and supports both legacy signatures `new ApiFailure(kind, status, code)` and rich options `new ApiFailure(options)`:

```typescript
export class ApiFailure extends Error {
  readonly category: ApiErrorCategory;
  readonly kind: LegacyApiKind; // 'offline' | 'network' | 'server' | 'auth' | 'validation' | 'contract'
  readonly status?: number;
  readonly httpStatus?: number;
  readonly code?: string;
  readonly userMessage: string;
  readonly requestId?: string;    // Server correlation ID from headers/body
  readonly diagnosticId: string; // Unique client ID: MOB-XXXXXX
  readonly endpoint?: string;    // Sanitized path (e.g. POST /patient-portal/appointments)
  readonly method?: string;      // GET | POST | PATCH
  readonly retryable: boolean;
  readonly timestamp: string;    // ISO 8601
  readonly originalError?: unknown;
}
```

---

## 4. Physical Device Diagnostic Export Format

When a tester or patient taps **"Share / Copy Details"**, the system generates a redacted summary suitable for email, messaging, or issue tickets:

```text
--- HMS Mobile Diagnostic Info ---
Diagnostic ID: MOB-8F3A2C
Timestamp: 2026-09-27T18:45:00.000Z
Category: HTTP_429
HTTP Status: 429
Error Code: AUTH_RATE_LIMITED
Server Request ID: req-fastify-492
Endpoint: POST /patient-portal/mobile/auth/login
Retryable: Yes
User Message: Too many attempts. Please wait before trying again.
-----------------------------------
```

### Redaction Rules Enforced:
- No `Authorization: Bearer ...` headers or refresh tokens.
- No raw passwords, OTP inputs, or cookie headers.
- Query parameters and potential token smuggling in paths are stripped and blocked.
- No internal stack traces or database error dumps shown to users.

---

## 5. UI Integration (`ErrorDiagnosticView`)

The `ErrorDiagnosticView` component is integrated across authentication screens (`LoginScreen`, `OtpScreen`), `ErrorScreen`, and available for modal dialogs:

- **Top Banner:** Friendly message + `Ref: MOB-XXXXXX` badge.
- **Action Row:** Retry button (if retryable) + "Technical Details ▼" accordion toggle + Dismiss button.
- **Accordion:** Clean table with Diagnostic ID, Category, HTTP Status, Code, Server Request ID, Endpoint, Timestamp, and Retryability.
- **Share Action:** Native `Share.share` opens Android/iOS native share sheets to copy or export diagnostic logs.
