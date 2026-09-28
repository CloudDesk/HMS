# PATIENT MOBILE — "MYCARE" BRANDING IMPLEMENTATION REPORT

**Date:** 2026-09-27  
**Workspace:** `@hms/patient-mobile`  
**Target Platform:** Android & iOS  

---

## 1. User-Facing Branding

- **Old Product Name:** `HMS Patient`
- **New Product Name:** `MyCare`
- **Tagline:** `Your care, connected.`

---

## 2. Updated Areas & Files

| Component / Configuration | File Path | Previous Text / Setting | Updated Text / Setting |
|---|---|---|---|
| **Expo App Name / Display Name** | `apps/patient-mobile/app.config.ts` | `name: 'HMS Patient'` | `name: 'MyCare'` |
| **Android App Label** | `apps/patient-mobile/app.config.ts` | Displays "HMS Patient" | Displays "MyCare" (via `name`) |
| **iOS Display Name** | `apps/patient-mobile/app.config.ts` | Displays "HMS Patient" | Displays "MyCare" (via `name`) |
| **Brand Logo Component** | `apps/patient-mobile/src/ui/components/BrandLogo.tsx` | `<Text>HMS Patient</Text>` | `<Text>MyCare</Text>` |
| **OTP Verification Screen** | `apps/patient-mobile/src/ui/screens/OtpScreen.tsx` | `Verify your mobile number` | `Verify your MyCare account` |
| **Home Screen Sign Out** | `apps/patient-mobile/src/ui/screens/HomeScreen.tsx` | `Are you sure you want to sign out of HMS Patient?` | `Are you sure you want to sign out of MyCare?` |
| **Profile Screen Sign Out** | `apps/patient-mobile/src/ui/screens/ProfileScreen.tsx` | `Are you sure you want to sign out of HMS Patient?` | `Are you sure you want to sign out of MyCare?` |
| **Splash Screen Branding** | `apps/patient-mobile/assets/splash.png` & `BrandLogo` | Minimal graphical cross emblem | Pure graphical healthcare emblem with "MyCare" |

---

## 3. Brand References Classification & Inventory

All occurrences across `apps/patient-mobile` were audited and classified:

### A. USER-FACING PRODUCT BRANDING (Updated to "MyCare")
- `app.config.ts`: App name -> `MyCare`
- `BrandLogo.tsx`: Title -> `MyCare`
- `OtpScreen.tsx`: Header -> `Verify your MyCare account`
- `HomeScreen.tsx`: Sign-out modal prompt -> `Are you sure you want to sign out of MyCare?`
- `ProfileScreen.tsx`: Sign-out modal prompt -> `Are you sure you want to sign out of MyCare?`

### B. INTERNAL TECHNICAL IDENTIFIERS (Preserved 100% Unchanged)
- **NPM Package:** `@hms/patient-mobile` in `package.json`
- **Directory Path:** `apps/patient-mobile/`
- **Expo Slug:** `hms-patient-mobile` in `app.config.ts`
- **Expo Owner:** `hmsapps` in `app.config.ts`
- **EAS Project ID:** `07adcdc9-76ef-4b20-a4e7-2392688a4e2c`
- **Android Package / ID:** `com.hms.patient.dev`
- **iOS Bundle Identifier:** `com.hms.patient.dev`
- **Environment Variables:** `EXPO_PUBLIC_HMS_ENV`, `EXPO_PUBLIC_HMS_API_URL` in `eas.json` and `src/config/config.ts`
- **Storage Keys & Keychain:** `hms.patient.native-session.v1`, `hms.patient.mobile`, `hms-installation.json` in `src/storage/native-storage.ts`
- **Technical Diagnostics:** `--- HMS Mobile Diagnostic Info ---` in `src/api/errors.ts`

### C. TEST FIXTURES & DATA (Preserved Unchanged)
- `src/portal/patient-context.test.ts`: `patient_number: 'HMS-2026-000001'`
- `src/portal/portal-api.test.ts`: `patient_number: 'HMS-2026-000001'`
- `src/documents/contracts.test.ts`: `provider_name: 'HMS Central Hospital'`
- `src/documents/documents-api.test.ts`: `provider_name: 'HMS Diagnostics'`
- `src/billing/billing-api.test.ts`: `email: 'info@hms.local'`

---

## 4. Internal Identity & Invariant Confirmations

- **`@hms/patient-mobile`**: UNCHANGED
- **`apps/patient-mobile`**: UNCHANGED
- **HMS API URL (`https://hms-api-atok.onrender.com/api`)**: UNCHANGED
- **Backend Routes & Contracts**: UNCHANGED
- **EAS Project Identity (`@hmsapps/hms-patient-mobile`)**: UNCHANGED
- **Package & Bundle IDs (`com.hms.patient.dev`)**: UNCHANGED
- **Authentication & Session Logic**: UNCHANGED
- **Fixed OTP `1234` Support**: UNCHANGED

---

## 5. Verification Results

| Check | Command | Result | Details |
|---|---|---|---|
| **Unit Tests** | `npm test --workspace=@hms/patient-mobile` | **PASS (100%)** | 23 test files passed, 133 tests passed |
| **TypeScript Typecheck** | `npm run typecheck --workspace=@hms/patient-mobile` | **PASS** | 0 errors |
| **ESLint** | `npm run lint --workspace=@hms/patient-mobile` | **PASS** | 0 errors, 0 warnings |
| **Patient Web Protection** | `git diff -- apps/patient-web` | **PASS** | 0 changes (clean) |

---

## 6. EAS Build Protection

> **EAS cloud build NOT executed.**  
> Zero EAS build credits or cloud builds were consumed during this branding update.
