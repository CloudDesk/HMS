# Ophthalmology frontend B3 verification

16 October 2026. Frontend only, backend contract v1.10.0 at commit 537c55a. Status: **PARTIALLY IMPLEMENTED; live clinical acceptance and contract gaps remain.** B1/B2 also remain partial as recorded in their handoff register. B4 has not started.

## Implemented functionality

- Added `/opd/ophthalmology/queue`, permission-gated sidebar/route and an encounter-to-queue entry. Branch, encounter, patient, station, assigned user, test, status, priority, search, sort and page filters use URL/query contracts and server pagination. Queue timestamps explicitly identify UTC because no branch timezone is published.
- Selected task detail retains authoritative patient/encounter/context scope, instructions, provenance, performer/device, review metadata, linked repeat and assignment/status/routing histories. Authorised shared encounter/patient queries enrich only selected detail; no per-row lookup fan-out.
- Added configured task creation against the activated context and exact bound workflow, with catalogue/test/eye/priority/stage/instructions and optional existing submitted clinical-order item. Selected catalogue values survive lookup pagination. No invented orders, workflow versions or clinical defaults.
- Added assign, reassign, call, unavailable, start, unable, cancel, repeat and handoff dialogs using actual published routes. Original expected version/status remain frozen while editing. Reasoned/destructive transitions require confirmation; background version changes disable confirmation and preserve entries. No arbitrary status editing or optimistic clinical transitions.
- Creation/repeat retries retain the same in-memory idempotency key for an unchanged request. Pending-action locks suppress double clicks. Responses after a scope change cannot close another dialog or trigger success navigation. Saved response scope is checked before follow-up UI actions.
- Reused the B2 result editor directly in the queue. Queue View plus matching OPD encounter View permits entry without unnecessary Intake View; Edit/Complete/Amend/attachment permissions remain independent. Existing draft/profile/source-reading/correction behavior remains intact. A real task context ID is used; no fabricated context version or visit status.
- Queue and selected task/result/context caches refresh after relevant actions and result mutations. Failed queries/actions expose retry paths and retain entered values. Clinical data is not persisted in browser storage or logged.

## Reused functionality and changed modules

Reused OPD visit/clinical-order and patient queries, branch/user lookups, existing specialty API/service/domain hooks, configuration schemas, RHF/Zod, TanStack Query, Sonner, navigation guard and shared Modal. Existing OPD `doc-*` card/table/form patterns and specialty responsive CSS are retained. `scope/HMS Local` is absent and no prototype was modified.

New modules: `apps/web/src/api/ophthalmology-queue.ts`, `hooks/ophthalmology/queue-actions.ts`, `useOphthalmologyQueue.ts`, `useOphthalmologyQueueFeature.ts`, `pages/OphthalmologyQueuePage.tsx`, and two queue dialogs with API/feature/dialog tests. Existing specialty result components now accept a narrow result-workspace interface; shared result hooks invalidate affected queue caches. The specialty encounter page/hook provides the queue entry and the draft guard supports leaving after successful saves.

Shared registration changes: `auth/access-control.ts`, `data/ui-foundation.ts`, `routing/AppRouter.tsx`, and `services/ophthalmology.service.ts`. Frontend prompt and B1/B2 handoff register updated. All earlier uncommitted frontend changes retained. Backend, patient-web, root dependency manifests/lockfile and Developer A documents were not edited.

## Backend validation and remaining dependencies

No backend changes or new transactions were introduced. The frontend sends exact backend state/version, IDs, reason and idempotency headers. Backend remains authoritative for RBAC, branch/department/task visibility, station/user/device eligibility, clinical source validity, transitions, transactional writes and audit. UI checks do not certify backend invariants.

- No submit-for-review endpoint exists. The enum alone cannot implement submission or review approval.
- Current visibility can hide newly created ORDERED unassigned tasks from creator/assigner. An approved backend discovery/assignment contract is required; frontend access checks were not bypassed.
- Queue list lacks required patient/MRN/age/gender/visit/subtype/consultant/station/user display projection. Quality/result-summary projection and eligible-user/clinical station/profile projections remain incomplete. Current modal lookups require explicit Configuration View / Users View permissions.
- The exact bound workflow can be displayed, but a computed prerequisite/bypass projection and sequential-stage start validation were not found. Full FSD sequencing is unverified. No passed-stage or bypass outcome is invented.
- The backend device check does not explicitly reject EXPIRED calibration. The UI offers active NOT_REQUIRED or current not-overdue devices, but the API owner must enforce the full invariant.
- B1 appointment and opaque master schemas, B2 nested clinical/comparison/history schemas, hospital-approved values and all 178-row clinical acceptance remain tracked in `HMS_OPHTHALMOLOGY_FRONTEND_B1_B2_REMAINING_GAPS.md`.

## Verification

Focused API/feature/dialog checks cover filter scope and pagination, invalid transition/reason rejection before writes, real clinical-source requirements, absent submission action, routing prerequisites, original expected versions, stable create/repeat keys, denied cached data, branch mismatch, independent grants, duplicate clicks, late responses, retained form values, background conflicts and declined confirmation.

- API typecheck/build: passed. Web typecheck: passed after correcting test-only optional-call indexing. Production web build: passed. Final patient-facing copy was also bundled successfully.
- Final focused regression: **14 files, 76 tests passed**. New queue API/feature/dialog cases also pass within the full suite; a final targeted rerun passed all **17 queue tests across 3 files** after scope/retry refinements.
- Full web suite: **67 files; 314 passed / 4 failed of 318 tests**. The four unchanged baseline failures are `auth/access-control.test.ts:71` (existing Medicine Master `ph-pill` icon missing from expected object), `auth/auth-refresh.test.tsx` (missing QueryClientProvider for AuthProvider at `AuthContext.tsx:35`), and both `pages/SurgeryWorkspacePage.test.tsx` cases (missing AuthProvider in existing recommendation modal at line 71).
- Targeted lint across specialty API/hooks/components/pages/service and changed route/access/sidebar registries: passed, zero errors.
- Global API lint retains **50 pre-existing errors**: insurance repository (1), service (18), tests (23), and patient service (8). Global web lint retains **6 pre-existing errors**: `DoctorSignatureCard.tsx:133`, `PatientAvatar.test.tsx:8`, `PatientCardModal.tsx:3`, `PatientProfileHeader.tsx:3`, `AuthenticatedMediaImage.tsx:32`, `PatientProfilePage.tsx:27`. These unrelated modules were not modified.
- Whitespace diff check passed. Backend, patient-web and dependency manifest/lockfile diffs are empty. Generated TypeScript build metadata is restored after verification.

Live attempt: the authenticated localhost queue remained at “Verifying access & session.” An eight-second local API health request timed out (HTTP 000). No live persistence, clinical action, logout/login, scope-role, attachment or responsive clinical acceptance is claimed. No hospital configuration, patients, tasks or permissions were seeded or changed. Temporary browser tab closed. Live backend persistence plus authorised Ophthalmology fixtures/profiles/staff are required for acceptance.

The next phase has not started.

Subsequent approval: the user approved B4 after this B3 verification. B4 implementation and remaining dependencies are recorded in `HMS_OPHTHALMOLOGY_FRONTEND_B4_VERIFICATION.md`; the statements above describe the B3 handoff at that time.
