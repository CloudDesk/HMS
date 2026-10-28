# Insurance Phase 1A Slice 3 — Verification

**Developer:** Kamesh  
**Active branch:** `Insurance-Module-v1-k`  
**Status:** COMPLETE — awaiting approval before the next slice  
**Scope:** Non-monetary approval foundation and Provider/Payer activation integration

## Implemented functionality

- Effective-dated approval rules for `PROVIDER_ACTIVATION` and
  `PAYER_ACTIVATION`.
- Global rules and payer-specific Payer activation rules with specific-rule
  precedence.
- Paginated/filterable approval-rule and approval-request lists plus detail
  APIs.
- Approval request creation, approval, rejection, and requester cancellation.
- Provider/Payer activation integration using approved request ID and exact
  resource version.
- Direct activation remains available only when no applicable active rule
  exists.
- Explicit self-approval prevention and database-backed required-permission
  evaluation.
- Optimistic concurrency, unique pending-request control, serialized rule
  schedule changes, stale-resource rejection, transactions, and audit history.

## API contract implemented

``` text
GET/POST   /api/insurance/approval-rules
GET/PATCH  /api/insurance/approval-rules/:id

GET/POST   /api/insurance/approval-requests
GET        /api/insurance/approval-requests/:id
POST       /api/insurance/approval-requests/:id/actions/approve
POST       /api/insurance/approval-requests/:id/actions/reject
POST       /api/insurance/approval-requests/:id/actions/cancel
```

Provider and Payer activation action bodies now optionally accept
`approval_request_id`. It becomes mandatory only when an applicable active
approval rule exists.

## Existing functionality reused

- Slice 1/2 Insurance Provider, Payer, operating configuration, lifecycle,
  repository/service split, transactions, audit, validation, and errors.
- Existing Permission, Role, User and Fastify RBAC infrastructure.
- Existing Audit Log and standard response/error envelopes.

## Files changed

``` text
apps/api/src/modules/insurance/insurance.types.ts
apps/api/src/modules/insurance/insurance.model.ts
apps/api/src/modules/insurance/insurance.repository.ts
apps/api/src/modules/insurance/insurance.service.ts
apps/api/src/modules/insurance/insurance.schemas.ts
apps/api/src/modules/insurance/insurance.routes.ts
apps/api/src/modules/insurance/insurance.service.test.ts
apps/api/src/database/seed.ts
HMS_INSURANCE_TWO_DEVELOPER_PHASE_WISE_EXECUTION_PLAN.md
doc/insurance/PHASE_1A_SLICE_3_GAP_NOTE.md
doc/insurance/PHASE_1A_SLICE_3_VERIFICATION.md
```

The assigned permission seed now includes
`Insurance.Approvals.View/Configure/Request/Decide`. No other shared service or
route registry change was needed because Slice 1 registration is reused.

## Backend validation and safety

- Only implemented resource types can have rules and requests in this slice.
- Rule permission codes must exist and be active.
- Active rule periods cannot overlap within the same transaction/scope.
- Payer-specific rules take precedence over global rules and cannot be bypassed
  by selecting a weaker global rule.
- One pending request is permitted per resource, transaction, and version.
- Only `DRAFT` or `INACTIVE` Provider/Payer resources can request activation.
- Requester and decision maker must differ.
- Decision maker must hold both the route permission and the rule-configured
  permission.
- Rejection and cancellation require a reason; only the requester may cancel.
- Resource changes after request creation cause stale-decision rejection.
- Activation verifies the approved request against rule, resource, and exact
  pre-activation version.
- Approval decisions and audit events commit or roll back together.
- No patient data, external secret, amount, currency, tariff, claim, or payment
  field was introduced.

## Verification completed

``` text
PASS  npm run typecheck --workspace=@hms/api
PASS  npm run lint --workspace=@hms/api
PASS  npm run build --workspace=@hms/api
PASS  Insurance focused test suite: 17 tests
PASS  npm run typecheck --workspace=@hms/web
PASS  npm run lint --workspace=@hms/web
PASS  npm run build --workspace=@hms/web
```

Focused approval coverage includes RBAC denial/allowance, overlapping-rule
concurrency, concurrent decisions, self-approval denial, missing configured
permission, stale target version, payer-specific rule precedence, direct
activation blocking, approved activation, requester-only cancellation,
rejection reason, audit evidence, and transaction rollback when audit fails.

## HMS Local UI patterns reused

None. Slice 3 is backend-only and no frontend or prototype file was changed.

## Remaining dependency and stop gate

- Contract, Scheme, Policy and Member resources have not started.
- Their approval transaction types remain intentionally unavailable until the
  corresponding resource and lifecycle services exist.
- Phase 1B remains blocked by the Finance Foundation.
- The next slice has not started and requires explicit approval.
