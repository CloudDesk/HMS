# HMS Ophthalmology OPD — Developer A (Backend) Phase Prompts

## Role and ownership

You are **Developer A — Backend**.

**Owned files:** `apps/api/**` including backend models, repositories, services, routes, schemas, authorization, audit logic, and backend tests. You may update backend contract artifacts only in the agreed documentation location.

**Do not edit, format, rename, generate, or delete:** `apps/web/**`, `apps/patient-web/**`, mobile apps, shared packages, root configuration, or any files owned by Developer B. If a change crosses this boundary, document the exact file and proposed change and request the owning developer's handoff/approval. Do not make the cross-boundary change yourself.

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

## Phase 0 — Repository assessment and contract preparation

**Objective:** Establish backend readiness and verify the FSD is the correct specification before implementation.

1. Follow all mandatory project rules above.
2. Locate and read the engineering checklist and FSD; record exact paths and versions.
3. Inspect existing API architecture, patient and encounter models, consultation lifecycle, authentication, permissions, audit facilities, service catalogue, laboratory, imaging, pharmacy, billing, and relevant tests.
4. Compare the FSD with current backend behavior and intended Ophthalmology OPD workflow.
5. Identify missing models, endpoints, validation, lifecycle transitions, transaction boundaries, and authorization requirements.
6. Review known risks: clinical orders blocked until consultation completion; aggregate order statuses rather than per-test statuses; narrative-only diagnoses; multi-write finalization without a transaction; stale visit-status writes; service-catalogue fallbacks; and document-publication authorization.
7. Produce an FSD alignment assessment and backend dependency register.
8. Draft a versioned backend contract for the next phase in the agreed contract location.
9. Do not begin broad feature implementation until relevant requirements and dependencies are approved.

**Deliverables:** FSD alignment assessment, backend gap analysis, API contract draft, dependency register, baseline test results, and phase-readiness recommendation.

**Timebox:** 10 minutes for the initial pass. Record deeper investigation as pending work rather than claiming completion.

## Phase 1 — Existing backend defects and foundations

**Prerequisites:** Phase 0 assessment available; relevant FSD requirements verified; required behavior approved.

1. Check the checklist and FSD alignment assessment before coding.
2. Investigate and fix only confirmed, in-scope backend defects, prioritizing:
   - Incorrect service-catalogue fallback behavior.
   - Stale visit-status updates and concurrency risks.
   - Consultation-finalization consistency and transaction boundaries.
   - Authorization, organization/branch isolation, and audit gaps.
3. Preserve existing module contracts and backward compatibility unless a versioned change is approved.
4. Add targeted backend tests for successful behavior, invalid transitions, concurrent updates, permission failures, and persistence failures as relevant.
5. Update the backend contract only when behavior genuinely changes.
6. Do not implement unapproved ophthalmology clinical rules.

**Completion gate:** Relevant tests pass, changes remain within backend ownership, and remaining risks are documented. If a decision is missing, stop the affected fix and report the blocker.

## Phase 2 — Structured ophthalmic observations

**Prerequisites:** Approved FSD observation fields/data types; approved API contract; Phase 1 dependencies resolved or explicitly accepted.

1. Derive the observation model and validation rules from the approved FSD.
2. Support the approved eye-specific structure, including laterality and examination sections only where specified.
3. Define stable identifiers, required/optional fields, validation errors, and safe update behavior.
4. Enforce encounter ownership, patient context, permissions, organization/branch scope, and audit requirements.
5. Persist observations safely and prevent partial or cross-patient writes.
6. Add endpoints, schema validation, and backend tests.
7. Publish request/response examples and the updated contract for Developer B.

Do not invent normal ranges, clinical thresholds, mandatory fields, or device-derived values. If unclear, record the exact question and implement only independently approved elements.

**Completion gate:** Backend behavior is tested, the contract is versioned and handed off, and FSD alignment is updated.

## Phase 3 — Test assignment and station lifecycle

**Prerequisites:** Approved FSD workflow and definitions for test types, statuses, reassignment, cancellation, and completion; Phase 2 contract where required.

1. Define test/task resources and lifecycle based on approved requirements.
2. Support per-test status and assignment where required; do not assume one aggregate order status adequately represents multiple tests.
3. Define allowed transitions, duplicate-submission handling, reassignment/cancellation rules, and completion validation.
4. Enforce role permissions, encounter ownership, organization/branch isolation, and audit history.
5. Handle concurrent updates and invalid transitions safely.
6. Provide queue/query endpoints with server-side filtering and pagination where needed.
7. Add backend tests and publish the contract and transition table.

Do not invent station roles, required test sequences, or clinical completion rules.

**Completion gate:** Approved lifecycle behavior is implemented and tested; Developer B has the contract required for station queues.

## Phase 4 — Structured diagnosis, treatment and prescriptions

**Prerequisites:** Approved diagnosis terminology/coding source; prescription fields and authority rules; optical-prescription requirements; medication/catalogue contracts; dependency review.

1. Define structured diagnosis resources and encounter relationships.
2. Support laterality and coding only as specified.
3. Define diagnosis create/edit/remove and audit behavior.
4. Implement treatment-plan persistence and validation.
5. Implement medication and optical prescription schemas/endpoints only for confirmed FSD requirements.
6. Enforce prescribing permissions, required fields, validity rules, patient/encounter linkage, and audit.
7. Preserve pharmacy and billing integration contracts.
8. Add validation, authorization, and persistence tests.
9. Publish versioned contracts and example payloads.

Do not invent diagnosis codes, prescribing authority, dosage rules, validity periods, or optical fields. List unapproved items as blockers.

**Completion gate:** Implemented behavior maps to approved requirements and is tested; unresolved clinical decisions are explicit.

## Phase 5 — Clinical review, amendment and completion

**Prerequisites:** Approved FSD lifecycle and rules for drafts/finalization, amendments, reopening, sign-off, and overrides; prior contracts stable.

1. Implement approved review and completion transitions.
2. Prevent unauthorized modification of finalized clinical records.
3. Support amendments/reopening only through approved workflows with audit history.
4. Validate required observations, diagnoses, tests, and prescriptions according to approved rules.
5. Make multi-write completion atomic where required.
6. Prevent stale writes and concurrent completion conflicts.
7. Define errors and contract behavior for the frontend.
8. Test incomplete consultations, duplicate submissions, concurrent updates, unauthorized access, and persistence failures.

Do not invent mandatory tests or diagnoses or add unapproved override permissions.

**Completion gate:** Lifecycle rules are documented, implemented, tested, and reflected in the API contract.

## Phase 6 — Integrations, portal controls and release hardening

**Prerequisites:** Approved integration requirements/contracts; external dependencies identified; previous contracts stabilized.

1. Integrate with patient, encounter, service catalogue, laboratory, imaging, pharmacy, billing, follow-up, and audit services only where required.
2. Verify ownership, authorization, idempotency, error handling, and transaction boundaries for each integration.
3. Expose patient-portal documents/results only through an approved publication/visibility policy.
4. Do not expose draft/restricted clinical records merely because a document is active.
5. Verify hosted storage/configuration; do not introduce production dependence on localhost or mock adapters.
6. Add safe integration and regression tests.
7. Run relevant backend type checks, lint, tests, and builds where available.
8. Report environmental limitations honestly; do not claim live integration if only mocks/test adapters were used.

**Completion gate:** Backend release evidence is recorded, remaining integration blockers are explicit, and the contract matches the implementation.

---

## Developer A — Phase handoff template

- **Phase/status:** `COMPLETE` / `PARTIALLY COMPLETE` / `BLOCKED` / `NOT STARTED`
- **FSD identity/path and alignment status:**
- **Checklist items reviewed and outstanding violations:**
- **Files changed (backend-owned only):**
- **API/contract version and location:**
- **Tests/commands run and actual results:**
- **Security, data-integrity, and concurrency considerations:**
- **Known limitations and unresolved decisions:**
- **Dependencies and exact handoff needed from Developer B (if any):**
- **Next action and responsible person:**
