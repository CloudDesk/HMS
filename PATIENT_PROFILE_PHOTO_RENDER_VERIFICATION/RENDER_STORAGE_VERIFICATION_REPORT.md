# MYCARE — PATIENT PROFILE PHOTO
## STORAGE + RENDER PRODUCTION VERIFICATION REPORT

**Date:** 2026-09-28  
**Subject:** Patient Profile Photo Storage & Render Persistence Verification  
**Branch:** `Dev-F-Release-5-Patient-Portal-Mobile`  
**Application:** MyCare (`apps/patient-mobile`) / Backend API (`apps/api`)  

---

## 1. Actual Storage Mechanism

- **Implementation Inspected:**
  - `PatientService.uploadProfilePhotoFile()` in [`patient.service.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patients/patient.service.ts)
  - `PatientDocumentStorageService` in [`patient-document-storage.service.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/storage/patient-document-storage.service.ts)
  - `PatientModel` subdocument `profilePhoto` in [`patient.model.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patients/patient.model.ts)
- **Physical Storage Location:**
  - Files are written to the **local filesystem** on the Node.js host/container using `node:fs/promises` (`mkdir`, `writeFile`, `readFile`, `unlink`).
  - Storage path resolves to `env.storage.localPatientDocumentsPath` (defaults to `./storage/patient-documents/patients/<patientId>/documents/<uuid>-<fileName>`).
  - MongoDB Atlas only records document metadata (`storageKey`, `mimeType`, `fileSizeBytes`, `uploadedAt`).
- **Storage Classification:** **Local / Ephemeral Filesystem (Outcome C / D)**.

---

## 2. Render Persistence Assessment

- **Deployment Specification:**
  - Inspected [`render.yaml`](file:///c:/Users/lenovo/Documents/GitHub/HMS/render.yaml): Service `hms-api` is deployed as a **Render Web Service on the Free plan (`plan: free`)**.
  - No persistent disk volume is mounted (Render persistent disks require paid plans and are not supported on Free Web Services).
- **Why It Is Not Persistent on Render:**
  - On Render Free Web Services, the container's disk is ephemeral.
  - Render free instances automatically spin down / sleep after 15 minutes of inactivity and spin up fresh containers on inbound traffic.
  - Every container spin-down, restart, or redeploy completely destroys the local `./storage/` directory and resets the filesystem to the Git commit build state.
- **Risk to Uploaded Patient Photos:**
  - **High / Data Loss:** Patient photos uploaded to the API will physically vanish whenever the Render instance sleeps, restarts, or is redeployed.
  - MongoDB will retain the `profilePhoto.storageKey` pointer, but subsequent image fetch requests (`GET /api/patient-portal/patients/:patientId/profile-photo`) will fail with `ENOENT` / `DOCUMENT_FILE_NOT_FOUND` (HTTP 404), breaking profile photo display in MyCare.
- **Required Production Storage Solution:**
  - Integration with persistent cloud object storage (e.g. AWS S3, Cloudflare R2, Google Cloud Storage) or MongoDB GridFS / binary storage for small image blobs under 5MB.

---

## 3. Storage Configuration Audit

- **Environment Configuration:**
  - `PATIENT_DOCUMENT_STORAGE_PROVIDER`: Defaults to `'local'`.
  - `LOCAL_PATIENT_DOCUMENT_STORAGE_PATH`: Defaults to `./storage/patient-documents`.
  - `GCP_PATIENT_DOCUMENTS_BUCKET`: Present as an unused configuration string in `env.ts`.
- **Secrets & Credentials:**
  - Zero secrets or access tokens printed or exposed.
  - No active cloud storage provider credentials exist in configuration.

---

## 4. Production API Health

- **Target URL:** `https://hms-api-atok.onrender.com/api`
- **Local Dev Health Check (`http://localhost:4000/api/health`):**
  - Status: HTTP 200 `{"status":"ok","service":"hms-api","environment":"dev"}`.
- **Remote Render Instance Health:**
  - Remote service runs on Render Free tier with cold-start latency.
  - Deployment configuration in `render.yaml` confirms healthCheckPath is `/api/health`.

---

## 5. Profile-Photo Endpoint Verification

Backend routes verified in [`patient-portal.routes.ts`](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.routes.ts):
- `POST /api/patient-portal/patients/:patientId/profile-photo` (multipart upload)
- `GET /api/patient-portal/patients/:patientId/profile-photo` (stream image / cache headers)
- `DELETE /api/patient-portal/patients/:patientId/profile-photo` (metadata + storage cleanup)

---

## 6. Upload Result

- Multipart file upload handles binary payloads correctly.
- Enforces max size (5 MB) and MIME validation (`jpeg`, `png`, `webp`, `heic`).
- Writes file to disk, updates `patient.profilePhoto`, creates audit log, and records `PROFILE_UPDATED` timeline event.
- Verified in unit and integration test suite (`profile-photo.test.ts`).

---

## 7. Retrieval Result

- Authenticated GET endpoint verifies caller authorization for `patientId`.
- Streams file binary with `Content-Type: image/jpeg` and `Cache-Control: private, no-transform, max-age=300`.
- Supports both `Authorization: Bearer <token>` header and query-param token fallback for React Native `<Image>`.
- Verified in unit and integration test suite (`profile-photo.test.ts`).

---

## 8. Replacement Result

- Uploading a new image updates the patient metadata with the new `storageKey` and file details.
- Automatically cleans up and removes the previous photo file from storage.
- Verified in unit and integration test suite (`profile-photo.test.ts`).

---

## 9. Delete Result

- `DELETE` endpoint removes `profilePhoto` subdocument from MongoDB.
- Deletes physical file from storage via `deleteIfExists`.
- Returns `{ success: true, message: "Profile photo deleted successfully" }`.
- Subsequent `GET` returns 404 `PROFILE_PHOTO_NOT_FOUND`, allowing mobile to display default initials avatar.
- Verified in unit and integration test suite (`profile-photo.test.ts`).

---

## 10. Authorization Result

- Context isolation verified using `resolveAccessiblePatientId`:
  - Accessing own profile photo: **ALLOWED**.
  - Accessing authorized dependent/family profile photo: **ALLOWED**.
  - Attempting to access/upload/delete an unauthorized patient photo: **REJECTED (403 FORBIDDEN / `PATIENT_ACCESS_DENIED`)**.
- Verified in `profile-photo.test.ts`.

---

## 11. File Validation Result

- Supported formats (`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`): **ACCEPTED**.
- Unsupported format (e.g. `application/pdf`, `text/plain`): **REJECTED (400 `INVALID_IMAGE_TYPE`)**.
- Oversized payload (> 5 MB): **REJECTED (400 `IMAGE_TOO_LARGE`)**.
- Invalid upload attempts leave existing profile photo completely unchanged.

---

## 12. Persistence / Restart Verification Status

- **Status: BLOCKER IDENTIFIED (FAILED PERSISTENCE PRE-CHECK).**
- Local filesystem storage cannot persist across Render container restarts or sleep cycles on Render Free tier.
- As required by Phase 2 and Phase 7 instructions, execution stopped before EAS build.

---

## 13. Mobile / Backend Contract Verification

- Contract fields aligned:
  - `portalPatientSchema` & `portalPatientDetailSchema` include `profile_photo_url: z.string().nullable()`.
  - `ProfilePhotoModal` handles camera and gallery selection, preview, confirm, and remove actions.
  - `Avatar` component handles authenticated image streaming, fallback initials, and custom sizes.
  - `PatientContext` handles multi-patient context switching with clean state isolation.
- Mobile test suite: **160 / 160 tests passing**.

---

## 14. Security Verification

- No raw image data or base64 strings logged.
- No tokens, passwords, or secrets exposed in log outputs.
- Auth tokens strictly validated on all endpoints.
- Ownership/dependent authorization strictly checked prior to data access.

---

## 15. Backend Test Results

- `apps/api/src/modules/patient-portal/profile-photo.test.ts`: **12 / 12 tests passed**.

---

## 16. Mobile Test Results

- `apps/patient-mobile`: **160 / 160 tests passed** across 25 test suites.

---

## 17. Typecheck Results

- `@hms/api`: **0 errors** (`tsc -p tsconfig.json --noEmit` passed).
- `@hms/patient-mobile`: **0 errors** (`tsc --noEmit` passed).

---

## 18. Lint Results

- `@hms/api`: **0 lint errors**.
- `@hms/patient-mobile`: **0 lint errors, 0 warnings**.

---

## 19. Patient Web Diff Result

- `git diff --stat apps/patient-web`: **EMPTY / 0 CHANGES (100% CLEAN)**.

---

## 20. Blockers

1. **Storage Persistence Blocker on Render Free Tier:**
   - The backend uses local container filesystem storage (`./storage/patient-documents`), which is ephemeral on Render Free tier.
   - Files are destroyed when Render puts the instance to sleep (after 15 minutes of inactivity) or upon redeployment.
   - **Remediation needed:** Connect persistent object storage (e.g. S3 / Cloudflare R2 / GCS) or store small profile photos directly in MongoDB (e.g. GridFS or binary subdocument) before production deployment.

---

## 21. Final Readiness Decision

```
============================================================
FINAL READINESS DECISION:
PROFILE PHOTO — NOT READY (STORAGE PERSISTENCE BLOCKER)
============================================================
```

---

## Explicit Statements

- **EAS build executed:** **NO**
- **EAS build credits consumed:** **NO**
- **Patient Web modified:** **NO**
- **Backend modified during this verification:** **NO**
- **Production storage persistent:** **NO (Ephemeral Local Filesystem on Render Free Tier)**
- **Render verification:** **FAIL (Storage Ephemerality on Free Tier)**
