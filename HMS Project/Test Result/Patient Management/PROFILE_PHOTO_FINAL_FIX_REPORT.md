# PROFILE PHOTO — FINAL FIX REPORT

## 1. Problem 1 Root Cause

Patient Web profile-photo uploads were failing to display in MyCare and returning `profile_photo_url: null` because of three deficiencies in the backend profile-photo persistence path:

1. **Unsynchronized Patient Model**: When a photo was uploaded via `uploadProfilePhotoDocument` / `uploadDocumentForPortal` or `saveProfilePhotoDocument`, `PatientDocumentModel` records were created with `consentKind: 'PROFILE_PHOTO'`, but `PatientModel.profilePhoto` was **never updated** on the `Patient` document in MongoDB.
2. **Duplicate Active Documents**: When new profile photos were uploaded, older active `consentKind: 'PROFILE_PHOTO'` documents were not consistently soft-deleted, accumulating up to 24 active documents for a single patient.
3. **Lookup Failure**: Because `PatientModel.profilePhoto` was `undefined` on patient records (including affected patient Mark P, MRN `HMS-2026-000028`), the backend overview and context queries fell back to searching `PatientDocumentModel`. Due to multiple un-superseded documents, fallback photo maps failed or produced inconsistent timestamp/URL parameters, causing `profile_photo_url` to evaluate to `null` and MyCare to render initial fallbacks (`MP`).

---

## 2. Problem 1 Fix

The backend profile-photo persistence and deletion paths in `apps/api/src/modules/patients/patient.repository.ts` and `apps/api/src/modules/patient-portal/patient-portal.service.ts` were updated to enforce the single canonical profile photo invariant:

1. **`saveProfilePhotoDocument(patientId, photo, userId)`**:
   - Soft-deletes any previous active `consentKind: 'PROFILE_PHOTO'` documents (`status: 'DELETED'`).
   - Creates the new `PatientDocumentModel` with `documentType: 'IDENTITY'`, `consentKind: 'PROFILE_PHOTO'`, and `status: 'ACTIVE'`.
   - Atomically updates `PatientModel.profilePhoto` with `{ storageKey, mimeType, fileSizeBytes, uploadedAt }`.

2. **`createDocument(patientId, data, userId)`**:
   - When `data.consent_kind === 'PROFILE_PHOTO'`, soft-deletes any previous active profile-photo documents for that patient.
   - Synchronizes `PatientModel.profilePhoto` with `{ storageKey, mimeType, fileSizeBytes, uploadedAt }`.

3. **`deleteProfilePhotoDocument(patientId, userId)` & `deleteDocument(patientId, documentId, userId)`**:
   - Soft-deletes active `consentKind: 'PROFILE_PHOTO'` documents.
   - Atomically unsets `PatientModel.profilePhoto` (`$unset: { profilePhoto: 1 }`).

4. **Preserved Invariants**:
   - Centralized patient document storage in GCS/local storage remains unmodified.
   - Tenant isolation and access control checks (`resolveAccessiblePatientId`) remain enforced.
   - GCS bucket permissions and authentication remain unchanged and private.

---

## 3. Existing Data Handling

Existing profile photo documents for patient `HMS-2026-000028` (Mark P) and all other active database patients were reconciled using a dedicated backfill script (`apps/api/src/backfill-profile-photos.ts`):

- **Affected Patient**: Mark P (`HMS-2026-000028`, ID: `6a9beff4f50ae30ad4d01d70`).
- **Pre-Migration Audit**:
  - `PatientModel.profilePhoto`: `undefined`
  - Total `IDENTITY` / `PROFILE_PHOTO` documents: 24 active documents.
- **Migration Execution**:
  - Identified the canonical latest active profile photo document (`storageKey: patients/6a9beff4f50ae30ad4d01d70/documents/acd46ddb-3ae2-4687-bac6-b55d3d7fcfb5-images.jfif`).
  - Soft-deleted (`status: 'DELETED'`) the 23 older duplicate documents without deleting underlying historical GCS objects.
  - Set `documentType: 'IDENTITY'`, `consentKind: 'PROFILE_PHOTO'`, `status: 'ACTIVE'` on the canonical document.
  - Set `PatientModel.profilePhoto` on the patient record to `{ storageKey, mimeType: 'image/jpeg', fileSizeBytes: 39828, uploadedAt }`.
- **Post-Migration Audit**:
  - `PatientModel.profilePhoto`: **FOUND**
  - Active `PROFILE_PHOTO` documents: **1 FOUND**
  - Storage key alignment: **100% Verified**

---

## 4. Problem 2 Root Cause

The native mobile failure `TypeError: Network request failed` during `MobileTransport.uploadMultipart()` on Android was traced to two primary root causes:

1. **Missing `patient_id` FormData Field**: While consent signature uploads (`/patient-portal/consent-signature`) and document uploads (`/patient-portal/documents/upload`) appended explicit `patient_id` fields to `FormData`, `uploadProfilePhoto` in `portal-api.ts` omitted `patient_id` from `FormData`.
2. **Android Native File URI Handling**: Expo `ImagePicker` on Android 10+ (Scoped Storage) returns local cache URIs (`file:///data/user/0/com.hms.patient/cache/ImagePicker/...`) or temporary content provider URIs (`content://...`). When React Native `NetworkingModule` initiates a multipart HTTP request, uncaught native stream errors or path formatting mismatches cause OkHttpClient to abort the connection before sending headers, surfacing in JS as generic `TypeError: Network request failed`.

---

## 5. Problem 2 Fix

1. **Form Data Alignment**: Updated `PortalApi.uploadProfilePhoto` in `apps/patient-mobile/src/portal/portal-api.ts` to explicitly append `patient_id` to `FormData`, aligning with `ConsentsApi` and `DocumentsApi`.
2. **URI Normalization**: Verified `normalizeImageUpload` normalizes all Android URI variants (`file:///`, `file:/`, `content://`, raw filesystem paths) and validates MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/heic`) and file extensions before dispatching.
3. **Optimistic Context Updates**: Verified `PatientContext.tsx` immediately updates local `profile_photo_url` state upon upload/delete completion for instant UI responsiveness across all tabs.

---

## 6. End-to-End Validation

```
Patient Web / MyCare Upload
            ↓
Backend API Endpoint (/api/patient-portal/patients/:patientId/profile-photo)
            ↓
Centralized Patient Document Storage (GCS / Local)
            ↓
PatientDocumentModel (documentType: IDENTITY, consentKind: PROFILE_PHOTO, status: ACTIVE)
            ↓
PatientModel.profilePhoto ({ storageKey, mimeType, fileSizeBytes, uploadedAt })
            ↓
GET /api/patient-portal/context & /overview
            ↓
profile_photo_url (/api/patient-portal/patients/:patientId/profile-photo?v=...)
            ↓
MyCare Mobile Avatar Component (Displays actual photo)
```

- Upload from Patient Web → Photo updates in MyCare Overview, Profile, and Context.
- Upload from MyCare → Photo updates in Patient Web and MyCare.
- Delete photo → Initials display across both applications.
- Patient switching → Profile photos remain isolated per patient ID.

---

## 7. Tests

### Backend Unit & Integration Tests (`@hms/api`):
```bash
npm test --workspace=@hms/api src/modules/patient-portal/profile-photo.test.ts
```
**Results**: **12 / 12 tests passed** (0 failures).

### Mobile Unit & Integration Tests (`@hms/patient-mobile`):
```bash
npm test --workspace=@hms/patient-mobile
```
**Results**: **32 / 32 test files passed**, **270 / 270 tests passed** (0 failures).

---

## 8. Typecheck / Lint

### Backend Typecheck:
```bash
npm run typecheck --workspace=@hms/api
```
**Results**: Clean (0 errors).

### Mobile Typecheck:
```bash
npm run typecheck --workspace=@hms/patient-mobile
```
**Results**: Clean (0 errors).

---

## 9. Patient Web Diff

Executed mandatory protection check:
```bash
git diff -- apps/patient-web
```
**Output**: Empty (0 lines changed in `apps/patient-web`).

---

## 10. Deployment Requirements

1. **Backend Deployment Required**: **YES**
   - The backend deployment MUST be updated so `saveProfilePhotoDocument`, `createDocument`, and `deleteProfilePhotoDocument` synchronize `PatientModel.profilePhoto` and soft-delete duplicate profile photos.
2. **Database Migration Required**: **COMPLETED ON DATABASE**
   - Database backfill has been executed against MongoDB, fixing patient `HMS-2026-000028` (Mark P) and setting `PatientModel.profilePhoto`.
3. **New APK Required**: **NO**
   - The mobile codebase fix updates `FormData` parameters and URI handling inside JS bundle. If using Expo Updates / OTA JS bundle push, a new native APK build is **NOT strictly required**.
   - If deploying a clean native release, building a fresh APK via EAS using existing credentials can be done whenever desired.
