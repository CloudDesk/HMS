# Insurance Phase 1A Slice 1 — Backend Gap Note

**Developer:** Kamesh  
**Branch:** `Insurance-module-k`  
**Scope:** Operating configuration, Insurance Provider, Provider-to-Branch mapping

## Existing functionality reused

- Fastify module route registration and shared service registry.
- Existing JWT authentication and `requirePermission` middleware.
- Permission category/group/seed infrastructure.
- Existing User, Role and Branch models for backend-authoritative branch scope.
- Existing Audit Log collection with structured `metadataJson`.
- Mongoose repository/service separation and standard `ok()` responses.
- Existing pagination, filtering, soft-delete and conditional-update patterns.
- Existing HMS Local operational tables/forms/status patterns are a future
  frontend reference only; there is no dedicated Insurance Provider prototype.

## Missing implementation

- No Insurance backend module exists.
- No singleton Insurance operating-mode configuration exists.
- No legal Insurance Provider master exists.
- No effective-dated Provider-to-Branch mapping exists.
- No Insurance permissions are seeded.
- No Insurance service-registry or route registration exists.

## Approved design for this slice

- Use an Insurance-owned singleton configuration collection to avoid changing
  the existing Settings API contract during this isolated backend slice.
- Operating modes: `PROVIDER`, `PAYER`, `TPA`, `HYBRID`.
- Provider is system-level; provider/branch mapping is branch-scoped.
- All updates use integer `version` conditional writes and return conflict on
  stale state.
- Provider codes are normalized and unique among non-deleted records.
- Provider mappings cannot overlap for the same provider/branch effective
  period.
- Mapping writes validate active Branch and authenticated-user branch scope.
- Provider status transitions are explicit; status is not freely editable.
- Audit records preserve before/after, actor, reason, branch/resource IDs and
  versions.

## Files intended

``` text
apps/api/src/modules/insurance/insurance.types.ts
apps/api/src/modules/insurance/insurance.model.ts
apps/api/src/modules/insurance/insurance.repository.ts
apps/api/src/modules/insurance/insurance.service.ts
apps/api/src/modules/insurance/insurance.schemas.ts
apps/api/src/modules/insurance/insurance.routes.ts
apps/api/src/modules/insurance/insurance.service.test.ts
```

Assigned shared backend files:

``` text
apps/api/src/modules/index.ts
apps/api/src/shared/services/service-registry.ts
apps/api/src/shared/types/service-registry.ts
apps/api/src/database/seed.ts
```

## Explicit exclusions

- No frontend changes.
- No payer, contract, scheme, policy or member implementation.
- No benefits, tariffs or monetary fields.
- No Billing, Payments or Finance Foundation changes.
- No Organization/Tenant model.
- No production mock data or localStorage.
