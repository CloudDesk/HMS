# HMS GCS Document Storage Verification

**Date:** 29 September 2026  
**Scope:** Post-release patient and clinical document storage provider

## Implemented Functionality

- Added selectable `local | gcp` patient-document storage.
- Added GCS upload, overwrite, existence, download, and idempotent delete behavior behind the existing storage-service contract.
- Added CRC32C upload validation and `private, no-store` object cache metadata.
- Preserved MIME/content type across GCS overwrites.
- Preserved existing authenticated download routes and MongoDB metadata contracts.
- Added production configuration guards to prevent silent use of ephemeral local storage.

## Automated Verification

Passed:

- `npm run typecheck --workspace=@hms/api`
- `npm run build --workspace=@hms/api`
- `npm run typecheck --workspace=@hms/web`
- `npm run build --workspace=@hms/web`
- Focused storage/configuration tests: 2 files, 7 tests passed.
- Focused ESLint for all GCS-owned source and test files.
- `git diff --check`

Repository-wide pre-existing failures:

- API lint: 13 existing errors in patient, consent-security, booking, and dental test files outside this change.
- Web lint: 30 existing errors in consent, dental, avatar, patient UI, and PDF files outside this change.
- Full API test suite: 84 files passed and 9 files failed; 634 tests passed and 24 failed. Failures concern existing dental lifecycle/status expectations, authentication/SMS setup, HTTP serialization, and appointment pagination. The focused GCS tests remain green.

## Bucket Inspection

Read-only inspection of `gs://hms-dev-documents` confirmed:

- Project: `cloud-desk-447206`
- Region: `ASIA-SOUTH1`
- Storage class: `STANDARD`
- Uniform bucket-level access: enabled
- Soft delete: seven days
- Public access prevention: inherited
- Current IAM includes `allAuthenticatedUsers` with `roles/storage.admin`

Per the owner's instruction, the existing bucket configuration was not changed.

## Deployment Configuration Required

Set these values on the Render API service:

```text
PATIENT_DOCUMENT_STORAGE_PROVIDER=gcp
GCP_PROJECT_ID=cloud-desk-447206
GCP_PATIENT_DOCUMENTS_BUCKET=hms-dev-documents
GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/hms-gcp-service-account.json
```

Upload the service-account JSON to Render as the secret file `hms-gcp-service-account.json`. Do not place it in Git or a normal environment file.

## Manual Verification Pending

- A live Render upload/download/replace/delete cycle was not executed because the Render service credential is not available in this workspace.
- After the secret file and environment variables are configured, verify an authorized upload, logout/login persistence, replacement, download, and deletion through the live HMS API.

No subsequent release phase was started.
