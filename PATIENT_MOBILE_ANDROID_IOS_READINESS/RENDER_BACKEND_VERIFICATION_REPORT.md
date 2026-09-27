# Render Backend Verification Report

## Required Backend

`https://hms-api-atok.onrender.com/api`

---

## Patient Web

- **Existing API Base URL:** `https://hms-api-atok.onrender.com/api` (`VITE_API_BASE_URL` in production)
- **Patient Web changed:** **NO**
- **Patient Web diff result:** **CLEAN (0 modifications)**

---

## Android

- **Preview EAS Environment:** Configured in `apps/patient-mobile/eas.json` (`preview` profile `env` block).
- **Resolved API URL:** `https://hms-api-atok.onrender.com/api`
- **Old `10.0.2.2` Fallback Status:** **Eliminated** from standalone preview and production builds.
- **Typecheck:** **PASS (0 errors)**
- **Lint:** **PASS (0 errors, 0 warnings)**
- **Tests:** **PASS (21 test files, 103 passed tests)**
- **APK Build Status:** Ready for cloud build (`npx eas build --profile preview --platform android`).
- **Physical-Device Status:** Awaiting new APK build and real-device testing.

---

## iOS

- **Preview EAS Environment:** Configured in `apps/patient-mobile/eas.json` (`preview` profile `env` block).
- **Resolved API URL:** `https://hms-api-atok.onrender.com/api`
- **Platform-Specific Override Status:** **None exist** (zero platform-specific API branching; iOS and Android use identical configuration).
- **Typecheck:** **PASS (0 errors)**
- **Lint:** **PASS (0 errors, 0 warnings)**
- **Tests:** **PASS (21 test files, 103 passed tests)**
- **iOS Build Status:** Ready for cloud build (`npx eas build --profile preview --platform ios`).
- **Physical-Device Status:** Awaiting iOS build and physical device installation.

---

## Configuration Findings

Both **Android Preview** and **iOS Preview** builds are unified and configured to connect directly to:

```text
https://hms-api-atok.onrender.com/api
```

- **URL Joining:** Base URL `https://hms-api-atok.onrender.com/api` + endpoint path `/patient-portal/otp/request` resolves to `https://hms-api-atok.onrender.com/api/patient-portal/otp/request` with zero duplicate `/api/api` prefixes.
- **No Local Fallbacks in Preview/Production:** Neither `10.0.2.2`, `localhost`, nor local LAN IP addresses will be bundled into Preview or Production builds.

---

## Commands for Build Execution

### Android Preview Standalone APK:
```bash
cd apps/patient-mobile
npx eas build --profile preview --platform android
```

### iOS Preview Build:
```bash
cd apps/patient-mobile
npx eas build --profile preview --platform ios
```

---

## Remaining Limitations & Status

| Milestone | Status | Details |
|---|---|---|
| **Configuration Verification** | **VERIFIED & READY** | `eas.json` and `src/config/config.ts` validated for both platforms. |
| **Hermes Native Bundle Export** | **VERIFIED & READY** | iOS and Android Hermes bytecode bundles export cleanly. |
| **Cloud Build Execution** | **PENDING USER COMMAND** | User must trigger `npx eas build` in their local terminal. |
| **Physical Android Testing** | **PENDING DEVICE QA** | To be performed after installing the newly generated APK. |
| **Physical iOS Testing** | **PENDING DEVICE QA** | To be performed after installing the newly generated iOS build. |
