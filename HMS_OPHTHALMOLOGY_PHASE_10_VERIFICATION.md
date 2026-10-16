# HMS Ophthalmology OPD Phase 10 Verification

**Date:** 16 October 2026  
**Phase:** 10 - Shared integrations, portal, reports, and dashboards  
**Status:** COMPLETE  

## Implemented functionality

- Added a provider-aware patient-document storage adapter. Development/test may use local storage; production requires configured Google Cloud Storage and rejects local, unsupported, or incomplete configuration.
- Added idempotent multipart Ophthalmology attachment upload and paginated listing by branch, task, result, or visit. Metadata records the authoritative Patient document, task/result, test, laterality, device, acquisition time, provenance, SHA-256 checksum, MIME, size, review state, and publication state.
- Added exact-version publication for approved consultation summaries, approved optical prescriptions, and reviewed test results, including reasoned optimistic withdrawal and append-only republishing.
- Added active-publication-only patient-portal projection with restricted patient-safe payloads.
- Added station queue, test turnaround, pending review, repeat/unable, clinical volume, and diagnostic utilization reports plus branch dashboard snapshot refresh/read.
- Added the OPD-owned follow-up compliance report. Procedure/surgery pipeline and finance-derived revenue remain integrated through the existing authoritative Phase 2 report.
- Approved source-domain-first creation and ID linking for medication, orders, procedure/surgery, referral, follow-up, billing, and pharmacy handoffs. Ophthalmology completion does not create duplicate downstream records.

## Existing functionality reused

- Reused Phase 1-9 context, task/result/version, review, optical approval, completion, transaction, idempotency, branch scope, audit, and Patient timeline foundations.
- Reused Patient document metadata and configured MIME/size policy, Patient portal access, OPD clinical orders/prescriptions/referrals/follow-ups, surgery/procedure, billing, and Phase 2 reports as authoritative domains.
- Reused existing Ophthalmology Test Queue, Portal Publication, Reports, OPD Follow-up, Phase 2 Reports, and Billing permissions.

## Files and modules changed including shared files

- Added/extended Phase 10 Ophthalmology types, model, repository, service, schemas, routes, and focused tests.
- Added the Google Cloud Storage SDK dependency and extended `PatientDocumentStorageService` with local/GCS selection, private-object metadata, CRC32C validation, download/update/delete, and production configuration enforcement.
- Extended the Patient repository with transaction-aware document creation and the service registry with Phase 10 storage/Patient dependencies.
- Added the OPD follow-up compliance query, repository aggregation, service authorization, route, schema, types, and test.
- Additively extended Patient portal projection and Patient timeline event types for Phase 10 publication history.
- Updated the API contract to 1.9.0, the Phase 0 alignment matrix, Developer A prompt, gap note, and this verification record.
- No frontend or `scope/HMS Local` file was modified.

## Backend validation transaction permission scope audit and error handling

- Attachment upload enforces configured MIME/size limits, byte-count agreement, valid non-future acquisition time, task/result identity, allowed task state, branch scope, and idempotency fingerprint.
- Blob persistence occurs before the required MongoDB transaction. Patient document metadata, Ophthalmology attachment metadata, audit, and timeline commit together; any failure deletes the newly uploaded blob.
- Unique branch/idempotency and task/document indexes protect retries and concurrency. Attachments default to `PENDING` review and `INTERNAL` publication.
- GCS uses Application Default Credentials, the configured private bucket, no-store cache metadata, and CRC32C validation. Secrets and signed/public URLs are not stored in API payloads.
- Publication revalidates exact source version and approved/reviewed state. Publication/withdrawal, audit, and Patient timeline updates are transactional; stale withdrawal returns a version conflict.
- Follow-up compliance is derived in the OPD domain from authoritative follow-up and appointment status with branch/department scope, date filters, and pagination.
- Source-domain-first handoffs reuse owning-domain idempotency/version rules. Failed source creation creates no Ophthalmology link; a failed link is recoverable by relinking or cancelling in the owning domain. Billing retains price, invoice, reversal, and revenue authority.

## HMS Local UI patterns reused

- Reviewed HMS Local patient documents, OPD consultation, reports dashboard/library, laboratory reports, and imaging reports for terminology and operational grouping.
- Phase 10 is backend-owned; no React screen, mock data, local storage, or prototype file was added or changed.

## Automated checks and manual tests completed

- Phase 8-10, portal, storage, follow-up compliance, and response-contract focused regression: **6 files, 28 tests passed**.
- Isolated Phase 6 diagnostic regression with an extended teardown timeout: **1 file, 37 tests passed**.
- Full API suite: **106 files passed, 1 functional test failed, 1 teardown suite timed out; 1,026 of 1,027 tests passed**. The functional failure is the pre-existing `department-module-visibility.test.ts` expectation for `context.departments`; the Phase 6 failure is only its 30-second `afterAll` teardown and the same file passes 37/37 in isolation with a 60-second hook timeout.
- API typecheck and build passed. Web typecheck and production build passed. All Phase 10-owned API files pass lint.
- Full API lint remains blocked by **50 unrelated pre-existing errors** in Insurance and Patient service files. Full web lint remains blocked by **6 unrelated pre-existing errors** in doctor signature, Patient, and authenticated-media files.
- `git diff --check` passed.
- Browser testing was not introduced because the requested Developer A Phase 10 work is backend-only.

## Remaining dependency or clarification for the next phase

- No Phase 10 blocker remains for the approved boundary.
- Vendor/device payload parsing, DICOM/video/annotation formats, new retention classes, arbitrary shared-resource portal publication, and any asynchronous outbox transport remain change-controlled future extensions requiring their own approved policy or adapter contract.
- Runtime deployment must continue to provide `PATIENT_DOCUMENT_STORAGE_PROVIDER=gcs`, `GCP_PATIENT_DOCUMENTS_BUCKET`, project identity, and valid Application Default Credentials.

## Next phase stop confirmation

Phase 10 is complete. Phase 11 has not started and requires explicit owner approval.
