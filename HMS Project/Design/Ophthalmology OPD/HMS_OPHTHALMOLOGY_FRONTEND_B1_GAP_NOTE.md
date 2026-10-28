# Ophthalmology frontend B1 foundation gap note

**Latest continuation:** The 13-area shell/header, compatible subtype selection/context editing, code and repeated acquisition rows, multiple media references, optional SPA/native-cancelable navigation guard and full metadata reload are now implemented. The current remaining-work register lists the exact backend/schema and clinical acceptance gates. Final focused verification passed 98 tests; neither phase is declared fully complete.

**Current continuation status (16 October 2026):** Administration, attachment uploads, versioned corrections, product/drug reference lookups and profile-defined detailed measurement/choice controls are implemented. The text below records the earlier baseline. Current verification and remaining work are in the B1/B2 verification records and `HMS_OPHTHALMOLOGY_FRONTEND_B1_B2_REMAINING_GAPS.md`. Neither phase is release complete. B3 has not started.

## Full B1/B2 continuation authorised

The user explicitly requested completion of both B1 and B2 after backend v1.10.0 delivery. Continue B1 configuration/station/workflow administration and B2 detailed controls, attachment references/amendments and missing lookup handling. Inspect current API validation and preserve all earlier changes. Add only frontend API clients, domain/feature hooks, structured RHF/Zod editors, route/navigation entries and tests. No generic JSON authoring, invented clinical configuration, duplicate shared domain or backend edits. Known opaque configuration/nested payload fields require an explicit mapping before new clinical values can be authored. B3 remains outside scope. Prior statements below about B2 not starting describe the earlier B1a baseline.

**Date:** 16 October 2026. **Status:** B1a IMPLEMENTED, FOCUSED AUTOMATED VERIFICATION PASSED; LIVE ACCEPTANCE PARTIAL. **Authorized slice:** B1a frontend foundation fixes, approved after B0 handoff. Full B1 remains PARTIALLY COMPLETE. See `HMS_OPHTHALMOLOGY_FRONTEND_B1_VERIFICATION.md`. B1b specialty/configuration screens remain dependent on the B0 register; B2 has not started.

## Reuse and implementation scope

Reuse existing OPD feature/domain hooks, API response contracts, query keys, forms, operational layout and Sonner. Fix diagnosis-chip persistence, context remount/reset and late mutation chains, validated URL tab selection, permission/tab lookup gating, unknown stock display and truthful partial-save errors. Add focused hook, diagnosis and rendered workspace tests. No new clinical fields, thresholds, permissions or backend transitions.

Intended files: `apps/web/src/pages/OpdVisitPage.tsx`, `hooks/opd/useOpdVisitFeature.ts`, `hooks/opd/useOpdWorkspace.ts`, a diagnosis helper/hook under `hooks/opd`, relevant tests and `components/opd/OpdPrescriptionSection.tsx` (nullable stock display). Existing patient/visit identifiers remain authoritative and backend actions retain existing contracts. Shared OPD files are modified minimally; no backend/patient-web/root configuration/lockfile changes.

## Source findings and dependencies

- Source confirms chip removal does not remove the exact generated assessment line; reload uses substring matching and ignores empty matches. Preserve narrative text and use existing structured diagnoses when available. Avoid introducing a new diagnosis model or primary-selection workflow in this foundation slice.
- Remount clinical local state by the selected visit and reject mismatched loaded visit/record identity. Do not copy late data into a new patient's forms. Stop subsequent orchestration steps after context change; operations already sent cannot be rolled back by the frontend.
- The parent feature currently drops `activeTab` when calling the workspace. Gate lookups by tab/permission/context; preserve clinical records needed for the summary/completion without resetting unsaved local state on tab changes.
- Missing inventory currently falls back to 120. Represent unknown stock explicitly, including the selector text; do not claim zero or availability when no authorized stock result exists.
- Draft/complete orchestration suppresses some errors. Surface the failed stage and warn when earlier steps already saved; do not automatically replay a multi-step completion after partial success.
- New finding: A1 contract describes consultation/order `expected_version`/`expected_status` in request bodies, but current `opd-consultation.schemas.ts` and `opd-clinical-order.schemas.ts` place them in parameter schemas and body schemas reject unknown fields. Developer A must reconcile before new frontend clients send those fields. B1a does not change backend schemas or invent query/parameter transport.
- Missing HMS Local prototypes, clinician-safe configuration/eligible-user lookup and later exact nested payloads remain B0 dependencies. Existing OPD layout supports reversible foundation fixes; specialty visual acceptance remains pending.

## Implemented decisions

- Diagnosis handling is now a frontend hook. Recover only exact legacy picker lines and existing structured diagnoses; do not infer a diagnosis from a narrative substring. Remove only the exact generated line, preserve independent narrative, and filter removed entries from existing structured metadata on save. Existing primary/secondary/coding metadata is retained. Adding a legacy picker item continues to create an assessment line; the later approved B4 structured diagnosis workflow is not implemented here.
- The clinical workspace remounts by selected visit. Matching visit/patient IDs and current view permission are required before exposing cached records. Missing records reset forms; mismatched patient/visit records become a blocking load error. Old async chains stop before the next operation after a context change. Late notifications, navigation and document presentation are suppressed after the prior workspace unmounts.
- URL tab state is read on every navigation with exact known names/numbers and no mount-time navigation. Existing Notes/Documents section implementations are reachable as tabs 8/9. Clinical records needed for summary/save remain permission-gated across tabs; medicine/inventory/doctor/document/branch/department lookups use active workflow and exact endpoint permissions. Existing catalogue access does not grant new clinical/admin rights.
- Draft/completion errors identify the failed stage and explain earlier persisted steps. A per-context pending guard prevents duplicate orchestration. Once consultation completion commits, the whole completion chain cannot be replayed in that context. Removed the redundant visit completion mutation because the backend consultation completion already updates it atomically. Individual downstream recovery remains with existing owning workflows; no frontend transaction is claimed.
- Unknown stock is null and labelled Stock unavailable, distinct from zero. Removed fabricated 70 kg/170 cm defaults. Replaced unimplemented Auto-save enabled claims with explicit save instructions and made tab saved indicators depend on persisted data. Notifications use top-right Sonner.
- Explicit patient selection and page-owned navigation ask before discarding unsaved changes, and browser reload/close receives the standard unsaved-change warning. This does not introduce a global router blocker; sidebar/external SPA history interception remains outside this slice. No clinical drafts are stored in browser storage.

## Live environment observation

The local staff frontend at `http://localhost:5173` was accessible in an authenticated session. Read-only UI navigation and unsaved diagnosis add/remove were verified against existing QA encounters, without saving clinical data. During encounter-switch acceptance, API requests began failing with Failed to fetch; the new encounter showed an error/empty state rather than previous-patient fields. Live persistence, negative-role, cross-branch and responsive acceptance are not certified from this session. Do not substitute mocks for that missing live acceptance.

## Verification plan

Run focused meaningful regressions for exact diagnosis removal/free-text preservation, empty encounter switch and late response, URL tab synchronization, request gating, unavailable stock and partial failure/context change. Run required API/web typecheck/lint/build; record baseline lint separately. Attempt available browser acceptance without real-patient fixture writes; report any environment limitations. No completed slice or entire B1 phase is claimed until evidence and pending acceptance are recorded.
