# HMS Ophthalmology Backend API Contract V1

## Contract status

**Version:** 1.4.0

**Baseline date:** 15 October 2026

**Authority:** Ophthalmology FSD v1.0 plus approved DEC-01 through DEC-12

**Implementation state:** Phases 1 through 5 implemented; Phase 6 has not started

**Compatibility:** Additive to existing OPD and shared-domain APIs

This contract freezes the backend vocabulary, ownership, endpoint families, lifecycle, concurrency, permission and error behavior required for phase-wise implementation. A consuming phase must update the contract with exact request/response schemas before exposing its routes. Missing clinical values and file/vendor policy inputs remain configuration dependencies and are never inferred.

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

### Phase 5 core clinical test result forms

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

Phase 5 implements the eight rows `VISUAL_ACUITY`, `LENSOMETRY`, `AUTOREFRACTION_KERATOMETRY`, `OBJECTIVE_REFRACTION`, `SUBJECTIVE_REFRACTION`, `INTRAOCULAR_PRESSURE`, `SLIT_LAMP_ANTERIOR_SEGMENT`, and `POSTERIOR_FUNDUS_EXAM`. The remaining rows are reserved for Phases 6 and 7 and are not accepted by the Phase 5 routes.

Each active branch `FORM_PROFILE` binds one form/schema to explicit configured test codes. Its revision and full values are snapshotted in the clinical version. Configured `required_fields`, `numeric_ranges`, and `allowed_values` are enforced at completion; no clinical defaults are seeded. Axis is structurally restricted to 0-180. Poor reliability requires a reason. The selected reading and original readings remain together in the payload. Initial entry is authorized manual entry only; device import returns `OPHTHALMOLOGY_ADAPTER_NOT_CONFIGURED` until an approved adapter exists. Attachments are references to active same-patient `PatientDocument` records only.

### Phase 8 doctor review and outcomes

| Method and path | Purpose |
|---|---|
| `GET /api/opd/visits/:visitId/ophthalmology/doctor-review` | Consolidated current/historical, eye-safe, permission-scoped read model |
| `PUT /api/opd/visits/:visitId/ophthalmology/clinical-review/draft` | Save assessment/plan draft with expected version |
| `POST /api/opd/visits/:visitId/ophthalmology/diagnoses` | Add additive structured diagnosis data to existing OPD consultation ownership |
| `PATCH /api/opd/visits/:visitId/ophthalmology/diagnoses/:diagnosisId` | Versioned diagnosis status/laterality change |
| `PUT /api/opd/visits/:visitId/ophthalmology/optical-prescription/draft` | Save separate optical prescription draft |
| `POST /api/opd/visits/:visitId/ophthalmology/optical-prescription/approve` | Authorized version approval |

Shared prescription, order, surgery/procedure, referral, follow-up and billing routes remain authoritative. Ophthalmology endpoints orchestrate by reference and stable source keys; they do not duplicate shared records.

### Phase 9 completion and amendment

| Method and path | Purpose |
|---|---|
| `GET /api/opd/visits/:visitId/ophthalmology/completion-readiness` | Return configured prerequisites, satisfied/unmet items and current version |
| `POST /api/opd/visits/:visitId/ophthalmology/deferred-results` | Record result/order, reason, plan/due date and responsible clinician |
| `POST /api/opd/visits/:visitId/ophthalmology/overrides` | Authorized reasoned override with unmet-prerequisite snapshot |
| `POST /api/opd/visits/:visitId/ophthalmology/complete` | Atomically approve and complete one exact version |
| `POST /api/opd/visits/:visitId/ophthalmology/reopen` | Start a reasoned amendment episode without mutating final history |
| `POST /api/opd/visits/:visitId/ophthalmology/amendments` | Append before/after version and trigger required re-review/republish |

Digital approval records authenticated actor, linked doctor, timestamp, consultation version and audit event. It is not represented as a cryptographic signature unless a later approved contract adds one.

### Phase 10 files publication reports and dashboards

| Method and path | Purpose |
|---|---|
| `POST /api/ophthalmology/test-tasks/:taskId/attachments` | Authorized upload through patient-document/storage abstraction |
| `GET /api/ophthalmology/test-tasks/:taskId/attachments` | Permission-scoped metadata list |
| `POST /api/ophthalmology/publications` | Explicit publish of reviewed/final resource version |
| `POST /api/ophthalmology/publications/:id/withdraw` | Withdraw publication with reason |
| `GET /api/ophthalmology/reports/:reportType` | Indexed paginated detail report |
| `GET /api/ophthalmology/dashboard` | Snapshot-backed branch/station operational summary |

Mandatory report types: `STATION_QUEUE`, `TEST_TURNAROUND`, `PENDING_REVIEW`, `REPEAT_UNABLE`, `CLINICAL_VOLUME`, `DIAGNOSTIC_UTILIZATION`. Surgery pipeline, follow-up compliance and revenue use authoritative shared reporting integrations.

Attachment metadata includes patient, encounter, task/test, order/result, eye, device, acquisition time, provenance, checksum, MIME, size, original name, review state and publication state. Binary payloads are not stored in MongoDB. Production requires configured Google Cloud Storage. Unsupported policy or adapter details return explicit configuration errors.

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
| 400 | `OPHTHALMOLOGY_RESULT_OPTION_INVALID` | A value is not in the active profile's approved options. |
| 400 | `OPHTHALMOLOGY_RESULT_LATERALITY_REQUIRED` | The form has no result for an applicable eye. |
| 400 | `OPHTHALMOLOGY_RESULT_LATERALITY_INVALID` | Eye data conflicts with the task laterality. |
| 400 | `OPHTHALMOLOGY_RESULT_SOURCE_INVALID` | The source is not permitted for this write action. |
| 400 | `OPHTHALMOLOGY_REASON_REQUIRED` | Cancellation, unable, repeat, amendment, override or withdrawal lacks a reason. |
| 400 | `OPHTHALMOLOGY_COMPLETION_BLOCKED` | Configured completion prerequisites are unmet. |
| 400 | `OPHTHALMOLOGY_DOCUMENT_REFERENCE_INVALID` | A previous-report reference is missing, inactive, or belongs to another patient. |
| 400 | `OPHTHALMOLOGY_ROUTE_INVALID` | A requested next-station or doctor route is structurally invalid. |
| 400 | `OPHTHALMOLOGY_POLICY_REQUIRED` | Required file/publication/security policy is absent. |
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
| 1.4.0 | 15 October 2026 | Implemented and froze Phase 5 result heads and version history for eight core tests, active form-profile binding/snapshots, configured required/range/option validation, laterality and axis controls, manual provenance, same-patient document references, transactional draft/completion, append-only amendment, optimistic concurrency, assignment/scope enforcement, indexes, audit, and rollback behavior. Review/submission and advanced tests remain later phases. |
| 1.3.0 | 15 October 2026 | Implemented and froze Phase 4 idempotent configured test tasks, shared order-item references, scoped station queues, assignment/reassignment, call/unavailable/start, device validation, unable/cancel, linked repeat preservation, doctor/next-station routing, optimistic concurrency, transactions, indexes, and audit behavior. Phase 5 result forms remain unstarted. |
| 1.2.0 | 15 October 2026 | Implemented and froze Phase 3 versioned intake, shared-history projection, patient-document reference validation, active complaint/emergency configuration binding, transactional completion, emergency alert, direct-routing, in-app notification, acknowledgement, concurrency, scope, audit, and rollback contracts. No clinical values or upload policy were invented. |
| 1.1.0 | 15 October 2026 | Implemented and froze Phase 2 context, generic configuration, dedicated station/device/membership, workflow-profile, laterality, permission, scope, pagination, optimistic-concurrency, unique-index and transactional activation contracts. No clinical values were seeded. |
| 1.0.1-draft | 15 October 2026 | Froze additive Phase 1 concurrency fields: visit, consultation, and clinical-order responses expose `version`; mutation bodies accept `expected_version` and `expected_status`. Existing clients may omit them, while repository compare-and-set still guards the server write. New Ophthalmology clients must send both for updates. Phase 1 visit/consultation finalization and order submission require transaction capability. |
| 1.0.0-draft | 15 October 2026 | Initial Phase 0 contract from FSD v1.0 and approved DEC-01 through DEC-12. |
