# Insurance Phase 8 Verification — 8 October 2026

## 1. Implemented

Completed Phase 8: Claim Validation & SHA Submission Readiness without modifying existing Phase 1–7 foundational contracts, creating mock adapters, or calling external SHA endpoints.

### Key Deliverables:
- `HMS_INSURANCE_PHASE8_GAP_NOTE.md`
- Model update: `apps/api/src/modules/insurance/insurance-claim.model.ts` (added `ClaimIssueSeverity = 'ERROR' | 'WARNING' | 'INFO'`, `message?: string` on `ClaimIssue`).
- Repository update: `apps/api/src/modules/insurance/insurance-claim.repository.ts` (enhanced transactional `validate` method supporting status transition to `VALIDATED` or `DRAFT`, atomic version increments, and returning sanitized validation state).
- Service update: `apps/api/src/modules/insurance/insurance-claim.service.ts` (implemented comprehensive layered validation, deterministic readiness issue classification, `readiness` evaluation endpoint, and safe `get` enrichment).
- Routes update: `apps/api/src/modules/insurance/insurance.routes.ts` (added `GET /api/insurance/claims/:id/readiness`, protected by `Insurance.Claims.View`).
- Tests: `apps/api/src/modules/insurance/insurance-claim.test.ts` (comprehensive 33-test suite covering all 30 validation and readiness scenarios) and `apps/api/src/modules/insurance/insurance.test.ts` (added route permission coverage).
- Execution Plan tracker updated in `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md`.

### Core Validation Behaviors:
1. **Layer A — HMS Internal Integrity:**
   - Validates claim existence and ensures cancelled claims reject validation (`CLAIM_CANCELLED`, 409).
   - Validates source invoice existence and claimable status (`INVOICE_NOT_CLAIMABLE` if unfinalized or non-OPD).
   - Validates source fingerprint immutability; reports `CLAIM_SOURCE_CHANGED` without silently updating.
   - Validates patient, member, policy, and branch context consistency (`INVOICE_CONTEXT_MISMATCH`, `MEMBER_CONTEXT_REQUIRED`, `POLICY_NOT_FOUND`).
   - Validates invoice item service linkage (`SERVICE_NOT_IN_ENCOUNTER`) and active service status (`SERVICE_UNAVAILABLE`).
   - Validates positive integer quantities, finite unit prices, and line arithmetic (`INVALID_CLAIM_AMOUNT`).
   - Validates that claim total equals sum of line amounts (`CLAIM_TOTAL_MISMATCH`).

2. **Layer B — Insurance Coverage & Benefits:**
   - Reuses `InsuranceService.checkCoverage` for active member and policy coverage on encounter date.
   - Reuses `InsuranceService.verifyBenefit` for Phase 4 benefit coverage without creating duplicate hierarchies.
   - For authorization-required services, links active approved live-mode authorizations with sufficient quantity.
   - If missing or insufficient, emits `AUTHORIZATION_REQUIRED_MISSING_OR_INSUFFICIENT` (internal error).
   - If linked, emits `SHA_AUTHORIZATION_VALIDITY_UNCONFIRMED` (readiness warning, as local approval does not confirm SHA payer-side validity).

3. **Layer C — SHA Service Mapping:**
   - Requires active, effective SHA service mapping for every claim line on the encounter date.
   - If missing or expired, reports `SHA_SERVICE_MAPPING_MISSING` (internal error).
   - If present, reports `CONFIGURED_NOT_SHA_VALIDATED` (readiness warning; code is configured locally but unconfirmed against SHA tariff master).

4. **Layer D — ICD-11 Validation:**
   - Free-text OPD diagnosis reports `ICD11_NOT_AVAILABLE` without inventing codes.

5. **Layer E — SHA Contract Readiness:**
   - Explicitly emits `SHA_SUBMISSION_CONTRACT_UNCONFIRMED`, `SHA_IDENTIFIER_MAPPING_UNCONFIRMED`, and `SHA_TERMINOLOGY_UNCONFIRMED`.

6. **Layer F — Financial Validation:**
   - Stored line totals and quantities validated.
   - Payer and patient liabilities are NOT calculated.
   - Header discounts and taxes emit `INVOICE_ADJUSTMENT_ALLOCATION_UNCONFIRMED`.

7. **Claim Status Transitions:**
   - When internal validation passes: claim status becomes `VALIDATED`, `valid: true`.
   - When internal validation fails: claim status remains `DRAFT`, `valid: false`.
   - `readyForShaSubmission: false` deterministically in ALL cases.
   - Claims are NEVER moved to `SUBMITTED`.

8. **Optimistic Concurrency & Audit:**
   - Transactional update matches version and increments atomically.
   - Stale version updates reject with `STALE_CLAIM` (409).
   - Emits `INSURANCE_CLAIM_VALIDATED` audit log recording `claimId`, `status`, `valid`, `readyForShaSubmission: false`, and issue codes.

## 2. Confirmed from Repository
- Billing invoice headers and invoice items provide authoritative source amounts (`lineTotal`).
- OPD encounters currently store free-text clinical notes with no structured ICD-11 terminology.
- No external SHA claim submission endpoint, authentication scope, or FHIR bundle specification is confirmed in the repository.
- Service catalogue codes are local identifiers requiring mapping via `ShaServiceMappingModel`.
- Authorization models record local approval without real-time payer synchronization.

## 3. Assumed
- Claims whose internal HMS integrity, coverage, benefits, preauthorization presence, and service mappings are sound are marked `VALIDATED`, while keeping `readyForShaSubmission: false` until external SHA submission contracts and ICD-11 sources are confirmed.

## 4. Still Requires Confirmation (Downstream Dependencies)
- Confirmed SHA Claim Submission FHIR Bundle profile and endpoint.
- Confirmed SHA ClaimResponse processing and query mechanisms.
- Confirmed ICD-11 diagnosis terminology source and integration.
- Payer/patient financial liability calculation and header adjustment allocation rules.

## 5. Automated Checks
- Focused tests: `apps/api/src/modules/insurance/insurance-claim.test.ts` (33 tests passed).
- Full insurance regression: 5 test files, 191 tests passed:
  - `insurance-claim.test.ts` (33 tests)
  - `insurance-integration.test.ts` (41 tests)
  - `insurance-authorization.test.ts` (19 tests)
  - `insurance.benefit-resolution.test.ts` (4 tests)
  - `insurance.test.ts` (94 tests)
- TypeScript typecheck: `npm run typecheck --workspace=@hms/api` (0 errors).
- ESLint: Focused lint on changed files passed with 0 errors.

## 6. Strict Scope Boundary
- Stopped after Phase 8. Phase 9 has not started.
