# Insurance Phase 1A Slice 3 — Backend Gap Note

**Developer:** Kamesh  
**Active branch:** `Insurance-Module-v1-k`  
**Scope:** Non-monetary approval foundation and Provider/Payer activation integration

## Existing functionality reused

- Slice 1/2 Insurance configuration, Provider, Payer, transactions, audit,
  optimistic versions, lifecycle actions, error handling, and API structure.
- Existing Permission, Role, User, and Branch records for server-authoritative
  permission and scope checks.
- Existing Audit Log and Fastify permission middleware.

## Missing implementation

- No Insurance approval-rule or approval-request persistence exists.
- Provider and Payer activation cannot currently require approval.
- No self-approval or stale-resource decision protection exists.
- No approval queue/history, decision, cancellation, or rule APIs exist.
- No `Insurance.Approvals.*` permissions are seeded.

## Approved Slice 3 boundary

- Implement approval rules and requests only for `PROVIDER_ACTIVATION` and
  `PAYER_ACTIVATION`, because those are the only approvable Insurance resources
  implemented at this point.
- Contract, Scheme, and Policy activation rule types remain deferred until
  their resource models and lifecycle services exist. The API rejects those
  premature rule types instead of storing unverifiable references.
- Provider/Payer activation remains direct when no matching active rule exists.
  When a rule exists, activation requires an approved request matching the
  rule, resource type, resource ID, and exact pre-activation resource version.
- Approval decisions do not directly activate the resource. They authorize
  the existing activation action, preserving one lifecycle transition owner.
- A requester cannot decide their own request.
- Rejection and cancellation require a decision reason. Approval records an
  optional decision reason.
- Only the original requester may cancel a pending request.
- One pending request is allowed per resource type, resource ID, transaction
  type, and resource version.
- Rule `required_permission` must reference an active existing permission.
  The decision service rechecks that permission from the database.
- Rules for Provider/Payer activation are system-level in this slice. Branch,
  payer, and scheme-scoped approval rules are deferred to their corresponding
  branch-scoped resource slices.
- Rule effective periods for the same transaction type may not overlap while
  active.
- No monetary thresholds or financial transaction types are introduced.

## Intended files

``` text
apps/api/src/modules/insurance/insurance.types.ts
apps/api/src/modules/insurance/insurance.model.ts
apps/api/src/modules/insurance/insurance.repository.ts
apps/api/src/modules/insurance/insurance.service.ts
apps/api/src/modules/insurance/insurance.schemas.ts
apps/api/src/modules/insurance/insurance.routes.ts
apps/api/src/modules/insurance/insurance.service.test.ts
apps/api/src/database/seed.ts
```

## Explicit exclusions

- No frontend changes.
- No Contract, Scheme, Policy, Member, Benefit, Tariff, Claim, or Finance data.
- No amount thresholds, currency logic, or Billing/Payment changes.
- No Organization/Tenant model and no production mock data.
