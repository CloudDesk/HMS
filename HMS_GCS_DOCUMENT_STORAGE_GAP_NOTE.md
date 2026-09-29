# HMS GCS Document Storage Gap Note

**Date:** 29 September 2026  
**Scope:** Post-release patient and clinical document storage provider

## Source Reconciliation

- `PROJECT_RULES.md` requires production file binaries in Google Cloud Storage, metadata in MongoDB, authenticated/RBAC-controlled file actions, and preservation of the existing API contract.
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md` does not define a separate storage phase; all listed Scope 2 Phase 3 phases are already complete.
- `HMS_Scope2_Developer1(Kamesh)_Phase_3_Prompts.docx` and `doc/HMS_Release2_FSD.docx` are not present in this checkout.
- No UI behavior changes are required, so no HMS Local prototype files are affected.

## Existing Functionality Reused

- `PatientDocumentStorageService` already owns upload, overwrite, existence, download, and delete operations for patient documents, profile photos, imaging attachments, and dental chairside images.
- Patient and portal routes already enforce authentication, permissions, patient scope, upload type/size rules, safe download filenames, and API response contracts.
- MongoDB already stores document metadata and opaque storage keys rather than file binaries.
- Existing compensating cleanup deletes a newly uploaded object when the corresponding MongoDB metadata write fails.

## Gap

- `PATIENT_DOCUMENT_STORAGE_PROVIDER` and `GCP_PATIENT_DOCUMENTS_BUCKET` existed but were unused; all files were still written to the local filesystem.
- Production could silently use Render's ephemeral local filesystem.
- The GCS client dependency and provider implementation were absent.
- Storage-provider configuration did not reject unsupported providers or a missing GCS bucket.

## Implementation Scope

- Add the official Google Cloud Storage Node.js client.
- Route the existing storage service operations to local storage or GCS based on configuration.
- Use CRC32C validation and preserve object content type on create and overwrite.
- Keep generated object keys and every patient API contract unchanged.
- Convert GCS missing-object responses to the existing `DOCUMENT_FILE_NOT_FOUND` application error.
- Reject invalid/traversal-like storage keys before local or cloud access.
- Fail startup when production is not configured for GCS or when the GCS bucket name is missing.
- Add focused local/GCS provider and configuration tests.

## External Configuration Boundary

- Project: `cloud-desk-447206`
- Bucket: `hms-dev-documents`
- The owner requested that the bucket's current IAM/public configuration remain unchanged. No bucket IAM, public-access-prevention, retention, soft-delete, or lifecycle setting is changed by this implementation.
- Render still requires Google Application Default Credentials at runtime. The recommended deployment mechanism is a Render secret file containing the service-account JSON and `GOOGLE_APPLICATION_CREDENTIALS` pointing to that file.

## Intended Files

- `apps/api/package.json`
- `package-lock.json`
- `apps/api/src/config/env.ts`
- `apps/api/src/config/env-storage.test.ts`
- `apps/api/src/shared/storage/patient-document-storage.service.ts`
- `apps/api/src/shared/storage/patient-document-storage.service.test.ts`

No frontend, database schema, route, permission, navigation, or HMS Local prototype file is changed.
