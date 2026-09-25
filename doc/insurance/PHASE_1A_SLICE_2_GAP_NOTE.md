# Insurance Phase 1A Slice 2 — Backend Gap Note

**Developer:** Kamesh  
**Active branch:** `Insurance-Module-v1-k`  
**Approved plan branch:** `Insurance-module-k`  
**Scope:** Payer master, payer lifecycle, operating-mode evaluation, permissions, audit, indexes, and tests

## Branch reconciliation

The repository was already on `Insurance-Module-v1-k` when Slice 2 started.
No automatic branch switch, rename, merge, or history rewrite was performed.
This note treats the current branch as the active Kamesh branch while preserving
the approved ownership boundary.

## Existing functionality reused

- Slice 1 Insurance module, singleton operating configuration, errors, audit
  structure, transaction helper, schemas, routes, and service/repository split.
- Existing JWT authentication and `requirePermission` middleware.
- Existing global permission seed and Administrator permission assignment.
- Existing pagination, filtering, sorting, normalized-code, soft-delete,
  optimistic-version, explicit-transition, and audit conventions.

## Missing implementation

- No Insurance Payer model or persistence contract exists.
- No payer list, detail, create, update, activate, or deactivate APIs exist.
- No payer permissions are seeded.
- No duplicate-code, stale-version, transition, persistence, or audit tests
  exist for Payer.

## Approved design for this slice

- Payer identity remains system-level; no branch or Organization/Tenant field
  is added.
- `payer_code` is normalized to uppercase and globally unique among
  non-deleted payers.
- Payer lifecycle is `DRAFT -> ACTIVE -> INACTIVE` and `INACTIVE -> ACTIVE`.
- Status is never directly editable; transitions use explicit action routes
  with required reason and expected `version`.
- Payer lists are paginated and support approved search, status, payer type,
  submission mode, sorting, and ordering.
- Payer mutations and their audit records execute in one MongoDB transaction.
- The service reads the singleton operating mode for every Payer mutation.
  Payer identity administration is valid in all four approved modes because
  provider-side workflows must maintain external payer identities. This slice
  does not contain payer decisions; `PROVIDER`-mode decision denial remains for
  the later decision/approval workflow where it is applicable.
- No API credential, external secret, financial, benefit, tariff, settlement,
  or claim amount is stored.

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
- No contract, scheme, policy, member, benefit, tariff, or approval records.
- No payer decision, adjudication, payment, remittance, or reconciliation.
- No Billing, Payments, Finance Foundation, Organization, or Tenant changes.
- No mock production data or localStorage.
