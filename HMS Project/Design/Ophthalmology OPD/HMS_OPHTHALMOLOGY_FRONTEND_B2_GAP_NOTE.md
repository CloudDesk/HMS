# Ophthalmology frontend B2 gap note

**Latest continuation:** The 13-area shell/header, compatible subtype selection/context editing, code and repeated acquisition rows, multiple media references, optional SPA/native-cancelable navigation guard and full metadata reload are now implemented. The current remaining-work register lists the exact backend/schema and clinical acceptance gates. Final focused verification passed 98 tests; neither phase is declared fully complete.

**Current continuation status (16 October 2026):** Administration, attachment uploads, versioned corrections, product/drug reference lookups and profile-defined detailed measurement/choice controls are implemented. The text below records the earlier baseline. Current verification and remaining work are in the B1/B2 verification records and `HMS_OPHTHALMOLOGY_FRONTEND_B1_B2_REMAINING_GAPS.md`. Neither phase is release complete. B3 has not started.

**Date:** 16 October 2026. **Status:** IN PROGRESS. The user explicitly approved starting B2 while B1 remains partial. This approval permits the available B2 observation/intake work; it does not approve new backend contracts or clinical values.

## Reuse and approved implementation

Read PROJECT_RULES, the Developer B prompt, B0/B1 findings, backend contract v1.10.0, current routes/types/schemas/service/core validation and A3/A5/A6/A7 tests. Backend commit `537c55a` (Phases 6–11) is present in the current checkout. The user explicitly resumed implementation after this push. Reuse the existing OPD encounter, API client/auth/error envelope, feature/domain/service layers, TanStack Query, RHF/Zod, OPD CSS, tables and Sonner. Preserve all existing uncommitted B0/B1 changes.

Implement a staff Ophthalmology workspace entered from the OPD encounter; read server-validated context, display configured intake/history/emergency controls and edit existing authorized core test tasks. Minimum context activation from existing approved completion/workflow profiles is an entry prerequisite; it is not a configuration administration subsystem. Queries require exact permissions and context. Configuration lookup needs Configuration View; do not grant it implicitly. Backend validates encounter department and all scope.

B2 does not create, assign, call or start tasks; use existing authorized tasks. Showing a paginated encounter task selector for observation entry is not B3 queue implementation. A6/A7 are now implemented on the backend. Initial scalar controls cover all 21 families; several detailed substructures, code-list masters and acquisition/attachment controls remain frontend work or require exact nested mappings. The phase remains partial. Later review/approval/consultation completion is outside this implementation.

## Current contracts and specific gaps

- Intake field and alert routes are implemented. Configured complaint options are `values.options`; emergency criteria are `values.criteria`, each active entry a code string or `{ code, label, active?, requires_description? }`. Inspect actual service semantics and validate before consuming. Separate prior-disease/family-history option sources are unspecified; preserve existing codes and block new selections without inventing masters.
- A5 implements eight form families. Exact scalar reading/selected-index/BCVA shapes can be reconciled from service validation and A5 test examples. Test fixture clinical values are never copied into production defaults.
- A6/A7 deliver the eleven advanced and two specialised forms. Their source types still use broad `Record<string, unknown>` for several clinical substructures; do not derive production keys or clinical choices merely from a display label or fixture value.
- Broad nested PD/segment-height/cycloplegic drug/JCC/binocular/posterior substructures and directional-ray keys remain incomplete contracts. Only explicitly contracted fields are editable; preserve unsupported existing payload data, show missing-field/configuration limitations and record incomplete FSD coverage.
- Versioned FORM_PROFILE supplies the schema version, supported test codes, required paths, allowed values, numeric ranges and IOP thresholds. Missing clinical options never get a hidden default. Existing results retain their profile snapshot. Imports remain unavailable; use existing same-patient document references only, with no new storage/upload policy.
- B1b administration, clinician-safe lookup projections, missing HMS Local reference and A1 shared OPD version-body mismatch remain open. B2 uses specialty routes whose version bodies are actually implemented.
- Shared API-client prerequisite found during live testing: `{ data: null }` was returned as the envelope object because nullish fallback treated an absent clinical resource as an unwrapped response. Fix `apps/web/src/api/client.ts` to test envelope membership, and verify null/false/zero/empty-string/raw responses. This caused false encounter mismatch flags and would block new context/result activation. No auth/refresh behaviour changes are required.

## Intended files and verification

New `apps/web/src/api/ophthalmology.ts`, `services/ophthalmology.service.ts`, `hooks/ophthalmology/**`, `components/ophthalmology/**`, `pages/OphthalmologyWorkspacePage.tsx` and focused tests. Minimal shared frontend edits: OPD entry button, AppRouter/access-control route registration and existing OPD-style responsive form CSS only if needed. No backend/patient-web/root dependencies or clinical configuration changes.

Verify request/response schemas, field mapping, blank versus zero/false, independent OD/OS, draft versus completion validation, profile/eye/task identity, exact version bodies, unknown-payload preservation, denied query gating, draft reload, error/conflict/retry, context/task switching and stale async completion. Run required six API/web checks and focused tests. Browser/live persistence acceptance requires an available authenticated QA environment; never replace it with production mocks or claim an incomplete form/phase complete.
