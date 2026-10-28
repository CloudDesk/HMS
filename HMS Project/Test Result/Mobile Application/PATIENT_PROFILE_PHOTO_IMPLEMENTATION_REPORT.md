# MYCARE — PATIENT PROFILE PHOTO END-TO-END IMPLEMENTATION REPORT

## Executive Summary
This report documents the audit-first, end-to-end design and implementation of **Patient Profile Photo** management in **MyCare** (`apps/patient-mobile`) and the backend (`apps/api`).

The solution enables patients to view their profile photo (with fallback to initials avatar), upload new photos from the camera or photo gallery with preview and confirmation, remove their profile photo, and maintain context isolation across primary patients and dependents.

---

## 1. Compliance & Protection Checks

| Requirement | Status | Details |
|---|---|---|
| **Patient Web Protection** | **100% PASS** | `git diff --stat apps/patient-web` is 0 (untouched). |
| **Technical Identity Preservation** | **PASS** | Package remains `@hms/patient-mobile`, folder `apps/patient-mobile`, backend contracts preserved. |
| **User-Facing Branding** | **PASS** | `MyCare` brand preserved across all modals and screens. |
| **Zero EAS Builds Rule** | **PASS** | No `eas build` executed; 0 cloud build credits consumed. |
| **Privacy & Security** | **PASS** | No raw base64 or image buffers logged; multipart payload streams safely; authorization tokens enforced. |

---

## 2. Architecture & Data Flow

```
+---------------------------------------------------------------------------------------+
|                                     MyCare (Mobile)                                   |
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   | ProfileScreen / PatientCard / PatientContextSelector                          |   |
|   |                                                                               |   |
|   |  - <Avatar size="xl" profilePhotoUrl={patient.profile_photo_url} ... />        |   |
|   |  - <ProfilePhotoModal visible={...} onSave={uploadPhoto} onDelete={...} />   |   |
|   +-------------------------------------------------------------------------------+   |
|                                          |                                            |
|                                          v                                            |
|   +-------------------------------------------------------------------------------+   |
|   | PatientContext: uploadPhoto(uri, mime, name) / deletePhoto()                  |   |
|   | - Optimistic update / state refresh for active patient context                |   |
|   +-------------------------------------------------------------------------------+   |
|                                          |                                            |
|                                          v                                            |
|   +-------------------------------------------------------------------------------+   |
|   | portal-api.ts -> authenticatedMultipartRequest / authenticatedRequest         |   |
|   +-------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------+
                                           |
                                           | HTTP Multipart / JSON
                                           v
+---------------------------------------------------------------------------------------+
|                                      HMS API Backend                                  |
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   | Routes:                                                                       |   |
|   | - POST   /api/patient-portal/patients/:patientId/profile-photo                    |   |
|   | - GET    /api/patient-portal/patients/:patientId/profile-photo                    |   |
|   | - DELETE /api/patient-portal/patients/:patientId/profile-photo                    |   |
|   +-------------------------------------------------------------------------------+   |
|                                          |                                            |
|                                          v                                            |
|   +-------------------------------------------------------------------------------+   |
|   | PatientPortalService:                                                         |   |
|   | - resolveAccessiblePatientId(user, patientId) -> Multi-patient authorization  |   |
|   | - patientService.uploadProfilePhotoFile() -> Disk/S3 file storage             |   |
|   | - patientPortalRepository.updatePatientProfilePhoto()                         |   |
|   | - patientService.deleteProfilePhotoFile(oldStorageKey) -> Storage cleanup     |   |
|   | - Audit Log + Patient Timeline (PROFILE_UPDATED)                              |   |
|   +-------------------------------------------------------------------------------+   |
|                                          |                                            |
|                                          v                                            |
|   +-------------------------------------------------------------------------------+   |
|   | MongoDB Patients Collection:                                                  |   |
|   | profilePhoto: { storageKey, mimeType, fileSizeBytes, uploadedAt }            |   |
|   +-------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------+
```

---

## 3. Implementation Details

### A. Backend (`apps/api`)
1. **Schema & Model:**
   - Updated [patient.model.ts](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patients/patient.model.ts) with `profilePhoto` subdocument containing `storageKey`, `mimeType`, `fileSizeBytes`, and `uploadedAt`.
   - Updated [patient-portal.schemas.ts](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.schemas.ts) with `profile_photo_url` in patient overview/context, along with photo upload and deletion schemas.
2. **File Handling & Storage:**
   - Updated [patient.service.ts](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patients/patient.service.ts) to support validating image formats (`image/jpeg`, `image/png`, `image/webp`, `image/heic`), enforcing a 5MB size limit, generating clean storage paths (`patients/<patientId>/profile/<uuid>.<ext>`), and cleaning up old photo files on replacement or deletion.
3. **Repository & Multi-Patient Authorization:**
   - Updated [patient-portal.repository.ts](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.repository.ts) and [patient-portal.service.ts](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.service.ts) to verify that the logged-in portal user owns or has access to the requested `patientId` before reading, uploading, or deleting photos.
   - Emits `AuditLogModel` events and records `PatientTimelineEventModel` (`PROFILE_UPDATED`).
4. **Endpoints:**
   - `POST /api/patient-portal/patients/:patientId/profile-photo`: Accepts multipart form file upload.
   - `GET /api/patient-portal/patients/:patientId/profile-photo`: Serves the image stream with appropriate `Content-Type` and `Cache-Control` headers. Supports Bearer token header as well as query token parameter for native image components.
   - `DELETE /api/patient-portal/patients/:patientId/profile-photo`: Removes the photo metadata and deletes the file from disk/storage.

### B. Mobile (`apps/patient-mobile`)
1. **Dependencies & Permissions:**
   - Integrated `expo-image-picker` with runtime camera and photo library permission checks and user prompts.
2. **Reusable Avatar Component ([Avatar.tsx](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/components/Avatar.tsx)):**
   - Renders authenticated remote images with graceful fallback to formatted initials avatar.
   - Configurable sizes: `xs` (28px), `sm` (36px), `md` (48px), `lg` (72px), `xl` (96px), and custom sizes.
   - Optional interactive edit badge overlay with camera icon.
3. **Interactive Photo Modal ([ProfilePhotoModal.tsx](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/components/ProfilePhotoModal.tsx)):**
   - Action sheet with options: "Take Photo", "Choose from Gallery", and "Remove Current Photo".
   - Full preview mode for selected/taken photos with "Save Photo" and "Retake / Choose Another" actions.
   - Active loading states during upload/removal operations.
4. **Context & Synchronization ([PatientContext.tsx](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/portal/PatientContext.tsx)):**
   - `uploadPhoto(fileUri, mimeType, fileName)`: Uploads photo for active patient context and synchronizes local state and patient list.
   - `deletePhoto()`: Deletes profile photo for active patient context and resets avatar to initials.
5. **Screens & Component Integrations:**
   - [ProfileScreen.tsx](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/screens/ProfileScreen.tsx): Large interactive profile avatar with edit overlay and quick action buttons ("Change Photo" / "Remove Photo").
   - [PatientCard.tsx](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/components/PatientCard.tsx): Profile photo display in patient identification cards.
   - [PatientContextSelector.tsx](file:///c:/Users/lenovo/Documents/GitHub/HMS/apps/patient-mobile/src/ui/components/PatientContextSelector.tsx): Profile photos displayed in the multi-patient switcher dropdown for each family member/dependent.

---

## 4. Automated Verification Results

### A. TypeScript & Linting
- **`@hms/api` Typecheck:** Passed (0 errors).
- **`@hms/api` Lint:** Passed (0 errors in modified/created files).
- **`@hms/patient-mobile` Typecheck:** Passed (0 errors).
- **`@hms/patient-mobile` Lint:** Passed (0 errors, 0 warnings).

### B. Unit & Integration Tests
- **Backend Patient Portal Profile Photo Tests (`apps/api/src/modules/patient-portal/profile-photo.test.ts`):**
  - `12 / 12 tests passed` (100% pass rate).
  - Verified: Unauthorized access rejection, valid upload & persistence, GET photo streaming, DELETE photo cleanup, and audit trail generation.
- **Mobile Unit & Component Tests (`apps/patient-mobile`):**
  - `160 / 160 tests passed` across 25 test suites.
  - Verified: Initials formatting, photo contracts, Avatar rendering, and profile photo integration.

### C. Native Bundle Verification
- **Expo Native Export (`npm run export:native`):**
  - Android bundle: 760 modules bundled cleanly.
  - iOS bundle: 766 modules bundled cleanly.
  - 0 native packaging errors.

---

## 5. Summary
The Patient Profile Photo feature is complete, secure, multi-patient aware, and tested across both backend and native mobile layers without touching `apps/patient-web` or triggering cloud EAS builds.
