# MyCare — EAS Build Fix: `expo-secure-store` Config Plugin / `xcode` Resolution Report

**Date:** 29 September 2026  
**Repository Branch:** `Dev-F-Release-5`  
**Target Application:** `@hms/patient-mobile` (MyCare Native Patient Mobile App)

---

## 1. Exact EAS Failure

During the remote EAS build execution on Expo Application Services, the build failed during the config evaluation stage (`expo config --json --full --type public`):

```
Unable to resolve a valid config plugin for expo-secure-store.
Cannot find module 'xcode'
Require stack:
- /home/expo/workingdir/build/node_modules/expo-secure-store/app.plugin.js
- /home/expo/workingdir/build/node_modules/@expo/config-plugins/build/plugins/withStaticPlugin.js
- /home/expo/workingdir/build/node_modules/@expo/config-plugins/build/plugins/withPlugins.js
- /home/expo/workingdir/build/node_modules/@expo/config-plugins/build/index.js
- /home/expo/workingdir/build/node_modules/expo/config-plugins.js
```

---

## 2. Root Cause Analysis

1. **Config Plugin Dependency Structure:**  
   `expo-secure-store` (version `57.0.4`) ships with an Expo Config Plugin (`app.plugin.js`) that configures native iOS/Android permissions and backup behavior (`configureAndroidBackup: true`).
2. **`@expo/config-plugins` Architecture:**  
   `@expo/config-plugins` (version `57.0.9`) lists `"xcode": "^3.0.1"` and `"xml2js": "0.6.0"` in its `dependencies` to parse and modify native iOS Xcode project files (`.pbxproj`) and XML property lists/manifests.
3. **Lockfile Desynchronization:**  
   In `package-lock.json` (`lockfileVersion: 3`), `node_modules/xcode` and `node_modules/xml2js` were omitted/pruned during previous lockfile updates.
4. **EAS Cloud Runner Behavior:**  
   When EAS executes `npm ci` in cloud containers, `npm ci` strictly adheres to `package-lock.json`. Because `xcode` was missing from `package-lock.json`, `npm ci` never installed `xcode`, causing `expo-secure-store/app.plugin.js` to fail immediately when evaluated by the Expo CLI.

---

## 3. Package & Expo SDK Versions

- **Expo SDK Version:** `57.0.25` (Expo SDK 57)
- **`expo-secure-store` Version:** `57.0.4`
- **`@expo/config-plugins` Version:** `57.0.9`
- **`react` Version:** `19.2.3`
- **`react-native` Version:** `0.86.3`
- **`xcode` Version:** `3.0.1` (Directly declared and locked)
- **`xml2js` Version:** `0.6.0` (Directly declared and locked)

---

## 4. Fix Applied

1. Declared `"xcode": "^3.0.1"` and `"xml2js": "0.6.0"` under `dependencies` in `apps/patient-mobile/package.json`.
2. Synchronized `package-lock.json` via `npm install --package-lock-only`, ensuring `node_modules/xcode` and `node_modules/xml2js` are formally recorded as top-level production packages for `@hms/patient-mobile`.
3. Kept `expo-secure-store` in `plugins: [['expo-secure-store', { configureAndroidBackup: true }]]` within `apps/patient-mobile/app.config.ts` without weakening security, removing the plugin, or replacing SecureStore with AsyncStorage.

---

## 5. Files Changed

1. `apps/patient-mobile/package.json` — Added `xcode` and `xml2js` dependencies.
2. `package-lock.json` — Synchronized with resolved package definitions for `node_modules/xcode` and `node_modules/xml2js`.

---

## 6. Local Verification Results

### A. Expo Config Evaluation (`npx expo config --json --full --type public`)
- **Exit Code:** `0` (Success)
- **Resolved Configuration Output:**
  - **App Name:** `MyCare`
  - **Slug:** `hms-patient-mobile`
  - **Android Package:** `com.hms.patient.dev`
  - **iOS Bundle ID:** `com.hms.patient.dev`
  - **EAS Project ID:** `07adcdc9-76ef-4b20-a4e7-2392688a4e2c`
  - **Config Plugins:** `[["expo-secure-store",{"configureAndroidBackup":true}],"expo-dev-client"]`
  - **SDK Version:** `57.0.0`

### B. Mobile Automated Tests (`npm run test --workspace=@hms/patient-mobile`)
- **Status:** **PASS**
- **Test Files:** 29 passed (29 total)
- **Tests:** 221 passed (221 total)
- **Coverage Includes:** SecureStore session management, authentication API, cascading appointment selection, date formatting, dental stages/quotations, and consent management.

### C. Mobile Typecheck (`npm run typecheck --workspace=@hms/patient-mobile`)
- **Status:** **PASS** (0 TypeScript errors)

### D. Mobile Lint (`npm run lint --workspace=@hms/patient-mobile`)
- **Status:** **PASS** (0 ESLint errors)

### E. Backend Typecheck (`npm run typecheck --workspace=@hms/api`)
- **Status:** **PASS** (0 TypeScript errors)

### F. Patient Web Protection (`git diff --stat apps/patient-web`)
- **Status:** **0 lines changed** (Protected and untouched).

---

## 7. Preview API Environment Verification

- **Profile:** `preview` in `apps/patient-mobile/eas.json`
- **`EXPO_PUBLIC_HMS_ENV`:** `production`
- **`EXPO_PUBLIC_HMS_API_URL`:** `https://hms-api-atok.onrender.com/api`
- **Safety Invariant:** Runtime config schema in `apps/patient-mobile/src/config/config.ts` requires HTTPS and strictly disables fallback to local IP (`10.0.2.2`) when `environment !== 'development'`.

---

## 8. EAS Readiness Decision

# **READY FOR NEXT EAS BUILD**

The missing `xcode` and `xml2js` dependencies required by `@expo/config-plugins` during `expo-secure-store` evaluation have been added and locked in `package-lock.json`. `expo config --json --full --type public` executes with code 0 locally and will now install and evaluate cleanly on EAS cloud runners.
