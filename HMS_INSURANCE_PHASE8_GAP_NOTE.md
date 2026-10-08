# Insurance Phase 8 Gap Note — Claim Validation & SHA Submission Readiness

## 1. Reusable Foundations from Phase 1–7
- Phase 7 claim data model (`InsuranceClaimModel`), claim lines, and SHA-256 source fingerprint immutability.
- Optimistic concurrency control via claim `version` with transactional updates.
- Billing invoice integration (`BillingInvoiceModel`, `BillingInvoiceItemModel`).
- OPD encounter context and service references (`InsuranceIntegrationService.context`).
- Insurance coverage verification (`InsuranceService.checkCoverage`).
- Benefit rule evaluation (`InsuranceService.verifyBenefit`).
- Preauthorization matching (`InsuranceIntegrationRepository.authorization`, `InsuranceAuthorizationModel`).
- SHA service mapping lookup (`InsuranceIntegrationRepository.mapping`, `ShaServiceMappingModel`).
- Audit logging (`AuditLogModel`) with sanitized metadata.

## 2. Phase 8 Scope & Business Purpose
- Answer: "Is the claim sufficiently valid and complete to proceed toward SHA submission?"
- Deterministic distinction between:
  - Internal validity (`valid: true` when internal integrity, coverage, benefits, local authorizations, and mappings pass; status transitions to `VALIDATED`).
  - Internal invalidity (`valid: false` when internal integrity or coverage or line arithmetic fails; status remains `DRAFT`).
  - SHA submission readiness (`readyForShaSubmission: false` deterministically enforced because external SHA contracts, identifier mappings, terminology, and structured ICD-11 are unconfirmed).
- Strict non-submission rule: claims NEVER move to `SUBMITTED`, no external SHA calls, no FHIR bundle generation, no mock SHA adapter.
- Financial liability calculation is strictly omitted; invoice-level discounts and taxes emit `INVOICE_ADJUSTMENT_ALLOCATION_UNCONFIRMED`.

## 3. Layered Validation Rules
- **Layer A (HMS Internal Integrity):** Claim existence, not cancelled, claimable OPD invoice, fingerprint match, patient/member/policy consistency, encounter linkage, line arithmetic (\(quantity \times unitPrice = lineTotal\)), claim total equals sum of lines.
- **Layer B (Coverage & Benefit & Authorization):** Active coverage as of encounter date, service covered in benefit rules, live approved authorization linked with sufficient quantity.
- **Layer C (SHA Service Mapping):** Active, effective SHA mapping required for every service line; locally configured mapping reports `CONFIGURED_NOT_SHA_VALIDATED`.
- **Layer D (Diagnosis / ICD-11):** Free-text OPD diagnosis reports `ICD11_NOT_AVAILABLE`.
- **Layer E (SHA Contract Readiness):** Reports `SHA_SUBMISSION_CONTRACT_UNCONFIRMED`, `SHA_IDENTIFIER_MAPPING_UNCONFIRMED`, `SHA_TERMINOLOGY_UNCONFIRMED`.
- **Layer F (Financial Integrity):** Derived line amounts, header adjustments report `INVOICE_ADJUSTMENT_ALLOCATION_UNCONFIRMED`.

## 4. Intended Files
- `HMS_INSURANCE_PHASE8_GAP_NOTE.md` (this file)
- `apps/api/src/modules/insurance/insurance-claim.model.ts` (extend `ClaimIssue` severity and message)
- `apps/api/src/modules/insurance/insurance-claim.repository.ts` (update `validate` to support status transition and return document)
- `apps/api/src/modules/insurance/insurance-claim.service.ts` (implement layered validation and readiness evaluation)
- `apps/api/src/modules/insurance/insurance.routes.ts` (expose enhanced validation and readiness endpoints)
- `apps/api/src/modules/insurance/insurance-claim.test.ts` (focused test suite covering all 30 verification cases)
- `HMS_INSURANCE_PHASE8_VERIFICATION.md` (completion and verification report)
