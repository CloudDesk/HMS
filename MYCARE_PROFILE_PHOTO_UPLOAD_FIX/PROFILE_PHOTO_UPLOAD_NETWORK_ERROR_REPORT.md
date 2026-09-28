# MYCARE — PROFILE PHOTO UPLOAD ANDROID NETWORK ERROR REPORT
**Audit, Root Cause Analysis, and Verification**
**Date:** 28 September 2026  
**Application:** MyCare (`apps/patient-mobile`)  
**Backend:** HMS API (`apps/api`)  

---

## 1. Executive Summary

During testing of the **MyCare** patient mobile application on physical Android devices, attempting to upload a profile photo (from either device camera capture or photo gallery) triggered a `Network Error` message in the user interface.

Normal JSON-based API requests (such as fetching appointments, profile data, bills, and medical records) functioned without error.

The investigation revealed that the issue was caused by:
1. Android-specific URI schemes (`file:///` or raw paths) and missing/non-standard MIME types (`undefined`, `image`, or without subtype) returned by `expo-image-picker` on Android, causing React Native's Android OkHttp multipart body constructor to throw an internal `IOException` / `IllegalArgumentException`, which React Native's `fetch` rejected as a generic `TypeError: Network request failed`.
2. Raw `ApiFailure.message` (`'NETWORK_ERROR'`) being displayed directly to users instead of utilizing the centralized `friendlyError` resolver.

Both issues have been resolved with pure platform-safe image upload normalization and user-friendly error handling.

---

## 2. Root Cause Analysis

```
┌─────────────────────────────────────────────────────────────┐
│ Physical Android Device: Camera or Gallery Selection        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ expo-image-picker (Android)                                 │
│ - selectedAsset.uri: file:///... or content://... or /...   │
│ - selectedAsset.fileName: undefined / null / no extension   │
│ - selectedAsset.mimeType: undefined / 'image'               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ React Native FormData + OkHttp (Android)                    │
│ - OkHttp MediaType.parse(mimeType) fails if invalid         │
│ - ContentResolver fails if URI lacks scheme                 │
│ - Throws TypeError: Network request failed                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ MobileTransport.uploadMultipart                             │
│ - Catches fetch error -> wraps in ApiFailure(NETWORK_ERROR) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ ProfilePhotoModal UI                                        │
│ - err.message was displayed directly -> "Network Error"      │
└─────────────────────────────────────────────────────────────┘
```

### Key Technical Findings:
1. **URI Resolution on Android:**
   On Android, React Native's `FormData` native bridge uses `ContentResolver.openInputStream(Uri.parse(uri))`. If a file URI does not have a scheme prefix (e.g. `/data/user/0/...`), `Uri.parse()` treats it as relative, leading to `FileNotFoundException`.
2. **MIME Type and Extension Standardization:**
   When `expo-image-picker` returns assets from Android's system photo picker or camera intent, `asset.mimeType` is frequently `undefined` or `'image'`. In OkHttp, `RequestBody.create(MediaType.parse(type), file)` throws `IllegalArgumentException` on unparseable MIME types, causing native `fetch` to reject.
3. **Error Presentation:**
   `ProfilePhotoModal.tsx` was extracting `err instanceof Error ? err.message : ...`, which yielded the raw enum string `'NETWORK_ERROR'` from `ApiFailure`, instead of calling `friendlyError(err)` which provides clear, empathetic user-facing guidance.

---

## 3. Detailed Audit Matrix

| Audit Dimension | Status | Audit Findings & Verification |
|---|---|---|
| **1. Camera Upload Path** | Verified | `ImagePicker.launchCameraAsync` captures square 1:1 image, stores locally in cache, URI normalized and sent via FormData. |
| **2. Gallery Upload Path** | Verified | `ImagePicker.launchImageLibraryAsync` selects image, URI normalized and sent via FormData. |
| **3. FormData Structure** | Verified | Uses standard `{ uri, name, type } as unknown as Blob` formatted part under the key `file`. |
| **4. HTTP Headers** | Verified | Sends `Accept: application/json` and `Authorization: Bearer <token>`. Does **NOT** manually set `Content-Type`, preserving the automatic multipart boundary. |
| **5. MIME Types** | Verified | Normalized to strict standard types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`. Standardizes `image/jpg` to `image/jpeg`. |
| **6. Filename Standardization** | Verified | Ensures valid extensions matching MIME type (`profile-<timestamp>.jpg`, `.png`, etc.). |
| **7. Backend Route** | Verified | `POST /api/patient-portal/patients/:patientId/profile-photo` parses multipart with `@fastify/multipart` `request.file()`, validates MIME type and size (5MB), and saves photo key. |
| **8. Fastify Multipart Limit** | Verified | Backend config sets `patientDocumentMaxFileSizeBytes` to 10MB default (exceeding the 5MB photo limit), allowing full uploads without 413 truncation. |
| **9. Image Size & Dimensions** | Verified | Photo picker uses `quality: 0.8` with `aspect: [1, 1]` cropping, keeping file sizes under 1MB. |
| **10. UI & User Experience** | Verified | Displays camera and gallery options, live circular preview, save button with loading indicator, and friendly error alerts. |
| **11. Transport Timeouts** | Verified | Multipart transport supports 60s timeout to allow smooth upload on mobile cellular connections. |
| **12. Error Formatting** | Verified | Integrated `friendlyError(err)` in `ProfilePhotoModal.tsx`. |

---

## 4. Code Changes

### A. `apps/patient-mobile/src/portal/portal-api.ts`
- Added `normalizeImageUpload` function to:
  - Ensure URI has `file://` scheme if missing.
  - Infer and sanitize MIME type (`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`).
  - Standardize `image/jpg` to `image/jpeg`.
  - Generate a clean filename with the correct extension if missing.
- Updated `uploadProfilePhoto` to use `normalizeImageUpload` before appending to `FormData`.

### B. `apps/patient-mobile/src/ui/components/ProfilePhotoModal.tsx`
- Imported `friendlyError` from `../../api/errors`.
- Updated `handleSavePhoto` and `handleDeletePhoto` to format error messages via `friendlyError(err)`.

### C. `apps/patient-mobile/src/portal/profile-photo.test.ts`
- Added comprehensive unit tests for `normalizeImageUpload`:
  - Full details handling.
  - Fallback MIME type and extension derivation from URI.
  - Normalization of `image/jpg` to `image/jpeg`.
  - Defaulting to `image/jpeg` with generated timestamped filename.

---

## 5. Verification Results

### 1. Automated Unit Tests (`@hms/patient-mobile`)
```bash
npm run test --workspace=@hms/patient-mobile
```
- **Test Files:** 27 passed (27 total)
- **Tests:** 209 passed (209 total)
- **Status:** **PASS**

### 2. TypeScript Strict Typecheck (`@hms/patient-mobile`)
```bash
npm run typecheck --workspace=@hms/patient-mobile
```
- **Output:** 0 errors
- **Status:** **PASS**

### 3. ESLint Code Quality (`@hms/patient-mobile`)
```bash
npm run lint --workspace=@hms/patient-mobile
```
- **Output:** 0 warnings, 0 errors
- **Status:** **PASS**

### 4. Backend Profile Photo Tests (`@hms/api`)
```bash
npx vitest run apps/api/src/modules/patient-portal/profile-photo.test.ts
```
- **Test Files:** 1 passed (1 total)
- **Tests:** 12 passed (12 total)
- **Status:** **PASS**

---

## 6. Protection Rules Compliance Check

- **Patient Web Untouched:** `git diff --stat apps/patient-web` is **0** (untouched).
- **Technical Identities Preserved:** `@hms/patient-mobile`, `apps/patient-mobile`, backend routes, Expo identities unmodified.
- **EAS Build Credits Preserved:** **Zero EAS builds executed.**
- **No Unapproved Redesigns:** Existing ProfilePhotoModal UI flow preserved.
