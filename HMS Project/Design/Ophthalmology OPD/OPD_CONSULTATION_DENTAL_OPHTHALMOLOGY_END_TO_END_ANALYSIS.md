# OPD Consultation End-to-End Analysis and Dental/Ophthalmology Improvement Plan

**Analysis date:** 4 September 2026  
**Scope:** Existing HMS OPD consultation workflow and a safe extension path for structured Dental and Ophthalmology diagnosis  
**Change type:** Analysis only; this document does not modify application logic, APIs, schemas, permissions, or workflows.

## 1. Executive summary

The current HMS OPD implementation provides a functioning general outpatient flow:

1. An appointment or walk-in is checked into OPD.
2. The visit progresses through a controlled queue/status lifecycle.
3. Vitals are captured before consultation completion.
4. The doctor records a general consultation and a diagnosis-like assessment.
5. Prescription, laboratory orders, imaging orders, referral, follow-up, documents, and billing are composed around the same visit.
6. Consultation and visit completion update the appointment, audit history, and patient EMR timeline.

The present Diagnosis tab is not a true diagnosis domain. Selected ICD-10 items exist only in React state and are appended into the consultation's free-text `assessment` field. Therefore diagnoses cannot be reliably queried, edited, ranked, audited, reported, or associated with a tooth, tooth surface, right/left eye, clinical certainty, or specialty examination.

The recommended direction is to preserve the existing OPD visit and consultation as the shared encounter backbone, introduce a structured OPD diagnosis record, and add optional specialty examination records for Dental and Ophthalmology. Pharmacy, laboratory, imaging, billing, referral, follow-up, EMR, and existing general consultation fields should continue using their current domains.

Do not implement Dental or Ophthalmology findings by adding more formatted text to `assessment`. That would preserve the screen appearance but would not create clinically reliable data.

## 2. Sources inspected

The analysis follows the repository source priority and reviewed:

- `PROJECT_RULES.md`.
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md`.
- The available extracted functional content in `fsd.txt`, including the Phase 1 OPD baseline and doctor consultation outputs.
- Existing API OPD visit, vitals, consultation, prescription, clinical-order, referral, and follow-up modules.
- Existing staff-web OPD API types, domain hooks, feature hooks, consultation workspace, diagnosis UI, and ICD-10 data.
- `M-010_OPD_VISIT_LAYERING_GAP_NOTE.md` and `M-010_OPD_VISIT_LAYERING_VERIFICATION.md`.

The referenced Phase 3 DOCX and `scope/HMS Local` prototype directory are not present in this checkout. Existing verification notes state that the OPD prototype was previously inspected. Exact specialty contracts—especially dental tooth notation and ophthalmic measurement conventions—must be confirmed with the clinical owner before implementation.

## 3. Current architecture

### 3.1 Layering

The current frontend broadly follows:

```text
OpdVisitPage
  -> useOpdVisitFeature
    -> useOpdWorkspace
      -> OPD/domain TanStack Query hooks
        -> OPD API client
          -> Fastify OPD routes
            -> OPD services
              -> OPD repositories
                -> MongoDB/Mongoose models
```

`useOpdVisitFeature` is the cross-domain coordinator. It composes consultation, prescription, lab/imaging orders, referral, follow-up, documents, appointments, and billing while the individual domain hooks continue to own their server state.

### 3.2 Core records

| Record | Cardinality/current purpose |
|---|---|
| `OpdVisit` | One encounter record for appointment or walk-in; owns queue and visit lifecycle. |
| `OpdVitals` | Multiple possible observations per visit; latest is used for consultation readiness/completion. |
| `OpdConsultation` | One per visit through unique `visitId`; owns general narrative clinical fields and `DRAFT/COMPLETED`. |
| `OpdPrescription` | One prescription aggregate per OPD source/visit with medication items and submission state. |
| `OpdClinicalOrder` | One aggregate per visit and order type (`LABORATORY` or `IMAGING`) with investigation items. |
| `OpdReferral` | One referral record per visit in the current repository pattern. |
| `OpdFollowUp` | One follow-up record per visit, optionally linked to a generated appointment. |
| Billing invoice | Separate Billing-domain record linked to patient and OPD visit. |
| Patient timeline/audit | Cross-cutting history populated for important OPD events. |

### 3.3 Permissions and scope

The backend routes enforce existing permission screens:

- `OPD / OPD Vitals / View|Create`
- `OPD / OPD Consultation / View|Edit`
- `OPD / OPD Prescription / View|Edit`
- `OPD / OPD Clinical Orders / View|Edit`
- `OPD / OPD Referral / View|Edit`
- `OPD / OPD Follow-up / View|Edit`

Visit access resolves the authenticated user's branch scope in the repository. Frontend capability flags hide or disable actions, but backend permissions remain authoritative. Dental and Ophthalmology extensions must retain branch, hospital, patient, visit, doctor, and department scope; a specialty UI flag must never authorize access by itself.

## 4. Current OPD lifecycle

### 4.1 Visit statuses

```text
CHECKED_IN
  -> WAITING_FOR_VITALS
  -> READY_FOR_CONSULTATION
  -> IN_CONSULTATION
  -> COMPLETED
```

Additional operational outcomes are `SKIPPED`, `CANCELLED`, and `NO_SHOW`. The service defines explicit allowed transitions. Terminal statuses cannot be reopened through the current transition map.

Important behavior:

- Creating from an appointment prevents duplicate visits for the same appointment.
- An active-visit check prevents a patient from receiving another active OPD visit.
- Appointment and visit creation/status updates use existing repository/service patterns.
- Vitals creation moves `CHECKED_IN` or `WAITING_FOR_VITALS` to `READY_FOR_CONSULTATION`.
- Saving the first consultation draft moves `READY_FOR_CONSULTATION` to `IN_CONSULTATION`.
- Consultation completion requires recorded vitals and marks the consultation, visit, and linked appointment completed.
- Calling the next patient uses a transaction and conditional updates to avoid double calling.

### 4.2 End-to-end business flow

#### Step 1: Patient and appointment context

The patient is selected through existing patient/appointment workflows. An OPD visit can be created from an active appointment or as a walk-in. The visit snapshots patient number/name, doctor, specialization, branch, and department and links the source appointment where applicable.

#### Step 2: Check-in and queue

The visit receives a visit number and queue token. Queue views filter by branch, department, doctor, date, status, and priority. A patient is prevented from having another active OPD visit.

#### Step 3: Vitals handoff

Authorized staff record general vitals. Server-side range validation covers blood pressure, height, weight, temperature, pulse, respiration, and oxygen saturation. BMI is calculated on the backend. Recording vitals advances the visit to `READY_FOR_CONSULTATION` and writes a patient timeline event.

#### Step 4: Doctor opens consultation workspace

The workspace loads the selected visit and patient plus clinical subrecords. The visible flow is:

1. Consultation
2. Diagnosis
3. Prescription
4. Lab Orders
5. Imaging Orders
6. Referral
7. Follow-up

Additional Notes and Documents views also exist in page rendering. General consultation fields include complaint, HPI, histories, allergies, physical examination, assessment, treatment plan, and internal doctor notes.

#### Step 5: Draft saving

The consultation uses an upsert keyed by `visitId`. Draft prescription and order records can also be saved. A consultation draft begins the doctor phase by transitioning a ready visit to `IN_CONSULTATION`.

#### Step 6: Diagnosis entry

The Diagnosis tab searches a frontend constant containing approximately 64 selected ICD-10 entries. A doctor can add a catalogue item or create a custom diagnosis with a generated `DX-xxxx` code.

However, selected diagnoses are not posted as structured records. Adding a diagnosis appends a line such as `K21.9 - Gastro-esophageal reflux disease...` to the consultation `assessment`. On reload, the UI attempts to reconstruct selected items by searching assessment text for known codes or names.

#### Step 7: Downstream clinical work

- Prescription drafts/submissions link to the visit, consultation, patient, doctor, branch, and source context.
- Laboratory and imaging order items are validated against active service catalogue records on the backend.
- Submitted orders produce patient timeline and clinical audit events.
- Referrals create an operational request for Reception to schedule; the current code intentionally does not auto-book it.
- Follow-up scheduling creates an Appointment-domain record and links it back to the OPD follow-up.

#### Step 8: Billing

At completion, the frontend builds invoice items from a matched consultation service and selected lab/imaging services, then calls the existing Billing mutation. Billing remains a separate domain.

#### Step 9: Completion and EMR

Consultation completion validates visit readiness and the presence of vitals, saves the consultation as `COMPLETED`, moves the visit and linked appointment to `COMPLETED`, adds the consultation event to the patient timeline, and writes a clinical audit event. Downstream records add their own timeline/audit events.

## 5. What is already strong and should be reused

- One authoritative OPD visit anchors patient, doctor, branch, department, appointment, and downstream context.
- Explicit visit status transitions prevent arbitrary lifecycle changes.
- Unique appointment-to-visit linkage and active-visit checks reduce duplicates.
- Vitals validation and the completion prerequisite are backend enforced.
- Consultation is uniquely keyed by visit and saved through an idempotent upsert.
- Branch scope and permissions are checked on protected backend routes.
- Prescriptions and orders use reusable source-context fields, already supporting OPD, Emergency, Inpatient, and Procedure sources.
- Clinical-order service IDs are validated against active catalogue services.
- Important actions update the patient EMR timeline and audit records.
- The frontend has reusable patient header, tab, sticky action, summary, order builder, and feedback patterns.
- The feature-hook composition keeps cross-domain orchestration out of individual domain hooks.

These foundations mean Dental and Ophthalmology should be extensions of OPD, not new parallel encounter systems.

## 6. Current gaps and risks

### 6.1 Diagnosis is free text rather than clinical data — critical

The Diagnosis tab writes selections into `assessment`. Consequences:

- No stable diagnosis ID.
- No code-system/version metadata.
- No primary versus secondary diagnosis.
- No provisional, differential, or confirmed state.
- No onset/resolution/status history.
- No laterality or body site.
- No direct query/reporting/indexing.
- No diagnosis-level author/timestamp/audit.
- No safe relationship to prescription, order, referral, billing, tooth, or eye.
- Custom `DX-xxxx` values are local timestamp fragments, not governed terminology.

### 6.2 Removing a diagnosis does not reliably remove persisted text — high

`handleRemoveDiagnosis` removes the chip from React state but does not remove the previously appended line from `assessment`. A save can therefore retain a diagnosis that appears removed from the UI.

### 6.3 Diagnosis state can leak between selected visits — high

When a newly loaded consultation has no assessment or no catalogue match, the effect does not explicitly clear `selectedDiagnoses`. This creates a risk of showing the previous patient's diagnosis chips in the next workspace session.

### 6.4 The “Auto-save enabled” label is inaccurate — medium

The Diagnosis UI displays an auto-save indicator, but persistence occurs through explicit Save Draft or Next actions. This can mislead clinicians into believing unsaved changes are already persisted.

### 6.5 Limited terminology catalogue — high for specialty work

The frontend catalogue is a small static subset and is not an authoritative, versioned terminology service. It is insufficient for Dental and Ophthalmology and cannot be safely maintained or reported at enterprise scale.

### 6.6 General consultation validation is too permissive — high

All consultation body fields are optional strings and have no meaningful maximum lengths. Completion requires vitals but does not require complaint, examination, diagnosis/assessment, or plan. Required completion fields should be approved by clinical governance and enforced on the backend.

### 6.7 Completion is a multi-domain sequence without one explicit orchestration result — high

The frontend completes the consultation first, then submits optional prescription/orders/referral/follow-up and creates billing. A failure after consultation completion can leave a clinically completed visit with only part of its downstream work submitted. Billing errors are deliberately swallowed in the current feature hook, so the UI can report consultation success while billing creation failed.

A single MongoDB transaction cannot necessarily cover every independent domain safely, but the workflow needs an explicit backend orchestration/idempotency contract or a resumable completion checklist with per-output state.

### 6.8 Service matching for consultation billing is heuristic — high

The page searches service names/categories/specialization and finally falls back to `services[0]`. This can bill the wrong service. The visit/appointment/department should carry an approved consultation service reference or pricing contract.

### 6.9 Inventory display contains a fallback quantity — high

When inventory is unavailable, the medicine projection uses a fallback available quantity of `120`. Production clinical UI must show unavailable/unknown stock, not invented availability.

### 6.10 Request gating is not fully activated — medium

`useOpdWorkspace` supports an `activeTab` parameter to gate tab-specific lookups, but `useOpdVisitFeature` currently calls it without passing `activeTab`. This causes more workspace queries to mount than necessary.

### 6.11 Concurrency protection is incomplete for generic status updates — medium/high

The service validates a transition using a previously read visit, but the repository's general `updateStatus` filter does not include the expected previous status/version. Two users can act on stale state. Conditional status updates or a version field should reject stale transitions with `409`.

### 6.12 Specialty findings cannot be represented — critical for requested scope

The consultation has only general narrative fields. It cannot safely represent an odontogram, tooth surfaces, periodontal measurements, visual acuity by eye, refraction, intraocular pressure, or eye-specific examination findings.

### 6.13 An empty vitals record can satisfy the completion prerequisite — high

The vitals request schema has no required observation, and the service accepts a body in which every clinical value is absent. Consultation completion checks only whether a latest vitals record exists. Therefore an empty record can move the patient to `READY_FOR_CONSULTATION` and satisfy `VITALS_REQUIRED`. The approved policy must define the minimum observation set, exceptions, and a reason-based override for specialties where a different observation set is appropriate.

### 6.14 Consultation finalization itself is not atomic — high

Inside consultation completion, the consultation is saved as completed, the visit is updated, the appointment is updated, the patient timeline is appended, and the audit event is written as separate operations without one transaction. A failure between those operations can produce mismatched consultation, visit, appointment, timeline, or audit state. This is separate from the later frontend downstream sequence and should be hardened even if no specialty module is added.

### 6.15 Doctor/department ownership is not explicit in consultation editing — high

Consultation routes require the OPD permission and resolve branch scope through the visit, but the inspected consultation service does not additionally prove that the actor is the visit's assigned doctor or belongs to the authorized department. If the intended rule is “only the assigned doctor may author or complete,” it is not explicitly enforced here. Clinical governance must define assigned-doctor, covering-doctor, supervisor, and reassignment behavior, then enforce it on the backend.

### 6.16 Active-visit duplicate protection is check-then-create — high under concurrency

`ensureNoActiveVisit` queries for an active visit before creation, but the visit model does not show a partial unique constraint covering one active visit per patient. Two concurrent check-ins can both pass the check. Use a database-enforced active-visit key/partial unique strategy or an equivalent transaction-safe conditional record.

### 6.17 “Next” navigation does not wait for draft persistence — medium/high

`handleNextStep` starts `saveConsultationDraft()` with `void` and immediately changes the tab/URL. Users can continue while saving fails or is still running. Rapid navigation can overlap saves, and the visible next step does not prove the prior step persisted. The action should await a successful save, show a saving state, and remain on the current step when validation or persistence fails.

### 6.18 Completion rules are duplicated across service and feature layers — medium

Consultation completion already marks the visit completed, while the feature hook later conditionally attempts another visit completion using the visit snapshot captured before the mutation. The second call is swallowed on failure. Although this often behaves harmlessly, one backend owner should finalize the consultation/visit state and return the authoritative result.

### 6.19 Clinical text length and privacy boundaries need explicit policy — medium

Consultation strings, vitals notes, and several downstream notes lack clear maximum lengths in the inspected schemas. `doctor_notes` is described in the UI as private, but the storage/response contract does not express a separate authorization boundary for that field. Confirm whether internal notes may appear in patient summaries or printed output, define a dedicated visibility rule, and test it across staff roles, patient-facing output, printing, and EMR export.

### 6.20 Risk priority summary

| Priority | Finding | Recommended disposition |
|---|---|---|
| P0 / clinical foundation | Diagnosis exists only inside free text. | Build structured diagnosis before Dental/Ophthalmology production use. |
| P0 / specialty safety | No tooth-, surface-, or eye-specific model. | Approve and implement specialty examination contracts. |
| P1 | Empty vitals can satisfy completion. | Define minimum vitals/override policy and enforce it server-side. |
| P1 | Consultation/visit/appointment completion is not atomic. | Add transactional or explicitly recoverable finalization. |
| P1 | Doctor/department ownership is not explicit. | Approve covering rules and enforce actor scope. |
| P1 | Active-visit prevention is not database-enforced. | Add concurrency-safe uniqueness. |
| P1 | Billing service selection can fall back to an unrelated service. | Store/configure an authoritative consultation service reference. |
| P1 | Inventory can display invented quantity `120`. | Represent unavailable stock as unknown and block unsafe assumptions. |
| P2 | Next-step navigation does not await save. | Await persistence and expose failure/conflict state. |
| P2 | Diagnosis removal/reload/local state can disagree. | Replace with server-backed diagnosis state. |
| P2 | Tab query gating is supported but not activated. | Pass active tab through the feature/workspace hook. |

## 7. Recommended target design

### 7.1 Preserve the shared encounter backbone

Keep these unchanged in purpose:

- `OpdVisit` for queue/encounter lifecycle.
- `OpdVitals` for general observations.
- `OpdConsultation` for shared clinical narrative.
- Existing prescription, lab, imaging, referral, follow-up, documents, billing, timeline, and audit domains.

Add specialty records linked to the same visit and consultation. Do not create `DentalVisit` or `EyeVisit` as competing encounter masters.

### 7.2 Add a structured OPD diagnosis domain

Recommended record shape, subject to clinical approval:

```ts
type OpdDiagnosis = {
  id: string;
  visit_id: string;
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  branch_id: string;
  department_id: string;
  specialty: 'GENERAL' | 'DENTAL' | 'OPHTHALMOLOGY' | string;
  code_system: 'ICD_10' | 'ICD_10_CM' | 'SNOMED_CT' | 'CUSTOM';
  code: string | null;
  display: string;
  diagnosis_type: 'PRIMARY' | 'SECONDARY' | 'DIFFERENTIAL';
  certainty: 'PROVISIONAL' | 'CONFIRMED' | 'RULED_OUT';
  clinical_status: 'ACTIVE' | 'RESOLVED';
  laterality: 'LEFT' | 'RIGHT' | 'BILATERAL' | 'NOT_APPLICABLE' | null;
  body_site: string | null;
  notes: string | null;
  recorded_at: Date;
  recorded_by: string;
};
```

Recommended invariants:

- Exactly one primary active diagnosis per consultation unless the approved policy allows more.
- Duplicate active code + laterality + body site entries are rejected.
- A custom diagnosis requires a display name and explicit `CUSTOM` code system; do not invent a pseudo-code client-side.
- Completed consultation diagnoses are immutable except through a controlled amendment workflow.
- Every create/update/remove/amend action records actor, timestamp, reason, and before/after state.
- Index by visit, consultation, patient/date, code, specialty, branch/department, and active status.
- List endpoints remain paginated for patient-level diagnosis history.

### 7.3 Add a Dental examination extension

One `OpdDentalExamination` per consultation is recommended, containing structured findings plus a reusable odontogram child array.

Suggested groups:

- Dental complaint and dental history.
- Dentition type and approved tooth numbering system.
- Odontogram findings per tooth and surface.
- Missing/unerupted/impacted/supernumerary tooth status.
- Caries, fracture, restoration, crown, bridge, implant, root-canal, mobility, and extraction indication.
- Periodontal screening/findings, gingival condition, plaque/calculus, pocket depth where in scope.
- Occlusion/TMJ/oral mucosa findings.
- Dental diagnosis links to structured `OpdDiagnosis` records.
- Procedure recommendation and treatment plan.
- Dental imaging order linkage where needed.

Decisions required before implementation:

- FDI/ISO 3950 versus Universal tooth notation.
- Permanent and deciduous tooth handling.
- Allowed tooth-surface vocabulary.
- Whether full periodontal charting is in this release.
- Required findings before completion.
- Amendment and historical odontogram comparison rules.

### 7.4 Add an Ophthalmology examination extension

Use one `OpdOphthalmologyExamination` per consultation with paired right-eye/left-eye observations.

Suggested groups:

- Presenting ocular complaint and ocular history.
- Visual acuity: distance/near, uncorrected/corrected/pinhole, right and left.
- Refraction: sphere, cylinder, axis, add, and best-corrected acuity.
- Intraocular pressure: value, method, time, right and left.
- Pupils, RAPD, colour vision, extraocular movements, and visual fields.
- External/adnexal, slit-lamp/anterior segment, lens, vitreous, optic disc, macula, vessels, and peripheral retina findings.
- Approved laterality on diagnoses.
- Imaging/investigation links such as OCT, fundus imaging, visual field, pachymetry, or ultrasound only when present in the service catalogue.
- Glasses/medication/procedure/referral/follow-up plan.

Decisions required before implementation:

- Visual acuity notation (Snellen metric/feet, LogMAR, or configurable display).
- IOP unit/method requirements and valid ranges.
- Refraction conventions and decimal precision.
- Mandatory right/left eye fields by visit type.
- Whether diagrams/drawings or image attachments are in scope.
- Which critical findings require alerts or urgent referral.

### 7.5 Specialty selection

Specialty mode should come from authoritative visit context—doctor specialization and department configuration—not a freely editable frontend value. A normalized specialty capability/configuration is safer than string matching names such as “Dental” or “Eye.”

Recommended behavior:

- All visits retain the General Consultation and structured Diagnosis sections.
- Dental department/doctor context adds a Dental Examination tab.
- Ophthalmology context adds an Eye Examination tab.
- Existing Prescription, Lab, Imaging, Referral, Follow-up, Documents, and Summary remain shared.
- Unknown specialties fall back to the general OPD workflow.

## 8. Recommended API design

Illustrative endpoints, aligned to existing route patterns:

```text
GET    /api/opd/visits/:visitId/diagnoses
PUT    /api/opd/visits/:visitId/diagnoses/draft
POST   /api/opd/visits/:visitId/diagnoses/complete

GET    /api/opd/visits/:visitId/dental-examination
PUT    /api/opd/visits/:visitId/dental-examination

GET    /api/opd/visits/:visitId/ophthalmology-examination
PUT    /api/opd/visits/:visitId/ophthalmology-examination
```

The exact aggregate boundary should be selected before coding. A single versioned “save clinical workspace” command can improve atomicity, but should not replace existing pharmacy/lab/imaging/billing domains. A practical design is:

1. Atomically finalize consultation + diagnoses + specialty examination + visit status.
2. Return an idempotent completion result and downstream output checklist.
3. Submit existing downstream domain commands with idempotency keys.
4. Report each downstream success/failure explicitly and allow safe retry.

All payloads require Zod/Fastify validation, maximum lengths, enumerations, numeric ranges, branch/department authorization, optimistic concurrency, standard error codes, OpenAPI schemas, and projections that avoid exposing unnecessary clinical data.

## 9. Recommended frontend design

### 9.1 Shared flow

```text
Patient header
  -> General Consultation
  -> Diagnosis
  -> Specialty Examination (when configured)
  -> Prescription
  -> Lab Orders
  -> Imaging Orders
  -> Referral
  -> Follow-up
  -> Review & Complete
```

### 9.2 Diagnosis user experience

- Server-backed terminology search with debouncing and pagination.
- Code, description, code system, primary/secondary/differential, certainty, laterality, and body site.
- Clear “custom un-coded diagnosis” workflow with validation and audit.
- No implicit string concatenation into assessment.
- Diagnosis chips/cards loaded directly from persisted diagnosis records.
- Explicit unsaved/saving/saved/error indicator; only say auto-save when actual debounced persistence exists.
- Completion checklist highlighting missing required information.
- Read-only completed state and controlled amendment action.

### 9.3 Dental UI

- Interactive but accessible odontogram with a keyboard/table alternative.
- Tooth selector, surface selector, finding/action, note, and status.
- Separate sections for periodontal/oral/TMJ findings based on approved scope.
- Existing HMS compact cards, tabs, sticky patient context, summary side panel, and sticky save bar.
- Print/export summary generated from structured data, not the interactive chart alone.

### 9.4 Ophthalmology UI

- Mirrored OD/right and OS/left columns with clear labels; never rely only on abbreviations.
- Compact rows for visual acuity, refraction, IOP, pupils, motility, fields, anterior segment, and posterior segment.
- Unit and method displayed beside measurements.
- Critical/urgent findings shown with text and icon, not color alone.
- A concise eye examination summary feeds the existing consultation summary and EMR view.

## 10. Compatibility and migration strategy

Existing consultation records must remain readable without migration failure.

Recommended approach:

1. Add diagnosis and specialty collections without removing `assessment`.
2. For old records, display `assessment` under “Legacy assessment/diagnostic notes.”
3. Do not automatically parse old prose into confirmed diagnoses.
4. If a migration assistant is desired, produce suggestions requiring clinician confirmation.
5. New structured diagnoses may generate a human-readable assessment summary, but the structured records remain authoritative.
6. Existing generic OPD visits continue to work when no specialty record exists.
7. Existing pharmacy, laboratory, imaging, referral, follow-up, billing, audit, and EMR identifiers remain unchanged.

## 11. Recommended implementation phases

### Phase A — Contract and clinical decisions

- Confirm diagnosis code systems and licensing/version source.
- Confirm Dental numbering/surface conventions.
- Confirm Ophthalmology units, ranges, required fields, and laterality rules.
- Define completion/amendment rules and ownership permissions.
- Define specialty mapping from department/doctor configuration.
- Produce approved API schemas and UI field matrix.

**Stop gate:** no specialty schema implementation until these clinical decisions are approved.

### Phase B — Generic structured diagnosis foundation

- Add model, repository, service, routes, schemas, permissions, indexes, audit, and timeline summary.
- Add optimistic concurrency/version handling.
- Replace client-only diagnosis state with domain/feature hooks and live APIs.
- Retain legacy assessment display compatibility.
- Add focused permission, branch, validation, duplicate, stale-write, and audit tests.
- Define assigned-doctor/covering-doctor authorization and enforce department scope.
- Make active-visit creation concurrency-safe and add a two-request test.

### Phase C — Dental examination

- Add approved structured Dental model and validators.
- Add odontogram and clinical sections using existing OPD workspace patterns.
- Link diagnoses, procedures/referrals, imaging, and summary.
- Test permanent/deciduous notation, tooth surfaces, duplicate findings, amendments, print, responsiveness, and accessibility.

### Phase D — Ophthalmology examination

- Add approved bilateral eye examination model and validators.
- Add paired-eye UI and structured summary.
- Link diagnoses, investigations, prescriptions, procedures/referrals, and follow-up.
- Test laterality, units, numeric ranges, critical findings, amendments, print, responsiveness, and accessibility.

### Phase E — Completion orchestration hardening

- Introduce versioned/idempotent finalization.
- Return per-output completion status for prescription, lab, imaging, referral, follow-up, and billing.
- Remove heuristic consultation-service billing fallback.
- Remove invented inventory availability.
- Activate tab-based query gating.
- Add recoverable partial-failure UI and retry behavior.
- Make the core consultation/visit/appointment/timeline/audit finalization atomic or explicitly resumable.
- Require an approved minimum vitals set or a permissioned, reasoned override.
- Make Next/step transitions wait for successful draft persistence.

## 12. Required validation and test matrix

### Backend

- Authentication and every OPD permission boundary.
- Branch/department/doctor scope for view and edit.
- Invalid visit, closed visit, missing vitals, and invalid transition.
- Required diagnosis and specialty completion fields.
- Duplicate primary diagnosis and duplicate code/site/laterality.
- Invalid tooth, surface, eye laterality, units, and clinical measurement ranges.
- Stale version conflict and two-user concurrent update.
- Completion rollback/idempotent retry behavior.
- Audit before/after values and patient timeline linkage.
- No cross-patient or cross-visit specialty record access.

### Frontend

- Loading, empty, error, permission denied, retry, saving, saved, conflict, and completed/read-only states.
- Switching patients clears all local specialty and diagnosis state.
- Reload restores exact diagnoses and findings from the backend.
- Removed diagnoses remain removed after reload.
- Specialty tabs appear only for authoritative configured context.
- Keyboard navigation and accessible labels for odontogram and paired-eye forms.
- Desktop, tablet, mobile, print, and long-text behavior.
- Downstream status clearly reports partial failures rather than false overall success.

### End-to-end

- Appointment -> check-in -> vitals -> general consultation -> structured diagnosis -> specialty examination -> orders/prescription -> referral/follow-up -> billing -> completion -> EMR.
- Dental visit with multiple tooth/surface findings and primary diagnosis.
- Ophthalmology visit with bilateral measurements and laterality-specific diagnosis.
- Logout/login persistence and patient timeline visibility.
- Two-session stale editing and completion conflict.
- Unauthorized branch/department access rejection.

## 13. Immediate improvements before specialty implementation

These are small, high-value corrections that do not require final Dental/Ophthalmology field decisions:

1. Clear diagnosis state whenever the selected visit changes.
2. Stop claiming auto-save unless actual persistence succeeds.
3. Fix diagnosis removal so persisted data and UI cannot disagree.
4. Remove the fake inventory quantity fallback of `120`; show unknown/unavailable.
5. Pass `activeTab` into `useOpdWorkspace` to activate existing query gating.
6. Add meaningful max lengths and approved minimum completion requirements.
7. Replace heuristic billing service matching with an explicit configured service reference.
8. Add conditional/versioned visit status updates to reject stale transitions.
9. Surface billing and downstream submission failures instead of reporting unconditional completion success.

Items 1–3 should ideally be superseded by the structured diagnosis foundation rather than deepening the current free-text approach.

## 14. Final recommendation

The existing OPD consultation flow is a sound shared foundation, but the current Diagnosis tab is presentation logic over a free-text assessment—not a safe basis for specialty diagnosis.

Implement one structured diagnosis domain shared by all OPD specialties, then add Dental and Ophthalmology examination extensions linked to the same visit and consultation. Preserve all existing downstream domains and route flows. First obtain clinical approval for tooth notation, dental surface vocabulary, visual-acuity/refraction/IOP conventions, required completion fields, terminology source, and amendment policy. This approach adds specialty depth without disrupting the existing OPD, pharmacy, laboratory, imaging, billing, referral, follow-up, or patient EMR workflows.
