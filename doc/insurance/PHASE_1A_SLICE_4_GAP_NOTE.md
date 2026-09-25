# Insurance Phase 1A Slice 4 — Backend Gap Note

**Developer:** Kamesh  
**Active branch:** `Insurance-Module-v1-k`  
**Scope:** Non-monetary Insurance Contract foundation and approval integration

## Existing functionality reused

- Insurance Provider, effective-dated Provider-to-Branch mapping, Payer,
  Approval Rule/Request, transactions, audit, optimistic versions, errors and
  route validation from Slices 1–3.
- Existing User/Role/Branch scope resolution and RBAC middleware.
- Existing MongoDB transaction and Audit Log infrastructure.

## Missing implementation

- No Insurance Contract model, repository, service, schemas, routes or tests.
- Approval foundation does not yet support `CONTRACT_ACTIVATION` or Contract
  resources.
- Branch-scoped approval-rule/request visibility is not yet required by the
  implemented Provider/Payer resources but becomes necessary for Contracts.

## Approved Slice 4 design

- Contract is branch-scoped and references existing Payer, Provider and Branch
  records; none are duplicated.
- Unique key is `branch_id + payer_id + normalized contract_number` among
  non-deleted records.
- Creation requires active Payer, active Provider, active accessible Branch,
  and an active Provider-to-Branch mapping effective on the Contract start.
- Lifecycle is:

``` text
DRAFT -> PENDING_APPROVAL
PENDING_APPROVAL -> APPROVED | DRAFT
APPROVED -> ACTIVE
ACTIVE -> SUSPENDED | EXPIRED | TERMINATED
SUSPENDED -> ACTIVE | TERMINATED
```

- Contract fields are editable only in `DRAFT`; rejected approvals return the
  Contract to `DRAFT` for correction.
- Submit moves a Contract to `PENDING_APPROVAL` and requires an applicable
  active `CONTRACT_ACTIVATION` rule before an approval request can be created.
- Approval approval atomically moves the Contract from `PENDING_APPROVAL` to
  `APPROVED`; rejection atomically returns it to `DRAFT`.
- Activation is a separate `Contracts.Activate` action from `APPROVED`.
- Suspension, expiration and termination require a reason. Reactivation from
  `SUSPENDED` requires a currently approved request for the current Contract
  version when an applicable rule exists.
- Approval rules and requests gain branch scope. Global rules remain visible;
  branch-scoped records are restricted to the authenticated user's branches.
- Matching precedence is exact branch+payer, branch-only, payer-only, global.
- No monetary threshold, tariff, benefit, amount, currency or Billing field is
  added.

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

- No frontend or HMS Local changes.
- No Scheme, Policy, Member, Benefit, Tariff, Claim, authorization or finance
  implementation.
- No Organization/Tenant subsystem, mock production data or localStorage.
