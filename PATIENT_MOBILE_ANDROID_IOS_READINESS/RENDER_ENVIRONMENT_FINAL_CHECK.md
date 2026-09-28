# Render Environment Final Check

## Result

**PASS**

---

## Preview API URL

- **Expected:** `https://hms-api-atok.onrender.com/api`
- **Actual:** `https://hms-api-atok.onrender.com/api`

---

## Preview Configuration Source

The Preview API URL is explicitly configured in `apps/patient-mobile/eas.json` under the `build.preview.env` configuration block:

```json
"preview": {
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  },
  "env": {
    "EXPO_PUBLIC_HMS_ENV": "production",
    "EXPO_PUBLIC_HMS_API_URL": "https://hms-api-atok.onrender.com/api"
  }
}
```

At runtime, `readPublicConfig()` in `apps/patient-mobile/src/config/config.ts` reads:
1. `process.env.EXPO_PUBLIC_HMS_ENV` -> `'production'`
2. `process.env.EXPO_PUBLIC_HMS_API_URL` -> `'https://hms-api-atok.onrender.com/api'`

The configuration is validated via Zod schema (`publicConfigSchema`):
- Trims any trailing slashes (`.transform((url) => url.replace(/\/+$/, ''))`).
- Validates protocol is strict `https:` for production/preview environments.
- Enforces that the pathname ends with `/api`.

---

## Local/Private URL Search

A comprehensive search across `apps/patient-mobile` (excluding `node_modules` and `.expo`) for `localhost`, `127.0.0.1`, `10.0.2.2`, `10.0.3.2`, `192.168.*`, `10.*` yielded the following findings:

| Pattern | Match Location | Classification / Context | Affects Preview Build? |
|---|---|---|---|
| `localhost` | None | None | **NO** |
| `127.0.0.1` | `environment.example:4` | Example documentation comment only | **NO** |
| `10.0.2.2` | `environment.example:5` | Example documentation file only | **NO** |
| `10.0.2.2` | `src/config/config.ts:18` | Fallback only when `environment === 'development'` and `EXPO_PUBLIC_HMS_API_URL` is undefined | **NO** (Preview sets `environment='production'`) |
| `10.0.2.2` | `src/api/transport.test.ts` | Vitest unit test mock fixture only | **NO** |
| `10.0.2.2` | `src/auth/session-manager.test.ts` | Vitest unit test mock fixture only | **NO** |
| `10.0.2.2` | `src/storage/session-store.test.ts` | Vitest unit test mock fixture only | **NO** |
| `10.0.3.2` | None | None | **NO** |
| `192.168.*` | None | None | **NO** |

**Conclusion:** Zero local, private, or LAN overrides affect the Preview build.

---

## API URL Construction

In `apps/patient-mobile/src/api/transport.ts`:
- **Base URL:** `this.config.apiBaseUrl` = `https://hms-api-atok.onrender.com/api` (guaranteed no trailing slash).
- **Request Path:** Must begin with `/` (e.g. `/patient-portal/otp/request`).
- **Joining Formula:** `${this.config.apiBaseUrl}${path}`

### Example Construction:
- **Base URL:** `https://hms-api-atok.onrender.com/api`
- **Path:** `/patient-portal/otp/request`
- **Resulting Endpoint:** `https://hms-api-atok.onrender.com/api/patient-portal/otp/request`
- **Verification:** No double `/api`, no missing `/api`, no double slashes (`//`).

---

## EAS Preview

1. **Definition:** Defined in `eas.json` under `build.preview.env`.
2. **Resolution & Inlining:** During `eas build --profile preview`, the Expo/Metro bundler inlines `process.env.EXPO_PUBLIC_HMS_API_URL` as a string literal constant into the compiled Android JavaScript bundle (`index.android.bundle`).
3. **Physical APK Execution:** When the installed APK runs on a physical Android device, `readPublicConfig()` retrieves the compiled Render URL directly from the Hermes bundle with no dependency on local servers or LAN IPs.

---

## Render Reachability

- **Status:** **PASS**
- **Tested Endpoint:** `https://hms-api-atok.onrender.com/api/health`
  - **HTTP Response:** `200 OK`
  - **Payload:** `{"status": "ok", "service": "hms-api", "environment": "prod"}`
  - **Response Time:** < 1.2 seconds
- **Database Health:** `https://hms-api-atok.onrender.com/api/health/db`
  - **HTTP Response:** `200 OK`
  - **Payload:** `{"status": "ok", "database": "hms"}`

---

## Patient Web

**0 changes** (`git diff -- apps/patient-web` produced 0 diffs).

---

## Backend

**0 changes** (`git diff -- apps/api` produced 0 diffs).

---

## Files Modified

**NONE** (Read-only verification; only this report document was written).

---

## EAS Build

**NOT EXECUTED.** (0 EAS builds or cloud credits consumed).

---

## Final Decision

### **SAFE TO CREATE EAS PREVIEW BUILD**
