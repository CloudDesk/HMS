# HMS Ophthalmology OPD Phase 11 Gap Note

**Date:** 16 October 2026  
**Phase:** 11 - End to end hardening and release validation  
**Entry status:** APPROVED  
**Implementation outcome:** PARTIALLY COMPLETE  

## Requirement and acceptance scope

Phase 11 is verification-only and is governed by DEC-01 through DEC-12. It closes or records release evidence for OPH-NFR-01 through OPH-NFR-03 and OPH-ACC-01 through OPH-ACC-03, while rechecking all previously implemented Ophthalmology matrix rows across roles, branches, encounters, stations, forms, exceptions, completion, portal publication, attachments, reports and shared-domain integrations.

The required exit evidence includes API and web typecheck, lint and build; the complete focused Ophthalmology suite; transaction-capable workflow tests; permission and scope isolation; optimistic concurrency, duplicate and idempotent retry behavior; query/index review; General OPD, Dental and shared-domain regression; mock/local-production dependency and sensitive-logging scans; and documented manual acceptance or an explicit deferred release disposition.

## Existing functionality reused

- Phase 1 through Phase 10 Ophthalmology context, intake, queue, task, result, review, prescription, completion, publication, attachment, report and dashboard services.
- Existing OPD visit, consultation, diagnosis, order, prescription, referral and follow-up contracts.
- Existing Patient document, timeline, portal, audit, notification, billing, procedure/surgery, laboratory, imaging and pharmacy contracts.
- Existing database-loaded RBAC, organization/branch/department/resource scope, MongoDB transactions, optimistic versions, idempotency fingerprints and error-response conventions.
- Existing per-phase automated tests and the HMS Local OPD, patient-document and reporting patterns as read-only workflow references.

## Baseline gaps and dependencies

- Phase 11 has no approved new clinical field, lifecycle or production feature to invent. Production clinical master values remain hospital-owned configuration.
- The live Google Cloud Storage upload/download/delete smoke test is deferred by the owner and therefore remains release-validation evidence still to be completed.
- Interactive multi-role, multi-branch browser acceptance and responsive/manual workflow verification require a populated runtime environment and authorized test identities.
- Vendor/device payload parsing, DICOM/video/annotation formats, new retention classes, arbitrary shared-resource publication and asynchronous outbox transport remain change-controlled extensions outside the approved Phase 11 implementation boundary.
- Existing unrelated repository-wide lint/test failures must be distinguished from Phase 11-owned failures and documented precisely; they must not be silently reported as passing.

## Intended files

- `apps/api/src/modules/ophthalmology/ophthalmology.phase11.test.ts` for release-hardening coverage that composes existing domain behavior without introducing a parallel production service.
- `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md` for Phase 11 status and release-evidence revision.
- `HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX.md` for verified requirement dispositions.
- `HMS_Ophthalmology_OPD_Developer_A_Backend_Prompts.md` for phase status.
- `HMS_OPHTHALMOLOGY_PHASE_11_VERIFICATION.md` for actual evidence and remaining release conditions.

Production code will be changed only if verification exposes a Phase-owned defect. Shared registries, permissions, routes and schemas will not be edited merely to create test hooks.

## Validation and test design

- Re-run every Phase 1 through Phase 10 focused suite against a transaction-capable MongoDB replica set.
- Add a release-level contract test that verifies the complete Ophthalmology permission inventory remains seeded only to the approved default role and that protected route families retain their expected module, screen and action gates.
- Verify model indexes cover active configuration uniqueness, one context/result per authoritative source, task idempotency/repeat linkage, branch/station queues, review lookups, publication uniqueness, attachment idempotency and patient/visit history.
- Verify cross-branch and cross-patient rejection, stale writes, duplicate/concurrent attempts, transactional rollback and idempotent replay through the existing phase tests.
- Run General OPD, Dental, Patient portal, Patient document, permission and response-contract regression suites.
- Scan production source for phase-owned mocks, browser persistence, fabricated report data, localhost dependencies, unapproved local production storage and patient-data logging.
- Run API/web typecheck, lint and production builds and record exact results.

## Explicit exclusions

- No new Ophthalmology feature, lifecycle status, clinical threshold, grading scale, mandatory test, master value or permission is introduced.
- No frontend page, prototype, shared-domain subsystem or production data is created.
- No cloud object is written during automated validation; the owner-deferred live GCS smoke test remains a release condition.
- Phase 12 or any later release phase is not started.
