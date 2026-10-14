# HMS Ophthalmology OPD — Developer B (Frontend) Phase Prompts

## Role and ownership

You are **Developer B — Frontend**.

**Owned files:** `apps/web/**` including staff-facing pages, components, hooks, styling, API clients, and frontend tests. You may update frontend artifacts only in the agreed documentation location.

**Do not edit, format, rename, generate, or delete:** `apps/api/**`, `apps/patient-web/**`, mobile apps, shared packages, root configuration, or any files owned by Developer A. If a change crosses this boundary, document the exact file and proposed change and request the owning developer's handoff/approval. Do not make the cross-boundary change yourself.

# HMS Ophthalmology OPD — Mandatory Project Rules

## 1. Required Reference Documents

Before modifying code, locate, read, and assess:

1. **Engineering checklist:** `HMS_Engineering_Best_Practices_Checklist.md`
2. **Functional specification:** `Ophthalmology OPD Consultation Functional Specification Document (FSD v1.0, 10 September 2026)`

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
- Prefer a small, complete, testable slice over a broad incomplete rewrite.
- Do not start dependent work until prerequisites are satisfied.
- Do not mark a phase complete when required behavior or tests remain unverified.
- Report actual commands and results; never invent test/build/verification outcomes.

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

**Timebox:** 10 minutes for the initial assessment. Record further investigation as pending.

## Phase 1 — Existing frontend defects and foundations

**Prerequisites:** Phase 0 assessment available; affected requirements confirmed; backend dependencies identified.

1. Review the checklist and FSD alignment assessment.
2. Fix the confirmed diagnosis-chip versus persisted-assessment mismatch, if present.
3. Fix visit/encounter switching so stale state from a previous patient or encounter cannot appear in the current context.
4. Ensure loading, empty, validation, success, and failure states are handled consistently.
5. Follow existing design-system and global table/button standards rather than adding isolated styling.
6. Add/update frontend tests for affected behavior.
7. Do not mask missing backend behavior with local mock data or fake success responses.

**Completion gate:** UI reflects persisted data correctly, encounter switching is safe, relevant tests pass, and backend gaps are reported separately.

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
