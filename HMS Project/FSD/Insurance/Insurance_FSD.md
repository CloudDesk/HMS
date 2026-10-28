# Insurance Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Insurance |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Document observed payer, scheme, policy, member, benefit and claim preparation capabilities without equating mock external flows with live integration.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Document observed payer, scheme, policy, member, benefit and claim preparation capabilities without equating mock external flows with live integration. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Authorized insurance operations user; billing staff for permitted financial context; administrator for payer configuration.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Insurance | Authorization | Manage |
| Insurance | Authorization | Submit |
| Insurance | Authorization | View |
| Insurance | Benefits | Manage |
| Insurance | Benefits | Verify |
| Insurance | Benefits | View |
| Insurance | Claims | Create |
| Insurance | Claims | Validate |
| Insurance | Claims | View |
| Insurance | Configuration | Create |
| Insurance | Configuration | Edit |
| Insurance | Configuration | View |
| Insurance | Eligibility | Verify |
| Insurance | Eligibility | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-INS-001 | Implementation observation — business validation required. Evaluate patient coverage through the existing coverage operation. | `apps/api/src/modules/insurance/insurance-integration.service.ts:67` | `apps/api/src/modules/insurance/insurance-integration.service.ts:67` — coverage | Implemented |
| FR-INS-002 | Implementation observation — business validation required. Validate claim data before progressing the workflow. | `apps/api/src/modules/insurance/insurance-authorization.service.ts:32` | `apps/api/src/modules/insurance/insurance-authorization.service.ts:32` — validate | Implemented |
| FR-INS-003 | Implementation observation — business validation required. Prepare an insurance claim using the current service contract. | `apps/api/src/modules/insurance/insurance-claim.service.ts:93` | `apps/api/src/modules/insurance/insurance-claim.service.ts:93` — prepare | Implemented |
| FR-INS-004 | Implementation observation — business validation required. Request preauthorization through the current integration boundary. | `apps/api/src/modules/insurance/insurance-authorization.service.ts:50` | `apps/api/src/modules/insurance/insurance-authorization.service.ts:50` — requestPreauthorization | Implemented |
| FR-INS-005 | Implementation observation — business validation required. Expose the current integration readiness result. | `apps/api/src/modules/insurance/dha/dha-preauthorization-readiness.service.ts:67` | `apps/api/src/modules/insurance/dha/dha-preauthorization-readiness.service.ts:67` — getReadiness | Implemented |
| FR-INS-006 | Implementation observation — business validation required. Provide a mock claim-submission operation explicitly labelled mock. | `apps/api/src/modules/insurance/dha/dha-claim-submission.service.ts:51` | `apps/api/src/modules/insurance/dha/dha-claim-submission.service.ts:51` — mockSubmitClaim | Implemented |
| FR-INS-007 | Implementation observation — business validation required. Provide mock adjudication without treating it as a live payer decision. | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:63` | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:63` — mockAdjudicateClaim | Implemented |
| FR-INS-008 | Implementation observation — business validation required. Summarize claim lifecycle and outstanding work for authorized users. | `apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts:159` | `apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts:159` — getClaimLifecycleSummary | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Configure the payer, scheme and policy under branch scope.
2. Link the eligible patient member.
3. Evaluate coverage and benefit information.
4. Prepare and validate the supported authorization or claim context.
5. Use the explicitly configured integration mode.
6. Track responses and outstanding work; mock outcomes are never evidence of payer acceptance or payment.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| VALIDATION_ERROR — Invalid claim ID format | 400 | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:74` |
| CLAIM_NOT_FOUND — Claim not found | 404 | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:79` |
| BRANCH_ACCESS_DENIED — Branch access denied | 403 | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:84` |
| CLAIM_CANCELLED — Claim is cancelled | 409 | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:88` |
| DHA_MOCK_DISCHARGE_NOT_FOUND — No DHA mock discharge found for this claim | 404 | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:99` |
| CLAIM_DISCHARGE_MISMATCH — Mock discharge belongs to another claim | 409 | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:107` |
| STALE_MOCK_DISCHARGE — Claim source fingerprint does not match discharge fingerprint | 409 | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:111` |
| CLAIM_SOURCE_CHANGED — Underlying invoice has changed since claim creation | 409 | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:121` |
| CLAIM_NOT_READY_FOR_ADJUDICATION — Claim validation failed | 422 | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts:143` |
| DHA_MOCK_ADJUDICATION_NOT_FOUND — Completed Phase 10.1 claim adjudication record required before appealing | 404 | `apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:132` |
| DISCHARGE_ADJUDICATION_MISMATCH — Adjudication does not match active discharge reference | 409 | `apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:161` |
| CLAIM_QUERY_UNRESOLVED — Cannot appeal claim with an unresolved query. Please resolve open query first. | 409 | `apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:183` |
| DHA_MOCK_APPEAL_NOT_FOUND — Mock claim appeal record not found | 404 | `apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:379` |
| APPEAL_ALREADY_DECIDED — Appeal has already been decided and cannot be modified | 409 | `apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:383` |
| PATIENT_DOCUMENT_NOT_FOUND — One or more referenced patient documents were not found or do not belong to this patient | 404 | `apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts:435` |
| INTERNAL_ERROR — Failed to record mock claim closure | 500 | `apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts:488` |
| DHA_MOCK_SUBMISSION_NOT_FOUND — No DHA mock submission found for this claim | 404 | `apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:93` |
| CLAIM_SUBMISSION_MISMATCH — Mock submission belongs to another claim | 409 | `apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:97` |
| STALE_MOCK_SUBMISSION — Claim source fingerprint does not match submission fingerprint | 409 | `apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:101` |
| DHA_MOCK_PREVIEW_NOT_FOUND — No DHA mock preview found for this claim and source fingerprint | 404 | `apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:121` |
| PREVIEW_SUBMISSION_MISMATCH — Preview references different submission | 409 | `apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:125` |
| CLAIM_PREVIEW_BLOCKED — Mock preview status does not permit discharge | 422 | `apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts:129` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/insurance/dha/dha-claim-reporting.schemas.ts`
- `apps/api/src/modules/insurance/insurance-authorization.schemas.ts`
- `apps/api/src/modules/insurance/insurance-claim.schemas.ts`
- `apps/api/src/modules/insurance/insurance-integration.schemas.ts`
- `apps/api/src/modules/insurance/insurance.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/insurance/InsuranceBenefitsPage.tsx` | useAuth, useState, useEffect, useMemo, useCallback |
| `apps/web/src/pages/insurance/InsuranceMembersPage.tsx` | useAuth, useState, useEffect, useCallback, useMemo |
| `apps/web/src/pages/insurance/InsurancePayersPage.tsx` | useAuth, useState, useEffect, useCallback, useMemo |
| `apps/web/src/pages/insurance/InsurancePoliciesPage.tsx` | useAuth, useState, useMemo, useEffect, useCallback |
| `apps/web/src/pages/insurance/InsuranceSchemesPage.tsx` | useAuth, useState, useEffect, useCallback, useMemo |
| `apps/web/src/pages/insurance/InsuranceShaMappingsPage.tsx` | useAuth, useState, useEffect, useMemo, useCallback |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| POST /api/insurance/payers | insurance.createPayer | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:58` |
| GET /api/insurance/payers | insurance.listPayers | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:68` |
| GET /api/insurance/payers/:id | insurance.getPayer | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:77` |
| PATCH /api/insurance/payers/:id | insurance.updatePayer | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:86` |
| POST /api/insurance/schemes | insurance.createScheme | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:97` |
| GET /api/insurance/schemes | insurance.listSchemes | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:107` |
| GET /api/insurance/schemes/:id | insurance.getScheme | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:116` |
| PATCH /api/insurance/schemes/:id | insurance.updateScheme | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:125` |
| POST /api/insurance/policies | insurance.createPolicy | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:136` |
| GET /api/insurance/policies | insurance.listPolicies | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:146` |
| GET /api/insurance/policies/:id | insurance.getPolicy | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:155` |
| PATCH /api/insurance/policies/:id | insurance.updatePolicy | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:164` |
| POST /api/insurance/members | insurance.createMember | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:175` |
| GET /api/insurance/members | insurance.listMembers | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:185` |
| GET /api/insurance/members/:id | insurance.getMember | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:194` |
| PATCH /api/insurance/members/:id | insurance.updateMember | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:203` |
| GET /api/insurance/members/:id/coverage-status | insurance.checkCoverage | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:214` |
| POST /api/insurance/coverage/check | insurance.checkCoverage | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:224` |
| POST /api/insurance/eligibility/verify | insurance.verifyEligibility | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:234` |
| GET /api/insurance/eligibility/verifications | insurance.listEligibilityVerifications | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:244` |
| GET /api/insurance/eligibility/verifications/:id | insurance.getEligibilityVerification | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:253` |
| POST /api/insurance/benefits | insurance.createBenefitConfig | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:263` |
| GET /api/insurance/benefits | insurance.listBenefitConfigs | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:273` |
| GET /api/insurance/benefits/:id | insurance.getBenefitConfig | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:282` |
| PUT /api/insurance/benefits/:id | insurance.updateBenefitConfig | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:291` |
| POST /api/insurance/benefits/verify | insurance.verifyBenefit | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:301` |
| POST /api/insurance/authorizations | insuranceAuthorization.requestPreauthorization | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:311` |
| GET /api/insurance/authorizations | insuranceAuthorization.list | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:315` |
| GET /api/insurance/authorizations/:id | insuranceAuthorization.get | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:318` |
| POST /api/insurance/authorizations/:id/submit | insuranceAuthorization.submit | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:322` |
| POST /api/insurance/authorizations/:id/cancel | insuranceAuthorization.cancel | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:327` |
| POST /api/insurance/claims | insuranceClaims.create | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:334` |
| GET /api/insurance/claims | insuranceClaims.list | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:337` |
| GET /api/insurance/claims/:id | insuranceClaims.get | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:340` |
| GET /api/insurance/claims/:id/readiness | insuranceClaims.readiness | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:344` |
| POST /api/insurance/claims/:id/validate | insuranceClaims.validate | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:348` |
| POST /api/insurance/claims/:claimId/dha/mock-submit | dhaClaimSubmission.mockSubmitClaim | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:357` |
| POST /api/insurance/claims/:claimId/dha/mock-preview | dhaClaimPreview.mockPreviewClaim | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:374` |
| POST /api/insurance/claims/:claimId/dha/mock-discharge | dhaClaimDischarge.mockDischargeClaim | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:391` |
| POST /api/insurance/claims/:claimId/dha/mock-adjudication | dhaClaimAdjudication.mockAdjudicateClaim | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:422` |
| POST /api/insurance/claims/:claimId/dha/mock-query | dhaClaimQuery.mockCreateQuery | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:447` |
| POST /api/insurance/claims/:claimId/dha/mock-query/:queryId/respond | dhaClaimQuery.mockRespondToQuery | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:477` |
| POST /api/insurance/claims/:claimId/dha/mock-appeal | dhaClaimAppeal.mockCreateAppeal | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:506` |
| POST /api/insurance/claims/:claimId/dha/mock-appeal/:appealId/submit | dhaClaimAppeal.mockSubmitAppeal | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:537` |
| POST /api/insurance/claims/:claimId/dha/mock-remittance-advice | dhaRemittanceAdvice.mockGenerateRemittanceAdvice | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:560` |
| POST /api/insurance/claims/:claimId/dha/mock-remittance-advice/:remittanceAdviceId/allocate | dhaPaymentAllocation.mockAllocatePayment | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:588` |
| POST /api/insurance/claims/:claimId/dha/mock-remittance-advice/:remittanceAdviceId/reconcile | dhaPaymentReconciliation.mockReconcilePayment | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:622` |
| GET /api/insurance/claims/:claimId/dha/mock-remittance-advice/:remittanceAdviceId/reconciliations | dhaPaymentReconciliation.getReconciliations | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:645` |
| GET /api/insurance/claims/:claimId/dha/closure-readiness | dhaClaimClosure.evaluateClosureReadiness | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:674` |
| POST /api/insurance/claims/:claimId/dha/mock-close | dhaClaimClosure.mockCloseClaim | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:688` |
| GET /api/insurance/claims/:claimId/dha/closures | dhaClaimClosure.getClosures | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:710` |
| GET /api/insurance/reports/claim-lifecycle | dhaClaimReporting.getClaimLifecycleSummary | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:725` |
| GET /api/insurance/reports/remittance-reconciliation | dhaClaimReporting.getRemittanceReconciliationSummary | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:739` |
| GET /api/insurance/reports/outstanding-work | dhaClaimReporting.getOutstandingWorkSummary | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:753` |
| GET /api/insurance/claims/:claimId/dha/history | dhaClaimReporting.getClaimAuditHistory | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:767` |
| GET /api/insurance/encounters/:encounterId/context | insuranceIntegration.context | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:784` |
| POST /api/insurance/encounters/:encounterId/services/:serviceId/coverage | insuranceIntegration.coverage | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:789` |
| POST /api/insurance/sha-service-mappings | insuranceIntegration.createMapping | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:794` |
| GET /api/insurance/sha-service-mappings | insuranceIntegration.listMappings | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:797` |
| POST /api/insurance/sha-service-mappings/:id/deactivate | insuranceIntegration.deactivateMapping | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:800` |
| POST /api/insurance/dha/patients/:patientId/verify | dhaPatientRegistry.verifyPatient | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:809` |
| GET /api/insurance/dha/patients/:patientId/sub-benefits | dhaSubBenefits.getSubBenefits | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:824` |
| GET /api/insurance/dha/patients/:patientId/interventions | dhaInterventionCoverage.getInterventions | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:844` |
| GET /api/insurance/dha/authorizations/:authorizationId/readiness | dhaPreauthorizationReadiness.getReadiness | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:884` |
| POST /api/insurance/dha/authorizations/:authorizationId/consent | dhaPreauthorization.processConsent | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:911` |
| POST /api/insurance/dha/authorizations/:authorizationId/submit | dhaPreauthorization.submitPreauthorization | Inline/custom validation; inspect source | `apps/api/src/modules/insurance/insurance.routes.ts:939` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### CoverageCheckResult

`apps/api/src/modules/insurance/insurance.types.ts:138`

| Field | Observed type |
| --- | --- |
| valid | boolean |
| reasonCode | CoverageCheckReasonCode |
| shaEligibilityStatus | ShaEligibilityStatus |
| memberId? | string |
| policyId? | string |
| patientId? | string |
| payerId? | string |
| schemeId? | string |
| memberNumber? | string |
| policyNumber? | string |
| payerCode? | string |
| schemeCode? | string |
| message | string |
| checkedAt | string |
| details? | Record<string, unknown> |

### EligibilityVerificationResult

`apps/api/src/modules/insurance/insurance.types.ts:174`

| Field | Observed type |
| --- | --- |
| id | string |
| memberId | string |
| patientId | string |
| policyId | string |
| payerId | string |
| schemeId? | string \| null |
| memberNumber | string |
| policyNumber | string |
| payerCode | string |
| schemeCode? | string \| null |
| requestedDate | string |
| correlationId | string |
| externalReferenceId? | string \| null |
| status | EligibilityStatus |
| reasonCode | string |
| message | string |
| errorMessage? | string \| null |
| details? | Record<string, unknown> |
| requestTimestamp | string |
| responseTimestamp? | string \| null |
| createdAt | string |

### BenefitLimit

`apps/api/src/modules/insurance/insurance.types.ts:210`

| Field | Observed type |
| --- | --- |
| maxAmount? | number \| null |
| maxQuantity? | number \| null |
| frequency? | string \| null |

### VerifyBenefitResult

`apps/api/src/modules/insurance/insurance.types.ts:268`

| Field | Observed type |
| --- | --- |
| eligible | boolean |
| benefitStatus | CoverageRule |
| memberId | string |
| serviceId? | string |
| serviceCode? | string |
| serviceName? | string |
| benefitId? | string |
| coverageLimit? | BenefitLimit \| null |
| configuredPatientResponsibility? | ConfiguredPatientResponsibility \| null |
| financialTermsBasis? | 'CONFIGURED_ONLY' |
| patientResponsibility? | ConfiguredPatientResponsibility \| null |
| reasonCode | string |
| message | string |
| authorizationRequired | boolean |
| verifiedAt | string |

### CreatePayerInput

`apps/api/src/modules/insurance/insurance.types.ts:15`

| Field | Observed type |
| --- | --- |
| payerCode | string |
| name | string |
| type? | PayerType |
| status? | PayerStatus |
| branchId? | string \| null |
| effectiveFrom? | string \| null |
| effectiveTo? | string \| null |
| email? | string \| null |
| phone? | string \| null |
| address? | string \| null |
| website? | string \| null |

### CreateSchemeInput

`apps/api/src/modules/insurance/insurance.types.ts:43`

| Field | Observed type |
| --- | --- |
| payerId | string |
| schemeCode | string |
| name | string |
| planType? | string \| null |
| networkType? | string \| null |
| effectiveFrom? | string \| null |
| effectiveTo? | string \| null |
| status? | SchemeStatus |
| branchId? | string \| null |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| MockAdjudicationStatus | \| 'MOCK_PENDING' \| 'MOCK_APPROVED' \| 'MOCK_PARTIALLY_APPROVED' \| 'MOCK_REJECTED' \| 'MOCK_QUERY' | `apps/api/src/modules/insurance/dha/dha-claim-adjudication.model.ts:3` |
| MockClaimAppealStatus | \| 'OPEN' \| 'SUBMITTED' \| 'MOCK_UPHELD' \| 'MOCK_OVERTURNED' | `apps/api/src/modules/insurance/dha/dha-claim-appeal.model.ts:3` |
| MockClaimClosureStatus | \| 'MOCK_CLOSED_RECONCILED' \| 'MOCK_CLOSED_NO_SETTLEMENT' | `apps/api/src/modules/insurance/dha/dha-claim-closure.model.ts:3` |
| MockClaimQueryStatus | 'OPEN' \| 'RESPONSE_SUBMITTED' \| 'MOCK_RESOLVED' | `apps/api/src/modules/insurance/dha/dha-claim-query.model.ts:3` |
| MockPaymentAllocationStatus | 'MOCK_ALLOCATED' | `apps/api/src/modules/insurance/dha/dha-payment-allocation.model.ts:3` |
| MockPaymentReconciliationStatus | \| 'MOCK_RECONCILED' \| 'MOCK_PARTIALLY_RECONCILED' \| 'MOCK_DISCREPANCY' | `apps/api/src/modules/insurance/dha/dha-payment-reconciliation.model.ts:3` |
| MockRemittanceStatus | 'MOCK_REMITTED' | `apps/api/src/modules/insurance/dha/dha-remittance-advice.model.ts:3` |
| transitions (observed transition map) | DRAFT: ['SUBMITTED', 'CANCELLED'], SUBMITTED: ['PENDING', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'FAILED'], FAILED: ['SUBMITTED', 'CANCELLED'], PENDING: [], APPROVED: [], PARTIALLY_APPROVED: [], REJECTED: [], EXPIRED: [], CANCELLED: [], | `apps/api/src/modules/insurance/insurance-authorization.service.ts:11` |
| PayerStatus | 'ACTIVE' \| 'INACTIVE' | `apps/api/src/modules/insurance/insurance.types.ts:2` |
| SchemeStatus | 'ACTIVE' \| 'INACTIVE' | `apps/api/src/modules/insurance/insurance.types.ts:3` |
| PolicyStatus | 'ACTIVE' \| 'INACTIVE' \| 'EXPIRED' \| 'SUSPENDED' | `apps/api/src/modules/insurance/insurance.types.ts:4` |
| MemberStatus | 'ACTIVE' \| 'INACTIVE' \| 'SUSPENDED' | `apps/api/src/modules/insurance/insurance.types.ts:5` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Patient Management; Billing; Service Catalog; Branch Management; Consent Management.

Observed backend import domains: `auth`, `billing`, `branches`, `doctors`, `insurance-authorization.repository.js';
import {
  DhaMockClaimAdjudicationModel,
  type MockAdjudicationStatus,
} from '.`, `insurance-authorization.repository.js';
import { DhaMockClaimAdjudicationModel } from '.`, `insurance-authorization.repository.js';
import { DhaMockClaimDischargeModel } from '.`, `insurance-authorization.repository.js';
import { DhaMockClaimSubmissionModel } from '.`, `insurance-authorization.repository.js';
import { DhaPreauthorizationReadinessService } from '.`, `insurance-authorization.repository.js';
import { InsuranceRepository } from '..`, `insurance-claim.model.js';
import { AuditLogModel } from '..`, `insurance-claim.repository.js';
import { InsuranceAuthorizationRepository } from '..`, `insurance-claim.repository.js';
import { InsuranceClaimService } from '..`, `insurance-claim.repository.js';
import { InsuranceClaimService, externalReadinessCodes } from '..`, `insurance-claim.service.js';

export interface DhaClaimPreviewLine {
  serviceId: string;
  serviceCode?: string;
  quantity: number;
  claimedAmount: number;
  interventionCode?: string;
}

export interface DhaClaimPreviewIssue {
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message?: string;
  invoiceItemId?: string;
}

export interface DhaClaimPreviewRequest {
  claimId: string;
  mockSubmissionReference: string;
  sourceFingerprint: string;
  version: number;
  correlationId: string;
  claimedTotal: number;
  lineCount: number;
  lines: DhaClaimPreviewLine[];
  issues: DhaClaimPreviewIssue[];
}

export interface DhaClaimPreviewResult {
  source: 'MOCK' | 'REAL';
  claimId: string;
  mockSubmissionReference: string;
  status: 'PREVIEW_AVAILABLE' | 'PREVIEW_BLOCKED';
  lineCount: number;
  claimedTotal: number;
  issues: DhaClaimPreviewIssue[];
  correlationId: string;
  previewedAt: Date;
}

export interface DhaClaimPreviewAdapter {
  readonly mode: 'MOCK' | 'REAL';
  previewClaim(request: DhaClaimPreviewRequest): Promise<DhaClaimPreviewResult>;
}

`, `insurance.model.js';

export type DhaPreauthReadinessCheck = {
  code: string;
  name: string;
  passed: boolean;
  message?: string;
};

export type DhaConsentReadiness =
  | 'NOT_REQUIRED'
  | 'REQUIRED'
  | 'READY'
  | 'NOT_READY'
  | 'CONTRACT_UNCONFIRMED';

export type DhaPreauthReadinessResult = {
  ready: boolean;
  authorizationId: string;
  patientId: string;
  clientRegistryId?: string | null;
  interventionCode?: string | null;
  needsPreauth?: boolean | null;
  consentReadiness: DhaConsentReadiness;
  checks: DhaPreauthReadinessCheck[];
  reasonCodes: string[];
};

export type DhaPreauthReadinessOptions = {
  subBenefitCode?: string;
  interventionCode?: string;
  needsPreauth?: boolean;
  contractConfirmed?: boolean;
  actorUserId?: string;
  correlationId?: string;
};

export class DhaPreauthorizationReadinessService {
  constructor(
    private readonly authorizationRepository: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    private readonly patientRepository: PatientRepository = new PatientRepository(),
    private readonly insuranceRepository: InsuranceRepository = new InsuranceRepository(),
    private readonly insuranceService: InsuranceService = new InsuranceService(new InsuranceRepository()),
    private readonly integrationRepository: InsuranceIntegrationRepository = new InsuranceIntegrationRepository(),
    private readonly interventionCoverageService: DhaInterventionCoverageService = new DhaInterventionCoverageService(),
  ) {}

  `, `insurance.service.js';
import { InsuranceIntegrationRepository } from '..`, `insurance.types.js';

export interface DhaMockClaimAdjudicationResponse {
  success: boolean;
  source: 'MOCK';
  claimId: string;
  mockDischargeReference: string;
  externalAdjudicationReference: string;
  status: MockAdjudicationStatus;
  claimedTotal: number;
  adjudicatedTotal: number;
  lines: DhaClaimAdjudicationLineResult[];
  idempotent: boolean;
  adjudicatedAt: Date;
  correlationId: string;
}

export class DhaClaimAdjudicationService {
  private adapter?: DhaClaimAdjudicationAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimAdjudicationAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimAdjudicationAdapter {
    return this.adapter ?? createDhaClaimAdjudicationAdapter();
  }

  `, `insurance.types.js';

export interface DhaMockClaimAppealCreateResponse {
  success: boolean;
  source: 'MOCK';
  appealId: string;
  claimId: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  externalAppealReference: string;
  appealReason: string;
  status: MockClaimAppealStatus;
  submissions: Array<{
    submissionReference: string;
    appealNote: string;
    documentIds?: string[];
    submittedAt: Date;
    simulatedOutcome: MockClaimAppealStatus;
    decisionReason?: string;
  }>;
  idempotent: boolean;
  createdAt: Date;
  correlationId: string;
}

export interface DhaMockClaimAppealSubmitResponse {
  success: boolean;
  source: 'MOCK';
  appealId: string;
  claimId: string;
  externalAppealReference: string;
  submissionReference: string;
  status: MockClaimAppealStatus;
  submissions: Array<{
    submissionReference: string;
    appealNote: string;
    documentIds?: string[];
    submittedAt: Date;
    simulatedOutcome: MockClaimAppealStatus;
    decisionReason?: string;
  }>;
  idempotent: boolean;
  submittedAt: Date;
  correlationId: string;
}

export class DhaClaimAppealService {
  private adapter?: DhaClaimAppealAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimAppealAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimAppealAdapter {
    return this.adapter ?? createDhaClaimAppealAdapter();
  }

  `, `insurance.types.js';

export interface DhaMockClaimClosureInput {
  reason?: string;
  idempotencyKey?: string;
}

export interface DhaClaimClosureReadinessResult {
  claimId: string;
  ready: boolean;
  closurePath: MockClaimClosurePath | 'NOT_ELIGIBLE';
  blockers: string[];
  reasons: string[];
  sourceFingerprint: string;
  summary: {
    hasDischarge: boolean;
    adjudicationStatus?: string;
    openQueriesCount: number;
    hasOpenAppeal: boolean;
    appealStatus?: string;
    hasRemittanceAdvice: boolean;
    reconciliationStatus?: string;
  };
}

export interface DhaMockClaimClosureResponse {
  success: boolean;
  source: 'MOCK';
  closureId: string;
  claimId: string;
  externalClosureReference: string;
  status: MockClaimClosureStatus;
  closurePath: MockClaimClosurePath;
  closureReason: string;
  claimedTotal: number;
  remittedTotal: number;
  allocatedTotal: number;
  reconciledTotal: number;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  mockAppealReference?: string | null;
  mockRemittanceReference?: string | null;
  mockReconciliationReference?: string | null;
  closureSnapshotFingerprint: string;
  idempotent: boolean;
  closedAt: Date;
  correlationId: string;
}

export class DhaClaimClosureService {
  private adapter?: DhaClaimClosureAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimClosureAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimClosureAdapter {
    return this.adapter ?? createDhaClaimClosureAdapter();
  }

  `, `insurance.types.js';

export interface DhaMockClaimDischargeResponse {
  success: boolean;
  source: 'MOCK';
  claimId: string;
  mockSubmissionReference: string;
  externalDischargeReference: string;
  status: 'MOCK_DISCHARGED';
  claimedTotal: number;
  lineCount: number;
  idempotent: boolean;
  dischargedAt: Date;
  correlationId: string;
}

export class DhaClaimDischargeService {
  private adapter?: DhaClaimDischargeAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimDischargeAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimDischargeAdapter {
    return this.adapter ?? createDhaClaimDischargeAdapter();
  }

  `, `insurance.types.js';

export interface DhaMockClaimPreviewResponse {
  success: boolean;
  source: 'MOCK';
  claimId: string;
  mockSubmissionReference: string;
  status: 'PREVIEW_AVAILABLE' | 'PREVIEW_BLOCKED';
  lineCount: number;
  claimedTotal: number;
  issues: Array<{
    code: string;
    severity: 'ERROR' | 'WARNING' | 'INFO';
    message?: string;
    invoiceItemId?: string;
  }>;
  idempotent: boolean;
  previewedAt: Date;
  correlationId: string;
}

export class DhaClaimPreviewService {
  private adapter?: DhaClaimPreviewAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimPreviewAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimPreviewAdapter {
    return this.adapter ?? createDhaClaimPreviewAdapter();
  }

  `, `insurance.types.js';

export interface DhaMockClaimQueryCreateResponse {
  success: boolean;
  source: 'MOCK';
  queryId: string;
  claimId: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  externalQueryReference: string;
  queryReason: string;
  status: MockClaimQueryStatus;
  responses: Array<{
    responseReference: string;
    responseNote: string;
    documentIds?: string[];
    respondedAt: Date;
    simulatedOutcome: 'RESPONSE_SUBMITTED' | 'MOCK_RESOLVED';
  }>;
  idempotent: boolean;
  createdAt: Date;
  correlationId: string;
}

export interface DhaMockClaimQueryRespondResponse {
  success: boolean;
  source: 'MOCK';
  queryId: string;
  claimId: string;
  externalQueryReference: string;
  responseReference: string;
  status: MockClaimQueryStatus;
  responses: Array<{
    responseReference: string;
    responseNote: string;
    documentIds?: string[];
    respondedAt: Date;
    simulatedOutcome: 'RESPONSE_SUBMITTED' | 'MOCK_RESOLVED';
  }>;
  idempotent: boolean;
  respondedAt: Date;
  correlationId: string;
}

export class DhaClaimQueryService {
  private adapter?: DhaClaimQueryAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimQueryAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimQueryAdapter {
    return this.adapter ?? createDhaClaimQueryAdapter();
  }

  `, `insurance.types.js';

export interface DhaMockClaimSubmissionResult {
  success: boolean;
  claimId: string;
  externalReference: string;
  source: 'MOCK';
  status: 'SUBMITTED';
  claimedTotal: number;
  idempotent: boolean;
  submittedAt: Date;
}

export class DhaClaimSubmissionService {
  private adapter?: DhaClaimSubmissionAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaClaimSubmissionAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaClaimSubmissionAdapter {
    return this.adapter ?? createDhaClaimSubmissionAdapter();
  }

  `, `insurance.types.js';

export interface DhaMockPaymentAllocationInput {
  amount: number;
  currency?: string;
  idempotencyKey?: string;
}

export interface DhaMockPaymentAllocationResponse {
  success: boolean;
  source: 'MOCK';
  allocationId: string;
  claimId: string;
  remittanceAdviceId: string;
  externalRemittanceReference: string;
  externalAllocationReference: string;
  status: MockPaymentAllocationStatus;
  currency: string;
  allocatedAmount: number;
  previouslyAllocatedTotal: number;
  newlyAllocatedTotal: number;
  remainingAllocatableAmount: number;
  idempotent: boolean;
  allocatedAt: Date;
  correlationId: string;
}

export class DhaPaymentAllocationService {
  private adapter?: DhaPaymentAllocationAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaPaymentAllocationAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaPaymentAllocationAdapter {
    return this.adapter ?? createDhaPaymentAllocationAdapter();
  }

  `, `insurance.types.js';

export interface DhaMockPaymentReconciliationInput {
  idempotencyKey?: string;
}

export interface DhaMockPaymentReconciliationResponse {
  success: boolean;
  source: 'MOCK';
  reconciliationId: string;
  claimId: string;
  remittanceAdviceId: string;
  externalRemittanceReference: string;
  externalReconciliationReference: string;
  status: MockPaymentReconciliationStatus;
  currency: string;
  remittedTotal: number;
  allocatedTotal: number;
  unallocatedAmount: number;
  allocationDifference: number;
  allocationCount: number;
  allocationIds: string[];
  discrepancyReasons?: string[];
  snapshotFingerprint: string;
  idempotent: boolean;
  reconciledAt: Date;
  correlationId: string;
}

export class DhaPaymentReconciliationService {
  private adapter?: DhaPaymentReconciliationAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaPaymentReconciliationAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaPaymentReconciliationAdapter {
    return this.adapter ?? createDhaPaymentReconciliationAdapter();
  }

  `, `insurance.types.js';

export interface DhaMockRemittanceAdviceResponse {
  success: boolean;
  source: 'MOCK';
  remittanceAdviceId: string;
  claimId: string;
  externalRemittanceReference: string;
  mockDischargeReference: string;
  mockAdjudicationReference: string;
  mockAppealReference?: string;
  status: MockRemittanceStatus;
  payableBasis: MockRemittancePayableBasis;
  claimedTotal: number;
  remittedTotal: number;
  disallowedTotal: number;
  currency: string;
  lines: Array<{
    invoiceItemId: string;
    serviceId: string;
    serviceCode?: string;
    quantity: number;
    claimedAmount: number;
    remittedAmount: number;
    disallowedAmount: number;
    status: 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED';
    denialReason?: string;
  }>;
  idempotent: boolean;
  remittedAt: Date;
  correlationId: string;
}

export class DhaRemittanceAdviceService {
  private adapter?: DhaRemittanceAdviceAdapter;

  constructor(
    private readonly claimRepository: InsuranceClaimRepository = new InsuranceClaimRepository(),
    private readonly claimService: InsuranceClaimService,
    private readonly access: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    adapter?: DhaRemittanceAdviceAdapter,
  ) {
    this.adapter = adapter;
  }

  private getAdapter(): DhaRemittanceAdviceAdapter {
    return this.adapter ?? createDhaRemittanceAdviceAdapter();
  }

  `, `insurance.types.js';

export interface DhaPreauthSubmissionResult {
  success: boolean;
  authorizationId: string;
  status: string;
  externalReference: string;
  approvedAmount?: number;
  denialReason?: string;
  decisionDate: Date;
  reasonCode?: string;
  source: 'MOCK' | 'REAL';
  lines: DhaPreauthDecisionLine[];
  idempotent?: boolean;
}

export const createDhaConsentAdapter = (envConfig = env.dha): DhaConsentAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaConsentAdapter(envConfig.mockConsentMode);
  }
  return new UnavailableDhaConsentAdapter();
};

export const createDhaPreauthorizationAdapter = (
  envConfig = env.dha,
): DhaPreauthorizationAdapter => {
  if (envConfig.integrationMode === 'MOCK') {
    return new MockDhaPreauthorizationAdapter(envConfig.mockPreauthDecision);
  }
  return new UnavailableDhaPreauthorizationAdapter();
};

export class DhaPreauthorizationService {
  private consentAdapter?: DhaConsentAdapter;
  private preauthAdapter?: DhaPreauthorizationAdapter;

  constructor(
    private readonly authorizationRepository: InsuranceAuthorizationRepository = new InsuranceAuthorizationRepository(),
    private readonly readinessService: DhaPreauthorizationReadinessService = new DhaPreauthorizationReadinessService(),
    consentAdapter?: DhaConsentAdapter,
    preauthAdapter?: DhaPreauthorizationAdapter,
  ) {
    this.consentAdapter = consentAdapter;
    this.preauthAdapter = preauthAdapter;
  }

  private getConsentAdapter(): DhaConsentAdapter {
    return this.consentAdapter ?? createDhaConsentAdapter();
  }

  private getPreauthAdapter(): DhaPreauthorizationAdapter {
    return this.preauthAdapter ?? createDhaPreauthorizationAdapter();
  }

  `, `opd`, `patients`, `roles`, `services`, `sha-eligibility.adapter.js';
import { DhaHttpClient } from '.`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts:396` — const result = await session.withTransaction(async () => {
- `apps/api/src/modules/insurance/dha/dha-payment-allocation.service.ts:202` — const result = await session.withTransaction(async () => {
- `apps/api/src/modules/insurance/dha/dha-payment-reconciliation.service.ts:234` — const result = await session.withTransaction(async () => {

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-INS-001 | FR-INS-001 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Evaluate patient coverage through the existing coverage operation. |
| AC-INS-002 | FR-INS-002 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Validate claim data before progressing the workflow. |
| AC-INS-003 | FR-INS-003 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Prepare an insurance claim using the current service contract. |
| AC-INS-004 | FR-INS-004 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Request preauthorization through the current integration boundary. |
| AC-INS-005 | FR-INS-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Expose the current integration readiness result. |
| AC-INS-006 | FR-INS-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Provide a mock claim-submission operation explicitly labelled mock. |
| AC-INS-007 | FR-INS-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Provide mock adjudication without treating it as a live payer decision. |
| AC-INS-008 | FR-INS-008 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Summarize claim lifecycle and outstanding work for authorized users. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-INS-01: R1 defers full insurance claims; a later approved business scope is needed for the current expanded domain.
- GAP-INS-02: Multiple DHA lifecycle services explicitly use mock methods; production adjudication and remittance are unverified.
- GAP-INS-03: Confirm payer, jurisdiction, benefit limits, patient responsibility and finance rounding policy.
- GAP-INS-04: Design notes and readiness checks do not establish external provider certification or live operation.
- GAP-INS-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Insurance/D05_FINANCE_POLICY_REPOSITORY_RECONCILIATION.md` | 75c5e324939f91493d0edc949db64aa8c3e2a73fdf09778260cc6bc27ad166fc | Historical design evidence |
| `HMS Project/Design/Insurance/HMS_INSURANCE_PHASE4_HOTFIX_GAP_NOTE.md` | cb014f61f0f98d0caa370c3afe73672c147a7fc0c118218e4e814f7060e2d9e2 | Historical design evidence |
| `HMS Project/Design/Insurance/HMS_INSURANCE_PHASE5_GAP_NOTE.md` | d383a3ab0ea67828515a245d1c94c8d2eede07284597cc64f741d52f737f5cb0 | Historical design evidence |
| `HMS Project/Design/Insurance/HMS_INSURANCE_PHASE6_GAP_NOTE.md` | fab780e6f120fa14b49e93ec4c70a4c60831b219484e372af14c9e4b698155f2 | Historical design evidence |
| `HMS Project/Design/Insurance/HMS_INSURANCE_PHASE7_GAP_NOTE.md` | df5544ed84f8c2031407f0986345999fd3a08604bc4cc697af228e3cd9b55b1d | Historical design evidence |
| `HMS Project/Design/Insurance/HMS_INSURANCE_PHASE8_GAP_NOTE.md` | 6c8d6d201279e56bc0701e7159f7a509106ddae7a0c07c9e1bddcfca435150e9 | Historical design evidence |
| `HMS Project/Design/Insurance/HMS_INSURANCE_TWO_DEVELOPER_PHASE_WISE_EXECUTION_PLAN.md` | f88f43048cdb29dd3fabd906226474697109d46c03dabd192a307adf5420cfca | Historical design evidence |
| `HMS Project/Design/Insurance/INSURANCE_V1_PHASE0_FIELD_AND_API_CONTRACT_DRAFT.md` | 0d6ebfc400b4cd2282077d4eb65a45518fde62edc53973ea610a1db1294ab9ef | Historical design evidence |
| `HMS Project/Design/Insurance/INSURANCE_V1_PHASE1A_IMPLEMENTATION_CONTRACT.md` | 84ee1d7891b073b4e5237eee0cd37da57b4481548dfc4be9629f4471431dfffc | Historical design evidence |
| `HMS Project/Design/Insurance/PHASE_0_GAP_AND_DECISION_NOTE.md` | a0f792f97e00c6efc7ee54528fd25c0f9657d0036e9dbe56ea7bd1096cddd8b6 | Historical design evidence |
| `HMS Project/Design/Insurance/PHASE_0_VERIFICATION.md` | 2b0419a2877bbc708de91ea07f5e8b38d44d29b1a87d59d399571cb6167aa9b5 | Historical design evidence |
| `HMS Project/Design/Insurance/PHASE_1A_SLICE_1_GAP_NOTE.md` | e97ee7ab3ab0b6be6c53bd77dc324c17495b863b75482bb610429ccdb58054d7 | Historical design evidence |
| `HMS Project/Design/Insurance/PHASE_1A_SLICE_2_GAP_NOTE.md` | 2af44c04fd4976a78a583a76da3255b572b454d54bf102fb6a301668db59e949 | Historical design evidence |
| `HMS Project/Design/Insurance/PHASE_1A_SLICE_3_GAP_NOTE.md` | a5386dfa3814081e432fee7ee2096f9369941fd1742bb997df531e95ae84068e | Historical design evidence |
| `HMS Project/Design/Insurance/PHASE_1A_SLICE_4_GAP_NOTE.md` | 3c4ac385f70f87453e8eb90c41806d2464b8b93f138631f27c6a98f676191fd9 | Historical design evidence |
| `HMS Project/Design/Insurance/workflow.txt` | d44cc21eca763b2c9165807d5c874ac4d7e85b5f3c25ea6cb5108b6f5b5ecf05 | Historical design evidence |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts` | e2e1753f5e3df039852ca5ebc9d6fc27ad6c7a2bf7debeac1ac8dd0b6236edc6 | Current implementation or project rule |
| `apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts` | 8ad6b8b0d0b3a2f3918ac629785edbc4926db68caedaf9ad7d049ee7689e17b2 | Current implementation or project rule |
| `apps/api/src/modules/insurance/dha/dha-claim-submission.service.ts` | e07e1f57b8c773d5a2dbcca38bc07c92c568e0b29d9a02259c83118bc0db0a29 | Current implementation or project rule |
| `apps/api/src/modules/insurance/dha/dha-preauthorization-readiness.service.ts` | 2318b2b98e5f92f2f08272a13c0fd7ac5f1ba70e39ba0d0b2a6c92129d172b2d | Current implementation or project rule |
| `apps/api/src/modules/insurance/insurance-authorization.service.ts` | 0e31902b5faf11b30b55ba2de63e7dd238de2a562005c44a00331ecfc824fd3f | Current implementation or project rule |
| `apps/api/src/modules/insurance/insurance-claim.service.ts` | 22e85ac8c5035343c242768bc1660411faa2192831969d5935449143742e8ff7 | Current implementation or project rule |
| `apps/api/src/modules/insurance/insurance-integration.service.ts` | 9d4262434faf4982aea71456268b436ab466d898a10370af285eefda90f6de27 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/insurance/dha/dha-auth.service.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-adjudication.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-adjudication.model.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-adjudication.service.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-appeal.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-appeal.model.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-appeal.service.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-closure.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-closure.model.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-closure.service.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-discharge.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-discharge.model.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-discharge.service.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-preview.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-preview.model.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-preview.service.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-query.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-query.model.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-query.service.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-reporting.schemas.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-reporting.service.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-submission.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-submission.model.ts`
- `apps/api/src/modules/insurance/dha/dha-claim-submission.service.ts`
- `apps/api/src/modules/insurance/dha/dha-consent.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-eligibility.service.ts`
- `apps/api/src/modules/insurance/dha/dha-http.client.ts`
- `apps/api/src/modules/insurance/dha/dha-intervention-coverage.service.ts`
- `apps/api/src/modules/insurance/dha/dha-patient-registry.service.ts`
- `apps/api/src/modules/insurance/dha/dha-payment-allocation.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-payment-allocation.model.ts`
- `apps/api/src/modules/insurance/dha/dha-payment-allocation.service.ts`
- `apps/api/src/modules/insurance/dha/dha-payment-reconciliation.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-payment-reconciliation.model.ts`
- `apps/api/src/modules/insurance/dha/dha-payment-reconciliation.service.ts`
- `apps/api/src/modules/insurance/dha/dha-preauthorization-readiness.service.ts`
- `apps/api/src/modules/insurance/dha/dha-preauthorization.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-preauthorization.service.ts`
- `apps/api/src/modules/insurance/dha/dha-remittance-advice.adapter.ts`
- `apps/api/src/modules/insurance/dha/dha-remittance-advice.model.ts`
- `apps/api/src/modules/insurance/dha/dha-remittance-advice.service.ts`
- `apps/api/src/modules/insurance/dha/dha-sub-benefits.service.ts`
- `apps/api/src/modules/insurance/dha/dha.errors.ts`
- `apps/api/src/modules/insurance/dha/dha.types.ts`
- `apps/api/src/modules/insurance/dha/index.ts`
- `apps/api/src/modules/insurance/insurance-authorization.model.ts`
- `apps/api/src/modules/insurance/insurance-authorization.repository.ts`
- `apps/api/src/modules/insurance/insurance-authorization.schemas.ts`
- `apps/api/src/modules/insurance/insurance-authorization.service.ts`
- `apps/api/src/modules/insurance/insurance-claim.model.ts`
- `apps/api/src/modules/insurance/insurance-claim.repository.ts`
- `apps/api/src/modules/insurance/insurance-claim.schemas.ts`
- `apps/api/src/modules/insurance/insurance-claim.service.ts`
- `apps/api/src/modules/insurance/insurance-integration.model.ts`
- `apps/api/src/modules/insurance/insurance-integration.repository.ts`
- `apps/api/src/modules/insurance/insurance-integration.schemas.ts`
- `apps/api/src/modules/insurance/insurance-integration.service.ts`
- `apps/api/src/modules/insurance/insurance.model.ts`
- `apps/api/src/modules/insurance/insurance.repository.ts`
- `apps/api/src/modules/insurance/insurance.routes.ts`
- `apps/api/src/modules/insurance/insurance.schemas.ts`
- `apps/api/src/modules/insurance/insurance.service.ts`
- `apps/api/src/modules/insurance/insurance.types.ts`
- `apps/api/src/modules/insurance/sha-eligibility.adapter.ts`
- `apps/api/src/modules/insurance/sha-preauthorization.adapter.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
