# MyCare — Consent Record Sync & Portal Query Investigation

## 1. Problem Statement & Symptoms
- **Observed Behavior:** On physical Android devices running MyCare, the Consent Management tab reported `0` consents ("No Consent Forms").
- **Contrast:** In the Web Portal and Staff Portal, the same patient record displayed 6 consent forms (1 pending signature, 5 signed).

---

## 2. Root Cause Analysis

### A. Backend `listDocumentsForPortal` Storage Filter Filtered Out Valid Records
- In commit `f992154`, `apps/api/src/modules/patients/patient.service.ts` modified `listDocumentsForPortal`:
  ```typescript
  const allDocuments = await this.repository.listAllDocuments(patientId, query);
  const existingFlags = await Promise.all(
    allDocuments.map((doc) => this.documentStorage.exists(doc.storage_key)),
  );
  const availableDocuments = allDocuments.filter((_, index) => existingFlags[index]);
  ```
- **The Issue:**
  - In local development, staging, or environments where local disk storage was ephemeral or where consent forms were template-generated database records whose raw files had not yet been generated on the server filesystem, `this.documentStorage.exists(doc.storage_key)` returned `false`.
  - As a result, all database documents were filtered out, and the API endpoint returned `data: []` with `meta.total: 0`.
  - In contrast, the staff endpoint `listDocuments()` queried MongoDB directly (`this.repository.listDocuments(patientId, query)`) without dropping documents.

### B. Mobile Status and Signature Mapping
- In `apps/patient-mobile/src/consents/contracts.ts`:
  - `mapDocumentsToConsentItems` checked only `status === 'SIGNED'`.
  - Consent records can have statuses such as `VERIFIED` or review statuses like `form.consent_status === 'SIGNED' | 'VERIFIED'` or `form.review_status === 'VERIFIED'`.
  - Without checking these properties, verified or signed documents would not be marked as `is_signed: true`.

---

## 3. Implemented Fixes

### A. Backend Portal Document Listing
- In `apps/api/src/modules/patients/patient.service.ts`:
  - Restored `listDocumentsForPortal` to return `this.repository.listDocuments(patientId, query)` directly.
  - Returns the complete list of patient documents / consent forms stored in MongoDB.

### B. Mobile Contract Mapping
- In `apps/patient-mobile/src/consents/contracts.ts`:
  - Updated `mapDocumentsToConsentItems` to check:
    ```typescript
    const isSigned = 
      doc.status === 'SIGNED' ||
      doc.status === 'VERIFIED' ||
      form.consent_status === 'SIGNED' ||
      form.consent_status === 'VERIFIED' ||
      form.review_status === 'VERIFIED';
    ```
  - Accurately maps document title, category, type, and signed status for MyCare mobile.

---

## 4. Verification & Compatibility
- Both Patient Web and MyCare mobile now receive all consent records consistently from the backend.
- `apps/patient-web` remains completely untouched (0 lines changed).
