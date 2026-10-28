# Ophthalmology frontend B4 verification

16 October 2026. Backend contract v1.10.0. **B4 is PARTIALLY IMPLEMENTED; clinical acceptance and contract-dependent scope remain open. B5 has not started.** Preserve the B1–B3 remaining-gap records.

## Implemented functionality

- The existing Ophthalmology encounter now opens a clinical-care section through its Treatment Plan navigation or clinical/optical controls. Care tab, configuration page, task page and selected result remain in URL parameters. No new visual system or duplicate prescribing/order domain was introduced.
- Clinical-review drafts provide summary, existing diagnosis/eye selection, structured treatment/category/priority/status, follow-up decision and patient instructions. Existing medication/order/procedure/referral/follow-up references survive edits. Response-only row IDs and clinician IDs are excluded from writes. The backend attributes the clinician and validates every reference and diagnosis.
- Saved structured diagnoses show code, terminology, primary/secondary, eye, certainty, severity, stage, differential flag, notes and available consultation history. The shared response type was extended additively to preserve these actual backend fields. New structured diagnosis authoring remains blocked by the version transport mismatch below.
- Optical prescribing is separate from refraction: explicit prescribed eyes, SPH/CYL/AXIS/add/prism/base, binocular/monocular PD, segment height, prescription type, lens/material/coatings, instructions, validity and review dates. No eye, prescription type, priority, PD, power or validity is invented. Bound active configuration supplies configured selections; no substitution with the latest unrelated profile. Configuration pagination preserves the draft.
- Optical draft save, exact saved-version approval, approval actor/time and historical version summaries are separate. Dirty, stale or unsaved contents cannot be approved. Approved and closed records are read-only in normal editing. No print/share/publication or cryptographic-signature claim was added.
- Authorized current task/result review shows eye, exact clinical version, acquisition time, performer, reliability/reason, technician impression, structured saved readings and document references. It records a separate authenticated review using exact task/result/clinical versions and the Review permission. Wrong-eye, patient, context, task and response mismatches are rejected. Source-result/attachment access reuses B3; repeat/exception actions remain there.
- Existing encounter medication, laboratory/imaging, referral and follow-up screens remain linked through their own View permissions. There is no second order, prescription, OT or referral subsystem.
- Original editing versions remain frozen across background refreshes. Errors preserve values; background query failure retains the editor with saving disabled. Explicit reload confirms discarding dirty values. Pending-action locks suppress duplicate requests and late responses cannot apply to another encounter/tab/task. Clinical data is not written to browser storage or logged.

## Existing functionality and UI patterns reused

Reused specialty context/encounter and paginated configuration/task/result hooks, shared OPD consultation read hook, RHF/Zod, TanStack Query, Sonner, navigation guards and OPD `doc-*` cards/forms/buttons. Existing responsive form-grid and scroll patterns remain. `scope/HMS Local` is absent; no prototype was changed.

## Changed modules and shared files

New: `api/ophthalmology-care.ts`; `hooks/ophthalmology/useOphthalmologyCare.ts` and `useOphthalmologyCareFeature.ts`; clinical-review, optical and care-workspace components; API/feature/editor tests.

Existing specialty changes: workspace page/hook, consultation-area mapping and its navigation regression test. Shared changes are limited to the additive OPD response metadata in `apps/web/src/api/opd.ts` and specialty service registration in `apps/web/src/services/ophthalmology.service.ts`. Frontend prompt, B4 gap note and this verification document were updated. Earlier uncommitted B0–B3 changes remain intact. Backend, patient-web, dependency manifests/lockfile and Developer A documents were not modified.

## Backend validation, permissions, scope, audit and errors

No backend logic, transactions, permissions, indexes or audit infrastructure were changed. Existing clinical-review/optical services validate active doctor identity, authoritative visit/context, exact versions, diagnosis/eye references, configured selections, conditional optical fields and same-encounter care references. Existing transactions and audit events remain authoritative. Frontend sends only contracted fields and exact versions and displays errors without optimistic state transitions.

Consultation View/Diagnose, Optical View/Create-or-Edit/Approve and Test Queue View/Test Review Review remain independent. Config lookups and task/result reads are active-tab/context/permission gated. Shared care links retain owning-domain View gates. The broad consolidated doctor-review endpoint is not called.

## Automated and live verification

- API typecheck and build passed. Final frontend typecheck and production build passed after the latest navigation/editor tests.
- Initial focused Ophthalmology regression: **16 files / 79 tests passed**. Final B4/editor/navigation regression: **5 files / 31 tests passed**, including treatment diagnosis/eye changes with retained care references and no response-only IDs, original version retention, optical dirty/stale approval guards and wrong-eye review rejection.
- Full web attempt: **68 files; 330 tests passed, 4 unchanged failures (334 executed)**. Two other files could not start due Vitest fork-worker startup timeouts (`PatientPrintHelper.test.tsx`, `hooks/surgery/useSurgery.test.tsx`); rerunning those with one worker passed **2 files / 2 tests**. The full attempt predates the last clinical-editor/navigation tests, which are included in the successful focused run above. This is not represented as one completely successful full-suite run.
- Four existing full-suite failures: `auth/access-control.test.ts:71` expects Medicine Master without its existing `ph-pill` icon; `auth/auth-refresh.test.tsx` lacks QueryClientProvider at `AuthContext.tsx:35`; both `pages/SurgeryWorkspacePage.test.tsx` cases lack AuthProvider for `NewProcedureRecommendationModal.tsx:71`.
- Owned lint across specialty API/hooks/components, shared OPD API types, workspace page and service passed. Global lint retains the same **50 API errors** (insurance repository 1, service 18, tests 23; patient service 8) and **6 web errors** (`DoctorSignatureCard.tsx:133`, `PatientAvatar.test.tsx:8`, `PatientCardModal.tsx:3`, `PatientProfileHeader.tsx:3`, `AuthenticatedMediaImage.tsx:32`, `PatientProfilePage.tsx:27`). Those unrelated modules were not edited.
- Backend/patient-web/dependency diffs are empty. Generated TypeScript metadata was restored after checks; whitespace diff verification passed. Focused tests cover contract bodies/routes, conditional power/PD/height/dates, original versions, response-only field rejection, independent permissions, denied cached data, patient/eye/task mismatches, duplicate/late actions, retained drafts, saved care references and explicit optical approval.

Live attempt: `/api/health` returned HTTP 200. The specialty workspace redirected to login because the previous authenticated session expired. No clinical data, profiles, tasks or permissions were created or changed. Temporary tab closed. Live save/reload, logout/login persistence, clinical responsive flows, approval/review permissions and cross-user handoff remain unverified pending an authenticated session and approved Ophthalmology fixtures. Browser login alone and component tests do not certify clinical acceptance.

## Remaining B4 dependencies

1. **Structured diagnosis writes:** shared PUT JSON body omits `expected_version`/`expected_status` and rejects extra properties, while the service accepts those version fields. The owning API must reconcile transport before new concurrency-safe structured diagnosis editing. No unversioned workaround was added.
2. **Consolidated/current/history projections:** actual doctor-review implementation returns raw Mongo records across encounter domains and previous branch/patient results without promised individual permission/comparison filtering. Publish/confirm the authorized projection, serialization and eligible eye/test/protocol/unit/history semantics before consolidated review or historical IOP graphs. No unrestricted history was reconstructed.
3. **Clinical context/configuration lookup:** existing specialty context requires Intake View; clinical configuration requires Configuration View and list pagination. Publish dedicated clinical-context/eligible lookup projections for doctors without those grants. No permission was granted implicitly.
4. **Shared specialty fields/investigation loop:** medication schema has no eye/start-date/taper/refill fields; order items lack the full eye/reason/schedule mapping. Full procedure diagnosis/eye/perioperative, referral/follow-up specialty fields, source-context integration and additional-test encounter transitions need approved owner contracts.
5. **New treatment-reference selection:** existing references are preserved, but new selection requires eligible same-encounter prescription/order/procedure/referral/follow-up projections. No bare-ID authoring was introduced.
6. **Optical delivery:** no approved optical print/share endpoint/policy exists. Optical approval does not publish a document or complete the consultation.
7. **Acceptance:** current live session/fixtures and all B1–B3 unresolved contracts remain prerequisites. Global pre-existing lint/test failures prevent a clean repository-wide completion claim.

The next phase has not started.
