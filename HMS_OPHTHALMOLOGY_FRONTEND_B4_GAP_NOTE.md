# Ophthalmology frontend B4 execution gap note

16 October 2026. User explicitly approved B4. Frontend only; preserve prior B0–B3 changes and backend ownership. Read PROJECT_RULES, root agent rules, frontend B4/FSD mapping, backend v1.10.0 routes/schemas/services/repositories/models and existing OPD hooks. Scope 2 Phase 3's IP/surgery/Emergency plan belongs to a separate release stream. `scope/HMS Local` remains absent; reuse existing OPD cards/forms/modal patterns.

## Reusable code and intended slice

Reuse the existing specialty encounter/context, OPD consultation and care workflows, test/result hooks, configuration pagination, RHF/Zod, Sonner, scope/version checks and dirty-navigation guard. Add a specialty care API/service/domain/feature slice, clinical-review treatment editor, optical draft/approval editor and selected-result review controls inside the existing workspace. Extend the shared diagnosis response type additively to preserve actual metadata. No second medication/order/referral/procedure subsystem, backend changes or B5 finalization.

## Contract findings before implementation

- Clinical review GET/PUT draft uses Consultation View/Diagnose, exact expected_version and active doctor validation. Treatment rows must reference an existing diagnosis/laterality; backend validates same-encounter care references in a transaction. No separate review/approval endpoint exists for treatment drafts; final completion is B5.
- Optical GET requires dedicated Optical Prescription View; draft PUT requires Create or Edit; approve POST requires Approve and the original DRAFT version. Power, PD, height and dates have explicit numeric/conditional rules. Lens/material/coating options come from the exact bound active completion profile when configured, never invented hospital defaults. No configuration-by-ID GET exists; find the bound profile through paginated existing reads. No optical print/share endpoint exists.
- Shared diagnosis response contains laterality/status/severity/stage/differential/history/version absent in the frontend type. However, shared PUT body forbids additional properties and omits expected_version/expected_status although the service accepts them. New concurrency-safe diagnosis writes require the owner to reconcile that transport. Preserve existing metadata and expose saved structured diagnoses; do not silently submit unversioned new clinical edits.
- The documented doctor-review read model is implemented as raw Mongo records, includes all encounter domains without individual permission filtering and up to 50 previous patient results without eye/protocol eligibility. This conflicts with B4's approved scoped/read-projection prerequisite. Do not call it or reconstruct unrestricted histories. Consolidated review, historical IOP graph and eligible comparisons remain owner dependencies.
- Existing shared medication/order/referral/follow-up/procedure screens remain authoritative. Missing eye/taper/schedule/source mappings are handoffs; existing forms are linked through exact permission gates. Existing treatment reference IDs are preserved; new reference selection needs an approved eligible projection.
- Existing specialty workspace requires OPD Visits and Intake View to obtain the authoritative context. Dedicated clinical context projection is needed for doctors who lack Intake View. Result Review additionally needs authorized queue task/result reads; no global patient history reconstruction.
- B1–B3 gaps and live clinical acceptance prerequisites remain unresolved. They do not authorize mocks, fabricated choices, unsafe diagnosis writes or bypassing permissions.

## Verification

Test schemas, numeric/conditional fields, versions/statuses, exact permissions, patient/eye/task/context scope, retained drafts/conflicts, duplicate/late actions and independent optical approval. Run required API/web typecheck/lint/build and focused frontend regressions. Attempt live acceptance without seeding hospital/clinical values. Report missing contracts and pre-existing failures precisely; B5 has not started.
