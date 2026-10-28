# Patient Portal Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Patient Portal |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Expose patient and guardian self-service through patient-scoped APIs and explicit access relationships.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Expose patient and guardian self-service through patient-scoped APIs and explicit access relationships. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Patient; guardian with permitted dependent access; staff do not acquire portal identity rights merely from a clinical role.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Patients | Patient Records | Edit |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-PORTAL-001 | Implementation observation — business validation required. Resolve the authenticated account and permitted patient context. | `apps/api/src/modules/patient-portal/patient-portal.service.ts:124` | `apps/api/src/modules/patient-portal/patient-portal.service.ts:124` — context | Implemented |
| FR-PORTAL-002 | Implementation observation — business validation required. Return the current portal overview projection. | `apps/api/src/modules/patient-portal/patient-portal.service.ts:130` | `apps/api/src/modules/patient-portal/patient-portal.service.ts:130` — overview | Implemented |
| FR-PORTAL-003 | Implementation observation — business validation required. List patient-scoped appointments. | `apps/api/src/modules/patient-portal/patient-portal.service.ts:140` | `apps/api/src/modules/patient-portal/patient-portal.service.ts:140` — listAppointments | Implemented |
| FR-PORTAL-004 | Implementation observation — business validation required. Check eligibility before patient rescheduling. | `apps/api/src/modules/patient-portal/patient-portal.service.ts:154` | `apps/api/src/modules/patient-portal/patient-portal.service.ts:154` — rescheduleEligibility | Implemented |
| FR-PORTAL-005 | Implementation observation — business validation required. Book using the existing portal service boundary. | `apps/api/src/modules/patient-portal/patient-portal.service.ts:425` | `apps/api/src/modules/patient-portal/patient-portal.service.ts:425` — bookAppointment | Implemented |
| FR-PORTAL-006 | Implementation observation — business validation required. Require the existing activation and guardian handling for minors. | `apps/api/src/modules/patient-portal/patient-portal.service.ts:294` | `apps/api/src/modules/patient-portal/patient-portal.service.ts:294` — activateGuardianForMinor | Implemented |
| FR-PORTAL-007 | Implementation observation — business validation required. Link dependents through the present access flow, pending business validation of identity proof. | `apps/api/src/modules/patient-portal/patient-portal.service.ts:380` | `apps/api/src/modules/patient-portal/patient-portal.service.ts:380` — linkExistingDependent | Implemented |
| FR-PORTAL-008 | Implementation observation — business validation required. Authorize portal document download for the selected patient. | `apps/api/src/modules/patient-portal/patient-portal.service.ts:202` | `apps/api/src/modules/patient-portal/patient-portal.service.ts:202` — downloadDocument | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Request and verify the supported login or activation challenge.
2. Resolve the authenticated portal account.
3. Select only a patient permitted by the account context.
4. Read the allowed overview, appointment and document projections.
5. Book or reschedule using server-side eligibility.
6. Upload or download authorized documents.
7. End the session or update approved profile fields through the correct boundary.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| VALIDATION_ERROR — Enter a valid mobile number. | 400 | `apps/api/src/modules/patient-portal/patient-otp.service.ts:26` |
| AUTH_RATE_LIMITED — Too many authentication requests. Try again later. | 429 | `apps/api/src/modules/patient-portal/patient-otp.service.ts:74` |
| INVALID_REGISTRATION_TOKEN — The registration session is invalid or has expired. Please verify your mobile number again. | 401 | `apps/api/src/modules/patient-portal/patient-otp.service.ts:159` |
| MAX_ATTEMPTS_EXCEEDED — Too many failed verification attempts. Please request a new code. | 429 | `apps/api/src/modules/patient-portal/patient-otp.service.ts:174` |
| INVALID_OTP — The verification code is invalid or has expired | 401 | `apps/api/src/modules/patient-portal/patient-otp.service.ts:247` |
| PATIENT_PORTAL_ACCOUNT_REQUIRED — A patient or guardian portal account is required | 403 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:126` |
| PATIENT_PORTAL_PROFILE_REQUIRED — No accessible patient record was found | 404 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:133` |
| PATIENT_NOT_FOUND — Linked patient record not found | 404 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:136` |
| PATIENT_ACCESS_DENIED — You do not have access to this patient record | 403 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:148` |
| INVOICE_NOT_FOUND — Invoice not found for this patient | 404 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:181` |
| EXISTING_PATIENT_REQUIRES_ACTIVATION — An existing patient record uses this email or mobile number. Ask hospital staff to activate portal access for that record. | 409 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:210` |
| GUARDIAN_CONSENT_REQUIRED — Legal guardian confirmation and consent are required | 400 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:217` |
| DUPLICATE_PATIENT — A possible existing patient record was found. Hospital staff must verify and link that patient. | 409 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:236` |
| PATIENT_IDENTITY_NOT_MATCHED — MRN, registered mobile number and date of birth do not match an active patient record | 404 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:245` |
| MINOR_GUARDIAN_REQUIRED — A minor patient must be linked through a parent or guardian account | 409 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:248` |
| EMAIL_REQUIRED — An email address is required to create portal access | 400 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:252` |
| PATIENT_AUTOMATIC_LINK_NOT_AVAILABLE — This patient record could not be linked automatically. Contact hospital reception for identity verification. | 409 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:274` |
| GUARDIAN_ACTIVATION_NOT_AVAILABLE — This mobile number cannot be activated as a new guardian account. Contact hospital reception. | 409 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:297` |
| PATIENT_PROFILE_EXISTS — Your own patient profile is already linked to this account | 409 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:325` |
| GUARDIAN_DETAILS_REQUIRED — Parent or guardian full name is required for patients under 15. | 400 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:327` |
| INTERNAL_SERVER_ERROR — Failed to complete patient profile | 500 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:354` |
| GUARDIAN_ACCOUNT_REQUIRED — A guardian account is required to add a dependent | 403 | `apps/api/src/modules/patient-portal/patient-portal.service.ts:363` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/patient-portal/patient-portal.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/patient-web/src/pages/PatientLoginPage.tsx` | useAuth, useAppLocation, useState, useEffect |
| `apps/patient-web/src/pages/PatientPortalPage.tsx` | useAuth, usePatientPortal |
| `apps/patient-web/src/pages/PatientSignupPage.tsx` | useAuth, useAppLocation, useMemo, useState, useQuery, useEffect |
| `apps/patient-web/src/pages/PatientWebsitePage.test.tsx` | See component composition; no named hook call extracted. |
| `apps/patient-web/src/pages/PatientWebsitePage.tsx` | useHospitalCatalogue |
| `apps/patient-web/src/components/patient-portal/Empty.tsx` | See component composition; no named hook call extracted. |
| `apps/patient-web/src/components/patient-portal/Pagination.tsx` | See component composition; no named hook call extracted. |
| `apps/patient-web/src/components/patient-portal/PortalAppointmentBooking.tsx` | useQueryClient, useRef, useEffect, useQuery, useMutation |
| `apps/patient-web/src/components/patient-portal/PortalAppointmentRescheduling.tsx` | useQueryClient, useQuery, useEffect, useMutation |
| `apps/patient-web/src/components/patient-portal/PortalAppointmentsTab.tsx` | See component composition; no named hook call extracted. |
| `apps/patient-web/src/components/patient-portal/PortalBillingTab.tsx` | See component composition; no named hook call extracted. |
| `apps/patient-web/src/components/patient-portal/PortalDocuments.tsx` | useQueryClient, useState, useQuery |
| `apps/patient-web/src/components/patient-portal/PortalInvoiceDetailModal.tsx` | See component composition; no named hook call extracted. |
| `apps/patient-web/src/components/patient-portal/PortalLinkDependentForm.tsx` | useState |
| `apps/patient-web/src/components/patient-portal/PortalMedicinesTab.tsx` | See component composition; no named hook call extracted. |
| `apps/patient-web/src/components/patient-portal/PortalOverviewTab.tsx` | See component composition; no named hook call extracted. |
| `apps/patient-web/src/components/patient-portal/PortalPatientCardModal.tsx` | See component composition; no named hook call extracted. |
| `apps/patient-web/src/components/patient-portal/PortalPatientForm.tsx` | useState, useQuery |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/patient-portal/public/branches | patientPortal.listPublicBranches | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:229` |
| GET /api/patient-portal/public/departments | patientPortal.listPublicDepartments | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:234` |
| GET /api/patient-portal/public/services | patientPortal.listPublicServices | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:241` |
| GET /api/patient-portal/public/doctors | patientPortal.listPublicDoctors | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:252` |
| GET /api/patient-portal/public/doctors/:id/slots | patientPortal.availableSlots | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:263` |
| POST /api/patient-portal/otp/request | patientPortal.requestOtp | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:268` |
| POST /api/patient-portal/otp/verify | patientPortal.verifyOtp | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:276` |
| POST /api/patient-portal/signup | auth.loginPatientAfterOtpVerification, patientPortal.register, patientPortal.verifyAndConsumeOtp, patientPortal.verifyAndConsumeRegistrationToken | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:289` |
| POST /api/patient-portal/login/otp | auth.loginPatientAfterOtpVerification, patientPortal.activateExistingPatientByPhone, patientPortal.assertOtpValidForPendingFlow, patientPortal.getUnlinkedPatientLoginStatus, patientPortal.verifyAndConsumeOtp | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:335` |
| POST /api/patient-portal/existing-patient/activate | auth.loginPatientAfterOtpVerification, patientPortal.activateExistingPatient, patientPortal.verifyAndConsumeOtp, patientPortal.verifyAndConsumeRegistrationToken | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:386` |
| POST /api/patient-portal/guardian-activation | auth.loginPatientAfterOtpVerification, patientPortal.activateGuardianForMinor, patientPortal.verifyAndConsumeOtp, patientPortal.verifyAndConsumeRegistrationToken | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:412` |
| GET /api/patient-portal/context | patientPortal.context | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:442` |
| GET /api/patient-portal/overview | patientPortal.overview | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:448` |
| GET /api/patient-portal/patients/:patientId/invoices/:invoiceId | patientPortal.invoice | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:457` |
| GET /api/patient-portal/documents | patientPortal.listDocuments | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:470` |
| POST /api/patient-portal/documents/upload | patientPortal.uploadDocument | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:482` |
| GET /api/patient-portal/patients/:patientId/documents/:documentId/download | patientPortal.downloadDocument | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:506` |
| PATCH /api/patient-portal/patients/:patientId | patientPortal.updatePatientProfile | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:511` |
| PATCH /api/patient-portal/patients/:patientId/guardian-profile | patientPortal.updateGuardianProfile | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:529` |
| POST /api/patient-portal/profile | patientPortal.completePatientProfile | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:540` |
| POST /api/patient-portal/dependents | patientPortal.addDependent | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:560` |
| POST /api/patient-portal/dependents/link | patientPortal.linkExistingDependent | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:576` |
| POST /api/patient-portal/appointments | patientPortal.bookAppointment | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:586` |
| GET /api/patient-portal/appointments | patientPortal.listAppointments | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:592` |
| GET /api/patient-portal/appointments/:id/reschedule-eligibility | patientPortal.rescheduleEligibility | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:608` |
| PATCH /api/patient-portal/appointments/:id/reschedule | patientPortal.rescheduleAppointment | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:611` |
| POST /api/patient-portal/accounts | patientPortal.provision | Inline/custom validation; inspect source | `apps/api/src/modules/patient-portal/patient-portal.routes.ts:616` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

No dedicated current-branch entity contract was established. Source-described fields, such as those in section 6, remain requirements to reconcile. Do not invent a schema from screen labels or prototype data.

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

No complete explicit current transition map was established. Inspect the linked service guards or obtain an approved lifecycle before specifying new status actions. A simple active flag or report state must not be expanded into an invented clinical lifecycle.

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Authentication; Patient Management; Appointments; Patient Documents; Billing; Mobile Application.

Observed backend import domains: `appointments`, `auth`, `billing`, `branches`, `departments`, `doctors`, `imaging`, `laboratory`, `opd`, `patients`, `roles`, `services`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

Representative implementation control locations:

- `apps/api/src/modules/patient-portal/patient-portal.service.ts:268` — return executeTransaction(this.repository, callback);

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-PORTAL-001 | FR-PORTAL-001 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Resolve the authenticated account and permitted patient context. |
| AC-PORTAL-002 | FR-PORTAL-002 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Return the current portal overview projection. |
| AC-PORTAL-003 | FR-PORTAL-003 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: List patient-scoped appointments. |
| AC-PORTAL-004 | FR-PORTAL-004 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Check eligibility before patient rescheduling. |
| AC-PORTAL-005 | FR-PORTAL-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Book using the existing portal service boundary. |
| AC-PORTAL-006 | FR-PORTAL-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Require the existing activation and guardian handling for minors. |
| AC-PORTAL-007 | FR-PORTAL-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Link dependents through the present access flow, pending business validation of identity proof. |
| AC-PORTAL-008 | FR-PORTAL-008 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Authorize portal document download for the selected patient. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-PORTAL-01: R1 moves Patient Portal to a later release; a later approved functional baseline was not found among the four original FSD files.
- GAP-PORTAL-02: Confirm identity proof, guardian relationships, revocation, minor age policy and sensitive-data release.
- GAP-PORTAL-03: Generic staff APIs and record ownership are not automatically patient permissions.
- GAP-PORTAL-04: Complete history and portal disclosure cannot be inferred from bounded overview arrays.
- GAP-PORTAL-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Patient Portal/C1-follow-up-audit.md` | 2f328f0fac4bcf60a27d37e39241e05a64aff6784f0584a4951391f836331493 | Historical design evidence |
| `HMS Project/Design/Patient Portal/review.md` | f1ba97df46637d3be7a95a995b4d16817feca7261c2550100e5e895e62d0325c | Historical design evidence |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/patient-portal/patient-portal.service.ts` | 5f80c2877e641af855f0ac9983043cb995ed2bc52b89ccb578c9c18510a4d7ea | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/patient-portal/guardian-profile.model.ts`
- `apps/api/src/modules/patient-portal/otp-challenge.model.ts`
- `apps/api/src/modules/patient-portal/patient-access-grant.model.ts`
- `apps/api/src/modules/patient-portal/patient-otp.repository.ts`
- `apps/api/src/modules/patient-portal/patient-otp.service.ts`
- `apps/api/src/modules/patient-portal/patient-portal.repository.ts`
- `apps/api/src/modules/patient-portal/patient-portal.routes.ts`
- `apps/api/src/modules/patient-portal/patient-portal.schemas.ts`
- `apps/api/src/modules/patient-portal/patient-portal.service.ts`
- `apps/api/src/modules/patient-portal/registration-token.model.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
