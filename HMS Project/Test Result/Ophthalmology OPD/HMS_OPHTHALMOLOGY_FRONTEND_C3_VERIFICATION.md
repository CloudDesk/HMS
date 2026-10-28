# Ophthalmology C3 Completion Safety Backend Verification

**Date:** 17 October 2026  
**Contract:** `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md` v1.12.0  
**Status:** COMPLETE  
**Boundary:** Backend completion-safety handoff only; C4 frontend not started

## Implemented functionality

- Corrected mandatory-test readiness so every configured code requires matching reviewed task evidence or a valid recorded deferral. Missing configured codes are returned as `MANDATORY_TEST_CODE:<CODE>` resources.
- Added explicit permission-safe summary and completion-history serialization. Internal idempotency/fingerprint data, frozen configuration/summary snapshots, raw result payloads, document/private-storage data and legacy arbitrary values are not returned.
- Replaced the arbitrary consultation amendment write with exact-version transactional correction commands for the authoritative OPD consultation, clinical review and optical prescription.
- Required a real authoritative correction before reapproval. Corrected optical prescriptions return to `DRAFT` and must be approved before consultation reapproval.
- Added a shared OPD backend guard that rejects generic completion whenever an Ophthalmology context owns the visit.

## Reused functionality

- Existing Ophthalmology context, doctor, branch/department scope, permission inventory, finalization lifecycle, completion profile, clinical review, optical approval and audit infrastructure.
- Existing OPD visit and consultation repositories, optimistic versions, appointment completion, patient timeline and MongoDB required-transaction helper.
- Existing Fastify validation/error envelope and service registry composition.

## Validation, transactions, permissions and audit

- All correction bodies reject unknown fields and require finalization version/status, open episode ID, source version, reason and a typed source payload.
- Source status/version and finalization status/version are revalidated inside the same required transaction.
- Transaction operations are sequential; correction rollback leaves both the authoritative source and finalization journal unchanged when audit persistence fails.
- Routes require `Ophthalmology Consultation / Amend`; complete, reopen and view permissions remain unchanged. Service checks still require the scoped Ophthalmology visit and assigned active doctor.
- Correction audits store source type/id, from/to source versions, actor, reason and scoped resource IDs without clinical before/after payloads.
- Stale correction and completion commands return conflict errors; generic bypass returns `OPHTHALMOLOGY_SPECIALTY_COMPLETION_REQUIRED`.

## Verification evidence

- `npm run typecheck --workspace=@hms/api` — passed.
- Focused API regression: Phase 5, Phase 8, Phase 9 and OPD Phase 1 hardening — 4 files, 53 tests passed.
- Phase 9 completion-safety coverage — 11 tests passed, including mandatory-code existence, safe projections, generic bypass, concurrent completion, audit rollback, exact correction versions and optical reapproval.
- `npm run build --workspace=@hms/api` — passed.
- C3-owned API ESLint target set — passed.
- Repository-wide API lint — blocked by 50 pre-existing errors confined to Insurance and Patient files; no C3-owned lint error remains.
- Repository-wide web typecheck/build — blocked by the existing `ophthalmology-reports.test.ts:25` tuple issue and `ophthalmology-reports-access.test.ts:6` sidebar typing issue.
- Repository-wide web lint — blocked by 10 pre-existing errors outside C3-owned files.
- No browser/manual UI test was run because C3 is backend-only. No HMS Local prototype was modified.

## Remaining boundary

- C4 must implement the frontend through the existing page/feature hook/domain hook/service/API chain and consume only contract v1.12.0 projections and commands.
- Live multi-role/multi-branch acceptance and the owner-deferred real GCS smoke test remain release-level work.
- C4 has not started.
