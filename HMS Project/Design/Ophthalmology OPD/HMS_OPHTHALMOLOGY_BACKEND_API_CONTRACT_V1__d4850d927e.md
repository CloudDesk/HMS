# HMS Ophthalmology Backend API Contract V1

## Contract status

### 21 October three-gap safety correction (working tree)

Acknowledgement remains receipt only (`ACTIVE | ACKNOWLEDGED`). Routine test start/save/finalize and consultation readiness/override/sign-off now reject an existing `EMERGENCY_SCREENING` alert with `409 OPHTHALMOLOGY_EMERGENCY_ESCALATION_REQUIRED`, including after acknowledgement. Emergency-priority testing, clinician documentation, read-only review and existing Emergency workflows remain available. No clearance transition or disposition values have been approved or added; routine resumption for such an encounter remains blocked until the clinical owner approves and the application implements that contract. Completion overrides cannot supply clearance.

The existing consultation summary adds nullable `summary.emergency_source`: `{ emergency_encounter_id, encounter_number, appointment_id, visit_id, patient_id, referred_at, priority }`. It is derived only through the existing Emergency referral appointment relationship after destination visit/appointment/patient/branch/department validation. It contains no Emergency clinical notes. Conflicting multiple source referrals return `409 OPHTHALMOLOGY_SOURCE_CONFLICT`; an absent or invalid relationship is never reported as linked. This read does not create/reuse by patient match alone, or create any encounter. Same-branch direct appointment links are supported; cross-branch or rescheduled-appointment ancestry needs an approved extension.

Emergency referral booking validates patient/target department/target doctor in its conditional repository link. The link and `emergency.referral.booked` audit now use one required transaction. Appointment creation remains owned by Appointments; failed linking cancels the newly created appointment using its existing status service. An uncertain commit is reread before compensation. Failed cancellation returns `409 EMERGENCY_REFERRAL_BOOKING_RECONCILIATION_REQUIRED` with `appointment_id` for manual review before retry. A process failure between the independent Appointment operation and linking still needs a durable cross-service idempotency/reconciliation contract; this change does not claim a distributed transaction.

Existing summary downstream projections now retain actual recommendation/referral/follow-up `status`, nullable `appointment_id` for referral/follow-up, and nullable `booking_id`/`booking_status` for recommendations. Booking status requires matching booking, recommendation, patient and branch. Follow-up date is mapped from `nextVisitDate`; procedure name/reason from `serviceName`/`clinicalReason`. Medication request status already reflects the shared prescription lifecycle, including Pharmacy's `DISPENSED`. These source states are separate from doctor sign-off; `SUBMITTED`, `SCHEDULED` and `BOOKED` do not establish whole-journey completion. No aggregate fulfillment enum or new mutation endpoint is introduced. Existing clinical prerequisites and signed snapshots remain authoritative; current summary reads can refresh downstream states independently.

**Version:** 2.0.0 (C9 structured treatment-plan major revision, 22 October 2026)

**Baseline date:** 15 October 2026

**Authority:** Ophthalmology FSD v1.0 plus approved DEC-01 through DEC-12

**Implementation state:** Backend/staff/patient integration remediation implemented in the working tree; final verification and clinical release acceptance remain open. Historical phase completion does not certify every FSD detail.

**Compatibility:** Additive to existing OPD/shared-domain APIs, but intentionally breaking for Ophthalmology clinical-review treatment-plan writes. Historical category-only rows remain readable and are never guessed into a new action type.

**Frontend handoff:** C10 STRUCTURED-TREATMENT FRONTEND IMPLEMENTED AND AUTOMATED-VERIFIED. Clinical-review drafts and typed treatment-plan amendments now use the 2.0.0 `action_type` and matching-reference contract. Historical `legacy_category` rows remain view-only until a clinician explicitly reclassifies them. Interactive live browser acceptance remains a release-verification item; the API contract version remains 2.0.0 because C10 did not change backend semantics.

This contract freezes the backend vocabulary, ownership, endpoint families, lifecycle, concurrency, permission and error behavior required for phase-wise implementation. A consuming phase must update the contract with exact request/response schemas before exposing its routes. Missing clinical values and file/vendor policy inputs remain configuration dependencies and are never inferred.

## 2.0 structured treatment-plan contract

`PUT /api/opd/visits/:visitId/ophthalmology/clinical-review/draft` and treatment-plan corrections through `POST /api/opd/visits/:visitId/ophthalmology/amendments` require each item to contain:

- `diagnosis_code`, `diagnosis_laterality`, nonblank `treatment`, `action_type`, `priority`, and `status`.
- `action_type`: `MEDICATION | OPTICAL | INVESTIGATION | PROCEDURE | REFERRAL | FOLLOW_UP | OTHER`.
- Exactly the matching authoritative reference for the chosen action: `medication_prescription_id`, `optical_prescription_id`, one or more unique `clinical_order_ids`, `procedure_recommendation_id`, `referral_id`, or `follow_up_id`. `OTHER` accepts narrative treatment only and forbids all downstream references.
- `priority`: `ROUTINE | URGENT | EMERGENCY`; `status`: `PLANNED | ACTIVE | COMPLETED | CANCELLED`.

Every reference is revalidated against the current patient, encounter, branch, and applicable department both when saved/corrected and before readiness/completion. Every plan must match a current consultation diagnosis and laterality. `PLANNED` or `ACTIVE` treatment cannot target a `RULED_OUT` diagnosis; retained `COMPLETED` or `CANCELLED` history may do so. Duplicate diagnosis/laterality/action tuples and duplicate clinical-order IDs are rejected.

New writes do not accept `category`. New response rows return `action_type` and `legacy_category`; current rows have non-null `action_type` and null `legacy_category`. A historical category-only stored row is returned with `action_type: null` and its original value in `legacy_category`. It must be explicitly reclassified before correction or completion; the backend does not infer a clinical action. Patient-safe published consultation payloads expose `action_type`, or `legacy_category` only for an old snapshot, without internal downstream IDs.

## 1.11 integration additions and corrections

The user explicitly authorized backend and frontend remediation on 18 October 2026. This revision does not approve clinical scales, units, medication rules or workflow dependency semantics that are absent from the approved contract.

| Contract | Behavior |
|---|---|
| Shared OPD save/order bodies | Optional `expected_version` / `expected_status` belong in strict JSON bodies; clinical editors send the original versions. Generic consultation completion rejects an authoritative Ophthalmology department/context with `OPHTHALMOLOGY_SPECIALTY_COMPLETION_REQUIRED`. |
| `POST /api/ophthalmology/test-tasks/:id/submit-for-review` | Existing Test Queue Complete permission, exact COMPLETED status/version, active station membership and a current completed result; conditional transaction, history and audit. |
| `GET /api/opd/visits/:visitId/ophthalmology/workspace` | Minimal patient/visit header and context for Intake/Consultation/Optical View, with authoritative branch/department scope. It grants no intake or generic consultation history access. |
| `GET /api/opd/visits/:visitId/ophthalmology/clinical-configuration` | Bound clinical profile for Consultation/Optical View, scoped to the encounter. Configuration authoring remains separately protected. |
| Completion readiness | Configured mandatory codes require real active tasks. Review must match a completed clinical version or an explicit deferral. Completion revalidates the full override snapshot and current allow-override configuration. |
| Source amendments | Typed `clinical_summary` / `patient_instructions` compare actual before values, create an immutable clinical-review version and require reapproval. Unknown source sections fail explicitly. Reopen withdraws context publications in the same transaction. |
| `GET /api/ophthalmology/publications` | Publication View; branch required, optional visit/source/type/version/status, page/limit; department-scoped pagination and metadata only. Replay material and portal payload are excluded. |
| Publish/withdraw | Existing dedicated permissions. Publish requires current approved/reviewed exact clinical version and no open amendment. Context publication revision serializes publication against reopen. Attachment publication metadata is synchronized transactionally. |
| Portal records/files | Allowlisted APPROVED_FOR_PORTAL payloads only. Ophthalmology files require active explicit report publication for both paginated listing and binary download; withdrawn/internal uploads stay inaccessible. Unrelated patient document behavior is retained. |
| `GET /api/ophthalmology/reports/:reportType/export` | Both Reports View and Export; validates the same branch/station/order-date filters, applies authoritative department scope, ignores page/limit for export and streams all selected projection rows as CSV through a bounded cursor. Spreadsheet formulas are neutralized; export request is audited. Reports remain live reads, not a point-in-time analytics snapshot. |

Full structured correction coverage, clinical nested field contracts/masters, workflow prerequisite/bypass semantics, eligible candidate projections and downstream surgery/follow-up/revenue reports remain tracked in the implementation verification. No release-complete assertion is made.

## General API conventions

- Base prefix: `/api`.
- Authentication: existing staff JWT middleware.
- Authorization: existing database-loaded `module/screen/action` permission middleware plus service-level organization, branch, department, encounter, station, assignment, resource and state checks.
- Identifiers: existing MongoDB string identifiers. Clients never create authoritative patient, encounter, task, result, order or approval identifiers.
- Dates/times: ISO 8601 with offset on input; UTC persistence and response timestamps.
- Lists: `page`, `limit`, explicit filters and stable sort. Default `limit=20`; maximum `limit=100` unless a phase records a justified lower limit.
- Responses: existing `{ data: ... }` success envelope and existing standard error envelope.
- Mutations of versioned clinical records require `expected_version`; state actions also require `expected_status`.
- Retryable create/action endpoints accept `Idempotency-Key` when the action can create a task, repeat, order, charge, publication or downstream handoff.
- Unknown request fields are rejected.
- List/detail projections return only fields required by the caller's permission and workflow.

## Canonical enums

### Ophthalmology visit subtype

`NEW_CONSULTATION | FOLLOW_UP | EMERGENCY | POST_OPERATIVE | SCREENING | PROCEDURE_REVIEW`

Shared OPD mapping:

| Ophthalmology subtype | Existing OPD visit type |
|---|---|
| `NEW_CONSULTATION` | `NEW_CONSULTATION` |
| `FOLLOW_UP` | `FOLLOW_UP` |
| `EMERGENCY` | `EMERGENCY` |
| `POST_OPERATIVE` | `REVIEW` |
| `SCREENING` | `REVIEW` |
| `PROCEDURE_REVIEW` | `REVIEW` |

`WALK_IN` remains an arrival channel and is not an Ophthalmology subtype.

### Laterality

Canonical values: `OD | OS | OU | NOT_APPLICABLE | NOT_SPECIFIED`.

- Per-eye measurement/image: `OD | OS`.
- Bilateral finding/treatment: `OD | OS | OU`.
- Diagnosis: `OD | OS | OU | NOT_APPLICABLE`.
- Complaint/appointment context: `OD | OS | OU | NOT_SPECIFIED`.
- `NOT_SPECIFIED` is invalid when applicable configuration requires clinical laterality.

### Ophthalmology workflow status

`CHECKED_IN | PRELIMINARY_EXAMINATION | AWAITING_DOCTOR | UNDER_CONSULTATION | TESTS_ORDERED | AWAITING_RESULTS | CLINICAL_REVIEW | REVIEW_COMPLETED | CONSULTATION_COMPLETED`

Allowed transitions:

- `CHECKED_IN -> PRELIMINARY_EXAMINATION | AWAITING_DOCTOR`
- `PRELIMINARY_EXAMINATION -> AWAITING_DOCTOR | UNDER_CONSULTATION`
- `AWAITING_DOCTOR -> UNDER_CONSULTATION`
- `UNDER_CONSULTATION -> TESTS_ORDERED | CLINICAL_REVIEW`
- `TESTS_ORDERED -> AWAITING_RESULTS`
- `AWAITING_RESULTS -> CLINICAL_REVIEW` after required results are reviewed or explicitly deferred
- `CLINICAL_REVIEW -> TESTS_ORDERED | REVIEW_COMPLETED`
- `REVIEW_COMPLETED -> CONSULTATION_COMPLETED`

The existing OPD visit remains the coarse shared state. `AWAITING_DOCTOR` maps to `READY_FOR_CONSULTATION`; `UNDER_CONSULTATION` through `REVIEW_COMPLETED` map to `IN_CONSULTATION`; final completion maps atomically to `COMPLETED`. Global `SKIPPED`, `CANCELLED` and `NO_SHOW` remain operational visit outcomes, not specialty clinical states.

### Test task status

`ORDERED | PATIENT_WAITING | PATIENT_CALLED | IN_PROGRESS | DRAFT | COMPLETED | SUBMITTED_FOR_REVIEW | REVIEWED | REPEAT_REQUIRED | UNABLE_TO_PERFORM | CANCELLED`

Successful chain:

`ORDERED -> PATIENT_WAITING -> PATIENT_CALLED -> IN_PROGRESS <-> DRAFT -> COMPLETED -> SUBMITTED_FOR_REVIEW -> REVIEWED`

Controlled branches:

- `ORDERED | PATIENT_WAITING | PATIENT_CALLED | DRAFT -> CANCELLED`, reason required.
- `IN_PROGRESS | DRAFT -> UNABLE_TO_PERFORM`, reason required.
- `COMPLETED | SUBMITTED_FOR_REVIEW -> REPEAT_REQUIRED`; preserve the original and create one linked repeat task.
- A linked repeat enters `PATIENT_WAITING`; the original is never overwritten.
- `REVIEWED` is terminal. `Closed` is not stored.
- Doctor Review is a routing action/item, not a task status.

### Provenance review and publication

- Source type: `MANUAL | DEVICE_IMPORT | MANUAL_CORRECTION`.
- Review decision: `ACCEPTED | REPEAT_REQUESTED | AMENDMENT_REQUIRED`.
- Publication status: `INTERNAL | APPROVED_FOR_PORTAL | WITHDRAWN`.

## Permission contract

All permissions use module `OPD`.

| Screen | Actions |
|---|---|
| Ophthalmology Configuration | View, Create, Edit, Deactivate |
| Ophthalmology Intake | View, Edit, Escalate |
| Ophthalmology Test Queue | View, Assign, Reassign, Call, Start, Edit, Complete, Cancel |
| Ophthalmology Test Review | View, Review, Request Repeat, Amend |
| Ophthalmology Consultation | View, Edit, Diagnose, Prescribe, Complete, Override, Reopen, Amend |
| Ophthalmology Optical Prescription | View, Create, Edit, Approve, Cancel |
| Ophthalmology Portal Publication | View, Publish, Withdraw |
| Ophthalmology Reports | View, Export |

Permission seeds do not grant clinical authority. Existing `SUPER_ADMIN` reconciliation receives the new permissions. Every other assignment is explicit.

## Resource model

### Encounter context

Minimum response fields:

```json
{
  "id": "object-id",
  "visit_id": "object-id",
  "patient_id": "object-id",
  "branch_id": "object-id",
  "department_id": "object-id",
  "doctor_id": "object-id",
  "visit_subtype": "NEW_CONSULTATION",
  "affected_eye": "OD",
  "workflow_status": "PRELIMINARY_EXAMINATION",
  "configuration_version_id": "object-id",
  "workflow_profile_version_id": "object-id",
  "version": 1,
  "created_at": "2026-10-15T08:00:00.000Z",
  "updated_at": "2026-10-15T08:00:00.000Z"
}
```

The server derives patient, branch, department, doctor and shared visit mapping from the authoritative OPD visit/appointment. Client values cannot override them.

### Configuration version

Configuration is branch-scoped and versioned by type. Generic configuration types are `SUB_SPECIALITY`, `COMPLAINT`, `TEST_CATALOGUE`, `VISUAL_ACUITY_SCALE`, `DIAGNOSIS_REFERENCE`, `DRUG_OPTION`, `OPTICAL_PRODUCT`, `IOL_CATALOGUE`, `CLINICAL_THRESHOLD`, `GRADE`, `REASON`, `FORM_PROFILE` and `COMPLETION_PROFILE`. Stations, devices, memberships and workflow sequencing are dedicated resources and are not duplicated inside the generic configuration payload.

Each version records status, effective dates, author, approver where configured, structured values and audit references. Clinical constants are absent until supplied; an endpoint must return `OPHTHALMOLOGY_CONFIGURATION_REQUIRED` instead of applying a hidden default.

### Test task

Required fields include task/test identity, patient, encounter, appointment/order/order item, branch, station/device, laterality, priority, assigned user, performer, reviewer, status, waiting/started/completed/reviewed times, repeat/original links, special instructions, expected version and transition history.

### Result version

Required common fields include task, test type, form schema version, version, laterality, source type, source readings, derived values, units, structured payload, reliability, quality, performer, device/calibration snapshot, attachment document IDs, completion/review metadata, superseded version and audit reference.

Completed and reviewed versions are immutable. A correction creates a new version.

## Endpoint families

### Phase 1 shared OPD foundation

Existing routes remain stable. Phase 1 changes behavior and adds version preconditions without creating Ophthalmology feature routes:

- `PUT /api/opd/visits/:visitId/clinical-orders/:orderType`
- `POST /api/opd/visits/:visitId/clinical-orders/:orderType/submit`
- `PUT /api/opd/visits/:visitId/consultation`
- `POST /api/opd/visits/:visitId/consultation/complete`
- `PATCH /api/opd/visits/:id/status`

Phase 1 requirements:

- A clinical order item must reference an active service of the required type; remove fallback to generic billing services.
- Authorized orders may be submitted during an open consultation; completion is not a prerequisite.
- Draft/save/finalization use conditional expected version/status behavior.
- Consultation finalization is one transaction or an approved recoverable boundary; no silent partial success.
- Existing General OPD and Dental request/response compatibility is preserved.

### Phase 2 encounter and configuration

| Method and path | Purpose | Permission |
|---|---|---|
| `POST /api/opd/visits/:visitId/ophthalmology/context` | Activate approved Ophthalmology context idempotently | Ophthalmology Intake Edit |
| `GET /api/opd/visits/:visitId/ophthalmology/context` | Get specialty context and permitted projection | Ophthalmology Intake View |
| `PATCH /api/opd/visits/:visitId/ophthalmology/context` | Update subtype/context with expected version | Ophthalmology Intake Edit |
| `GET /api/ophthalmology/configurations` | Paginated branch/type/version list | Ophthalmology Configuration View |
| `POST /api/ophthalmology/configurations` | Create a structural/configuration draft | Ophthalmology Configuration Create |
| `PATCH /api/ophthalmology/configurations/:id` | Update draft with expected version | Ophthalmology Configuration Edit |
| `POST /api/ophthalmology/configurations/:id/activate` | Activate prospectively after validation | Ophthalmology Configuration Edit |
| `POST /api/ophthalmology/configurations/:id/deactivate` | Deactivate prospectively with reason | Ophthalmology Configuration Deactivate |
| `GET /api/ophthalmology/stations` | Paginated branch station/device/membership list | Ophthalmology Configuration View |
| `GET /api/ophthalmology/stations/:id` | Get one permitted station | Ophthalmology Configuration View |
| `POST /api/ophthalmology/stations` | Create an active branch station | Ophthalmology Configuration Create |
| `PATCH /api/ophthalmology/stations/:id` | Edit station details with expected version; status is not editable | Ophthalmology Configuration Edit |
| `POST /api/ophthalmology/stations/:id/deactivate` | Deactivate an active station with expected version and reason | Ophthalmology Configuration Deactivate |
| `GET /api/ophthalmology/workflow-profiles` | Paginated branch/subtype/revision list | Ophthalmology Configuration View |
| `GET /api/ophthalmology/workflow-profiles/:id` | Get one permitted profile | Ophthalmology Configuration View |
| `POST /api/ophthalmology/workflow-profiles` | Create a draft stage/test sequence | Ophthalmology Configuration Create |
| `PATCH /api/ophthalmology/workflow-profiles/:id` | Edit a draft with expected version | Ophthalmology Configuration Edit |
| `POST /api/ophthalmology/workflow-profiles/:id/activate` | Activate and supersede the prior branch/subtype profile atomically | Ophthalmology Configuration Edit |
| `POST /api/ophthalmology/workflow-profiles/:id/deactivate` | Deactivate an active profile with reason | Ophthalmology Configuration Deactivate |

Phase 2 request rules:

- Context create requires `visit_subtype`, `affected_eye`, `configuration_version_id`, and `workflow_profile_version_id`. The configuration must be an active branch `COMPLETION_PROFILE`; the workflow profile must be active for the same branch and subtype. The server derives all shared encounter references and initializes the overlay from the authoritative OPD visit status.
- Context patch requires `expected_version` and at least one of `visit_subtype`, `affected_eye`, or `workflow_profile_version_id`. Context create/update and their audit event are atomic.
- Generic configuration create requires `branch_id`, `type`, `code`, and `name`; optional fields are `description`, `effective_from`, and structured `values`. Patch requires `expected_version`. Only drafts are editable.
- Station create requires `branch_id`, `department_id`, `code`, and `name`. Optional supported test codes, device calibration metadata, and member user IDs are validated. Members must be active and assigned to the same branch and Ophthalmology department. Calibration due time, when paired with calibration time, must be later.
- Workflow-profile create requires `branch_id`, `visit_subtype`, `name`, and one or more uniquely coded stages. Each stage declares sequential/parallel mode, unique test codes, and bypass permission. Patch requires `expected_version`; only drafts are editable.
- List endpoints use stable sorting and return `{ data, meta: { total, page, limit, totalPages } }`. Unknown fields are rejected and limits are capped at 100.
- Structural activation/deactivation requires `expected_version` and `expected_status`, uses MongoDB transactions, compare-and-set filters, partial unique active indexes, and safe audit metadata. No clinical master value or threshold is seeded.

### Phase 3 intake and alerts

| Method and path | Purpose | Permission |
|---|---|---|
| `GET /api/opd/visits/:visitId/ophthalmology/intake` | Read the intake, alerts, and permitted shared-history projection | Ophthalmology Intake View |
| `PUT /api/opd/visits/:visitId/ophthalmology/intake/draft` | Create or update the single versioned intake draft | Ophthalmology Intake Edit |
| `POST /api/opd/visits/:visitId/ophthalmology/intake/complete` | Validate active configurations and atomically complete and route | Ophthalmology Intake Edit |
| `POST /api/opd/visits/:visitId/ophthalmology/alerts/:id/route` | Retry in-app routing to newly eligible recipients without duplicate notification | Ophthalmology Intake Escalate |
| `POST /api/opd/visits/:visitId/ophthalmology/alerts/:id/acknowledge` | Record an eligible Ophthalmology clinician's acknowledgement | Ophthalmology Intake Escalate |

The draft body rejects unknown fields and contains:

- `expected_version` (`null` only for first creation), selected complaint/emergency configuration version IDs, complaint codes, `affected_eye`, duration value/unit (`DAY | WEEK | MONTH | YEAR`), onset (`SUDDEN | GRADUAL | UNKNOWN`), progression, severity, associated symptom codes, and description.
- `no_significant_ophthalmic_history`, configured prior-disease codes, structured prior surgeries/treatments/injury-or-laser items, spectacle/contact-lens use, long-term steroid details, family-history codes, and validated existing patient-document IDs.
- Explicit shared medical-history/allergy review confirmations, selected emergency criteria, and details for the configured other-urgent-condition criterion.

Completion requires `{ expected_version, expected_status: "DRAFT", expected_context_version }`. The selected `COMPLAINT` and `CLINICAL_THRESHOLD` versions must be active, branch-matched, correctly typed, and contain every selected active code. Required complaint/duration/onset and conditional details are enforced by the backend. Shared medical history and allergies remain owned by the existing OPD consultation and are returned read-only; the intake stores review confirmations rather than duplicating those records. Previous reports remain patient-document references; Phase 3 adds no upload policy or storage path.

An emergency selection atomically completes intake, moves an eligible early specialty context to `AWAITING_DOCTOR`, creates one `EMERGENCY_SCREENING` alert for the completed intake version, persists in-app notifications, and writes safe audit events. Eligible recipients are derived server-side from active user, mapped active doctor, branch, Ophthalmology department, and `Ophthalmology Consultation / View` permission. Completion rolls back if no eligible recipient exists. Route retry and acknowledgement require `{ expected_version, expected_status: "ACTIVE" }`; acknowledgement additionally requires the actor to be an eligible Ophthalmology clinician. Alerts are `ACTIVE | ACKNOWLEDGED`, never create a diagnosis, and do not claim external SMS/email/push delivery.

### Phase 4 tasks and station queues

| Method and path | Purpose |
|---|---|
| `GET /api/ophthalmology/test-tasks` | Scoped paginated queue with branch/station/user/status/test/search/sort filters |
| `GET /api/ophthalmology/test-tasks/:taskId` | Permission-scoped task detail |
| `POST /api/opd/visits/:visitId/ophthalmology/test-tasks` | Create configured tasks idempotently from test/order items |
| `POST /api/ophthalmology/test-tasks/:taskId/assign` | Assign eligible station/user |
| `POST /api/ophthalmology/test-tasks/:taskId/reassign` | Reassign with reason and eligibility revalidation |
| `POST /api/ophthalmology/test-tasks/:taskId/call` | `PATIENT_WAITING -> PATIENT_CALLED` |
| `POST /api/ophthalmology/test-tasks/:taskId/patient-unavailable` | Audited `PATIENT_CALLED -> PATIENT_WAITING` with reason |
| `POST /api/ophthalmology/test-tasks/:taskId/start` | Start task after assignment/scope validation |
| `POST /api/ophthalmology/test-tasks/:taskId/unable` | Record unable-to-perform reason and doctor-review routing |
| `POST /api/ophthalmology/test-tasks/:taskId/cancel` | Controlled cancellation with reason |
| `POST /api/ophthalmology/test-tasks/:taskId/request-repeat` | Preserve original and create linked repeat exactly once |
| `POST /api/ophthalmology/test-tasks/:taskId/route` | Next station or direct doctor routing |

Create and request-repeat require an `Idempotency-Key` header (8-120 safe characters). Every action body includes exact `expected_status` and `expected_version`; reason is required for reassign, unavailable, unable, cancel, and repeat. Create snapshots the active branch `TEST_CATALOGUE` version, configured test code/name, bound workflow version and optional validated stage. `CLINICAL_ORDER_ITEM` requires an exact non-draft shared order/item for the same visit, patient, and branch; the task never mutates that order.

Assignment validates an active branch/department station supporting the test and, when provided, an active member with `Ophthalmology Test Queue / Start`. Start requires that assigned actor and accepts optional `device_code`; an active device must be calibration-current or not require calibration. Unable-to-perform records doctor routing without inventing a status. Next-station routing atomically adds routing history and assigns an existing ordered task in the same context. Queue visibility is limited to active station memberships, explicit assignment, or eligible Ophthalmologist review work.

### Phase 5-6 clinical test result forms

Common routes:

| Method and path | Purpose |
|---|---|
| `GET /api/ophthalmology/test-tasks/:taskId/result` | Current permitted result and version metadata |
| `PUT /api/ophthalmology/test-tasks/:taskId/result/draft` | Save intended draft version |
| `POST /api/ophthalmology/test-tasks/:taskId/result/complete` | Validate form profile and freeze completed version |
| `POST /api/ophthalmology/test-tasks/:taskId/result/amendments` | Create controlled correction version |

Draft and amendment writes contain `form_type`, `form_schema_version`, `form_profile_version_id`, `expected_task_status`, `expected_task_version`, `expected_result_version`, `performed_at`, `source_type`, `reliability`, optional reliability reason/comments/document IDs, and a discriminated structured `payload`. Draft creation requires task `IN_PROGRESS`, null expected-result version, and `MANUAL`; draft re-save requires task `DRAFT` plus exact task/result versions and updates the single intended clinical version. Completion requires exact `DRAFT` task/result versions, validates the frozen payload and configured form rules, then atomically freezes the result and task as `COMPLETED`. Result-level amendment requires exact `COMPLETED` versions, `MANUAL_CORRECTION`, Test Review Amend permission, and a reason; it appends a new completed clinical version and never mutates the superseded version.

Supported form types and minimum discriminators:

| Form type | Required contract focus |
|---|---|
| `VISUAL_ACUITY` | Conditions, OD/OS result or unable reason, low-vision/near values, reliability and conclusion |
| `LENSOMETRY` | OD/OS optical power, axis rules, prism/base, lens properties, PD/centre and condition |
| `AUTOREFRACTION_KERATOMETRY` | Device/calibration, source readings, selected readings, derived SE/K values and quality |
| `OBJECTIVE_REFRACTION` | Method, working distance, cycloplegia details, raw/final OD/OS values and impression |
| `SUBJECTIVE_REFRACTION` | Starting/final values, BCVA, acceptance, binocular balance, near addition and impression |
| `INTRAOCULAR_PRESSURE` | OD/OS readings, mmHg, method/time/position, repeats, selected result, reliability and configured alert |
| `PACHYMETRY` | Method, OD/OS thickness, repeats/average, quality, impression and report |
| `COLOUR_VISION` | Method, tested eye, plate counts, calculated score, result/defect/severity and reliability |
| `MOTILITY_SQUINT_BINOCULAR` | Method, fixation, deviation/measurements, movements, positive details, stereopsis and impression |
| `SLIT_LAMP_ANTERIOR_SEGMENT` | Separate OD/OS structures, finding/location/grade, diagrams/images and remarks |
| `DRY_EYE` | Symptoms/score, Schirmer, TBUT, staining, meniscus, glands, blink/lid/sensation and impression |
| `VISUAL_FIELD` | Equipment/protocol, eye/correction, setup, reliability indices, pattern, eligible comparison and report |
| `OCT` | Type/scans, eye, signal/quality, measurements, artefact, eligible comparison, images/report and observation |
| `FUNDUS_PHOTOGRAPHY` | Eye/image type/field/dilation, quality/count, abnormalities, eye-linked images and repeat flag |
| `POSTERIOR_FUNDUS_EXAM` | Dilation consent/check/drug/times, method, OD/OS structures, diagrams/images and remarks |
| `CORNEAL_TOPOGRAPHY` | OD/OS K values/axes, derived values, elevation/maps, asphericity, pupil/WTW, quality and impression |
| `BIOMETRY_IOL` | Measurements, target, formula/model/power, prediction, quality/factors, selected/backup IOL and approval |
| `B_SCAN` | Eye/indication, acquisition setup, structures/lesion, images/videos/report and doctor review |
| `GONIOSCOPY` | OD/OS quadrant grade/pigment/PAS/NV, positive details and overall examination |
| `CONTACT_LENS` | Trial/final identity, OD/OS power/fit/over-refraction, response, outcome, education and follow-up |
| `PAEDIATRIC_VISION` | Age-appropriate methods, cycloplegia, alignment/red reflex, amblyopia/binocular, cooperation and parent history |

Phase 5 implements the eight core rows `VISUAL_ACUITY`, `LENSOMETRY`, `AUTOREFRACTION_KERATOMETRY`, `OBJECTIVE_REFRACTION`, `SUBJECTIVE_REFRACTION`, `INTRAOCULAR_PRESSURE`, `SLIT_LAMP_ANTERIOR_SEGMENT`, and `POSTERIOR_FUNDUS_EXAM`. Phase 6 implements `PACHYMETRY`, `COLOUR_VISION`, `MOTILITY_SQUINT_BINOCULAR`, `DRY_EYE`, `VISUAL_FIELD`, `OCT`, `FUNDUS_PHOTOGRAPHY`, `CORNEAL_TOPOGRAPHY`, `BIOMETRY_IOL`, `B_SCAN`, and `GONIOSCOPY`. Phase 7 implements `CONTACT_LENS` and `PAEDIATRIC_VISION` through the same versioned result lifecycle.

Each active branch `FORM_PROFILE` binds one form/schema to explicit configured test codes. Its revision and full values are snapshotted in the clinical version. Configured `required_fields`, `numeric_ranges`, and `allowed_values` are enforced at completion; no clinical defaults are seeded. Axis is structurally restricted to 0-180. Poor reliability requires a reason. The selected reading and original readings remain together in the payload. Initial entry is authorized manual entry only; device import returns `OPHTHALMOLOGY_ADAPTER_NOT_CONFIGURED` until an approved adapter exists. Attachments are references to active same-patient `PatientDocument` records only.

Advanced-result rules are enforced by the backend. Pachymetry averages must match retained repeat readings; colour-vision plate totals and percentage must agree; and reported topography average K/corneal astigmatism must agree with K1/K2. OCT artefact or segmentation error requires a comment. Positive motility and gonioscopy findings require their structured details. Poor quality requires a repeat/review disposition or remarks. Fundus image sets retain eye, type, field, dilation, quality and exact image references.

Visual Field and OCT progression outcomes other than `NOT_COMPARED` require an exact prior result ID and clinical version. The referenced version must be completed, earlier, for the same patient/branch/form, and laterality-compatible; otherwise the API returns `OPHTHALMOLOGY_COMPARISON_INELIGIBLE`. B-scan completion always marks the task for doctor review. Biometry/IOL accepts only `PROPOSED` selection in Phase 6 and marks the task for doctor review; final selection/approval remains Phase 8. Client-supplied reviewer identity, review time, and final approval are not accepted.

Contact-lens results distinguish `TRIAL` and `FINAL`, validate each eye against an active same-branch `OPTICAL_PRODUCT` configuration version, retain power/fit/over-refraction/acuity/comfort/ocular-response details, and require insertion/removal and hygiene education at completion. An optional follow-up reference must belong to the same patient and visit; a recommendation date must be after the assessment. A final fitting or a contraindicated/doctor-review outcome routes the task for doctor review but does not approve an optical prescription.

Paediatric results retain the selected age-appropriate methods, cycloplegic context, eye-specific alignment/red reflex, amblyopia/binocular assessment, cooperation, separately identified parent report, birth/development history, and result codes. Age in months and guardian-record presence are derived from the active Patient record. The branch form profile must define `paediatric_max_age_years`; cycloplegia must reference an active same-branch `DRUG_OPTION` and have ordered administration/examination/performed times. An unable examination requires a repeat outcome. Developmental-review and repeat outcomes route the task for doctor review.

### Phase 8 doctor review and outcomes

| Method and path | Purpose |
|---|---|
| `GET /api/opd/visits/:visitId/ophthalmology/doctor-review` | Consolidated current/historical, eye-safe, permission-scoped read model |
| `GET /api/opd/visits/:visitId/ophthalmology/clinical-review` | Read current and append-only clinical-review versions |
| `PUT /api/opd/visits/:visitId/ophthalmology/clinical-review/draft` | Save assessment/plan draft with expected version |
| `GET /api/opd/visits/:visitId/consultation` | Existing authoritative consultation/diagnosis read, now including optional Ophthalmology diagnosis context and history |
| `PUT /api/opd/visits/:visitId/consultation` | Existing authoritative consultation draft write with diagnosis status/laterality and expected version/status |
| `GET /api/opd/visits/:visitId/ophthalmology/optical-prescription` | Read current and append-only optical-prescription versions |
| `PUT /api/opd/visits/:visitId/ophthalmology/optical-prescription/draft` | Save separate optical prescription draft |
| `POST /api/opd/visits/:visitId/ophthalmology/optical-prescription/approve` | Authorized version approval |

Shared prescription, order, surgery/procedure, referral, follow-up and billing routes remain authoritative. Ophthalmology endpoints orchestrate by reference and stable source keys; they do not duplicate shared records.

Consultation diagnoses accept optional `laterality`, `status`, `severity`, `stage`, and `differential` fields. A non-empty diagnosis set has exactly one primary diagnosis; using the clinical extension requires laterality and status, and duplicate code/laterality/status contexts are rejected. Changes to diagnoses or narrative treatment preserve the prior state, actor, time, and consultation version.

Clinical-review drafts hold a summary and diagnosis-linked treatment-plan versions under the 2.0 structured action/reference contract above. Medication prescription, optical prescription, clinical order, procedure recommendation, referral, and follow-up references resolve in their authoritative modules and may not be mixed across action types. Optical prescriptions retain OD/OS power, PD, segment height, configured lens/material/coating choices, instructions, validity/review dates, and append-only versions. Approval requires `Ophthalmology Optical Prescription / Approve`, an active branch/department doctor record, exact draft status/version, a transaction, and an audit event; an approved head cannot be edited through the normal draft route.

### Phase 9 completion and amendment

| Method and path | Purpose |
|---|---|
| `POST /api/ophthalmology/test-tasks/:id/result/review` | Record an authenticated doctor review against exact task, result, and clinical versions |
| `GET /api/opd/visits/:visitId/ophthalmology/completion-readiness` | Return configured prerequisites, satisfied/unmet items and current version |
| `POST /api/opd/visits/:visitId/ophthalmology/result-deferrals` | Record result/order, reason, plan/due date and responsible clinician |
| `POST /api/opd/visits/:visitId/ophthalmology/completion-overrides` | Authorized reasoned override with exact unmet-prerequisite snapshot |
| `POST /api/opd/visits/:visitId/ophthalmology/complete` | Atomically approve and complete one exact version |
| `GET /api/opd/visits/:visitId/ophthalmology/summary` | Return the finalization head plus consolidated authoritative consultation summary |
| `GET /api/opd/visits/:visitId/ophthalmology/completion-history` | Return approvals, overrides, deferrals, amendment episodes, and immutable version history |
| `POST /api/opd/visits/:visitId/ophthalmology/reopen` | Start a reasoned amendment episode without mutating final history |
| `POST /api/opd/visits/:visitId/ophthalmology/amendments` | Append before/after version and trigger required re-review/republish |

Digital approval records authenticated actor, linked doctor, timestamp, consultation version and audit event. It is not represented as a cryptographic signature unless a later approved contract adds one.

Completion uses the active branch `COMPLETION_PROFILE` bound to the consultation context. Its `required_requirements` may contain only the approved structural requirement codes and its optional `mandatory_test_codes` determines mandatory test review. The server returns each requirement with `satisfied`, explanatory text, and resource IDs. It never invents clinical prerequisites. A configured `allow_override: true` is required before an authorized doctor may snapshot and override the exact current unmet-code set.

The finalization head uses `OPEN -> COMPLETED -> AMENDMENT_OPEN -> COMPLETED`, expected versions, and an idempotency key/fingerprint. Initial completion atomically completes the authoritative OPD consultation and visit, linked appointment when present, Ophthalmology review/context, patient timeline, approval history, and audit. Completed clinical records are read-only through normal write APIs. Reopening creates an append-only episode; amendments retain section, before/after values, reason, actor, and time, and reapproval appends a superseding clinical version without reopening the coarse OPD visit.

### Phase 10 files publication reports and dashboards

| Method and path | Purpose |
|---|---|
| `POST /api/ophthalmology/attachments` | Idempotent multipart upload plus atomic Patient document and Ophthalmology attachment metadata |
| `GET /api/ophthalmology/attachments` | Paginated branch/task/result/visit-scoped attachment metadata |
| `POST /api/ophthalmology/publications` | Explicit publish of reviewed/final resource version |
| `POST /api/ophthalmology/publications/:id/withdraw` | Withdraw publication with reason |
| `GET /api/ophthalmology/reports/:reportType` | Indexed paginated detail report |
| `GET /api/ophthalmology/dashboard` | Snapshot-backed branch/station operational summary |
| `POST /api/ophthalmology/dashboard/refresh` | Authorized snapshot refresh/job trigger |

Mandatory report types: `STATION_QUEUE`, `TEST_TURNAROUND`, `PENDING_REVIEW`, `REPEAT_UNABLE`, `CLINICAL_VOLUME`, `DIAGNOSTIC_UTILIZATION`. Surgery pipeline, follow-up compliance and revenue use authoritative shared reporting integrations.

Authoritative cross-domain report integrations are `/api/reports/phase-2` for procedure/surgery pipeline and finance-derived revenue, and `/api/opd/reports/follow-up-compliance` for OPD follow-up compliance. Their owning-domain permissions remain mandatory; Ophthalmology does not proxy or recalculate their data.

Attachment metadata includes patient, encounter, task/test, order/result, eye, device, acquisition time, provenance, checksum, MIME, size, original name, review state and publication state. Binary payloads are not stored in MongoDB. Production requires configured Google Cloud Storage. Unsupported policy or adapter details return explicit configuration errors.

Phase 10 implementation status:

- Implemented exact-version `CONSULTATION_SUMMARY`, `OPTICAL_PRESCRIPTION`, and `TEST_RESULT` publication, idempotent replay, transactional audit/timeline, reasoned optimistic withdrawal, restricted safe payload projection, active-publication-only patient portal reads, six paginated operational reports, and snapshot refresh/read.
- Attachment upload/list is implemented through `PatientDocumentStorageService`. `PATIENT_DOCUMENT_STORAGE_PROVIDER=gcs` uses `GCP_PATIENT_DOCUMENTS_BUCKET` and Application Default Credentials; production rejects local or incomplete storage configuration. The endpoint accepts only the existing configured MIME/size policy, uploads the blob first, atomically creates the Patient document and Ophthalmology link, and deletes the blob if metadata persistence fails.
- Shared downstream handoffs use source-domain-first creation and ID linking. Ophthalmology completion validates and retains authoritative prescription/order/procedure/referral/follow-up IDs and does not emit duplicate completion-time commands. Source-domain idempotency/version rules own retries; relink or source-domain cancellation is the compensation path. Billing owns price mapping, invoice idempotency, reversals, and revenue totals.

### Phase 11 release hardening

- Direct optical-prescription reads require `Ophthalmology Optical Prescription / View`; draft creation or editing requires either `Create` or `Edit`; exact-version approval requires `Approve`. General consultation permissions do not implicitly grant direct optical-prescription access.
- Release regression coverage freezes the dedicated optical permission boundary and the critical uniqueness, active-configuration, idempotency, branch/station queue, patient/visit history, result and publication indexes.
- Automated Phase 1 through Phase 11, OPD, portal, storage, permission and response-contract validation is complete. Live GCS object lifecycle testing and interactive multi-role/multi-branch browser acceptance remain explicit release conditions.
- Phase 11 introduces no new clinical lifecycle, threshold, master value or shared-domain source of truth.

## Mutation example

Request:

```http
POST /api/ophthalmology/test-tasks/66f000000000000000000001/start
Content-Type: application/json

{
  "expected_status": "PATIENT_CALLED",
  "expected_version": 4,
  "device_code": "ETDRS"
}
```

Success:

```json
{
  "data": {
    "id": "66f000000000000000000001",
    "status": "IN_PROGRESS",
    "version": 5,
    "started_at": "2026-10-15T08:30:00.000Z"
  }
}
```

Stale state:

```json
{
  "error": {
    "code": "OPHTHALMOLOGY_STATUS_CONFLICT",
    "message": "The test task changed after it was loaded",
    "details": {
      "expected_status": "PATIENT_CALLED",
      "current_status": "IN_PROGRESS",
      "current_version": 5
    }
  }
}
```

## Error catalogue

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `OPHTHALMOLOGY_CONTEXT_REQUIRED` | The visit has no active Ophthalmology context. |
| 400 | `OPHTHALMOLOGY_DEPARTMENT_REQUIRED` | The authoritative encounter department is not eligible. |
| 400 | `OPHTHALMOLOGY_CONFIGURATION_REQUIRED` | Required branch/form/clinical configuration is absent. |
| 400 | `OPHTHALMOLOGY_LATERALITY_REQUIRED` | Laterality is missing or invalid for the record type. |
| 400 | `OPHTHALMOLOGY_CONDITIONAL_FIELD_REQUIRED` | A positive/selected value lacks required details. |
| 400 | `OPHTHALMOLOGY_RESULT_INVALID` | Structured result fails the form contract. |
| 400 | `OPHTHALMOLOGY_RESULT_REQUIRED` | A structural or configured completion field is absent. |
| 400 | `OPHTHALMOLOGY_RESULT_CONDITIONAL_REQUIRED` | A positive/selected result lacks its dependent detail. |
| 400 | `OPHTHALMOLOGY_RESULT_RANGE_INVALID` | Axis or a configured numeric field is outside its approved range. |
| 400 | `OPHTHALMOLOGY_RESULT_CALCULATION_INVALID` | A reported derived value does not match its retained source readings. |
| 400 | `OPHTHALMOLOGY_RESULT_OPTION_INVALID` | A value is not in the active profile's approved options. |
| 400 | `OPHTHALMOLOGY_RESULT_LATERALITY_REQUIRED` | The form has no result for an applicable eye. |
| 400 | `OPHTHALMOLOGY_RESULT_LATERALITY_INVALID` | Eye data conflicts with the task laterality. |
| 400 | `OPHTHALMOLOGY_RESULT_AGE_INVALID` | The patient age is outside the configured paediatric assessment range. |
| 400 | `OPHTHALMOLOGY_RESULT_SOURCE_INVALID` | The source is not permitted for this write action. |
| 400 | `OPHTHALMOLOGY_COMPARISON_REQUIRED` | A progression outcome lacks an exact prior result/version reference. |
| 400 | `OPHTHALMOLOGY_REASON_REQUIRED` | Cancellation, unable, repeat, amendment, override or withdrawal lacks a reason. |
| 400 | `OPHTHALMOLOGY_COMPLETION_BLOCKED` | Configured completion prerequisites are unmet. |
| 400 | `OPHTHALMOLOGY_DOCUMENT_REFERENCE_INVALID` | A previous-report reference is missing, inactive, or belongs to another patient. |
| 400 | `OPHTHALMOLOGY_ROUTE_INVALID` | A requested next-station or doctor route is structurally invalid. |
| 400 | `OPHTHALMOLOGY_POLICY_REQUIRED` | Required file/publication/security policy is absent. |
| 400 | `OPHTHALMOLOGY_TREATMENT_ACTION_TYPE_REQUIRED` | A legacy or internal plan has no explicit structured action classification. |
| 400 | `OPHTHALMOLOGY_TREATMENT_REFERENCE_REQUIRED` | The selected action lacks its matching authoritative downstream reference. |
| 400 | `OPHTHALMOLOGY_TREATMENT_REFERENCE_CONFLICT` | The plan contains a reference owned by another action type, or `OTHER` contains a downstream reference. |
| 400 | `OPHTHALMOLOGY_DIAGNOSIS_REQUIRED` | A treatment plan exists but the consultation has no diagnosis. |
| 400 | `OPHTHALMOLOGY_DIAGNOSIS_MISMATCH` | A plan does not match a current consultation diagnosis/laterality. |
| 403 | `PERMISSION_REQUIRED` | Existing permission middleware denied the action. |
| 403 | `OPHTHALMOLOGY_SCOPE_DENIED` | Organization/branch/department/encounter/station/resource scope failed. |
| 403 | `OPHTHALMOLOGY_ASSIGNMENT_DENIED` | User is not the eligible assigned performer/reviewer. |
| 404 | `OPHTHALMOLOGY_CONTEXT_NOT_FOUND` | Specialty context was not found in permitted scope. |
| 404 | `OPHTHALMOLOGY_INTAKE_NOT_FOUND` | Intake was not found for the permitted context. |
| 404 | `OPHTHALMOLOGY_ALERT_NOT_FOUND` | Alert was not found for the permitted visit. |
| 404 | `OPHTHALMOLOGY_CONFIGURATION_NOT_FOUND` | Configuration version was not found in permitted scope. |
| 404 | `OPHTHALMOLOGY_STATION_NOT_FOUND` | Station was not found in permitted scope. |
| 404 | `OPHTHALMOLOGY_WORKFLOW_NOT_FOUND` | Workflow profile was not found in permitted scope. |
| 404 | `OPHTHALMOLOGY_TEST_TASK_NOT_FOUND` | Test task was not found. |
| 404 | `OPHTHALMOLOGY_TEST_RESULT_NOT_FOUND` | Result/version was not found in permitted scope. |
| 409 | `OPHTHALMOLOGY_VERSION_CONFLICT` | Expected version no longer matches. |
| 409 | `OPHTHALMOLOGY_CONTEXT_CONFLICT` | A different context already owns the OPD visit. |
| 409 | `OPHTHALMOLOGY_CONFIGURATION_CONFLICT` | Configuration identity/revision conflicts with an existing record. |
| 409 | `OPHTHALMOLOGY_STATION_CONFLICT` | Station code conflicts within the branch. |
| 409 | `OPHTHALMOLOGY_WORKFLOW_CONFLICT` | Workflow branch/subtype/revision conflicts with an existing record. |
| 409 | `OPHTHALMOLOGY_STATUS_CONFLICT` | Expected status/transition no longer matches. |
| 409 | `OPHTHALMOLOGY_DUPLICATE_TASK` | The active task identity already exists. |
| 409 | `OPHTHALMOLOGY_REPEAT_CONFLICT` | A different repeat already exists for the original task. |
| 409 | `OPHTHALMOLOGY_ASSIGNMENT_CONFLICT` | Assignee/station eligibility or membership changed. |
| 409 | `OPHTHALMOLOGY_STATION_UNAVAILABLE` | Station is inactive, out of scope, or does not support the test. |
| 409 | `OPHTHALMOLOGY_DEVICE_UNAVAILABLE` | Device is inactive or its calibration is not current. |
| 409 | `OPHTHALMOLOGY_IDEMPOTENCY_CONFLICT` | Idempotency key was reused with a different normalized request. |
| 409 | `OPHTHALMOLOGY_FINALIZED` | Finalized content cannot be edited outside amendment. |
| 409 | `OPHTHALMOLOGY_SHARED_CONTRACT_CONFLICT` | Shared-domain state prevents the requested handoff. |
| 409 | `OPHTHALMOLOGY_ROUTING_REQUIRED` | Emergency completion cannot route because no eligible Ophthalmology clinician exists. |
| 409 | `OPHTHALMOLOGY_COMPARISON_INELIGIBLE` | The referenced prior clinical version is not eligible for comparison. |
| 409 | `OPHTHALMOLOGY_RULED_OUT_DIAGNOSIS_ACTIVE_TREATMENT` | A planned or active item targets a diagnosis currently marked ruled out. |
| 422 | `OPHTHALMOLOGY_REVIEW_REQUIRED` | Action requires review of the referenced exact version. |
| 422 | `OPHTHALMOLOGY_APPROVAL_REQUIRED` | Action requires authenticated doctor/authorized approval. |
| 503 | `TRANSACTION_CAPABILITY_REQUIRED` | Required atomic workflow cannot run on the connected MongoDB deployment. |
| 503 | `OPHTHALMOLOGY_STORAGE_UNAVAILABLE` | Required configured storage provider is unavailable. |
| 501 | `OPHTHALMOLOGY_ADAPTER_NOT_CONFIGURED` | Requested device/vendor import has no approved adapter. |

Existing generic validation, authentication, not-found and internal-error codes remain applicable where a specialty code is not more precise.

## Audit contract

Every applicable create, update, assign, reassign, call, start, draft, complete, submit, review, repeat, cancel, acknowledge, approve, defer, override, amend, reopen, publish and withdraw event records:

- Actor and authenticated user identity.
- Event time.
- Organization, branch and department.
- Patient, visit/encounter, task/test, result/version and shared resource references.
- Source context and idempotency key where applicable.
- Reason and comment where applicable.
- Expected/previous and resulting status/version.
- Before/after references for clinical amendments.
- Safe metadata only; no full notes, result payloads, secrets or private file URLs in logs.

## Shared-domain compatibility contract

- Diagnosis adds nullable laterality, clinical status, severity/stage, differential marker and version metadata without breaking existing records.
- Medication items add nullable eye, start date, taper, refill and ophthalmic instructions; pharmacy continues using the same prescription identity.
- Laboratory/imaging orders and verified results remain authoritative. Ophthalmology tasks reference individual order items/results.
- Surgery/procedure, referral and follow-up receive encounter, diagnosis, laterality and clinical reason through compatible fields/references.
- Billing receives idempotent source events and returns authoritative charges/totals.
- Patient portal reads only explicit publication records for approved/final versions.
- Every shared change requires General OPD, Dental and owning-domain regression tests.

## Contract change control

- Backward-compatible additions increment the draft revision and update the changelog.
- Enum removal, field semantic change, transition change or endpoint removal requires an owner-approved major contract revision and migration plan.
- A later approved FSD revision is not self-executing; it must be reconciled into the matrix and this contract.
- Missing DEC-06 values use `PENDING CONFIGURATION`; missing DEC-10 policy uses `PENDING POLICY`; missing device parsing uses `PENDING ADAPTER CONTRACT`.

## Changelog

| Version | Date | Change |
|---|---|---|
| 2.0.0 | 22 October 2026 | Owner-approved C9 major revision: replaced free-text treatment `category` writes with explicit action types and exactly matching shared-domain references, added optical linkage, scope and completion-time revalidation, ruled-out diagnosis safety, legacy read compatibility without inferred classification, and patient-safe publication projection. C10 subsequently implemented the consuming frontend without changing this backend contract version. |
| 1.10.0 | 16 October 2026 | Implemented Phase 11 automated hardening, corrected direct optical-prescription routes to use their dedicated permission inventory, froze critical index and permission regressions, and recorded remaining live GCS/manual acceptance plus unrelated repository test/lint conditions. |
| 1.9.0 | 16 October 2026 | Completed Phase 10 configured GCS/local storage provider, atomic/idempotent attachment metadata, source-domain-first ID-linked handoffs, exact-version portal publication/withdrawal, restricted portal projection, six operational reports, snapshot dashboard refresh/read, and authoritative cross-domain report integration contracts. |
| 1.8.0 | 15 October 2026 | Implemented Phase 9 exact-version result review, configured structured completion readiness, result/order deferral, exact unmet-requirement override, authenticated doctor approval, atomic/idempotent shared OPD completion, final locking, append-only reopen/amendment/reapproval, and summary/history APIs. External publication and downstream dispatch remain Phase 10. |
| 1.7.0 | 15 October 2026 | Implemented Phase 8 permission-scoped doctor review, additive authoritative OPD diagnosis context/history, versioned structured treatment plans with scoped shared-resource references, and separate versioned optical prescriptions with configured choices, exact-version doctor approval, immutability, transactions, concurrency, and audit. Consultation completion remains Phase 9. |
| 1.6.0 | 15 October 2026 | Implemented Phase 7 contact-lens and paediatric-vision result contracts, active branch optical/drug reference validation, same-visit follow-up validation, server-derived paediatric age/guardian context, specialized completion conditions, doctor-review routing, amendments, concurrency, transactions, and audit. Optical-prescription approval remains Phase 8. |
| 1.5.0 | 15 October 2026 | Implemented Phase 6 advanced diagnostic result contracts for eleven forms, retained-source calculation checks, conditional positive/quality findings, eligible exact-version comparison, eye-safe image/document references, proposed-only IOL selection, B-scan/IOL doctor-review routing, scoped unified reads, append-only amendments, concurrency, transactions, and audit. Device adapters, final clinical review, and Phase 7 specialized forms remain later work. |
| 1.4.0 | 15 October 2026 | Implemented and froze Phase 5 result heads and version history for eight core tests, active form-profile binding/snapshots, configured required/range/option validation, laterality and axis controls, manual provenance, same-patient document references, transactional draft/completion, append-only amendment, optimistic concurrency, assignment/scope enforcement, indexes, audit, and rollback behavior. Review/submission and advanced tests remain later phases. |
| 1.3.0 | 15 October 2026 | Implemented and froze Phase 4 idempotent configured test tasks, shared order-item references, scoped station queues, assignment/reassignment, call/unavailable/start, device validation, unable/cancel, linked repeat preservation, doctor/next-station routing, optimistic concurrency, transactions, indexes, and audit behavior. Phase 5 result forms remain unstarted. |
| 1.2.0 | 15 October 2026 | Implemented and froze Phase 3 versioned intake, shared-history projection, patient-document reference validation, active complaint/emergency configuration binding, transactional completion, emergency alert, direct-routing, in-app notification, acknowledgement, concurrency, scope, audit, and rollback contracts. No clinical values or upload policy were invented. |
| 1.1.0 | 15 October 2026 | Implemented and froze Phase 2 context, generic configuration, dedicated station/device/membership, workflow-profile, laterality, permission, scope, pagination, optimistic-concurrency, unique-index and transactional activation contracts. No clinical values were seeded. |
| 1.0.1-draft | 15 October 2026 | Froze additive Phase 1 concurrency fields: visit, consultation, and clinical-order responses expose `version`; mutation bodies accept `expected_version` and `expected_status`. Existing clients may omit them, while repository compare-and-set still guards the server write. New Ophthalmology clients must send both for updates. Phase 1 visit/consultation finalization and order submission require transaction capability. |
| 1.0.0-draft | 15 October 2026 | Initial Phase 0 contract from FSD v1.0 and approved DEC-01 through DEC-12. |


## 1.12 working-tree additions - 20 October 2026

These additions extend the earlier contract; they do not certify clinical release acceptance.

### Appointment scheduling intent

Existing appointment create/update/read support nullable `ophthalmology`: required `visit_subtype` and `affected_eye`; optional nullable `service_id`, `sub_speciality_configuration_id`, `sub_speciality_code`, `referral_source` and `referred_by`. Catalogue id/code are paired, references must be active and scoped to the selected consultant, and subtype must map to the shared visit type under DEC-02. REVIEW is now supported by Appointment persistence, schemas and shared referral adapters. Updates to specialty intent require the exact original `expected_updated_at`, a SCHEDULED/CONFIRMED appointment, conditional persistence and transactional audit. Ordinary rescheduling preserves intent; destination-doctor changes revalidate it.

`GET /api/appointments/ophthalmology-options?doctor_id=<id>&resource=SERVICES|SUB_SPECIALITIES&page=1&limit=20` uses existing Appointment Booking Create/Edit permission and authoritative branch/department checks. It returns minimal paginated active choices with source doctor/branch/department and `eligible`; prices and clinical rules are not returned. SUB_SPECIALITY configuration options have explicit unique `code`, `label`, `active` and optional `requires_description`; activation needs at least one active option. No choices are seeded.

### Clinical source corrections

The existing controlled amendment endpoint additionally accepts `follow_up_decision` and `treatment_plans`. Corrections validate the exact original before snapshot, preserve existing plan identities, reject foreign/duplicate identities/references and no-ops, reuse draft clinical reference validation and update immutable source versions in the same transaction as the amendment journal/audit. Corrections produce DRAFT clinical source requiring reapproval; they do not mutate pharmacy, procedure, referral or appointment status merely because a plan field changes. Diagnosis/optical source correction coverage beyond existing dedicated workflows remains open.

### Exact result comparisons

FORM_PROFILE may explicitly declare `comparison_units` as a bounded map of safe numeric measurement paths to hospital-approved nonblank unit codes. Staff administration provides structured path/unit rows and preserves historical profile metadata. Comparison controls render these numeric paths with their configured units; no unit defaults or conversions exist.

Progression requires an earlier exact completed version for the same patient, branch and department, a different result record, matching form/schema and exact tested eye, matching VF machine/program/strategy or OCT type/scan set, and identical nonempty unit maps with finite numeric values at each mapped path. Missing units or incompatible protocols reject the claimed comparison with OPHTHALMOLOGY_COMPARISON_INELIGIBLE; NOT_COMPARED remains valid without a prior reference. Outcome remains the clinician's explicit decision.

`GET /api/ophthalmology/test-tasks/:id/result/comparisons?expected_result_version=<saved version>&page=1&limit=20` uses existing Test Queue View permission plus bound task access. It rejects stale source versions and returns task/result/version binding, minimal prior result id/clinical version/date/form/eye, eligibility/reason and pagination. The server counts all scoped earlier completed versions before paging; incompatible rows remain in the page with reasons. It never returns patient identifiers, result payloads, source comments or profile internals. Staff fetches only on explicit open with a matching saved unchanged result; save/completion/amendment revalidate eligibility.

### Report populations

Clinical volume accepts explicit `volume_basis=VISITS`, from authoritative active Ophthalmology departments and non-deleted OPD visits, including visits without contexts/tests. Dates filter visitDate, all statuses remain explicit, and station filters are rejected for VISITS. Legacy omitted basis retains ordered encounters. Minimal rows include doctor/branch/department/date/type/status and linked appointment scheduling subtype/sub-speciality when patient/branch/department/doctor references match. Missing appointment details remain null, not inferred. CSV streams the full same filtered population.

PENDING_REVIEW includes submitted or review-required completed/stale-reviewed tasks only when the exact current result is completed and not reviewed at that version. Dashboard pending counts reuse this population. REPEAT_UNABLE returns current matching tasks with the latest recorded transition reason for that status. Its optional `summary` has basis CURRENT_TASK_STATUS, denominator_tasks, repeat_required_tasks, unable_tasks, and nullable percentage fields. Denominator is all tasks ordered under the same branch/department/station/order-date filters, including cancelled tasks and repeat children; empty denominator yields null percentages. This is not a historical repeat-event rate. CSV exports task rows/reasons, not the live summary. Surgery/follow-up/revenue report integration remains a separate authoritative-domain dependency.


Dashboard scope safety: branch snapshots include only active authoritative Ophthalmology departments. Reading or refreshing requires access to every department included in the branch aggregate; partial-scope users use the existing filtered reports. Snapshots persist their department set. Legacy unbound snapshots or changed active department sets return DASHBOARD_NOT_READY until refreshed, rather than exposing an aggregate of unknown scope. Existing Dashboard permissions still apply, and no new grants or indexes are introduced.
