# MyCare — Consent Management Correction & Implementation Report

## 1. Previous Incorrect Content Management Implementation
During the previous phase, a misunderstanding occurred where public hospital catalogue features (Hospital Guide, public services directory, doctor directory, clinical departments, branch locations, and procedure educational videos) were implemented under the umbrella of "Content Management".

As clarified, Content Management / Hospital Guide is **not** part of this requirement and has been completely decommissioned and removed from the MyCare mobile codebase.

---

## 2. Files & Components Removed
The following files and components created specifically for Content Management / Hospital Guide were cleanly removed without impacting any other domain:

1. `apps/patient-mobile/src/content/contracts.ts` (Removed)
2. `apps/patient-mobile/src/content/content-api.ts` (Removed)
3. `apps/patient-mobile/src/content/contracts.test.ts` (Removed)
4. `apps/patient-mobile/src/content/content-api.test.ts` (Removed)
5. `apps/patient-mobile/src/content/` directory (Removed)
6. `apps/patient-mobile/src/ui/screens/ContentScreen.tsx` (Removed)
7. `apps/patient-mobile/src/ui/components/ProcedureVideoModal.tsx` (Removed)
8. Removed `Hospital Guide` quick-access card from `apps/patient-mobile/src/ui/screens/HomeScreen.tsx`.
9. Removed `'content'` route and tab from `apps/patient-mobile/App.tsx` and `BottomNavBar.tsx`.
10. Removed video action buttons, modal imports, and video state from `apps/patient-mobile/src/ui/screens/DentalScreen.tsx`.

---

## 3. Dental Treatment Stages Preserved
The Dental Treatment Stages and Dental Quotation domain is **fully preserved** and actively functional:

- **Backend Route & Service**:
  - `GET /api/opd/dental/patients/:patientId/stages`
  - `DentalStageService.listStagesByPatient` with patient and guardian access grants (`PatientAccessGrantModel`).
  - Sequence sorting, prerequisite calculation (`is_blocked_by_prerequisite`), prosthetic lab tracking (`READY`, `SENT_TO_LAB`, `IN_LAB`), and linked appointment info.
- **Mobile Client & UI**:
  - `apps/patient-mobile/src/dental/contracts.ts`: `patientDentalStageSchema`, `dentalStageStatusSchema`, `getStageStatusLabel`, `getStageBadgeVariant`.
  - `apps/patient-mobile/src/dental/dental-api.ts`: `listPatientStages`.
  - `apps/patient-mobile/src/ui/screens/DentalScreen.tsx`: Top segment toggle (`TREATMENT STAGES` vs `QUOTATIONS`), stage progression cards, prerequisite warnings, lab readiness indicators, and quotation review/decision modals.
  - Tests: `contracts.test.ts` and `dental-api.test.ts` passing 100%.

---

## 4. Existing Consent Management Implementation Audited
An audit of the existing Patient Portal (`apps/patient-web`) and HMS API (`apps/api`) revealed the true architecture for Consent Management:

1. **Patient Consent Documents**:
   - Consent forms in HMS are represented as `PatientDocument` records with `document_type === 'CONSENT'` and `consent_kind !== 'PATIENT_SIGNATURE'`.
   - Each form contains `title`, `description`, `provider_name`, `document_date`, `file_name`, `mime_type`, and `file_size_bytes`.
2. **Patient / Guardian Consent Signatures**:
   - Signatures are captured as image documents with `document_type === 'CONSENT'`, `consent_kind === 'PATIENT_SIGNATURE'`, and `context_id === consentForm.id`.
   - Status transitions to `SIGNED` upon signature attachment, or `VERIFIED` upon hospital team review.
3. **Guardian Legal Consent**:
   - Legal guardian authorization (`legal_consent_accepted: true`) is tracked on the guardian profile when managing minor dependents.

---

## 5. Existing Patient Portal Consent APIs Identified
The existing Patient Portal endpoints were reused directly without unnecessary backend redesign:

- `GET /api/patient-portal/documents?patient_id=:patientId&page=1&limit=100`:
  - Retrieves patient documents including consent forms and attached signatures.
  - Protected by `authenticate(services)` and access-checked via `resolveAccessiblePatientId`.
- `POST /api/patient-portal/consent-signature`:
  - Accepts multipart form data with `patient_id`, `consent_document_id`, and `file` (signature image).
  - Validates image mime type (`image/jpeg`, `image/png`, `image/webp`) and size ($\le 10$ MB).
  - Creates the linked `PATIENT_SIGNATURE` document and updates consent status to `SIGNED`.

---

## 6. Consent Management Mobile Implementation
Created the dedicated native Consent Management module in `apps/patient-mobile`:

1. **Contracts & Mappers (`src/consents/contracts.ts`)**:
   - `consentDocumentRawSchema` & `consentDocumentsListResponseSchema`: Zod validation for server payloads.
   - `consentItemSchema`: Unified representation combining consent form metadata with linked signature status.
   - `mapDocumentsToConsentItems`: Pure function that correlates consent forms with their matching `PATIENT_SIGNATURE` documents.
   - `getConsentStatusLabel` & `getConsentStatusVariant`: Consistent semantic badges (`Signature Required`, `Signed & Recorded`, `Hospital Verified`, `Consent Expired`).
2. **API Client (`src/consents/consents-api.ts`)**:
   - `listConsents(patientId)`: Queries patient consent documents and maps to items.
   - `uploadConsentSignature(patientId, consentDocumentId, file)`: Dispatches multipart signature upload to `/patient-portal/consent-signature` using normalized file URIs.
3. **UI Screen (`src/ui/screens/ConsentsScreen.tsx`)**:
   - Patient context switcher with instant isolation on profile switch.
   - Legal Guardian Authorization banner for dependents.
   - Filter tabs: `All`, `Action Required (Pending Signature)`, and `Signed`.
   - Clear cards showing form title, issue date, file size, signature recorded date, and review status.
   - One-tap "Review & Sign Consent Form" or "Review & Update Signature".
4. **Signature Modal (`src/ui/components/ConsentSignatureModal.tsx`)**:
   - View consent document details, file name, and legal notice.
   - Integrated camera capture (`ImagePicker.launchCameraAsync`) to photograph handwritten signatures.
   - Photo library picker (`ImagePicker.launchImageLibraryAsync`) to select signature images from device gallery.
   - Signature preview area with image replacement option.
   - Submitting indicator, retry logic, and error handling.
5. **Navigation Wiring**:
   - Added `Consent Forms` quick card on `HomeScreen.tsx`.
   - Added `Consent Management` action card in `ProfileScreen.tsx` under *More Services*.
   - Wired `'consents'` route in `App.tsx` and `BottomNavBar.tsx`.

---

## 7. Backend Changes
No modifications were required to the existing Patient Portal consent endpoints (`GET /api/patient-portal/documents` and `POST /api/patient-portal/consent-signature`). They were directly consumed by `ConsentsApi`.

---

## 8. Security & Authorization Verification
- **Patient Authorization Gate**: All requests verify `req.user.id` against `resolveAccessiblePatientId(userId, patientId)`. Cross-patient access attempts return `403 Forbidden`.
- **Guardian Access**: Guardian accounts with validated `PatientAccessGrantModel` records can access and sign consent forms for their linked minor dependents.
- **Sensitive Data Protection**: Signatures and consent files are streamed securely via authenticated session tokens.

---

## 9. Patient Context Isolation Verification
- Switching patient/dependent context in `PatientContextSelector` triggers an immediate state reset:
  `setConsents([]); setSelectedConsent(null);`
- Consent records from Patient A never persist in memory or UI when switching to Patient B.

---

## 10. Tests Executed & Results
All automated tests passed:
- `npm run test --workspace=@hms/patient-mobile`
- **Result**: 29 test files passed, **221 unit tests passed**.

---

## 11. Typecheck Results
- `@hms/patient-mobile`: `npm run typecheck --workspace=@hms/patient-mobile` → **Exit code 0 (Clean)**.
- `@hms/api`: `npm run typecheck --workspace=@hms/api` → **Exit code 0 (Clean)**.

---

## 12. Lint Results
- `@hms/patient-mobile`: `npm run lint --workspace=@hms/patient-mobile` (`eslint .`) → **Exit code 0 (Clean, 0 errors, 0 warnings)**.

---

## 13. Patient Web Diff Result
- `git diff --stat apps/patient-web` → **0 files changed, 0 insertions, 0 deletions**.

---

## 14. Remaining Limitations
- PDF inline rendering in mobile uses native document viewers or server-backed previews; signature capture operates by uploading high-clarity signature images directly to the backend document repository.

---

## Explicit Final Declaration

```
CONTENT MANAGEMENT / HOSPITAL GUIDE:
REMOVED FROM THIS REQUIREMENT

CONSENT MANAGEMENT:
IMPLEMENTED

DENTAL TREATMENT STAGES:
PRESERVED

PATIENT WEB:
UNCHANGED
```
