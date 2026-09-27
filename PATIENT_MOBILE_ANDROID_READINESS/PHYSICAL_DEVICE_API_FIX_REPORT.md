# Physical Android API Fix Report

## 1. Root Cause

The previously generated Preview APK contained the emulator loopback address `http://10.0.2.2:4000/api` because `EXPO_PUBLIC_HMS_API_URL` was not configured in `eas.json` during the cloud build. On a physical Android device, `10.0.2.2` cannot route to any host, causing the mobile transport layer to immediately fail with `"Unable to connect. Check your internet connection and try again."`

---

## 2. API Configuration Update

- **Previous API URL in Preview Build:** `http://10.0.2.2:4000/api` (Emulator fallback)
- **New API URL for Preview & Production:** `https://hms-api-atok.onrender.com/api` (Deployed Render backend, identical to Patient Web)
- **Configuration Files Changed:**
  - `apps/patient-mobile/eas.json`: Injected `EXPO_PUBLIC_HMS_ENV: "production"` and `EXPO_PUBLIC_HMS_API_URL: "https://hms-api-atok.onrender.com/api"` into the `preview` and `production` build profiles.
- **EAS Build Environment:** `preview` profile with `android.buildType = "apk"` and `env` parameters configured.

---

## 3. Patient Web Protection

- **Patient Web modified:** **NO**
- **Patient Web diff:** **CLEAN (0 modifications)**
- **Patient Web configuration:** Preserved unchanged (`VITE_APP_ENV=prod`, `VITE_API_BASE_URL=https://hms-api-atok.onrender.com/api`).

---

## 4. Verification Results

| Check | Command | Result |
|---|---|---|
| **Mobile Test Suite** | `npm test --workspace=@hms/patient-mobile` | **PASS (21 files, 103 tests passed, 0 failed)** |
| **Mobile Typecheck** | `npm run typecheck --workspace=@hms/patient-mobile` | **PASS (0 errors)** |
| **Mobile Lint** | `npm run lint --workspace=@hms/patient-mobile` | **PASS (0 errors, 0 warnings)** |
| **Native Bundle Export** | `npm run export:native --workspace=@hms/patient-mobile` | **PASS (iOS & Android Hermes bytecode bundles)** |
| **Patient Web Diff** | `git diff -- apps/patient-web` | **PASS (0 diffs, 100% clean)** |

---

## 5. Build & Physical Device Testing Status

- **New APK Built:** **PENDING MANUAL USER COMMAND EXECUTION** (EAS cloud build must be triggered via local terminal).
- **APK Build Status:** Ready to build.
- **Physical Android Test Status:** Awaiting new APK build and device installation.
- **OTP Request Status:** Target endpoint configured to `POST https://hms-api-atok.onrender.com/api/patient-portal/otp/request`.
- **Login Status:** Fixed verification code `1234` configured for authentication.

---

## 6. Manual Build Command for User

Run this command in your local interactive terminal to generate the updated standalone APK with the Render backend:

```bash
cd apps/patient-mobile
npx eas build --profile preview --platform android
```

---

## 7. Remaining Limitations

- **Physical Device Validation:** Must be completed on the physical Android phone after installing the newly generated APK.
- **Online Payment:** `ONLINE PAYMENT NOT AVAILABLE IN CURRENT HMS PAYMENT CONTRACT`.
- **Native Push:** `Native Push: NOT AVAILABLE IN CURRENT HMS PUSH CONTRACT` (In-app Notification Center fully operational).
