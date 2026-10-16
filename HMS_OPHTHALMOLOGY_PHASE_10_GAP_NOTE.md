# HMS Ophthalmology OPD Phase 10 Gap Note

**Date:** 16 October 2026  
**Phase:** 10 - Shared integrations, portal, reports, and dashboards  
**Entry status:** APPROVED TO START  
**Implementation status:** COMPLETE FOR APPROVED PHASE 10 BOUNDARY

## Source reconciliation

- `PROJECT_RULES.md` remains authoritative for the existing Fastify/Mongoose architecture, repository-only database access, service-owned rules, Google Cloud Storage in production, RBAC, audit, pagination, and verification.
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md` and `HMS_Scope2_Developer1(Kamesh)_Phase_3_Prompts.docx` govern a separate Scope 2 inpatient/surgery/emergency release. They add no Ophthalmology Phase 10 contract and must not be used to duplicate those domains.
- `HMS_Release2_FSD.docx` is now present, but its scope is the separate inpatient/surgery/emergency release. Existing shared-domain contracts remain integration dependencies for Ophthalmology.
- `Ophthalmology_OPD_Consultation_Functional_Specification_Document.docx` v1.0, the approved DEC-09 through DEC-11 decisions, API contract v1.8.0, and completed Phases 1-9 control this phase.
- Phase 10 closes the FSD integration, portal, report, audit, and non-functional requirements represented by OPH-INT-01 through OPH-INT-12, OPH-CMP-08, OPH-RPT-01 through OPH-RPT-09, and the relevant security/audit/acceptance rows in the Phase 0 matrix.

## Reusable implementation

- Ophthalmology context, station, workflow, task/result/version, review, completion, finalization, transaction, idempotency, branch/department scope, audit, and timeline behavior from Phases 1-9.
- Authoritative shared OPD clinical orders, laboratory results, imaging reports, prescriptions, pharmacy dispensing, procedure/surgery, referral, follow-up, billing, Patient documents, Patient timeline, and patient-portal repositories.
- Existing `PatientDocumentStorageService`, Patient document metadata model, configured MIME allow-list and maximum upload size, and upload compensation pattern.
- Existing `Ophthalmology Portal Publication` (`View`, `Publish`, `Withdraw`) and `Ophthalmology Reports` (`View`, `Export`) permission seeds.
- Existing administration dashboard snapshot pattern and branch-scoped report query conventions.
- HMS Local patient documents, OPD consultation, reports dashboard/library, laboratory reports, and imaging reports are interaction references only and will not be modified.

## Gaps and approved implementation boundary

### Implement in this phase

- Add Ophthalmology attachment metadata that references the authoritative Patient document and records task/test/result, laterality, device, acquisition time, source, checksum, review state, and publication state without embedding binary data in MongoDB.
- Make the existing patient-document storage service honor `PATIENT_DOCUMENT_STORAGE_PROVIDER`: local remains development/test only; `gcs` requires the configured bucket and uses Google Cloud Storage. Reject unsupported or incomplete production storage configuration explicitly.
- Add explicit version-bound publication and withdrawal records for approved consultation summaries, approved optical prescriptions, and reviewed test results. Publication must be idempotent, scoped, audited, and exclude drafts, unreviewed results, internal notes, and staff-only observations.
- Add the six mandatory paginated operational reports and a branch snapshot-backed dashboard: station queue, turnaround, pending review, repeat/unable, clinical volume, and diagnostic utilization.
- Add safe patient-portal projection of active Ophthalmology publications only; portal reads must not infer visibility from active source records.
- Preserve shared identifiers and expose integration status from authoritative shared records rather than copying laboratory, imaging, pharmacy, procedure, referral, follow-up, or finance data into Ophthalmology.

### Approved integration decisions and stop boundaries

- Vendor/device parsing remains `PENDING ADAPTER CONTRACT`; this phase supports manual/device-import provenance and attachments, not vendor payload parsing.
- DICOM/video/annotation formats and retention remain `PENDING POLICY`; only the existing configured MIME/size policy is accepted.
- **Approved handoff contract:** use source-domain-first creation and ID linking. Medication prescriptions, clinical orders, procedure recommendations, referrals, follow-ups, invoices and dispensing records are created through their existing authoritative domain services; Ophthalmology stores and revalidates only their IDs. Completion does not fan out duplicate automatic commands. Retries reuse the source domain's idempotency/version contract; a failed source create leaves no Ophthalmology link, and a failed link is recoverable by relinking or cancelling in the owning domain. A future asynchronous transport must use a transactional outbox/inbox contract and is change-controlled rather than silently added here.
- **Approved billing contract:** shared OPD clinical orders and services are the billable source records. Billing remains responsible for price mapping, invoice idempotency, reversals and revenue totals; Ophthalmology never calculates charges or revenue.
- Publishing arbitrary Patient documents or shared-domain records remains blocked until their source domains expose an approved patient-visible classification/version contract. Phase 10 publication is limited to the three safely verifiable Ophthalmology resource types above.
- **Approved report integration:** procedure/surgery pipeline and finance-derived revenue use the existing `/api/reports/phase-2` authoritative report with its Reports/Billing permissions and branch/department/source filters. Follow-up compliance uses `/api/opd/reports/follow-up-compliance`, derived in the OPD domain from authoritative follow-up and appointment status. Ophthalmology does not recalculate these metrics.

## Intended files

- `apps/api/src/shared/storage/patient-document-storage.service.ts`
- `apps/api/src/config/env.ts` and API dependency manifests only if needed for Google Cloud Storage
- `apps/api/src/modules/ophthalmology/ophthalmology-integration.model.ts`
- `apps/api/src/modules/ophthalmology/ophthalmology.types.ts`
- `apps/api/src/modules/ophthalmology/ophthalmology.schemas.ts`
- `apps/api/src/modules/ophthalmology/ophthalmology.repository.ts`
- `apps/api/src/modules/ophthalmology/ophthalmology.service.ts`
- `apps/api/src/modules/ophthalmology/ophthalmology.routes.ts`
- `apps/api/src/shared/services/service-registry.ts`
- `apps/api/src/modules/patient-portal/patient-portal.repository.ts` only for an additive explicit-publication projection
- Focused Phase 10 tests and contract/traceability/verification documents

## Data indexes and lifecycle

- Attachment link: unique `(taskId, documentId)`, plus patient/visit/task/result, review/publication state, and acquisition-time indexes.
- Publication: `INTERNAL -> APPROVED_FOR_PORTAL -> WITHDRAWN`; a withdrawn exact source version may be republished as a new append-only publication. Unique active source-version publication and idempotency-key indexes prevent duplicates.
- Snapshot: unique branch snapshot identity with generated/expiry timestamps; report details remain paginated indexed queries and never load whole collections.
- Publication stores source type/id/version, patient/visit/context/branch/department, publisher, timestamps, withdrawal actor/reason, and safe portal projection only.

## Validation permissions scope concurrency and errors

- Upload/link requires Test Queue `Edit`; attachment listing requires Test Queue `View`. Publication uses Portal Publication `Publish`/`Withdraw`/`View`; reports/dashboard use Reports `View`.
- Revalidate user branch, Ophthalmology department, visit/context, patient, task/result, exact clinical version, source final/reviewed state, and Patient document ownership before persistence.
- Require idempotency keys for binary upload and publication. A reused key with a different canonical fingerprint returns `OPHTHALMOLOGY_IDEMPOTENCY_CONFLICT`.
- Blob upload precedes the metadata transaction; any metadata failure deletes the uploaded blob. Database publication/withdrawal and corresponding audit/timeline updates are transactional.
- Stale withdrawal uses expected version and returns `OPHTHALMOLOGY_VERSION_CONFLICT`. Duplicate active publication returns/replays the same record only for the same idempotent request.
- Missing/invalid storage provider or bucket returns `OPHTHALMOLOGY_STORAGE_UNAVAILABLE`; unsupported MIME/size follows the configured Patient document policy; missing publication eligibility returns `OPHTHALMOLOGY_REVIEW_REQUIRED`, `OPHTHALMOLOGY_APPROVAL_REQUIRED`, or `OPHTHALMOLOGY_POLICY_REQUIRED` as applicable.

## Test design

- Attachment authorization, configured MIME/size rejection, GCS/local provider selection, checksum/metadata persistence, duplicate retry, metadata rollback, and orphan cleanup.
- Publication eligibility for each supported resource, restricted-content exclusion, exact-version binding, duplicate retry, mismatched idempotency, withdrawal reason/version, republish history, branch/resource scope, audit, and portal projection.
- Each report's filters, pagination, branch/station scope, timing calculations, no sensitive overexposure, index-backed bounded query shape, and snapshot refresh/read behavior.
- Shared-domain regressions for OPD diagnosis/orders, laboratory, imaging, prescription/pharmacy, surgery, referral, follow-up, billing, Patient documents, portal, timeline, and audit.
- Required API/web typecheck, lint, build, focused tests, and relevant full regression. Browser work is not introduced because Phase 10 remains Developer A backend scope.

## Exit constraint

Phase 10 is complete for the approved implementable boundary after the storage, attachment, source-domain-first handoff, publication, operational report, dashboard and authoritative report-integration checks pass. Vendor payload parsing, new binary formats/retention classes, arbitrary shared-resource portal publication and any future asynchronous outbox remain change-controlled extensions, not omitted Phase 10 functionality. Phase 11 must not start without explicit approval.
