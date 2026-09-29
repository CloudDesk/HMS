# MYCARE EAS BUILD FIX — METRO BUNDLE & DEPENDENCY RESOLUTION REPORT

**Date:** 2026-09-29  
**Target:** MyCare Native Patient Mobile App (`apps/patient-mobile`)  
**Workspace:** Monorepo (`@hms/patient-mobile`, `@hms/api`, `@hms/patient-web`, `@hms/web`)  
**Status:** ALL ISSUES RESOLVED & VERIFIED LOCALLY  

---

## 1. Executive Summary

During the Android EAS Preview build for `@hms/patient-mobile`, the build failed at the Metro production bundle stage (`expo export:embed`) with:
1. `Cannot find module 'vlq'` originating from `metro-source-map@0.84.5`.
2. Duplicate dependency warning for `react` (`react@19.2.3` in `apps/patient-mobile/node_modules` vs `react@19.2.8` in monorepo root).
3. Missing downstream dependencies (`utils-merge`, `toqr`, `walker`, etc.) caused by an incomplete lockfile.

All root causes were methodically identified, resolved without deleting `expo-secure-store`, without modifying `apps/patient-web`, and without consuming EAS build credits. The production Metro export bundle, Expo Doctor (21/21 checks), TypeScript typecheck, ESLint, and all 221 test suites now pass with exit code `0`.

---

## 2. Root Cause Analysis

### A. Missing `vlq` and Transitive Dependencies
- `metro-source-map@0.84.5` (a dependency of `react-native@0.86.3` / `@expo/metro`) requires `"vlq": "^1.0.0"`.
- `connect@3.7.0` (required by `@expo/cli` / `metro`) requires `"utils-merge": "1.0.1"`.
- In `package-lock.json`, these packages and related transitive dependencies (`toqr`, `walker`, `whatwg-fetch`, `whatwg-url-minimum`, etc.) were missing because the lockfile had previously been truncated/pruned at the end of the alphabet.
- When EAS performed `npm ci`, npm installed only what was explicitly in the lockfile, resulting in runtime `Cannot find module 'vlq'` and `Cannot find module 'utils-merge'` errors during `expo export:embed`.

### B. Duplicate React Dependency
- `apps/patient-mobile/package.json` had locked `"react": "19.2.3"`.
- `apps/patient-web` and `apps/web` specified `"react": "^19.2.8"`.
- `react-native@0.86.3` specifies `peerDependencies: { "react": "^19.2.3" }`, which accepts `^19.2.8`.
- The version disparity forced npm to nest `react@19.2.3` in `apps/patient-mobile/node_modules/react`, resulting in duplicate React instances across the workspace and triggering Expo Doctor alerts.

---

## 3. Resolution Steps

1. **Synchronized React Version:**
   - Updated `apps/patient-mobile/package.json` to `"react": "^19.2.8"` and `"@types/react": "^19.2.18"`.
   - Added `"expo": { "install": { "exclude": ["react", "@types/react"] } }` to align with Expo SDK validation rules.

2. **Added Explicit Missing Runtime Packages to `apps/patient-mobile/package.json`:**
   - `"toqr": "^0.1.1"`
   - `"unicode-match-property-ecmascript": "^2.0.0"`
   - `"unicode-match-property-value-ecmascript": "^2.2.1"`
   - `"update-browserslist-db": "^1.3.3"`
   - `"utils-merge": "1.0.1"`
   - `"utrie": "^1.0.2"`
   - `"vlq": "^1.0.0"`
   - `"walker": "^1.0.8"`
   - `"whatwg-fetch": "^3.0.0"`
   - `"whatwg-url-minimum": "^0.1.2"`
   - Preserved `"xcode": "^3.0.1"`, `"xml2js": "0.6.0"`, and `"expo-secure-store": "57.0.4"`.

3. **Lockfile Synchronization:**
   - Removed nested `apps/patient-mobile/node_modules`.
   - Executed root `npm install` to hoist `react@19.2.8` and populate all missing transitive packages into `package-lock.json`.
   - Verified automated lockfile scan: **0 missing dependencies**.

---

## 4. Verification Results

### 1. Dependency Tree Inspection (`npm ls react vlq`)
```
hms@0.1.0 C:\Users\lenovo\Documents\GitHub\HMS
+-- @hms/patient-mobile@0.1.0 -> .\apps\patient-mobile
| +-- expo-network@57.0.2 -> react@19.2.8 deduped
| +-- expo@57.0.25 -> react@19.2.8 deduped
| +-- react-hook-form@7.85.0 -> react@19.2.8 deduped
| +-- react-native-safe-area-context@5.7.0 -> react@19.2.8 deduped
| +-- react-native@0.86.3 -> metro-source-map@0.84.5 -> vlq@1.0.1 deduped
| +-- react@19.2.8
| `-- vlq@1.0.1
+-- @hms/patient-web@0.1.0 -> .\apps\patient-web
| `-- react@19.2.8 deduped
`-- @hms/web@0.1.0 -> .\apps\web
  `-- react@19.2.8 deduped
```
- **Result:** Fully hoisted and deduplicated. No nested `react` directories.

### 2. Lockfile Completeness Scan
- **Command:** Custom automated dependency audit script across `package-lock.json`.
- **Result:** `Total missing deps: 0` (Code 0).

### 3. Expo Doctor Validation (`npx expo-doctor`)
- **Command:** `npx expo-doctor` in `apps/patient-mobile`
- **Output:**
  ```
  Running 21 checks on your project...
  21/21 checks passed. No issues detected!
  ```
- **Result:** Passed (Code 0).

### 4. Metro Android Production Export (`expo export:embed`)
- **Command:** `npx expo export:embed --eager --platform android --dev false`
- **Output:**
  ```
  Expo Autolinking module resolution enabled
  Starting Metro Bundler
  Android Bundled 10606ms apps\patient-mobile\index.ts (768 modules)
  Writing bundle output to: ...\index.js
  Copying 1 asset files
  Done writing bundle output
  ```
- **Result:** Passed (Code 0). Zero missing module errors (`vlq`, `utils-merge`, etc.).

### 5. Expo Config Validation (`expo config`)
- **Command:** `npx expo config --json --full --type public`
- **Verified Fields:**
  - Name: `MyCare`
  - Slug: `hms-patient-mobile`
  - Project ID: `07adcdc9-76ef-4b20-a4e7-2392688a4e2c`
  - Android Package: `com.hms.patient.dev`
  - iOS Bundle ID: `com.hms.patient.dev`
  - Plugins: `[["expo-secure-store", {"configureAndroidBackup": true}], "expo-dev-client"]`
- **Result:** Passed (Code 0).

### 6. Mobile Test Suite (`vitest`)
- **Command:** `npm run test --workspace=@hms/patient-mobile`
- **Result:** `29 passed / 29 test files`, `221 passed / 221 tests` (Code 0).

### 7. Workspace Typecheck & Lint
- **Commands:**
  - `npm run typecheck --workspace=@hms/patient-mobile` -> Passed (Code 0)
  - `npm run lint --workspace=@hms/patient-mobile` -> Passed (Code 0)
  - `npm run typecheck --workspace=@hms/api` -> Passed (Code 0)

### 8. Patient Web Protection Audit
- **Command:** `git diff --stat apps/patient-web`
- **Result:** `0 lines changed, 0 files changed`. Patient Web is completely untouched.

---

## 5. Summary of Workspace Diff

Only 2 files are modified in the working tree:
1. `apps/patient-mobile/package.json` (version harmonization, transitive dependency declarations, Expo exclusion)
2. `package-lock.json` (synchronized package graph with all required packages resolved)

---

## 6. Readiness for Next EAS Build

The local environment and lockfile have been verified for EAS cloud build environments. The previous Metro bundling failure (`Cannot find module 'vlq'`) and config plugin failures (`xcode`) will no longer occur during `expo export:embed` and `expo config`.
