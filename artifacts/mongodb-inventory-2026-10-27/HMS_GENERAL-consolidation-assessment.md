# HMS_GENERAL collection consolidation assessment

Inspected on 27 October 2026 at 11:12 IST. Current branch: `DEV-OPHTHALMOLOGY-F-V2`, HEAD `255eebdbe504ebd6943f3e991021dd35cb550990`, including working-tree changes.

The database contains **91 collections: 53 empty and 38 containing data**. This assessment accounts for every collection. It proposes 12 possible consolidation groups involving 34 collections, recommends retaining 56 collections separately, and identifies one collection whose owner is unknown.

This is analysis only. No database documents, indexes, application code or branch checkouts were changed. Inspection used collection/index metadata, estimated counts and source code; patient and token documents were not read. Counts are estimates at the inspection time, not evidence of recent use.

## Meaning of the ratings

- **Easy:** localized model/storage changes with little workflow impact. Migration and validation are still required.
- **Medium:** several consumers, subtype-specific uniqueness, reference preservation or concurrency-sensitive migration.
- **Difficult:** interconnected clinical, financial or security rules; transactions; broad consumer changes; or security-sensitive rollout.

Code effort and data migration are rated separately. Overall difficulty includes both and the necessary regression checks. These are engineering judgments, not implementation time estimates. An empty collection can still require a difficult code change. Migration ratings assume the current database snapshot and available destination capacity; other environments may contain more data.

## Practical consolidation candidates

The proposal is to share physical storage while preserving distinct models, validation, permissions, services and API contracts. [Mongoose discriminators](https://mongoosejs.com/docs/discriminators.html) support multiple typed models in one collection. Avoid replacing validated records with an unrestricted generic payload.

Suggested destination names below are proposals, not approved contracts.

| ID | Collections to combine | Proposed destination | Code | Migration | Overall | Slots saved |
|---|---|---|---|---|---|---:|
| C01 | `administrationdashboardsnapshots` + `ophthalmologydashboardsnapshots` | `dashboardsnapshots` | Easy | Easy | **Easy** | 1 |
| C02 | `sequences` + `doctorsequences` + `patientnumbersequences` | Reuse `sequences` | Easy | Medium | **Medium** | 2 |
| C03 | `opdfollowups` + `opdreferrals` | `opdcareactions` | Medium | Easy | **Medium** | 1 |
| C04 | `doctorleaves` + `doctoravailabilityexceptions` | `doctorscheduleexceptions` | Medium | Easy | **Medium** | 1 |
| C05 | `laboratory_results` + `imaging_reports` | `clinicalreports` | Medium | Easy | **Medium** | 1 |
| C06 | `opdvitals` + `inpatientvitals` | `clinicalvitals` | Medium | Medium | **Medium** | 1 |
| C07 | `permissioncategories` + `permissiongroups` | `permissioncatalogue` | Medium | Medium | **Medium** | 1 |
| C08 | `ophthalmologyconfigurations` + `ophthalmologyworkflowprofiles` | `ophthalmologysettings` | Medium | Medium | **Medium** | 1 |

The first four groups would save **5 slots: 91 → 86**. All eight would save **9 slots: 91 → 82**. Savings occur only after verified migration, deployment and retirement of old collections. Retaining old collections for rollback does not free capacity. These figures apply only to `HMS_GENERAL`.

### C01 — Dashboard snapshots

Both hold generated snapshots with a localized read/write surface. Administration uses a global `key`; ophthalmology uses `branchId` and `departmentIds`. There is one estimated document across the two collections.

Add `kind: ADMINISTRATION | OPHTHALMOLOGY` with separate schemas and correctly scoped uniqueness. Preserve the global administration record and ophthalmology branch/department scope. Change the two snapshot repositories while keeping response shapes unchanged. Test independent refreshes and branch isolation. This reuses existing snapshot functionality; it does not introduce a new cache layer.

### C02 — Number sequences

All three allocate numbers, but their storage differs: `_id/sequence`, `_id/value`, and `key/value`. Five documents currently exist across these collections.

Reuse `sequences` with collision-free namespaced keys and adapt the doctor/patient allocation paths through repositories. Preserve doctor/year prefixes, patient initialization from existing identifiers, atomic increments and transaction sessions. Inspect the existing sequence migration script and shared service callers. Migrate the greatest valid counter value for each namespace; never reset a counter or assume an empty patient counter means no patients exist.

The schema change is small, but migration is Medium because identifier reuse is unacceptable. Test concurrent allocations, year boundaries, initialization, retries and rollback.

### C03 — OPD follow-ups and referrals

The collections share patient, visit, consultation, doctor and appointment context. Both are empty. Follow-ups have scheduling/reminder fields and `DRAFT/SCHEDULED`; referrals have specialty/facility/priority and `DRAFT/SUBMITTED`.

Use separate `FOLLOW_UP` and `REFERRAL` record types. Both currently have unique `visitId`; the destination must preserve one of each per visit, for example with unique `{ kind, visitId }`. Scope every read, update, upsert and aggregation by type. Change both OPD repositories and consumers in inpatient admissions and ophthalmology.

Test saving both types for the same visit, same-type duplicate prevention, follow-up compliance reporting, referral appointment linking, admission source validation and ophthalmology completion.

### C04 — Doctor leave and day overrides

Both modify a doctor's schedule and both collections are empty. Leave spans a date range and can be cancelled; an availability exception applies to one date with working blocks.

Use `LEAVE` and `DAY_OVERRIDE` types. Retain a partial unique doctor/date index for day overrides only. Preserve cancellation, date-range overlap behavior and working-block rules. The doctor repository is the direct model consumer, but downstream appointment booking and availability require regression tests.

### C05 — Laboratory results and imaging reports

These schemas share order/patient/encounter references, entered/verified metadata and similar indexes. Both are empty. Laboratory results hold result rows; imaging reports hold findings, impression and recommendations.

Use `LAB_RESULT` and `IMAGING_REPORT` types with distinct clinical validation. Preserve report IDs, one-per-type/order constraints, verification and source context. Change laboratory, imaging and patient-portal repositories. Keep current report APIs and permissions. Test result entry, verification and retrieval across OPD, Emergency, IP and procedure sources, including portal visibility.

These are shared Developer 2 domains. Implementation needs coordinated integration, not replacement of their workflows.

### C06 — OPD and inpatient vital readings

Both store measurements, but OPD uses names such as `bloodPressureSystolic`, `temperatureC` and `recordedAt`, while inpatient uses `bpSystolic`, `temperature` and admission/branch context. OPD includes weight/height/BMI; inpatient includes pain score. There are three OPD records and no inpatient records.

Use separate OPD/IP schemas under one collection and preserve existing field/unit contracts through adapters. Do not silently drop fields, equate units or change the meaning of timestamps. Update the OPD and inpatient repositories and patient/encounter/time indexes. Test multiple readings, chronology, permissions and branch isolation.

### C07 — Permission catalogue headings

Categories and groups share code/name/description; groups reference a category. There are 19 documents across the two collections. Actual grants remain in `permissions`, with roles/users unchanged.

Use `CATEGORY` and `GROUP` typed records. Preserve `_id`, parent links and permission references. Update model references, `populate` paths, permission repository and seed logic. Preserve category-only code uniqueness; do not accidentally add a new group or global uniqueness rule.

Test repeatable seeding, populated permission lists, role editing and authorization. This is a shared-file storage change, not a redesign of permission infrastructure.

### C08 — Ophthalmology configuration versions

Both collections hold branch-scoped versioned definitions with effective dates and draft/active/inactive status. They contain 43 documents. Configuration already uses `type` to distinguish 13 catalogue categories.

Use another discriminator field such as `kind`; retain existing `type`. Preserve IDs referenced by `configurationVersionId` and `workflowProfileVersionId`. Keep separate active-version uniqueness for configuration code/category versus workflow visit subtype. Update appointment and ophthalmology repositories and their model references.

Test activation/deactivation, branch isolation, historical encounter references, appointment selection and workflow prerequisites. Do not change clinical configuration semantics.

## More complex options

| ID | Collections to combine | Proposed destination | Code | Migration | Overall | Slots saved |
|---|---|---|---|---|---|---:|
| C09 | `ophthalmologyclinicalreviews`, `ophthalmologyconsultationfinalizations`, `ophthalmologyopticalprescriptions` | `ophthalmologyclinicaldocuments` | Difficult | Medium | **Difficult** | 2 |
| C10 | Seven DHA claim workflow collections, listed below | `dhaclaimrecords` | Difficult | Easy | **Difficult** | 6 |
| C11 | `dhamockremittanceadvices`, `dhamockpaymentallocations`, `dhamockpaymentreconciliations` | `dhafinancialrecords` | Difficult | Easy | **Difficult** | 2 |
| C12 | `otpchallenges`, `passwordresettokens`, `registrationtokens`, `refreshtokens` | `authtokens` | Difficult | Difficult | **Difficult** | 3 |

### C09 — Ophthalmology clinical documents: optional, later

These share visit/context identity and versioning, but differ in clinical approval, completion, amendment and publication behavior. One optical prescription exists.

Retain separate REVIEW, FINALIZATION and OPTICAL documents with their own state machines and per-type/visit uniqueness. Preserve source IDs and versions used by publications. Change ophthalmology repositories, phase-10 publication logic and OPD visit-closure integration. Test concurrent version changes, approvals, amendments, closure and exact-version publication. Combining storage must not turn these into one mutable clinical record.

### C10 — DHA claim workflow: larger saving, substantial work

The seven collections are:

- `dhamockclaimsubmissions`
- `dhamockclaimpreviews`
- `dhamockclaimdischarges`
- `dhamockclaimadjudications`
- `dhamockclaimqueries`
- `dhamockclaimappeals`
- `dhamockclaimclosures`

All are empty, but application services actively reference them. They share claim identity, source fingerprints, external references and audit/version metadata. They are not all append-only events: preserve their distinct mutable workflows and snapshots.

Use seven validated record types. Preserve external references, fingerprints, lifecycle transitions and idempotency. Redesign subtype-specific unique indexes with partial filters; merely prefixing an index with `kind` does not handle absent fields safely. Update DHA services and reporting aggregations, including consumers in remittance/closure. Existing DHA services directly access models; scoped implementation must respect the repository rule and coordinate that work.

Test the full claim lifecycle, query/appeal, stale source fingerprints, duplicate retry, closure prerequisites, transactions and reports.

### C11 — DHA financial records: larger saving, substantial work

All three are empty. Remittance advice, allocations and reconciliation have different cardinalities and totals even though they relate to the same claim.

Keep three record types. Preserve `remittanceAdviceId`, allocation IDs, external references, idempotency and fingerprint constraints. Change allocation/reconciliation/closure/reporting services, retaining atomic transaction behavior. Do not collapse multiple allocations into a single claim-level record or treat them as ordinary billing payments.

Test concurrent allocation limits, partial allocations, retries, rollback, discrepancies and closure totals. C10 and C11 together would turn ten DHA collections into two and save eight slots. Combined with C01–C08, this would give **91 → 74**, before adding any new collections. This is potential capacity, not a recommendation to implement every option.

### C12 — Authentication tokens: possible, but defer

There are 677 refresh-token documents; the other three collections are empty. Token purpose, hashing/format, single-use behavior, revocation and consumers differ.

Registration cleanup uses `expireAfterSeconds: 3600`; OTP, reset and refresh tokens use `0`. A shared collection must preserve this difference, potentially through an explicit `purgeAt` field, while continuing to enforce security expiry separately. [MongoDB TTL documentation](https://www.mongodb.com/docs/manual/core/index-ttl/) explains expiration-based cleanup and its timing.

Every query and mutation must enforce token purpose. Review auth, portal, patient and user consumers. Test cross-purpose rejection, existing sessions, rotation/revocation, OTP attempts/resend, registration consumption and cleanup. Do not include rate-limit buckets or patient access grants. The three-slot saving alone does not justify making this an early change.

## Collections to keep separate

These are recommendations based on the current architecture. They are technically capable of sharing a generic collection, but that does not make consolidation worthwhile. Difficulty means the effort of attempting a merge; no such change is proposed.

| Collections | Difficulty if combined | Reason |
|---|---|---|
| `patients`, `users`, `doctors`, `branches`, `departments`, `services`, `medicines` | Difficult | Widely referenced identities and directories with distinct uniqueness, ownership and access rules. |
| `permissions`, `roles` | Difficult | Preserve permission grants and assignments. C07 covers headings only. |
| `appointments`, `opdvisits`, `opdconsultations`, `opdprescriptions`, `emergencyencounters`, `inpatientadmissions` | Difficult | Scheduling, clinical encounters, documentation, prescribing and admission have different lifecycles and downstream references. |
| `admissionrequests`, `procedurerecommendations`, `procedurebookings` | Difficult | Requests, recommendations and confirmed bookings have different prerequisites, active-record constraints and conversion paths. |
| `hmswards`, `hmsbeds`, `bedholds`, `bedtransfers`, `bedassignmenthistories` | Difficult | Hierarchy, live occupancy, reservations, transfer commands and history have distinct atomicity and audit requirements. |
| `billing_invoices`, `billing_invoice_items`, `billing_payments`, `advancepayments` | Difficult | Invoice, item, payment transaction and deposit requirement are different records. AdvancePayment is a requirement/balance record, not another payment ledger. Embedding invoice items is conceivable but affects claims, portal and reporting; not recommended just for one slot. |
| `payers`, `insuranceschemes`, `insurancepolicies`, `insurancemembers`, `insurancebenefitconfigs`, `insuranceeligibilityverifications`, `insuranceauthorizations`, `insuranceclaims`, `shaservicemappings` | Difficult | Different parent-child, membership, coverage, verification, authorization and claim contracts. Consider DHA groups separately. |
| `pharmacy_medicine_inventory`, `pharmacy_medicine_batches`, `pharmacy_medicine_stock_movements`, `pharmacydispensings` | Difficult | Stock balance, expiry batch, movement history and fulfilment are separate consistency boundaries. |
| `patientdocuments`, `ophthalmologyattachments`, `ophthalmologypublications`, `guardianprofiles`, `patientaccessgrants` | Difficult | File metadata, clinical linkage, approved publication snapshots, guardian identity and access authorization differ. Existing document/publication lookups enforce visibility. |
| `auditlogs`, `patienttimelineevents`, `notifications`, `authratelimits` | Difficult | Different audiences, payloads and retention. Expiring counters must not impose TTL deletion on durable clinical/audit records. |
| `admissionpolicies`, `consenttemplates`, `systemsettings`, `ophthalmologystations`, `ophthalmologycontexts`, `inpatientroundnotes` | Difficult | Distinct prerequisite, consent, system-setting, station, clinical-context and narrative-note contracts. No compelling saving offsets added coupling. |
| `opdclinicalorders` | Difficult | Already combines LABORATORY and IMAGING using `orderType`. Keep orders distinct from reports, prescriptions and appointments. |
| `mpesa_callback_events` | Unknown | One estimated document and four indexes; no matching model or collection-name reference found in current backend source. Confirm external-service/other-branch ownership. Not classified as unused. |

## Migration issues found in this database

1. The earlier cluster inventory totals 500 collections across six databases. This review covers only `HMS_GENERAL`. A new destination collection needs capacity; reusing an existing source collection is an alternative but still requires compatibility planning. An in-cluster backup copy also consumes collection capacity.
2. Four model-defined collections are absent: `ophthalmologyalerts`, `ophthalmologyintakes`, `ophthalmologytestresults`, `ophthalmologytesttasks`. Their first writes may require new collections. They are excluded from the 91-collection savings. Adding all four after the nine-slot practical reduction would produce 86 collections here, assuming no other changes.
3. Live indexes and current model declarations differ. For example, `ophthalmologyopticalprescriptions` currently has only `_id` indexed although the model declares unique `visitId`. `appointments` retains dental-context indexes absent from the current model, and `billing_invoice_items` has a live procedure-specific unique index. Investigate ownership/history and duplicates; do not discard live constraints just because this branch does not declare them.
4. Type-specific uniqueness is essential. `{ kind, visitId }` fits C03. Optional subtype fields may instead need a partial unique index. [MongoDB partial index documentation](https://www.mongodb.com/docs/manual/core/index-partial/) explains that uniqueness applies to matching documents.
5. Review raw aggregations, `$lookup`, `$unionWith`, `populate` and literal collection names. Pointing a model at a shared collection does not automatically add subtype filters inside a raw lookup. Patient/publication visibility and bed/report queries are notable examples.
6. Preserve `_id` and all references. Detect destination key collisions before migration. Do not renumber patient/doctor IDs, reset counters, change scope or rewrite approved clinical/payment/consent rules.
7. Older deployments can continue writing or recreate old collections. Earlier checks found `DEV-GENERAL` and `Insurance-Module-v1-F` at `a12bb85`. Shared modules need coordinated changes before source collections are retired. This review does not establish which deployment uses which database.

## Suggested order and verification

Start with C01, then C02 with explicit counter/concurrency checks, followed by C03 and C04. Those four groups save five slots after retirement. Consider C05–C08 after shared-domain review and stable initial changes. Evaluate C10/C11 only when their extra capacity justifies the insurance regression effort. Defer C09/C12 unless there is another product or maintenance reason.

Before a cutover: preserve an external backup, coordinate old writers, retain IDs, validate copied records and indexes, test rollback, and retire source collections only after explicit authorization. Nothing was retired during this review.

Keep frontend routes, hooks and API responses unchanged where possible. Most proposed changes belong in models, repositories and migration scripts. Preserve the existing frontend architecture. If a feature contract changes, reassess scope and difficulty. Shared files and Developer 2 integrations need coordinated review; this analysis starts no implementation phase.

Implementation must pass API and web typecheck/lint/build, plus focused persistence, permission/scope, uniqueness, stale-state, concurrency, rollback/idempotency and browser tests. No implementation tests were run for this read-only assessment.

## Source evidence and estimated impact

These are direct model-reference consumers outside tests and model declarations, including seed/migration scripts. They are a lower bound for impacted files; indirect services, routes and UI integration tests still need review.

### C01

Estimated source documents: 1. Direct consumers: 2.

Model files: [apps/api/src/modules/administration-dashboard/administration-dashboard.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/administration-dashboard/administration-dashboard.model.ts), [apps/api/src/modules/ophthalmology/ophthalmology-phase10.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/ophthalmology/ophthalmology-phase10.model.ts).

Consumers: [apps/api/src/modules/administration-dashboard/administration-dashboard.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/administration-dashboard/administration-dashboard.repository.ts), [apps/api/src/modules/ophthalmology/ophthalmology-phase10.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/ophthalmology/ophthalmology-phase10.repository.ts).

### C02

Estimated source documents: 5. Direct consumers: 4.

Model files: [apps/api/src/modules/doctors/doctor-scheduling.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/doctors/doctor-scheduling.model.ts), [apps/api/src/modules/patients/patient-number.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patients/patient-number.model.ts), [apps/api/src/shared/sequence/sequence.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/sequence/sequence.model.ts).

Consumers: [apps/api/src/modules/doctors/doctor.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/doctors/doctor.repository.ts), [apps/api/src/modules/patients/patient.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patients/patient.repository.ts), [apps/api/src/scripts/migrate-sequences.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/scripts/migrate-sequences.ts), [apps/api/src/shared/sequence/sequence.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/shared/sequence/sequence.service.ts).

### C03

Estimated source documents: 0. Direct consumers: 4.

Model files: [apps/api/src/modules/opd/opd-follow-up.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/opd/opd-follow-up.model.ts), [apps/api/src/modules/opd/opd-referral.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/opd/opd-referral.model.ts).

Consumers: [apps/api/src/modules/opd/opd-follow-up.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/opd/opd-follow-up.repository.ts), [apps/api/src/modules/ophthalmology/ophthalmology.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/ophthalmology/ophthalmology.repository.ts), [apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts), [apps/api/src/modules/opd/opd-referral.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/opd/opd-referral.repository.ts).

### C04

Estimated source documents: 0. Direct consumers: 1.

Model files: [apps/api/src/modules/doctors/doctor-scheduling.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/doctors/doctor-scheduling.model.ts).

Consumers: [apps/api/src/modules/doctors/doctor.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/doctors/doctor.repository.ts).

### C05

Estimated source documents: 0. Direct consumers: 3.

Model files: [apps/api/src/modules/imaging/imaging-report.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/imaging/imaging-report.model.ts), [apps/api/src/modules/laboratory/laboratory-result.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/laboratory/laboratory-result.model.ts).

Consumers: [apps/api/src/modules/imaging/imaging.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/imaging/imaging.repository.ts), [apps/api/src/modules/patient-portal/patient-portal.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.repository.ts), [apps/api/src/modules/laboratory/laboratory.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/laboratory/laboratory.repository.ts).

### C06

Estimated source documents: 3. Direct consumers: 2.

Model files: [apps/api/src/modules/inpatient-admissions/inpatient-clinical-record.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/inpatient-admissions/inpatient-clinical-record.model.ts), [apps/api/src/modules/opd/opd-vitals.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/opd/opd-vitals.model.ts).

Consumers: [apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts), [apps/api/src/modules/opd/opd-vitals.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/opd/opd-vitals.repository.ts).

### C07

Estimated source documents: 19. Direct consumers: 2.

Model files: [apps/api/src/modules/permissions/permission.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/permissions/permission.model.ts).

Consumers: [apps/api/src/database/seed.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/database/seed.ts), [apps/api/src/modules/permissions/permission.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/permissions/permission.repository.ts).

### C08

Estimated source documents: 43. Direct consumers: 2.

Model files: [apps/api/src/modules/ophthalmology/ophthalmology.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/ophthalmology/ophthalmology.model.ts).

Consumers: [apps/api/src/modules/appointments/appointment.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/appointments/appointment.repository.ts), [apps/api/src/modules/ophthalmology/ophthalmology.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/ophthalmology/ophthalmology.repository.ts).

### C09

Estimated source documents: 1. Direct consumers: 3.

Model files: [apps/api/src/modules/ophthalmology/ophthalmology-review.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/ophthalmology/ophthalmology-review.model.ts), [apps/api/src/modules/ophthalmology/ophthalmology-consultation.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/ophthalmology/ophthalmology-consultation.model.ts).

Consumers: [apps/api/src/modules/ophthalmology/ophthalmology.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/ophthalmology/ophthalmology.repository.ts), [apps/api/src/modules/opd/opd-visit.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/opd/opd-visit.service.ts), [apps/api/src/modules/ophthalmology/ophthalmology-phase10.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/ophthalmology/ophthalmology-phase10.repository.ts).

### C10

Estimated source documents: 0. Direct consumers: 9.

Model files: [apps/api/src/modules/insurance/dha/dha-claim-adjudication.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-adjudication.model.ts), [apps/api/src/modules/insurance/dha/dha-claim-appeal.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-appeal.model.ts), [apps/api/src/modules/insurance/dha/dha-claim-closure.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-closure.model.ts), [apps/api/src/modules/insurance/dha/dha-claim-discharge.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-discharge.model.ts), [apps/api/src/modules/insurance/dha/dha-claim-preview.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-preview.model.ts), [apps/api/src/modules/insurance/dha/dha-claim-query.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-query.model.ts), [apps/api/src/modules/insurance/dha/dha-claim-submission.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-submission.model.ts).

Consumers: [apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts), [apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts), [apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts), [apps/api/src/modules/insurance/dha/dha-claim-query.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-query.service.ts), [apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts), [apps/api/src/modules/insurance/dha/dha-remittance-advice.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-remittance-advice.service.ts), [apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts), [apps/api/src/modules/insurance/dha/dha-claim-preview.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-preview.service.ts), [apps/api/src/modules/insurance/dha/dha-claim-submission.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-submission.service.ts).

### C11

Estimated source documents: 0. Direct consumers: 5.

Model files: [apps/api/src/modules/insurance/dha/dha-payment-allocation.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-payment-allocation.model.ts), [apps/api/src/modules/insurance/dha/dha-payment-reconciliation.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-payment-reconciliation.model.ts), [apps/api/src/modules/insurance/dha/dha-remittance-advice.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-remittance-advice.model.ts).

Consumers: [apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts), [apps/api/src/modules/insurance/dha/dha-payment-allocation.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-payment-allocation.service.ts), [apps/api/src/modules/insurance/dha/dha-payment-reconciliation.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-payment-reconciliation.service.ts), [apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts), [apps/api/src/modules/insurance/dha/dha-remittance-advice.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/insurance/dha/dha-remittance-advice.service.ts).

### C12

Estimated source documents: 677. Direct consumers: 6.

Model files: [apps/api/src/modules/patient-portal/otp-challenge.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/otp-challenge.model.ts), [apps/api/src/modules/auth/auth.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/auth.model.ts), [apps/api/src/modules/auth/refresh-token.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/refresh-token.model.ts), [apps/api/src/modules/patient-portal/registration-token.model.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/registration-token.model.ts).

Consumers: [apps/api/src/modules/patient-portal/patient-otp.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-otp.repository.ts), [apps/api/src/modules/auth/auth.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/auth/auth.repository.ts), [apps/api/src/modules/patient-portal/patient-portal.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-portal.repository.ts), [apps/api/src/modules/patients/patient.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patients/patient.repository.ts), [apps/api/src/modules/users/user.repository.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/users/user.repository.ts), [apps/api/src/modules/patient-portal/patient-otp.service.ts](C:/Users/lenovo/Documents/GitHub/HMS/apps/api/src/modules/patient-portal/patient-otp.service.ts).

## Complete register of all 91 collections

Each collection appears exactly once. Candidate means a design option, not approval to merge or delete.

| Collection | Estimated documents | Assessment | Group | Difficulty if combined |
|---|---:|---|---|---|
| administrationdashboardsnapshots | 1 | Candidate | C01 | Easy |
| admissionpolicies | 0 | Keep separate | — | Difficult |
| admissionrequests | 1 | Keep separate | — | Difficult |
| advancepayments | 0 | Keep separate | — | Difficult |
| appointments | 5 | Keep separate | — | Difficult |
| auditlogs | 1247 | Keep separate | — | Difficult |
| authratelimits | 0 | Keep separate | — | Difficult |
| bedassignmenthistories | 0 | Keep separate | — | Difficult |
| bedholds | 0 | Keep separate | — | Difficult |
| bedtransfers | 0 | Keep separate | — | Difficult |
| billing_invoice_items | 1 | Keep separate | — | Difficult |
| billing_invoices | 1 | Keep separate | — | Difficult |
| billing_payments | 0 | Keep separate | — | Difficult |
| branches | 3 | Keep separate | — | Difficult |
| consenttemplates | 0 | Keep separate | — | Difficult |
| departments | 4 | Keep separate | — | Difficult |
| dhamockclaimadjudications | 0 | Candidate | C10 | Difficult |
| dhamockclaimappeals | 0 | Candidate | C10 | Difficult |
| dhamockclaimclosures | 0 | Candidate | C10 | Difficult |
| dhamockclaimdischarges | 0 | Candidate | C10 | Difficult |
| dhamockclaimpreviews | 0 | Candidate | C10 | Difficult |
| dhamockclaimqueries | 0 | Candidate | C10 | Difficult |
| dhamockclaimsubmissions | 0 | Candidate | C10 | Difficult |
| dhamockpaymentallocations | 0 | Candidate | C11 | Difficult |
| dhamockpaymentreconciliations | 0 | Candidate | C11 | Difficult |
| dhamockremittanceadvices | 0 | Candidate | C11 | Difficult |
| doctoravailabilityexceptions | 0 | Candidate | C04 | Medium |
| doctorleaves | 0 | Candidate | C04 | Medium |
| doctors | 5 | Keep separate | — | Difficult |
| doctorsequences | 1 | Candidate | C02 | Medium |
| emergencyencounters | 0 | Keep separate | — | Difficult |
| guardianprofiles | 0 | Keep separate | — | Difficult |
| hmsbeds | 0 | Keep separate | — | Difficult |
| hmswards | 0 | Keep separate | — | Difficult |
| imaging_reports | 0 | Candidate | C05 | Medium |
| inpatientadmissions | 0 | Keep separate | — | Difficult |
| inpatientroundnotes | 0 | Keep separate | — | Difficult |
| inpatientvitals | 0 | Candidate | C06 | Medium |
| insuranceauthorizations | 0 | Keep separate | — | Difficult |
| insurancebenefitconfigs | 0 | Keep separate | — | Difficult |
| insuranceclaims | 0 | Keep separate | — | Difficult |
| insuranceeligibilityverifications | 0 | Keep separate | — | Difficult |
| insurancemembers | 0 | Keep separate | — | Difficult |
| insurancepolicies | 0 | Keep separate | — | Difficult |
| insuranceschemes | 0 | Keep separate | — | Difficult |
| laboratory_results | 0 | Candidate | C05 | Medium |
| medicines | 6 | Keep separate | — | Difficult |
| mpesa_callback_events | 1 | Owner review | — | Unknown |
| notifications | 0 | Keep separate | — | Difficult |
| opdclinicalorders | 2 | Keep separate | — | Difficult |
| opdconsultations | 5 | Keep separate | — | Difficult |
| opdfollowups | 0 | Candidate | C03 | Medium |
| opdprescriptions | 1 | Keep separate | — | Difficult |
| opdreferrals | 0 | Candidate | C03 | Medium |
| opdvisits | 7 | Keep separate | — | Difficult |
| opdvitals | 3 | Candidate | C06 | Medium |
| ophthalmologyattachments | 0 | Keep separate | — | Difficult |
| ophthalmologyclinicalreviews | 0 | Candidate | C09 | Difficult |
| ophthalmologyconfigurations | 22 | Candidate | C08 | Medium |
| ophthalmologyconsultationfinalizations | 0 | Candidate | C09 | Difficult |
| ophthalmologycontexts | 5 | Keep separate | — | Difficult |
| ophthalmologydashboardsnapshots | 0 | Candidate | C01 | Easy |
| ophthalmologyopticalprescriptions | 1 | Candidate | C09 | Difficult |
| ophthalmologypublications | 0 | Keep separate | — | Difficult |
| ophthalmologystations | 0 | Keep separate | — | Difficult |
| ophthalmologyworkflowprofiles | 21 | Candidate | C08 | Medium |
| otpchallenges | 0 | Candidate | C12 | Difficult |
| passwordresettokens | 0 | Candidate | C12 | Difficult |
| patientaccessgrants | 1 | Keep separate | — | Difficult |
| patientdocuments | 2 | Keep separate | — | Difficult |
| patientnumbersequences | 0 | Candidate | C02 | Medium |
| patients | 6 | Keep separate | — | Difficult |
| patienttimelineevents | 34 | Keep separate | — | Difficult |
| payers | 0 | Keep separate | — | Difficult |
| permissioncategories | 3 | Candidate | C07 | Medium |
| permissiongroups | 16 | Candidate | C07 | Medium |
| permissions | 237 | Keep separate | — | Difficult |
| pharmacy_medicine_batches | 6 | Keep separate | — | Difficult |
| pharmacy_medicine_inventory | 6 | Keep separate | — | Difficult |
| pharmacy_medicine_stock_movements | 0 | Keep separate | — | Difficult |
| pharmacydispensings | 0 | Keep separate | — | Difficult |
| procedurebookings | 1 | Keep separate | — | Difficult |
| procedurerecommendations | 3 | Keep separate | — | Difficult |
| refreshtokens | 677 | Candidate | C12 | Difficult |
| registrationtokens | 0 | Candidate | C12 | Difficult |
| roles | 33 | Keep separate | — | Difficult |
| sequences | 4 | Candidate | C02 | Medium |
| services | 18 | Keep separate | — | Difficult |
| shaservicemappings | 0 | Keep separate | — | Difficult |
| systemsettings | 1 | Keep separate | — | Difficult |
| users | 14 | Keep separate | — | Difficult |
