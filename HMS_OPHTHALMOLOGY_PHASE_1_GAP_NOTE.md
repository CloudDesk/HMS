# HMS Ophthalmology OPD - Phase 1 Gap Note

**Date:** 15 October 2026  
**Phase:** 1 - Shared OPD contract hardening  
**Status:** COMPLETE

## Approved scope

Phase 1 is limited to hardening the existing shared OPD consultation and clinical-order contracts needed by Ophthalmology. No Ophthalmology specialty module, workflow overlay, configuration, test queue, result form, or frontend work is started in this phase.

## Existing functionality reused

- Existing OPD visit, consultation, laboratory/imaging order, appointment, patient timeline, audit, permission, branch-scope, and service-catalogue implementations.
- Existing `Page -> Hook -> Service -> API` clients remain compatible; this phase changes backend contracts additively.
- Existing MongoDB session and transaction patterns.
- Existing OPD Clinical Orders and OPD Consultation permissions and routes.

## Confirmed gaps

1. Clinical order validation first checks the correct `LAB_TEST` or `IMAGING_SERVICE` catalogue type, but falls back to any active billable service. This permits a service of the wrong clinical type.
2. OPD order submission requires the consultation to be `COMPLETED`, conflicting with the approved workflow in which investigations may be ordered during an open consultation.
3. Consultation and clinical-order records do not expose a version, and draft/final mutations cannot reject stale clients.
4. Consultation completion writes consultation, visit, appointment, patient timeline, and audit records independently. A mid-operation failure can leave partial completion.
5. Visit status updates are not conditional on the previously read status and do not accept a transaction session.
6. Clinical-order submission plus patient timeline/audit is not atomic.

## Frozen Phase 1 contract

- Visit, consultation, and clinical-order responses add `version: number`.
- Visit-status, consultation draft/completion, and clinical-order draft/submission bodies add optional `expected_version` and `expected_status` fields for existing-client compatibility.
- When supplied, expected values are authoritative and stale values return HTTP `409` with `OPD_CONSULTATION_VERSION_CONFLICT`, `OPD_CONSULTATION_STATUS_CONFLICT`, `CLINICAL_ORDER_VERSION_CONFLICT`, or `CLINICAL_ORDER_STATUS_CONFLICT`.
- Even when legacy clients omit expected fields, repository writes use the version/status read by the service as a compare-and-set guard so concurrent server-side mutations cannot silently overwrite each other.
- New Ophthalmology clients must send both expected fields when updating an existing resource. This compatibility allowance does not weaken the Phase 2+ specialty contract.
- Clinical orders may be submitted while the consultation is `DRAFT` or `COMPLETED`, provided the OPD visit is not cancelled or no-show and a consultation exists.
- Every order item must resolve to an active `LAB_TEST` or `IMAGING_SERVICE`; generic billing-service fallback is removed.
- Consultation completion and order submission use required MongoDB transactions. Unsupported standalone/transactionless deployments return `503 TRANSACTION_CAPABILITY_REQUIRED`; no non-transactional fallback is permitted for these workflows.
- Existing endpoints, response envelope, permissions, branch scope, field names, and General OPD/Dental behavior remain otherwise unchanged.

## Intended files

- `apps/api/src/modules/opd/opd-consultation.{model,types,schemas,repository,service}.ts`
- `apps/api/src/modules/opd/opd-clinical-order.{model,types,schemas,repository,service}.ts`
- `apps/api/src/modules/opd/opd-visit.{model,types,schemas,repository,service}.ts`
- `apps/api/src/modules/opd/opd-vitals.service.ts`
- `apps/api/src/modules/opd/opd-prescription.service.ts`
- `apps/api/src/modules/appointments/appointment.repository.ts`
- `apps/api/src/modules/patients/patient.repository.ts`
- `apps/api/src/shared/database/transaction.ts`
- Focused Phase 1 tests under `apps/api/src/modules/opd`
- Phase 0 contract/matrix and Phase 1 verification documentation

## Shared dependencies and safety boundaries

- Appointment status updates already accept a MongoDB session and will be reused.
- Patient timeline already accepts a session; audit will receive an additive optional session parameter.
- The existing permissive transaction helper remains unchanged for legacy workflows. A separate required-transaction helper will be used only where Phase 1 requires atomicity.
- No permission seed, router, frontend, prototype, or unrelated module change is planned.

## Acceptance checks

- Wrong-type but billable services are rejected.
- Authorized laboratory/imaging orders can be submitted during a draft consultation.
- Stale consultation/order version or status is rejected with `409`.
- Consultation finalization and order submission roll back on any participating write failure.
- Transaction-unavailable finalization/submission fails explicitly with `503`.
- Existing OPD request bodies without concurrency fields remain valid.
- API typecheck, lint, build, focused tests, and relevant existing OPD regression tests complete; repository-wide unrelated failures are documented precisely.

## Stop gate

Phase 2 must not start until this phase is implemented, verified, documented, and explicitly approved.
