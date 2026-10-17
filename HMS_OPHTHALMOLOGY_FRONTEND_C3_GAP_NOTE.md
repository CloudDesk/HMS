# Ophthalmology C3 Completion Safety Backend Gap Note

## Scope

C3 resolves CR-10 through CR-13 before any C4 completion UI is enabled. This phase changes backend contracts only and stops after verification.

## Source reconciliation

- `PROJECT_RULES.md`, the current Ophthalmology API contract, C1/C2 reconciliation records, and existing API implementation are authoritative for this slice.
- `doc/HMS_Release2_FSD.docx` is not present. The supplied Scope 2 Developer 1 prompt concerns IP, Surgery, and Emergency and does not define Ophthalmology completion corrections.
- No dedicated Ophthalmology HMS Local prototype exists; C3 has no UI changes.
- Existing version, transaction, scope, doctor, permission, audit, and idempotency patterns are reused.

## Confirmed gaps

### CR-10 — Mandatory test evidence

`every()` currently treats an empty mandatory-task set as satisfied. A configured mandatory code can therefore pass without a task, reviewed result, or approved deferral.

### CR-11 — Safe completion reads

Summary/history endpoints currently expose broad raw cross-domain records and internal finalization fields such as request fingerprints, configuration snapshots, raw summary snapshots, and arbitrary amendment values.

### CR-12 — Authoritative corrections

The current amendment endpoint only appends caller-supplied `before_value` and `after_value`; it does not change or verify an authoritative source record.

### CR-13 — Generic completion bypass

The shared OPD completion endpoint can complete an Ophthalmology visit without applying specialty readiness and finalization rules.

## Approved C3 contract

- Mandatory readiness is satisfied only when every configured mandatory test code has at least one matching active task and all matching tasks are reviewed or explicitly deferred. Missing codes are returned as stable `MANDATORY_TEST_CODE:<CODE>` resource identifiers.
- Summary and history responses are explicitly serialized allowlists. Internal fingerprints, idempotency keys, configuration payloads, raw cross-domain documents, and legacy before/after values are not returned.
- Replace the free-form amendment write with three source-specific transactional correction commands:
  - authoritative completed OPD consultation correction;
  - authoritative completed clinical-review correction;
  - authoritative approved optical-prescription correction.
- Each correction requires an open amendment episode, exact finalization and source versions, full source-specific validation, a reason, append-only source version/history, source ID plus from/to versions in the amendment episode, and audit evidence.
- Reapproval requires at least one authoritative correction in the open episode and exact current source versions. It creates a new immutable summary and superseding clinical version.
- Generic OPD consultation completion rejects any visit with an Ophthalmology context and directs callers to the specialty completion endpoint.

## Intended files

- Ophthalmology finalization model/types/repository/service/schemas/routes and Phase 9 tests.
- Shared OPD consultation service plus focused bypass-guard tests and service-registry wiring.
- Ophthalmology API contract, reconciliation status, Developer A/B prompts, and C3 verification note.

## Stop gate

Run focused concurrency, scope, validation, correction, reapproval, rollback, and generic-bypass tests; API typecheck, owned lint, and build. Stop before C4.
