# Ophthalmology backend/frontend completion execution

18 October 2026. User explicitly requested full backend and frontend implementation after the source audit. This expands the previous frontend-only boundary to the existing Ophthalmology and additive shared backend/staff frontend integration. Preserve current 46a6e7f checkout plus two existing B6 test corrections and verification artifact. Do not start the unrelated Scope2 IP/Emergency release. Reuse PROJECT_RULES, engineering checklist, FSD v1.0, approved DEC-01–12, alignment matrix, actual models/repositories/services/routes/permissions and existing OPD UI; HMS Local is absent.

## Dependency order and gap notes

1. **Contract and workflow safety:** move optional consultation expected state/version fields from path schema to strict body, add frontend version payloads; require presence of configured mandatory tests; reject generic OPD completion when a specialty context exists, including inside its transaction; expose the approved COMPLETED → SUBMITTED_FOR_REVIEW transition with version/status/member/permission checks, audit and frontend action. Reuse existing permissions, transactions and queue action infrastructure. Add regression and route tests.
2. **Clinical completion and amendment:** reconcile source-record corrections, exact version readiness, summary allowlist and publication supersession before enabling completion/reopen/amendment UI. No journal-only correction claim. Preserve immutable versions and use actual source contracts.
3. **Clinical and operational integration:** eligible configuration/diagnosis/care/queue projections and missing detailed form contracts, plus staff publication list/eligibility, reports/export and safe patient-facing projections. Reuse domains; no duplicate billing/procedure subsystem. Any clinical options, units, thresholds or unavailable authoritative integration requiring owner policy remain explicitly blocked.
4. **Frontend and acceptance:** connect completed contracts through API/service/domain/feature/page layers; retain dirty/stale/error handling and scope gates. Verify full required API/web checks, focused integration tests and browser workflows where authentication/fixtures exist. Do not declare release complete on component tests alone.

The request authorizes the remediation above, not clinical value seeding, new lifecycle rules, new architecture, grants, deployment or manufacturing absent hospital/vendor policy. Phase documents retain historical status; this record and verification will distinguish implemented fixes from remaining requirements. No code or clinical data is to be reverted or silently replaced.

## Amendment correction gap note

The existing amendment DTO already names a section and exact before/after values. Apply approved clinical-summary and patient-instruction text corrections to a new clinical-review source version inside the existing finalization transaction, checking the actual before value and field limits. Reject unknown sections rather than falsely journaling a correction. Reapproval must complete the corrected source version. Reopening withdraws active publications for this consultation with an explicit reason/actor/version change in the same transaction, and records the count in audit. Broader result/diagnosis/prescription correction requires its own schema-aware source mapping; do not invent nested clinical paths.

## Publication and files gap note

Reuse existing Publication View/Publish/Withdraw permissions and source/version checks. Add a paginated staff publication history read with metadata projection (never the raw patient payload or replay keys), restricted by authoritative branch/department and optional visit. Add latest-version publication eligibility, block publication during an open amendment and preserve original keys/version errors. Close attachment full-fingerprint replay and upload-time source revalidation gaps. Patient display must read only explicitly approved, allowlisted publication payloads; unsupported legacy payloads must not expose raw objects. Existing hospital media policy remains authoritative.

## Progress checkpoint

- Shared consultation/order strict body schemas now accept expected version/status; staff consultation payloads send original state/version.
- Generic OPD complete checks authoritative Ophthalmology department/context before and inside the transaction.
- Mandatory configured codes must have actual active tasks; absent mandatory configuration fails explicitly.
- Approved submit-for-review state action implemented with Complete permission, station membership, completed source guard, audit/history and queue UI.
- Structured diagnosis editor and feature hook added, requiring explicit terminology/classification/eye/certainty, exact version, permission, stale/dirty/late guards.
- Clinical-summary/patient-instruction amendments create corrected source versions, compare actual before value and reapprove corrected state. Reopen withdraws context publications transactionally. Unsupported correction sections are rejected rather than falsely journaled.
- Creator-only department-scoped discovery for unassigned tasks added. Upload replay compares the full fingerprint and revalidates source state/version after storage. Publication eligibility requires latest exact clinical version.
- Paginated metadata-only staff publication GET and amendment publication lock added; staff exact-version publication status/history/withdrawal controls and allowlisted patient projection/display now implemented.
- Intermediate safety/source regressions: 3 API files / 40 tests passed; focused staff regression 6 files / 26 tests passed. These are intermediate, not final checks. Initial web typecheck caught optional diagnoses handling, since corrected; final checks still required.
- User asked asynchronously for existing approved completion profile and test branch/account for live acceptance; answer pending. No clinical master values or permissions have been seeded.

Current: staff publication integration, safe portal display/file gates, clinical workspace/bound configuration integration and filtered streaming CSV export are implemented. Remaining: detailed clinical/master/comparison contracts, workflow prerequisite semantics, broader structured source corrections, eligible candidate projections, additional business report contracts and live acceptance. Preserve all original changes. Run final six checks and regression after source changes settle. Do not restore generated TypeScript metadata until checks finish; never revert source or pre-existing B6 corrections.

## Finalization UI reconciliation

After mandatory-task presence and source-version review fixes, the finalization UI may use the existing server-configured readiness contract and approved DEC-06/08 lifecycle; it must not invent extra clinical thresholds or mark missing configuration satisfied. Completion freezes all record versions, uses an idempotency key, requires dedicated Complete permission and explicit authenticated approval confirmation. Unmet requirements need a still-matching recorded server override, not a checkbox. Reopen/typed text amendment/reapproval remain separate actions, preserve originals and disclose publication withdrawal. Clinical profile content and end-to-end acceptance remain pending the user's existing approved setup.

## Clinical workspace access gap note

Dedicated Consultation/Optical View must be able to read its own branch/department encounter header/context without obtaining Intake or generic OPD Visits permission. Add a minimal header/context projection through the existing specialty service, retain header-only data and reject wrong department. Preserve reception's existing OPD/Intake path and do not fetch intake/history when its permission is absent. Add a bound clinical-configuration read for approved clinical View permissions; this confers no configuration authoring permission. Keep the underlying admin routes protected.

## Patient publication display gap note

The full-stack request also covers the audit's patient-frontend display gap. Add an allowlisted publication serializer reused on write and portal read, including legacy records, and a strictly parsed read-only patient overview section. Preserve existing patient/guardian scope and existing portal layout; render only APPROVED_FOR_PORTAL sources returned by the authenticated overview. Do not expose replay keys, clinician-only notes, raw versions, previous results or raw JSON. Keep explicit publication/withdrawal separate from upload/test/consultation status. Add privacy and backwards-compatibility tests; no patient-role grants or clinical defaults.

## Binary publication privacy gap note

Inspection found that the generic portal Patient Documents service lists/downloads every active patient document, so an internal Ophthalmology attachment could bypass publication controls. Keep unrelated document behavior unchanged; filter Ophthalmology-linked files by an active TEST_RESULT publication before pagination/count and before/after authenticated binary download. Sync attachment review/publication metadata transactionally on publish/withdraw/reopen. Serialize publish versus reopen on the existing context record using an internal revision fence; preserve the public clinical version. Add indexes and isolated publish/download/withdraw tests using temporary storage.

## Reporting export gap note

Reuse existing Reports View/Export permissions, existing query validation/projections and authenticated download transport. Stream all matching rows through an aggregation cursor with a bounded batch instead of reading/copying a frontend page. Keep branch/department scope authoritative, neutralize spreadsheet formulas, omit arbitrary source fields and audit export requests. The report stays a live read, not a frozen analytics snapshot. Current clinical volume still means encounters with tests; repeat/unable rates and downstream surgery/follow-up/revenue metrics must not be invented from incomplete denominators/integration rules.

## Final remediation checkpoint

See HMS_OPHTHALMOLOGY_FULL_IMPLEMENTATION_VERIFICATION.md. API 139 tests, settled-source staff specialty 156 tests, separate access 2 tests and affected patient API 6 tests passed. API/staff/patient typechecks/builds passed. Workspace baseline lint/shared test failures remain; no release-complete assertion is made. Clinical contracts and authorized live acceptance remain open. No further clinical phase or unrelated Scope2 phase has started.

## Continuation: task-scoped assignment lookups

User renewed full-stack implementation authorization. Reuse the existing active station compatibility and eligibleTestAssignee rule (active station member, active branch/department user and active role with Test Queue Start). Add paginated task-scoped station/member reads with Queue View, task visibility and department checks; return station acquisition metadata and member ID/name only. No Configuration/Users authoring grants. Frontend queries remain modal-only, scope-checked and preserve frozen action versions. Files: specialty types/schemas/repository/service/routes, queue API/domain/feature/dialog and focused tests. HMS Local remains absent. No clinical stage-order policy is inferred.

The same continuation adds task-authorized minimal encounter headers and active test-compatible form-profile / clinical catalogue reads. Existing result write validators remain authoritative. This removes generic OPD Visits and Configuration View dependencies for authorized technician result entry without exposing shared consultation notes or adding edit privileges. All new lists filter before pagination.
