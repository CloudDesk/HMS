# Insurance Phase 7 verification — 8 October 2026

## Implemented

Completed Phase 7 (OPD Claim Draft Creation, Line Derivation, and Validation/Readiness Reporting from HMS Invoices) without modifying prior phase contracts or introducing unconfirmed external integrations.

Artifacts and files:
- `HMS_INSURANCE_PHASE7_GAP_NOTE.md`
- `apps/api/src/modules/insurance/insurance-claim.model.ts`
- `apps/api/src/modules/insurance/insurance-claim.repository.ts`
- `apps/api/src/modules/insurance/insurance-claim.schemas.ts`
- `apps/api/src/modules/insurance/insurance-claim.service.ts`
- `apps/api/src/modules/insurance/insurance-claim.test.ts`
- Shared additions:
  - `apps/api/src/modules/insurance/insurance.routes.ts`: `POST /api/insurance/claims`, `GET /api/insurance/claims`, `GET /api/insurance/claims/:id`, `POST /api/insurance/claims/:id/validate`.
  - `apps/api/src/shared/services/service-registry.ts` & `apps/api/src/shared/types/service-registry.ts`: `insuranceClaims` service registration.
  - `apps/api/src/database/seed.ts`: Seeded `Insurance.Claims: ['View', 'Create', 'Validate']`.

Key implemented behaviors:
1. **Invoice and Encounter Linkage:**
   - Evaluates finalized OPD invoices (`PENDING`, `PARTIALLY_PAID`, `PAID`). Non-OPD and unfinalized invoices are rejected with `INVOICE_NOT_CLAIMABLE`.
   - Validates patient, branch, and encounter ownership consistency (`INVOICE_CONTEXT_MISMATCH`).
   - Resolves patient membership with active coverage verification (`LOCAL_COVERAGE_VALID`).

2. **Line Derivation and Arithmetic Integrity:**
   - Claim lines are strictly derived from stored invoice items (`quantity * unitPrice === lineTotal`).
   - Client-supplied line amounts or totals are disallowed; invalid arithmetic throws `INVALID_CLAIM_AMOUNT`.
   - Claim item counts are bounded between 1 and 100 (`CLAIM_ITEM_COUNT_INVALID`).

3. **Cumulative Authorization Matching:**
   - Multi-item service lines compute cumulative quantities to prevent exceeding approved quantities across repeated line items.
   - Live approved authorizations matching encounter date, service, and patient context are linked; missing or insufficient authorizations emit `AUTHORIZATION_REQUIRED_MISSING_OR_INSUFFICIENT`.
   - Linked authorizations emit `SHA_AUTHORIZATION_VALIDITY_UNCONFIRMED` because local status does not prove payer-side validity.

4. **Deterministic Readiness Reporting:**
   - Claims strictly remain in `DRAFT` status with `readyForShaSubmission: false`.
   - Readiness reports structured error codes: `ICD11_NOT_AVAILABLE`, `SHA_SUBMISSION_CONTRACT_UNCONFIRMED`, `SHA_SERVICE_MAPPING_MISSING` (or `CONFIGURED_NOT_SHA_VALIDATED`), `AUTHORIZATION_REQUIRED_MISSING_OR_INSUFFICIENT` (or `SHA_AUTHORIZATION_VALIDITY_UNCONFIRMED`).
   - If header-level invoice discount or tax exists, `INVOICE_ADJUSTMENT_ALLOCATION_UNCONFIRMED` is reported; no speculative discounts or tax allocations are made.
   - Payer and patient financial liabilities are NOT calculated.

5. **Source Fingerprint and Concurrency:**
   - Stored SHA-256 fingerprint of invoice and sorted items guarantees invoice immutability.
   - Idempotent re-submission returns the existing draft claim if unchanged.
   - Changes to the underlying invoice or items result in `DUPLICATE_CLAIM` upon re-creation or flag `CLAIM_SOURCE_CHANGED` upon validation.
   - Validation checks `version` and increments atomically using MongoDB transactions; stale version requests fail with `STALE_CLAIM`.

6. **RBAC, Scoping, and Audit:**
   - Enforces `Insurance.Claims: ['View', 'Create', 'Validate']` and user branch access.
   - Emits transactional audit logs: `INSURANCE_CLAIM_CREATED` and `INSURANCE_CLAIM_VALIDATED`.

## Verification & Test Results

- Focused unit/integration test suite: `apps/api/src/modules/insurance/insurance-claim.test.ts` (31 tests passed).
- Full insurance regression suite: 5 test files, 187 tests passed:
  - `insurance-claim.test.ts` (31 tests)
  - `insurance-integration.test.ts` (41 tests)
  - `insurance-authorization.test.ts` (19 tests)
  - `insurance.benefit-resolution.test.ts` (4 tests)
  - `insurance.test.ts` (92 tests)
- TypeScript typecheck: `npm run typecheck --workspace=@hms/api` passed with 0 errors.

## Constraints & Stop Gates Observed

- Strictly NO external SHA calls, mock SHA endpoints, FHIR claim bundles, or ClaimResponse parsing.
- Strictly NO patient/payer liability calculation.
- Phase 7 complete. Stopped before Phase 8.
