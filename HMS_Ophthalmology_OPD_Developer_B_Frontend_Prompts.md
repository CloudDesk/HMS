# HMS Ophthalmology OPD — Developer B (Frontend) Phase Prompts

> **18 October 2026 implementation update:** The human user subsequently authorized backend and frontend remediation in this chat. That authorization supersedes the earlier frontend-only boundary for this remediation. Preserve the historical B0–B6 numbering and ownership rules for future independent frontend tasks. The current implementation/status evidence is in `HMS_OPHTHALMOLOGY_FULL_IMPLEMENTATION_PLAN.md` and `HMS_OPHTHALMOLOGY_FULL_IMPLEMENTATION_VERIFICATION.md`; none of B1–B6 should be called release-complete solely from previous feature checkpoints.

Add these acceptance requirements to the corresponding phase prompts: original shared-OPD version bodies; mandatory-task presence and exact review versions; implemented submit-for-review; clinical-only workspace/bound-configuration access; structured diagnosis editing; frozen completion keys/versions; typed source correction/reapproval with publication withdrawal; exact-version publication status/history/withdrawal; portal-safe record/file visibility; authenticated full-filter CSV export. Preserve stale/dirty drafts, explicit permissions and server scope. Still resolve the detailed clinical/master/comparison/workflow semantics and live hospital acceptance gaps recorded in the current verification.

## Role and ownership

You are **Developer B — Frontend**.

**Scope clarification — 16 October 2026:** Implement only the staff frontend. This revision is an FSD gap analysis and prompt update, not authorization to begin feature implementation or the next phase. The phase-specific requirements and coverage register below are part of each prompt, not optional examples. Preserve the existing Phase 0–6 numbering; use B0–B6 for frontend phases and A0–A11 for Developer A backend phases to avoid confusing their different boundaries.

**Owned files:** `apps/web/**` including staff-facing pages, components, hooks, styling, API clients, and frontend tests. You may update frontend artifacts only in the agreed documentation location.

**Do not edit, format, rename, generate, or delete:** `apps/api/**`, `apps/patient-web/**`, mobile apps, shared packages, root configuration, or any files owned by Developer A. If a change crosses this boundary, document the exact file and proposed change and request the owning developer's handoff/approval. Do not make the cross-boundary change yourself.

# HMS Ophthalmology OPD — Mandatory Project Rules

## 1. Required Reference Documents

Before modifying code, locate, read, and assess:

1. **Engineering checklist:** `HMS_Engineering_Best_Practices_Checklist.md`
2. **Functional specification:** `Ophthalmology OPD Consultation Functional Specification Document (FSD v1.0, 10 September 2026)`

Also read `PROJECT_RULES.md`, `AGENTS.md`, `HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX.md` (including approved DEC-01–DEC-12), and `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md`. The project rules remain authoritative where the general checklist differs; for example, the checklist's Azure storage wording does not authorize changing the project's Google Cloud Storage requirement.

The supplied FSD was read from `C:/Users/Admin/Downloads/Ophthalmology_OPD_Consultation_Functional_Specification_Document 1.docx`: version 1.0, dated 10 September 2026, labelled For Review and Approval. Its content matches this implementation track. The existing alignment register records project approval of the v1.0 baseline and DEC-01–DEC-12 on 15 October 2026; the attachment's pending signature table does not by itself revoke those recorded decisions. This analysis does not approve new clinical values or declare the supplied copy byte-identical to the earlier document. Compare section headings/content on future revisions; use section numbers as locators because table numbering differs across existing reference notes.

The user-supplied workflow diagram is a supporting interaction reference. It illustrates emergency bypass, routine stations, diagnostic repeat/review, treatment outcomes and final approval. It is not authority for extra statuses, fixed station order, mandatory tests, or immediate doctor review for every routine patient. Follow the configured sequence and approved contracts.

### Reference-document verification
- Search the currently checked-out repository and available project reference files for the exact checklist and FSD filenames. Verify the exact paths; do not assume them.
- Verify whether the FSD is the correct and authoritative specification for this Ophthalmology OPD implementation track.
- Compare the FSD with the existing codebase, approved decisions, API contracts, and phase objectives.
- Identify missing, ambiguous, contradictory, outdated, or unapproved requirements.
- Do not assume the FSD is implementation-ready merely because it exists.
- Do not silently rewrite or reinterpret the FSD.
- Do not invent clinical thresholds, mandatory tests, diagnosis rules, prescription rules, or workflow decisions.
- If the FSD cannot be found, report the search locations and stop work that depends on its requirements. Independent codebase analysis may continue.
- If the checklist cannot be found, report it and do not silently skip its standards.
- If the FSD conflicts with an approved requirement or contract, document the conflict and request a decision before implementing affected behavior.

Create or update an FSD alignment assessment in an agreed documentation location. Include:
1. FSD identity, version/date, and exact path.
2. Whether it is the correct specification for this track.
3. Requirement-to-code and requirement-to-phase mapping.
4. Missing, ambiguous, contradictory, or outdated requirements.
5. Clinical and technical decisions requiring approval.
6. API and frontend dependencies.
7. Readiness: `READY`, `READY WITH BLOCKERS`, or `NOT READY`.
8. Exact blockers and the action required to resolve each.

Never claim a document was verified if it was not accessible.

## 2. Branch and Repository Safety
- Work only in the currently checked-out branch.
- Do not switch branches, reset, rebase, stash, cherry-pick, or discard existing changes.
- Inspect `git status` and relevant diffs before and after work.
- Preserve pre-existing and unrelated modifications.
- Do not run destructive database operations or tests against real data.
- Do not modify generated files or dependency lockfiles unless required and approved.

## 3. Contract-First Dependencies
- Use a versioned, agreed API contract before frontend integration.
- Preferred location: `docs/analysis/ophthalmology/contracts/`. Verify it is accessible and suitable before relying on it. If documentation is ignored/untracked, agree on a tracked, accessible, non-conflicting location; do not force-add or overwrite files without approval.
- Each contract must define endpoint/method, request/response schemas, required fields and validation, authentication/permissions/organization scope, errors, identifiers and lifecycle transitions, audit requirements, compatibility/versioning, and representative examples.
- Developer A publishes the contract; Developer B implements against it. Neither silently changes the other's implementation.
- The existing tracked contract is `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md`, currently v1.10.0. Use it rather than creating a competing contract under the preferred directory. Read the actual routes, schemas and types without editing them. Endpoint families for later phases are planned contracts, not evidence that those endpoints work.
- If a dependency is missing, complete only independent work and document the exact missing artifact, decision, field, endpoint, or approval. Do not invent a substitute.

## 4. Engineering Checklist Compliance
Use `HMS_Engineering_Best_Practices_Checklist.md` as a required review gate. Apply relevant items, including:
- Friendly and consistent error handling.
- Correct API routes/configuration; no production dependency on localhost.
- No mock data or fake dashboards presented as real functionality.
- Strict TypeScript; do not introduce `any`.
- Correct identifiers, validation, authorization, and organization isolation.
- Atomic persistence and data integrity where required.
- Safe authentication, session, and patient-portal behavior.
- Accessible, consistent UI and global table/button standards.
- Correct file storage and secure document access.
- Clinical workflow correctness, timezone handling, concurrency safety.
- Appropriate tests, documentation, and release checks.
Do not claim the entire HMS complies merely because one phase passes its checks.

## 5. Execution Discipline
- Work only on the assigned phase and ownership area.
- Timebox the initial analysis and implementation to 10 minutes per prompt.
- Treat the timebox as an initial progress checkpoint, not permission to omit FSD coverage, skip verification, or declare incomplete work complete. Continue only within the authorized phase; report unfinished work accurately.
- Prefer a small, complete, testable slice over a broad incomplete rewrite.
- Do not start dependent work until prerequisites are satisfied.
- Do not mark a phase complete when required behavior or tests remain unverified.
- Report actual commands and results; never invent test/build/verification outcomes.
- Stop after each phase and wait for explicit approval before starting the next phase. Backend phase completion does not constitute approval or completion of the corresponding frontend work.

### Frontend architecture and patient safety

- Follow `Page -> Feature Hook -> Domain Hook -> Domain Service -> API Client -> Backend`. Compose cross-domain work in feature hooks; do not fetch or mutate server data inside pages/components.
- Use TanStack Query with patient/visit/task/branch-aware keys, permission/context gating, targeted invalidation and modal-only lookup fetching. Keep page, filter, sort, search and selected workspace tab in validated URL state.
- Use React Hook Form and Zod aligned to exact request schemas. Keep incomplete draft validation distinct from completion validation; do not require every final field merely to save a draft.
- Send each endpoint's exact version/status fields, including separate context/task/result versions where required. Reuse an idempotency key for a retry of the same operation; do not reuse it for a different request. A conflict requires refresh/reconciliation, not automatic overwrite.
- Cancel or ignore obsolete requests and reset forms, selected files, pending actions and cached views on patient/visit/task changes. A late response or mutation result must never populate the newly selected encounter. Warn about unsaved changes without storing clinical drafts in browser storage.
- Show explicit loading, empty, missing-configuration, denied, error, success, conflict and retry states. No fake success, normal findings, zero metrics or browser-persisted clinical records.
- Use top-right Sonner notifications, red required asterisks, keyboard-accessible controls and clear text labels alongside status colours. A saved section indicator must reflect persisted data, not imply clinician review or approval.
- Reuse existing OPD/patient/table/modal/document patterns. `scope/HMS Local` was absent in this checkout during this analysis; recover the approved visual reference before claiming prototype fidelity. Do not modify prototypes or invent a new visual system.
- Retain existing routing/layout patterns. Document any conflict between the locked-stack wording and the repository implementation instead of initiating a router/layout migration.

## 6. Required Handoff
At the end of every phase, report:
1. Phase and status.
2. FSD alignment and newly discovered blockers.
3. Checklist items reviewed and outstanding violations.
4. Files changed, limited to your ownership.
5. API/contract changes and dependencies.
6. Tests run and actual results.
7. Known limitations and unresolved decisions.
8. Exact next action and responsible developer.

Allowed statuses: `COMPLETE`, `PARTIALLY COMPLETE`, `BLOCKED`, or `NOT STARTED`.

---

## Phase 0 — UI assessment and backend dependency mapping

**Status — 16 October 2026:** COMPLETE for assessment deliverables; implementation readiness is READY WITH BLOCKERS. See `HMS_OPHTHALMOLOGY_FRONTEND_B0_ASSESSMENT.md`, `HMS_OPHTHALMOLOGY_FRONTEND_B0_FIELD_MAPPING.md` (21 forms, 178 field rows), and `HMS_OPHTHALMOLOGY_FRONTEND_B0_VERIFICATION.md`. B1/B2 progress is tracked below. This assessment status does not certify frontend functionality or waive any documented dependency.

**Objective:** Verify FSD readiness and map the existing UI before implementation.

1. Follow all mandatory project rules above.
2. Locate and read the engineering checklist and FSD; record exact paths and versions.
3. Assess whether the FSD sufficiently defines UI behavior, roles, states, validation, loading/error handling, responsive behavior, and accessibility.
4. Inspect existing staff-facing patient registration, encounter, consultation, queue, laboratory, imaging, pharmacy, billing, and shared UI patterns.
5. Identify frontend defects and map each proposed change to an FSD requirement.
6. Obtain Developer A's backend contract or record the exact missing dependency. Do not invent endpoints, payloads, fields, or status values.
7. Produce an FSD-to-UI mapping, UI gap assessment, and frontend dependency register.
8. Do not implement features that depend on unresolved clinical/backend decisions.

**Deliverables:** FSD alignment assessment, UI gap list, baseline frontend checks, dependency register, and phased recommendation.

**Required scope:** Apply B0 in the coverage register below, including field-level mapping for all 21 forms and distinguishing implemented from planned backend APIs.

**Timebox:** 10 minutes for the initial assessment. Record further investigation as pending.

## Phase 1 — Existing frontend defects and foundations

**Status — 16 October 2026 (B1/B2 continuation):** PARTIALLY IMPLEMENTED. B1a fixes remain. B1b now includes live API configuration/profile, station/device/member and workflow administration, structured editors and versioned actions. The 13-area shell/header, compatible subtype selection and versioned context editing are now implemented. Opaque master value schemas, appointment fields and live clinical acceptance remain open. See `HMS_OPHTHALMOLOGY_FRONTEND_B1_VERIFICATION.md` and `HMS_OPHTHALMOLOGY_FRONTEND_B1_B2_REMAINING_GAPS.md`.

**Prerequisites:** Phase 0 assessment available; affected requirements confirmed; backend dependencies identified.

1. Review the checklist and FSD alignment assessment.
2. Fix the confirmed diagnosis-chip versus persisted-assessment mismatch, if present.
3. Fix visit/encounter switching so stale state from a previous patient or encounter cannot appear in the current context.
4. Ensure loading, empty, validation, success, and failure states are handled consistently.
5. Follow existing design-system and global table/button standards rather than adding isolated styling.
6. Add/update frontend tests for affected behavior.
7. Do not mask missing backend behavior with local mock data or fake success responses.

**Completion gate:** UI reflects persisted data correctly, encounter switching is safe, relevant tests pass, and backend gaps are reported separately.

**Required scope:** Apply B1 below: specialty activation, appointment/context mapping, role-aware shell and configuration administration. Keep unrelated OPD/Dental workflows unchanged.

## Phase 2 — Structured ophthalmic observation UI

**Prerequisites:** Approved FSD observation requirements and Developer A's versioned API contract.

1. Build observation forms/sections from approved FSD field definitions.
2. Support laterality, validation, and required/optional states exactly as specified.
3. Connect the UI through the existing API-client architecture to approved endpoints.
4. Implement loading, save, validation, empty, and server-error states.
5. Ensure the selected patient/encounter remains correct through navigation, refresh, and encounter switching.
6. Avoid duplicate submissions and never show success before a confirmed save.
7. Add tests for data entry, validation, API failures, and encounter switching.
8. Update documentation if UI behavior or dependencies change.

Do not invent clinical ranges, default findings, or mandatory fields. If a field is unclear or absent from the contract, report it instead of fabricating a substitute.

**Completion gate:** UI consumes the agreed contract and is tested against success/error behavior.

**Required scope:** Apply B2 below for intake/emergency and all 21 form families. Implement as B2a intake, B2b the eight contracted core forms, B2c advanced diagnostics and B2d contact-lens/paediatric forms. Backend A6/A7 have now been delivered in contract v1.10.0; reconcile exact nested fields and hospital configuration while implementing B2c/B2d. B2b live task testing also requires the B3 task-entry slice; agree that slice explicitly or use existing authorized tasks without claiming the full queue UI is complete. A completed slice does not make the whole B2 phase complete.

**Status — 16 October 2026 (B1/B2 continuation):** PARTIALLY IMPLEMENTED. Intake/emergency and initial controls for all 21 families now include profile-defined detailed measurement/choice controls, optical/drug reference lookups, task attachment uploads/reference selection and versioned corrections with a reason. Repeated code/dilation/image/IOL rows and multiple media selection are now implemented. Remaining schema-dependent detailed/comparison fields and row-by-row/live acceptance are listed in `HMS_OPHTHALMOLOGY_FRONTEND_B2_VERIFICATION.md` and `HMS_OPHTHALMOLOGY_FRONTEND_B1_B2_REMAINING_GAPS.md`. B3 queue implementation has since started under explicit user approval; see its status below.

## Phase 3 — Test queues and station workflow UI

**Prerequisites:** Approved FSD workflow and Developer A's contract, including statuses and allowed transitions.

1. Build queue views and task details using the agreed API.
2. Show per-test statuses where supported.
3. Implement assignment, reassignment, completion, cancellation, or other actions only when approved and supported by the API.
4. Provide role-appropriate controls and handle permission-denied responses.
5. Include loading, empty, filter, pagination, validation, stale-data, and failure states as appropriate.
6. Prevent repeated actions while requests are pending and refresh affected queue data after successful updates.
7. Add tests for status rendering, transitions, permissions, and API errors.

Do not create frontend-only status transitions or hard-code assumptions about station roles, required tests, or sequencing.

**Completion gate:** Queue actions reflect server-confirmed states and map to the approved contract.

**Required scope:** Apply B3 below for all queue actions, handoffs, repeats, metadata and exception flows. Submission/review controls remain gated by the implemented review contract, not merely the existence of status enum values.

**Status — 16 October 2026:** PARTIALLY IMPLEMENTED. Live-API queue route/filter/paging, selected scoped detail/history, configured task creation, assign/reassign/call/start/unavailable/unable/cancel/repeat/route dialogs and shared result-editor access are implemented. Original versions, scoped permissions, dirty guards, stable create/repeat keys and targeted cache refresh are retained. Submit-for-review, unassigned-task discovery, complete clinical display/eligibility projections, workflow prerequisite enforcement and live clinical acceptance remain dependencies. See `HMS_OPHTHALMOLOGY_FRONTEND_B3_GAP_NOTE.md` and `HMS_OPHTHALMOLOGY_FRONTEND_B3_VERIFICATION.md`. B4 was subsequently approved; see its status below.

## Phase 4 — Diagnosis, treatment and prescription UI

**Prerequisites:** Approved clinical field definitions and Developer A's versioned API contracts.

1. Build structured diagnosis entry/display using approved terminology and fields.
2. Keep diagnosis chips, encounter assessments, and saved diagnosis records consistent.
3. Implement treatment and prescription forms only for confirmed requirements.
4. Apply approved validation and permissions; show server validation errors against relevant fields.
5. Distinguish unsaved, saved, and finalized records.
6. Prevent duplicate submissions and stale encounter data.
7. Add tests for create/edit, validation, API errors, and saved-data consistency.

Do not invent diagnosis codes, dosage rules, prescription authority, validity periods, or optical fields. Do not use mock data to make incomplete endpoints appear functional.

**Completion gate:** Forms use the approved contract, display saved data accurately, and handle validation/authorization failures.

**Required scope:** Apply B4 below for consolidated review, diagnostic feedback, structured diagnosis, treatment, medication/optical prescriptions and shared care outcomes. Backend A8 and relevant shared-domain extensions are prerequisites.

**Status — 16 October 2026:** PARTIALLY IMPLEMENTED. Existing specialty workspace now has versioned clinical-review/treatment drafts, saved structured diagnosis metadata/history, separate optical draft/approval/history and selected current-result review with exact task/result/clinical versions and eye checks. Existing shared prescribing/orders/referral/follow-up remain linked. Consolidated/history/IOP projections, version-safe structured diagnosis writes, full shared specialty fields, new treatment-reference selection, optical print/share and live clinical acceptance remain dependencies. See `HMS_OPHTHALMOLOGY_FRONTEND_B4_GAP_NOTE.md` and `HMS_OPHTHALMOLOGY_FRONTEND_B4_VERIFICATION.md`. B5 was subsequently approved; see its status below.

## Phase 5 — Review, amendment and consultation completion UI

**Prerequisites:** Approved FSD lifecycle and Developer A's stable review/amendment/completion contract.

1. Display consultation state based on server data.
2. Implement review/completion actions only for permitted roles and approved transitions.
3. Show incomplete requirements returned by the backend rather than inventing clinical rules in the UI.
4. Distinguish draft, finalized, amended, and other lifecycle states only when the contract defines them.
5. Prevent repeated submissions and handle stale-record/concurrent-update errors.
6. Make finalized-record restrictions and amendment history clear to authorized users.
7. Add tests for incomplete consultations, successful completion, rejected transitions, permission errors, and stale data.

Do not bypass backend validation or provide unapproved override mechanisms.

**Completion gate:** UI reflects server-authoritative lifecycle state and handles defined completion/amendment responses.

**Required scope:** Apply B5 below for each completion prerequisite, review/deferral/override, doctor approval, the complete summary and immutable amendment history. Backend A9 is a prerequisite; an existing generic OPD Complete button must not bypass specialty readiness.

**Status — 16 October 2026:** PARTIALLY IMPLEMENTED. Server readiness and scoped finalization/approval/amendment history, version-frozen authorized result-deferral and override dialogs, and specialty-origin shared OPD completion guidance are implemented. Final completion/reapproval, source-record amendments, safe consolidated summary serialization and an authoritative generic OPD backend guard remain blocked by contracts documented in `HMS_OPHTHALMOLOGY_FRONTEND_B5_GAP_NOTE.md`. See `HMS_OPHTHALMOLOGY_FRONTEND_B5_VERIFICATION.md` for checks and acceptance limits. B6 has not started.

## Phase 6 — Integrations, portal-aware UI and release hardening

**Prerequisites:** Stable backend contracts, approved integration behavior, and explicit resolution or acceptance of remaining dependencies.

1. Integrate with existing patient, encounter, laboratory, imaging, pharmacy, billing, follow-up, and document workflows only where specified.
2. Use approved API clients/configuration; do not hard-code hosted production URLs to localhost.
3. Do not display mock data as real clinical or operational information.
4. Respect backend publication and authorization rules for patient-facing documents/results.
5. Verify loading, empty, error, permission, and retry behavior across integrated screens.
6. Apply global table, button, accessibility, and responsive UI standards.
7. Run relevant frontend tests, type checks, lint, and production builds where available.
8. Verify changes are confined to `apps/web/**` and approved frontend artifacts.

**Completion gate:** UI regression evidence is recorded, integration issues are listed, and no mock behavior is presented as a completed integration.

**Required scope:** Apply B6 below for staff publication controls, files, all required reporting and full regression acceptance. Patient-portal implementation remains a handoff to its owner; Developer B must not edit `apps/patient-web/**`.

---

## FSD coverage and dependency assessment — 16 October 2026

**Readiness: READY WITH BLOCKERS for staged frontend work; not ready for end-to-end release.** Existing prompts established engineering guardrails but left the following clinical requirements implicit or unnamed. This register makes them explicit without authorizing backend changes.

Current evidence: backend contract v1.4.0 and A5 verification record A1–A5 implemented. Read-only inspection confirms context/configuration, intake/alerts, task actions and eight core result-form contracts. Staff code search found generic OPD components and an ophthalmic medication route option, but no dedicated Ophthalmology frontend integration. Treat backend verification as prior evidence, not a live acceptance test performed by this prompt revision.

| Frontend slice | Backend dependency | Current boundary |
|---|---|---|
| B1 specialty context/configuration | A2 | Contracted; requires approved branch configuration and explicit user grants. |
| B2a intake and emergency | A3 | Contracted; complaint/emergency configuration and eligible recipients required. |
| B2b eight core results | A4 task identity plus A5 results | Contracted; active form profiles, clinical values and eligible assigned staff required. |
| B3 task-entry/queue slice | A4 | Contracted; review submission/acceptance is not delivered merely by A4/A5. |
| B2c advanced diagnostics | A6 | Backend delivered in v1.10.0; frontend detailed controls, exact nested mappings and acceptance remain. |
| B2d contact lens and paediatric | A7 | Backend delivered in v1.10.0; frontend product/drug lookups, detailed controls and acceptance remain. |
| B4 doctor review and outcomes | A8 and shared-domain contracts | Planned; do not wire future endpoint names as working functionality. |
| B5 completion and reopening | A9 | Partial: readiness/history and deferral/override implemented; final completion, correction/reapproval, safe summary and backend generic completion guard remain dependencies. See B5 verification. |
| B6 publication/files/reports | A10 plus owning domains | Planned; portal client changes belong to its owner. |

Phases are scope boundaries, not a requirement to wait for every advanced form before doing independently approved queue work. Obtain explicit approval for any B2/B3 slice ordering change, retain incomplete requirements in the register, and do not silently renumber phases or waive exit gates.

### B0 Traceability and acceptance planning

Map FSD sections 1–20 and Appendices A–B to a screen, action, frontend phase, exact API/schema, permission, configuration dependency and test. For each form field record its label, backend path, type/unit, eye scope, draft/completion requirement, conditional rule, source/provenance and history behaviour. Every row must be implemented, explicitly blocked or explicitly deferred by the owner; generic wording such as “build observation forms” is not sufficient coverage.

Use the existing alignment matrix as source evidence without rewriting Developer A's deliverables. Keep this prompt and any approved frontend gap/verification artifacts in the existing tracked root documentation location. Record actual baseline checks and distinguish older verification dates from current results.

### B1 Existing OPD entry, appointment context and administration

FSD references: sections 2–5, 7, 13, 18 and Appendix A; DEC-02, DEC-03, DEC-06, DEC-07 and DEC-12.

1. Activate the specialty layer from the existing eligible Ophthalmology OPD encounter. Keep one patient, appointment and encounter across stations; do not add a separate specialty login or parallel visit.
2. Preserve registration/search, appointment, consultant/branch/slot selection, check-in and vitals. Display the six approved specialty subtypes, including Procedure Review, using the contract's existing OPD mapping rather than changing global visit enums.
3. Capture/display service, sub-speciality, affected eye, referral source/referred-by, priority and permitted notes through their owning APIs. Identify unsupported appointment fields as a shared contract gap; never append unknown fields to an existing request.
4. Provide the existing OPD-style patient header with MRN, visit, allergies and alerts, and permission-gated sections for the 13 consultation areas in FSD section 7. Separate specialty workflow status, shared OPD status and individual task status.
5. Add authorized administration views for versioned masters/form/completion profiles, stations/devices/calibration, eligible memberships and sequential/parallel workflow profiles. Use only supported create/edit/activate/deactivate actions and reason/version checks. Do not expose a generic JSON editor as a substitute for usable approved forms.
6. Read clinical configuration from approved server projections. Clinical staff must not gain configuration-edit permissions to load a form; if a suitable read projection is absent, register that API/permission dependency.
7. No configured scale/threshold/options means a clear configuration blocker. Do not seed FSD example values or copy current settings over historical configuration snapshots.

### B2a Complaint, history and emergency intake

FSD references: sections 8, 14–15 and Appendix B.

1. Complaint entry includes configured multi-select complaints, affected eye, duration/unit, onset, progression, applicable severity, associated symptoms and supporting description. Complaints and technician impressions never create a diagnosis automatically.
2. History includes prior disease, surgery with procedure/eye/date, current treatments, injuries/laser, spectacles/contact-lens use, steroids, family history and existing report references. Confirm before “no significant history” clears conflicting positive history. Apply conditional-detail validation.
3. Reuse the authoritative medical history and allergy display and record review confirmations through the intake contract; do not duplicate or silently edit the shared records.
4. Display configured emergency criteria and “Emergency Review Required” with reason, actor and time. Surface server-confirmed routing and bypassed stages without deleting outstanding tasks. Show failure when no eligible recipient exists; do not display a successful escalation after a rejected intake completion.
5. Provide separately permission-gated routing retry and alert acknowledgement. Show acknowledgement identity/time and active versus acknowledged status. Routing is currently in-app notification only; do not imply SMS/email delivery or automatic registration in the separate Emergency module.
6. Test emergency bypass, no recipient, missing configuration, confirmed history clearing, conditional surgery/urgent details, draft reload and wrong-encounter late responses.

### B2b–B2d Structured test-form inventory

FSD section numbers below are authoritative locators. All 21 forms are required scope; a backend dependency delays a form but does not remove it.

| FSD | Form | Explicit frontend coverage | Slice |
|---|---|---|---|
| 9.1 | Visual acuity | Chart/scale, test distance/unit, lighting/correction, unaided/presenting/current-glasses/pinhole/BCVA; counting-fingers distance, hand movement, light perception/projection, near conditions and acuity, cooperation/reliability and conclusion. | B2b |
| 9.2 | Lensometry | OD/OS signed SPH/CYL/AXIS/add, prism/base, lens type/material/coating, optical centre/PD, applicable segment height, condition, spectacle age/use, comfort/change reasons and existing prescription reference. | B2b |
| 9.3 | Autorefraction/keratometry | Device/calibration, cycloplegia and medication, retained readings and selected final reading, spherical equivalent, PD/pupil, K1/K2/axes/derived values, units, quality and observation. | B2b |
| 9.4 | Objective refraction | Dry/wet/cycloplegic method, retinoscopy type, working distance/unit, drug/strength and administration/examination times, raw/final power, reflex/media and observation. | B2b |
| 9.5 | Subjective refraction | Starting/final power, BCVA, duochrome/JCC/fogging, acceptance, binocular balance/acuity, dominant eye/diplopia, near addition/distance/acuity, use and impression. | B2b |
| 9.6 | IOP | Separate readings, unit, method/time/position, anaesthetic/fluorescein/drug, repeats and selected final reading, reliability reason and configured alert interpretation; never auto-diagnose glaucoma. | B2b |
| 9.7 | Pachymetry | Method, OD/OS thickness/unit, retained repeats/average, quality, impression and report. | B2c |
| 9.8 | Colour vision | Method/tested eye, plates shown/correct/incorrect and supported score, result, defect/severity and reliability reason. | B2c |
| 9.9 | Motility/squint/binocular | Methods, fixing eye, deviation/nature, near/distance prism measurements and correction, directional movement/grades, nystagmus/diplopia/head-posture details, stereopsis/Worth Four Dot and impression. | B2c |
| 9.10 | Slit-lamp/anterior segment | Separate OD/OS lids/lashes, lacrimal, conjunctiva, sclera, cornea, chamber, iris, pupil, lens, anterior vitreous and tear-film findings; normal/abnormal, location/grade, diagrams/images and remarks where contracted. | B2b |
| 9.11 | Dry eye | Symptoms/questionnaire, Schirmer method/duration, TBUT, staining grade/location, tear meniscus/unit, glands/meibum, blink/lid/sensation and impression. | B2c |
| 9.12 | Visual field | Equipment/program/strategy, eye/correction, pupil/fixation, losses/false positives/negatives/duration/cooperation/gaze, indices/pattern, eligible comparison and report/impression. | B2c |
| 9.13 | OCT | Type/requested scans matching order and eye, signal/quality, applicable measurements, artefact/segmentation comments, eligible comparison, images/report and observation. | B2c |
| 9.14 | Fundus photography | Eye per image set, type/field/dilation, quality/count, abnormalities, eye-linked images, notes and repeat indication. | B2c |
| 9.15 | Posterior/fundus | Dilation confirmation/consent, contraindication check, drug/dose/eye and instillation/ready times, method, media/vitreous/disc/macula/fovea/vessels/retina, diagrams/images and remarks. | B2b |
| 9.16 | Topography | OD/OS K values/axes/Kmax/average, astigmatism/thickness/units, elevations/maps, asphericity/pupil/white-to-white, retained source maps, quality and impression. | B2c |
| 9.17 | Biometry/IOL | Axial length/K/axes/chamber depth/lens thickness/white-to-white/corneal thickness, approved target/formula/model/power/prediction, quality/special factors, alternative calculations, selected/backup IOL and doctor approval. | B2c |
| 9.18 | B-scan | Order eye/indication, probe/gain, optional axial length, vitreous/retina/choroid, lesion dimensions/mobility, permitted media/report, technician observation and separate doctor review. | B2c |
| 9.19 | Gonioscopy | Superior/inferior/nasal/temporal quadrants per eye, grade/pigmentation/PAS/neovascularization and positive details; lens, static/dynamic method, classification/cooperation/diagram/impression. | B2c |
| 9.20 | Contact lens | Distinct trial/final lens details, brand/material/base curve/diameter, power/add, trial/wear/replacement schedule, fit, over-refraction/VA, comfort/ocular response, outcome, training/hygiene and follow-up. | B2d |
| 9.21 | Paediatric vision | Age-appropriate methods, cycloplegia/drug/timing, alignment/red reflex, amblyopia/binocular findings, cooperation, separate parent-reported symptoms, birth/development history and result. | B2d |

Common requirements for every form:

- Show OD/OS side by side on wide screens and clearly labelled on narrow screens. Use record-specific canonical laterality subsets; OU is not a substitute for two independent eye measurements. Any explicit copy-to-other-eye action produces separately identifiable values and never silently defaults findings to normal.
- Show patient, encounter, task/order, performer, station, device/calibration, performed/start/completion times, reliability, review status and version metadata according to permission. Clearly distinguish technician impression from final diagnosis.
- Use the published discriminated payload, schema version and active form profile. Keep signed values, zero, missing values and units distinct; axis is 0–180 where applicable. Other ranges, scales, grades, clinical thresholds and required fields come from approved configuration.
- Retain raw/source readings and selected/final readings. Only show calculations defined by the contract; server-validated values remain authoritative. Preserve original data when quality is poor or a repeat is requested, and require the appropriate explanation.
- Distinguish draft save, performer completion, submission, review and final clinical approval. A5 completion only makes the task/result `COMPLETED`; it does not imply review. A5 amendments apply to the exact supported completed result version, not arbitrary reviewed/finalized records.
- Distinguish manual, imported and manually corrected provenance. A5 supports manual entry and correction; device import must remain unavailable while the adapter is unconfigured. Use existing same-patient document references; full upload/annotation/video/DICOM support requires its explicit policy and API.
- Historical comparisons must match patient, eye, test and eligible protocol/unit/encounter. Show “not compared” when no eligible result exists; never infer progression or overwrite current values.
- Test each form's draft/reload, complete, conditional/missing/invalid values, wrong eye/context, poor reliability, stale version, denied action and permitted amendment. Validate source/selected/derived consistency where applicable.

### B3 My Test Queue, handoffs and exceptions

FSD references: sections 5–6, 12–15 and 20; DEC-04 and DEC-12.

1. Display one row per task with permitted patient identity, encounter, appointment type/consultant, test, station/assignee, priority, assigned/waiting time, state, instructions and authorized prior-result access. Use paginated server filters/sorts and branch-timezone display; do not fetch all rows to calculate dashboard totals.
2. Cover all eleven FSD actions: call, start, save draft, complete, submit for review, request repeat, reassign, next station, direct ophthalmologist, patient unavailable and cancel with reason. Also expose unable-to-perform and controlled amendment when allowed. Missing action endpoints remain explicit dependencies.
3. Use approved action controls rather than an unrestricted status dropdown. `REVIEWED` is terminal; `Closed` is not an extra persisted state and `Doctor Review` is routing. Patient-unavailable does not mean consultation completed.
4. Reassignment uses backend-eligible branch/station/test users. Active eligible membership is not proof of real-time shift availability; do not reuse doctor appointment slots for technicians.
5. Show sequential/parallel workflow stages, actual prerequisites and permitted bypass. Next-station routing selects an existing eligible task; do not manufacture a duplicate task/order or silently delete bypassed work.
6. Repeat retains the original result and links the new task; show both and their reasons/history. Retried creation/repeat must not appear twice. Use exact versions/statuses and prescribed idempotency headers.
7. Handle patient-left/unavailable, device unavailable, poor quality, inability to perform, wrong-eye correction, cancellation and pending external results without losing prior results. Offer only server-supported reassign/defer/cancel/review actions, with required reasons.
8. After successful saves/actions, refresh affected detail, queue and permitted doctor views. Verify the next permitted user sees saved data through real API refresh; a local component update is not handoff evidence.

### B4 Doctor review, diagnosis and treatment outcomes

FSD references: sections 10–11 and 20.

1. Build the consolidated doctor review inside the existing OPD flow: patient/allergies/alerts/history, VA, spectacles/refraction, IOP readings/history graph, anterior/posterior findings, reports/images, reliability and technician impressions, pending review and repeat requests. Fetch the approved consolidated/read projections; do not reconstruct unrestricted patient histories.
2. Support the complete investigation loop during consultation: select test/eye/reason/priority/schedule, create a shared order, route to the appropriate queue, display the authoritative result, and separately record authorized review/reviewer/time. Additional tests may return the encounter to awaiting results; do not require consultation completion first.
3. Structured diagnosis uses existing terminology/codes with laterality, suspected/confirmed/ruled-out status, primary/secondary, configured severity/stage and separate differential diagnoses. Preserve change history and the one-primary rule. Keep chips and persisted assessment consistent.
4. Treatment plan links diagnosis, eye, treatment, priority, status and clinician. Distinguish draft, saved, reviewed and approved states. Never promote a machine observation to final diagnosis.
5. Reuse medication prescribing for medicine/form/eye/dose/frequency/duration/start date/taper/route/quantity/refill/instructions, only where approved shared fields exist. Preserve allergy context and prescriber authority; do not create a second prescription system.
6. Provide a separate optical prescription: distance/near/bifocal/progressive/occupational type, OD/OS SPH/CYL/AXIS/add, optional prism/base, binocular/monocular PD, applicable segment height, lens/material/coating, instructions, validity, review date, approval and authorized print/share. Do not treat saved refraction as an approved optical prescription.
7. Reuse procedure/surgery recommendation with diagnosis/eye/indication/priority and supported scheduling, surgeon, anaesthesia, implant, admission, investigations, clearance, consent and package references. Minor procedure details include checklist/notes/consumables/complications/instructions where the owning contract supports them. Missing fields are Developer A/shared-owner dependencies, not permission to build an OT subsystem.
8. Reuse internal/external referral with destination/reason/diagnosis or finding/eye/summary/referring doctor, and follow-up with date or interval/reason/consultant/pre-review tests/medication review/warning instructions. Preserve original encounter references.

### B5 Summary, completion and amendments

FSD references: sections 12, 14.1, 15–16 and Appendix B; DEC-08.

1. Display the server readiness result with actionable links to unmet sections: VA or omission reason; required independent eye data and examinations; authorized emergency/IOP acknowledgement; result review or explicit deferral/later-review plan; required assessment/diagnosis; approval of created treatment/prescriptions; follow-up or explicit no-follow-up; doctor approval.
2. A deferred result needs order/result reference, reason, due date or review plan and responsible clinician. Deferral is not a review. A dedicated authorized override requires reason and a server snapshot of unmet requirements; no frontend bypass checkbox.
3. Summary includes complaint/history, VA, spectacles/refraction, separate right/left findings, IOP, investigations/reviewed results, diagnosis/laterality, treatment, medication and optical prescriptions, procedure/surgery, referral, follow-up and patient instructions.
4. Completion requires confirmation and server-recorded actor/doctor, time and exact consultation version. Display the confirmed locked state only after success. Digital approval is the approved authenticated event; do not imply cryptographic signature certification or accept a signature image as approval.
5. Distinguish test completion, clinician review and consultation completion. Preserve outstanding work when finalization fails. Existing generic OPD actions must respect specialty readiness rather than finalizing around it.
6. Reopening starts the approved amendment episode. Display immutable prior versions, before/after, reason, actor/time and required re-review/re-approval/publication effects. Never turn a final record into an editable historical record in place.

### B6 Documents, staff publication controls, reports and acceptance

FSD references: sections 11, 16–20 and Appendices A–B; DEC-10 and DEC-11.

1. Integrate authorized document selection/upload/download through existing services when supported. Preserve patient/visit/task/order/result/eye/device/acquisition/provenance metadata. Enforce contracted file types/size limits and show failed upload/metadata/retry states accurately. Do not invent DICOM, video, annotation or device-adapter capabilities.
2. Staff publication UI must distinguish `INTERNAL`, `APPROVED_FOR_PORTAL` and `WITHDRAWN`, act on a reviewed/final version and show authorized publish/withdraw and amendment effects. Uploaded/active/completed does not automatically mean patient-visible. Internal notes, confidential observations and unverified results stay excluded.
3. Handoff portal display requirements to its owner: appointments/consultant, approved summary, final medication/optical prescriptions, selected approved reports/images, procedure/pre-operative instructions, follow-up/instructions and bills/receipts. Developer B may verify integration evidence but cannot mark portal implementation complete from staff UI alone.
4. Provide six required operational views: station queues, turnaround (order/start/completion/review), pending review, repeat/unable reasons and rates, clinical volume and diagnostic utilization. Integrate surgery pipeline, follow-up compliance and revenue from existing authoritative reports. Use scoped server metrics, date/branch/station filters, server pagination and permission-gated export. Do not present missing metrics as zero or fabricate counts from a partial page.
5. Exercise the normal workflow, emergency bypass, additional-test return/review, linked repeat, unreliable/unable/left/device-unavailable cases, wrong-eye amendment, result deferral, unauthorized override, finalization, publication/withdrawal and downstream handoff. Verify refresh/logout/login persistence, two-session stale actions and no duplicate save/order/charge effects using authorized test data.
6. Test reception, triage nurse, vision/refraction/tonometry/diagnostic staff, optometrist/orthoptist, ophthalmologist, counsellor, billing/pharmacy, administrator, read-only and no-access configurations as applicable. Permissions and resource scope, not role names alone, determine UI actions; never add grants in the frontend.
7. Verify General OPD, Dental, registration, appointments/check-in, vitals, shared diagnosis/orders/results, pharmacy, billing, referral/follow-up and procedure workflows remain functional. Include wrong patient/eye/visit/branch/department, session expiry, late-response and attachment privacy cases.
8. Verify responsive high-volume entry, keyboard/focus/labels, long-form sections, table overflow and print/share output. Inspect browser Network requests for permission gating, modal lookup timing, duplicate requests and real persistence. Component tests with mocked responses are not live browser/API acceptance.

### Required validation and completion evidence

For each implemented frontend phase run staff typecheck, lint, production build and focused Vitest tests. Run the project-required API checks as read-only integration checks without modifying backend files:

```bash
npm run typecheck --workspace=@hms/web
npm run lint --workspace=@hms/web
npm run build --workspace=@hms/web
npm run typecheck --workspace=@hms/api
npm run lint --workspace=@hms/api
npm run build --workspace=@hms/api
```

Use the existing Vitest project configuration to select actual changed-feature tests. Do not invent a workspace test script. Record exact commands, scope and results, affected-file lint evidence, live browser acceptance, unexecuted checks and unrelated baseline failures. Do not edit generated build files manually or expand ownership to repair unrelated failures.

At this analysis checkpoint, previously executed workspace checks passed typecheck/build across API, staff web and patient web. Lint reported 51 API errors and 6 staff-web errors; patient-web lint passed. Three selected general admission/surgery/Emergency test files passed 11 tests. These are project-baseline observations, not Ophthalmology frontend acceptance. The present revision changes documentation only and does not claim a frontend phase complete.

### Outstanding dependencies and exact handoffs

| Dependency | Owner and required next artifact | Frontend response |
|---|---|---|
| Production clinical values | Ophthalmology leadership/admin: approved versioned scales, options, ranges, thresholds, grades, mandatory fields/tests and completion profiles. | Show configuration-required state; no inferred defaults. |
| Advanced/special forms | Developer A: A6/A7 routes, calculations/comparison rules, errors and tests delivered in v1.10.0. | Implement B2c/B2d controls; record any still-broad nested mappings individually. |
| Review and clinical outcomes | Developer A/shared owners: implemented A8 read/review/diagnosis/plan/prescription contracts and submission/review actions. | Do not present completed tests as reviewed. |
| Completion/amendment | Developer A: implemented A9 readiness, deferral, override, approval/reopen and downstream amendment effects. | No shortcut through generic OPD completion. |
| Files/import/publication | Developer A/storage/security/portal owners: A10 contracts, approved media policy/adapters and patient-publication semantics. | Existing permitted document references only until supported; portal edits remain out of scope. |
| Reports | Developer A and finance/procedure/follow-up owners: implemented scoped aggregates/detail/export contracts. | No local fabricated reporting. |
| Staff eligibility/configuration access | Administrator/Developer A: explicit role grants, eligible memberships and permission-safe clinical configuration projections. | No automatic clinical permission elevation or claimed real-time availability. |
| Prototype availability | Project owner: accessible approved HMS Local references, or explicit visual-reference decision. | Reuse existing live UI patterns for analysis; do not claim missing prototypes were inspected. |

No backend, patient-portal, clinical master, permission seed or frontend implementation is changed by this prompt revision. The next authorized implementation step is B0 assessment/field mapping and its phase handoff, followed only by an explicitly approved frontend slice.

---

## Developer B — Phase handoff template

- **Phase/status:** `COMPLETE` / `PARTIALLY COMPLETE` / `BLOCKED` / `NOT STARTED`
- **FSD identity/path and alignment status:**
- **Checklist items reviewed and outstanding violations:**
- **Files changed (frontend-owned only):**
- **Backend contract version/location consumed:**
- **Tests/commands run and actual results:**
- **Accessibility, UI consistency, and patient/encounter context checks:**
- **Known limitations and unresolved decisions:**
- **Dependencies and exact handoff needed from Developer A:**
- **Next action and responsible person:**


## Current working-tree correction - 20 October 2026

This dated update supersedes older pending statements only for the following implemented slices: appointment specialty scheduling intent and scoped paginated lookup/editor with approved REVIEW mapping; structured sub-speciality options; treatment-plan/follow-up source amendments; visit-based report population with linked booking subtype/sub-speciality; exact completed-result pending-review counts; current repeat/unable reasons and explicitly labelled status-rate denominators; and exact prior-version comparison lookup with protocol/eye/schema/department/configured-unit validation. Preserve all earlier safety, source-version, permission, error and live acceptance requirements. See backend contract 1.12 and HMS_OPHTHALMOLOGY_GAP_CLOSURE_20261020.md for exact contracts/evidence. Do not mark B1/B2 or the full release complete: seven other master editors/schemas, unsupported nested clinical semantics, diagnosis/optical source correction coverage, downstream business metrics and live clinical/storage/permission/responsive acceptance remain unresolved. No hospital clinical values or permissions were seeded.
