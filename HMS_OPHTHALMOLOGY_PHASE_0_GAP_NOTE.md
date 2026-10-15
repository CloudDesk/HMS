# HMS Ophthalmology OPD Phase 0 Gap Note

## Phase status

**Status:** COMPLETE - READY FOR PHASE 1

**Analysis date:** 15 October 2026

**Branch:** `Dev-Ophthalmology-K`

**Scope:** Contract reconciliation, repository baseline, dependency inventory, proposed data and API design, and verification only. No backend feature implementation was performed.

## Controlling sources

The following sources were reconciled in order:

1. `PROJECT_RULES.md`.
2. `HMS_Engineering_Best_Practices_Checklist.md`.
3. `Ophthalmology_OPD_Consultation_Functional_Specification_Document.docx`, version 1.0 dated 10 September 2026.
4. `HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX.md`.
5. `HMS_Ophthalmology_OPD_Developer_A_Backend_Prompts.md`.
6. Existing backend and frontend contracts.
7. `scope/HMS Local` OPD and appointment prototypes for interaction context only.

The repository `AGENTS.md` is written for Scope 2 Phase 3 IP, Surgery, and Emergency work. Its architecture, safety, phase-gate, and verification rules remain applicable, but its functional scope does not replace the dedicated Ophthalmology FSD. The referenced `doc/HMS_Release2_FSD.docx` is absent. That missing unrelated release document does not block this Ophthalmology phase because the Ophthalmology FSD exists and DEC-01 through DEC-12 were approved by the project owner on 15 October 2026.

## Initial working tree

Before Phase 0 completion work, the working tree contained:

- Modified `HMS_Ophthalmology_OPD_Developer_A_Backend_Prompts.md`.
- Untracked `HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX.md`.

These are the user-requested Ophthalmology planning artifacts. No unrelated file was reverted, overwritten, or reformatted.

## Existing functionality inventory

| Domain | Existing implementation to reuse | Confirmed gap or conflict |
|---|---|---|
| OPD visit | `opd-visit` model/repository/service/routes; branch-scoped lists, pagination, queue and status handling | Shared visit type/status does not express the approved Ophthalmology subtype and specialty workflow. Status mutation has no caller-supplied expected version. |
| OPD consultation | One consultation per visit; structured basic diagnosis; draft and completion routes | Only `DRAFT \| COMPLETED`; no laterality/status/severity/differential diagnosis fields, Ophthalmology review lifecycle, immutable versions, or amendment episode. Completion performs several writes without one transaction. |
| OPD clinical orders | Reusable laboratory/imaging order aggregate with source context, indexes, queues, audit hooks, and conditional operational status update | OPD submit requires a completed consultation, preventing tests during consultation. Multiple service items are aggregated under one order while Ophthalmology needs a task per test. Typed lookup falls back to generic billing services. |
| OPD prescriptions | Existing medication prescription and pharmacy source of truth | Missing optional eye, start date, taper, refill, and ophthalmic instruction fields. Optical prescription needs a separate Ophthalmology resource. |
| OPD follow-up/referral | Existing models, services, routes, status and visit linkage | Laterality, pre-review tests, and Ophthalmology clinical context require additive contract review. |
| Patients | Search, identity, profile, document metadata/review, consent metadata, timeline and clinical audit helpers | Ophthalmic attachment metadata and explicit portal publication are missing. No duplicate patient system is required. |
| Appointments/doctors/departments | Appointment context, department mapping, doctor availability and user mapping | No general technician/station shift availability contract. Doctor availability must not be reused for technicians. |
| Services | Typed service catalogue and billing services | The clinical-order fallback to generic billing services violates typed catalogue integrity. Ophthalmology test/station configuration remains separate from billable-service identity. |
| Laboratory/imaging | Existing operational queues and verified/result-report records sourced from OPD clinical orders | Ophthalmology must reference shared order items/results and must not create duplicate verified results. Laterality/clinical-reason additions require compatible additive contracts. |
| Surgery/procedure | Existing recommendation and booking domain with source encounter linkage | Ophthalmology passes diagnosis, eye and reason through an approved additive handoff; no new surgery domain. |
| Billing | Existing billing and finance reporting source of truth | Ophthalmology may emit idempotent charge triggers but must not calculate finance totals or duplicate reports. |
| Consent | Existing consent templates and patient-document consent context | Dilation, guardian, and procedure consent references require contract verification in their consuming phases. |
| Permissions | Database-loaded `module/screen/action` permissions; denied-access audit; seed reconciliation; `SUPER_ADMIN` support | Ophthalmology screens/actions do not exist yet. Clinical roles must not receive implicit grants. |
| Transactions | Shared `executeTransaction` helper and repository sessions | The helper currently falls back to non-transactional execution on unsupported MongoDB deployments. Patient-safety-critical Ophthalmology atomic workflows must fail when transaction capability is required rather than silently degrading. |
| Storage | Patient document abstraction with local development storage | Production Google Cloud Storage behavior and Ophthalmology MIME/size/retention/publication policy are not implemented in this abstraction. Vendor parsing remains unavailable. |
| Dashboard/reporting | Administration snapshot model and background-style summary patterns; paginated operational lists | Ophthalmology snapshots and six mandatory workflow reports do not exist. |
| Service registration | Central service registry and `modules/index.ts` route registration | Ophthalmology repository/service/routes must be added minimally in the approved phase. |

## Prototype findings

The HMS Local OPD prototype supplies useful layout and interaction patterns: patient header, tabbed clinical workspace, queue table and side panel, sticky actions, order builders, status badges, timeline, document cards, and completion confirmation. Its implementation uses static arrays, mock JSON, `localStorage`, and browser-only state. Those data and persistence mechanisms are prohibited in production and will not be copied.

## Approved architecture and ownership

Ophthalmology remains an enhancement to the existing OPD encounter. New specialty-owned resources will live under `apps/api/src/modules/ophthalmology`. Shared-domain changes remain in their existing modules and must be additive and backward-compatible.

The proposed specialty resource set is:

- `OphthalmologyEncounterContext`: one per eligible OPD visit; stores subtype, approved specialty workflow status, laterality context, configuration snapshot and optimistic version.
- `OphthalmologyConfigurationVersion`: branch-scoped, effective-dated configuration for masters, thresholds, mandatory rules and form profiles. Clinical values remain empty until approved values are supplied.
- `OphthalmologyStation` and `OphthalmologyWorkflowProfile`: branch station membership, supported tests, devices, ordered stage groups and bypass rules.
- `OphthalmologyTestTask`: one independently traceable task per test/order item with assignment, station, status, expected version and full transition history.
- `OphthalmologyTestResultVersion`: immutable versioned form payload, source readings, calculated values, quality/reliability, provenance, attachments and review state.
- `OphthalmologyTriage`: versioned complaint, ophthalmic history, emergency criteria and alert references.
- `OphthalmologyClinicalReview`: doctor review state, alert acknowledgements, deferred results, overrides and approval events.
- `OphthalmologyOpticalPrescription`: separate structured optical prescription with version, approval and validity.
- `OphthalmologyPublication`: explicit internal, portal-approved and withdrawn publication records.
- `OphthalmologyDashboardSnapshot`: bounded operational metrics for dashboards; detailed reports remain indexed and paginated.

Models may be combined only when repository inspection during the consuming phase proves that doing so preserves indexing, ownership, immutability and query performance. The API contract is authoritative for behavior; physical collection choices remain phase design decisions.

## Proposed index and uniqueness plan

| Resource | Required indexes or constraints |
|---|---|
| Encounter context | Unique active `visitId`; `{ branchId, workflowStatus, updatedAt }`; `{ patientId, createdAt }`; `{ doctorId, workflowStatus, updatedAt }`. |
| Configuration | Unique `{ branchId, configurationType, version }`; one active/effective version enforced with conditional update and validation; `{ branchId, effectiveFrom, status }`. |
| Station | Unique active `{ branchId, code }`; `{ branchId, active, supportedTestTypes }`; membership lookup index. |
| Workflow profile | Unique `{ branchId, visitSubtype, version }`; `{ branchId, status, effectiveFrom }`. |
| Test task | Unique task identity per encounter/order-item/test/repeat generation; `{ branchId, stationId, status, priority, assignedAt }`; `{ assignedUserId, status, priority }`; `{ encounterId, status }`; `{ originalTaskId, repeatNumber }`. |
| Result version | Unique `{ taskId, version }`; `{ encounterId, testType, eye, completedAt }`; `{ taskId, reviewStatus, createdAt }`; immutable completed/reviewed versions. |
| Triage/review | Unique active record per encounter/version; alert and pending-review indexes by branch, status and due date. |
| Optical prescription | `{ encounterId, status, updatedAt }`; `{ patientId, approvedAt }`; unique active version identity. |
| Publication | Unique `{ resourceType, resourceId, resourceVersion, channel }`; `{ patientId, status, publishedAt }`. |
| Snapshot | Unique `{ branchId, snapshotType, bucketStart }`; TTL only for explicitly approved transient snapshots, never clinical history. |

Exact partial-filter expressions and migration scripts must be reviewed against production data before creation.

## Transaction concurrency and idempotency boundaries

- Consultation and test mutations require `expected_status` and `expected_version`; stale mutations return `409 OPHTHALMOLOGY_VERSION_CONFLICT` or `409 OPHTHALMOLOGY_STATUS_CONFLICT`.
- Completion atomically writes the immutable consultation version, Ophthalmology status, global OPD status, authenticated approval event, audit event and timeline event. Appointment status participates in the same transaction when it is part of the local MongoDB boundary.
- Test completion/review atomically freezes the result version, changes the task state and records audit/review metadata.
- Repeat creation preserves the original result and creates exactly one linked repeat task under an idempotency/source key.
- Assignment/reassignment conditionally validates task state and server-derived eligibility immediately before update.
- Shared orders, charges and publication use stable source/idempotency keys. External or separate-domain work that cannot join the transaction uses an explicit outbox/compensation or retry-safe handoff approved in the consuming phase.
- A transaction-required clinical workflow must not use the current standalone-Mongo fallback. It must return a clear service-configuration error when atomicity cannot be provided.

## Permission inventory

The approved DEC-07 screens/actions are the contract. Phase 2 will seed these permissions under module `OPD` and grant them automatically only through the existing `SUPER_ADMIN` reconciliation. Other role grants are explicit administrative configuration.

All actions additionally validate active user, organization, branch, Ophthalmology department, patient/encounter, station membership, assignment, test/resource and record state.

## Phase allocation and entry dependencies

| Phase | Scope | Entry dependency |
|---|---|---|
| 1 | Existing OPD defect correction and transactional/version foundation | This Phase 0 complete; concrete shared-file diff review before editing. |
| 2 | Ophthalmology context, structural configuration, stations and permissions | Phase 1 approved; no invented clinical values. |
| 3 | Triage, history and emergency escalation | Approved complaint/emergency configuration and notification contract. |
| 4 | Test tasks, station queues and lifecycle | Phase 2 configuration plus approved DEC-04/DEC-12 contract. |
| 5 | Core clinical test forms | Applicable DEC-06 values and DEC-10 file policy. |
| 6 | Advanced diagnostics | Applicable clinical values, file policy and any vendor adapter contract. |
| 7 | Contact lens and paediatric assessments | Consent/guardian and catalogue contracts verified. |
| 8 | Consolidated doctor review, diagnosis, plans and prescriptions | Shared diagnosis/prescription/order/result contracts verified. |
| 9 | Completion, approval, amendment and summary | Configured completion prerequisites supplied. |
| 10 | Integrations, portal, reports and dashboards | Authoritative domain APIs and publication/storage policy verified. |
| 11 | End-to-end hardening | Phases 1 through 10 approved and all required configuration present. |

## Phase 1 intended files

Phase 1 is limited to existing OPD/shared foundations and focused tests. Candidate files, subject to a fresh diff inspection, are:

- `apps/api/src/modules/opd/opd-clinical-order.service.ts`
- `apps/api/src/modules/opd/opd-clinical-order.repository.ts`
- `apps/api/src/modules/opd/opd-clinical-order.model.ts`
- `apps/api/src/modules/opd/opd-clinical-order.types.ts`
- `apps/api/src/modules/opd/opd-clinical-order.schemas.ts`
- `apps/api/src/modules/opd/opd-consultation.service.ts`
- `apps/api/src/modules/opd/opd-consultation.repository.ts`
- `apps/api/src/modules/opd/opd-consultation.model.ts`
- `apps/api/src/modules/opd/opd-consultation.types.ts`
- `apps/api/src/modules/opd/opd-consultation.schemas.ts`
- `apps/api/src/modules/opd/opd-visit.repository.ts`
- `apps/api/src/modules/opd/opd-visit.service.ts`
- `apps/api/src/shared/database/transaction.ts` only if a minimal transaction-required option is necessary and compatible with existing callers.
- New or updated focused OPD tests beside the affected modules.

Phase 1 must not add Ophthalmology forms, stations, queues, clinical masters, portal publishing, reports, or frontend behavior.

## Remaining dependencies that do not block Phase 1

- DEC-06 clinical master values, thresholds, mandatory fields/tests and completion profiles: `PENDING CONFIGURATION`.
- DEC-10 MIME types, file-size limits, retention, DICOM/video/annotation policy: `PENDING POLICY`.
- Device/vendor import payloads and samples: `PENDING ADAPTER CONTRACT`.
- Role grants beyond `SUPER_ADMIN`: explicit administrative/clinical assignment required.
- Real-time technician shift availability: deferred; active eligible membership is authoritative under DEC-12.
- Concrete shared-domain field changes: verify in each consuming phase and stop on contract conflict.

## Phase 0 conclusion

The FSD is traceable, all 12 design decisions are approved, the repository baseline and shared dependencies are inventoried, the data/index/transaction/permission plan is defined, the versioned API contract exists, and baseline verification is recorded. Phase 0 is complete. Phase 1 has not started.
