# Ophthalmology audit remediation

## Scope and reusable foundations

Requested on 22 October 2026 for DEV-OPHTHALMOLOGY-F-V2. This remediation reuses the existing Emergency model and repository, scoped clinician lookup, MongoDB transaction helper, OPD prescription/consultation services, specialty completion transaction and live billing projection. Existing working-tree changes are preserved.

## Gaps and intended changes

- Complete and test Emergency provenance, source-alert uniqueness and clinical clearance authorization in the existing Emergency/Ophthalmology modules.
- Persist medication laterality through schema, DTO, model and repository; validate ophthalmic medication and diagnosis laterality in OPD services before writes.
- Align journey emergency blocking with clearance and include unpaid invoices, required stat medications and required referrals.
- Add HTTP permission, clearance/resumption, negative laterality and persisted journey integration tests.
- Shared changes: OPD prescription contracts and clinical services; no prototype or layout changes are planned.

## Billing dependency

Billing accepts explicit catalogue service IDs. No approved visit-subtype-to-consultation-service mapping or existing-invoice reconciliation rule has been identified. Atomic charge creation must not invent prices or choose an arbitrary service. The owner has been asked for this mapping; the existing billing status enum is DRAFT/PENDING/PARTIALLY_PAID/PAID/CANCELLED, not SETTLED/EXEMPT. Financial closure will use non-cancelled invoice balances until an explicit exemption contract is approved.

## Verification

Pending implementation and automated checks. This document does not certify release readiness.
