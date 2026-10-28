# Authentication Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Authentication |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Establish and revoke authenticated sessions while protecting account and patient login boundaries.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Establish and revoke authenticated sessions while protecting account and patient login boundaries. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Staff user; patient or guardian using portal login; authorized account administrator.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

No module-specific staff permission tuple was established in the inspected current routes. See API boundaries and the unresolved role/authorization decisions; do not invent a default grant.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-AUTH-001 | Documented source requirement; approval unverified. Configurable password policy, session timeout and account lockout on repeated failed attempts. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1146 | `apps/api/src/modules/auth/auth.service.ts:93` — login | Partial |
| FR-AUTH-002 | Documented source requirement; approval unverified. Access limited to permitted tabs/screens/actions per role and branch. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1140 | `apps/api/src/modules/auth/auth.service.ts:306` — authenticateAccessToken | Partial |
| FR-AUTH-003 | Implementation observation — business validation required. Authenticate a staff login and return the existing session representation. | `apps/api/src/modules/auth/auth.service.ts:93` | `apps/api/src/modules/auth/auth.service.ts:93` — login | Implemented |
| FR-AUTH-004 | Implementation observation — business validation required. Validate refresh sessions and reject invalid or disallowed sessions. | `apps/api/src/modules/auth/auth.service.ts:252` | `apps/api/src/modules/auth/auth.service.ts:252` — refresh | Implemented |
| FR-AUTH-005 | Implementation observation — business validation required. Revoke the presented session on logout. | `apps/api/src/modules/auth/auth.service.ts:287` | `apps/api/src/modules/auth/auth.service.ts:287` — logout | Implemented |
| FR-AUTH-006 | Implementation observation — business validation required. Change a password only through the service validation path. | `apps/api/src/modules/auth/auth.service.ts:327` | `apps/api/src/modules/auth/auth.service.ts:327` — changePassword | Implemented |
| FR-AUTH-007 | Implementation observation — business validation required. Apply public authentication rate limits. | `apps/api/src/modules/auth/auth.service.ts:174` | `apps/api/src/modules/auth/auth.service.ts:174` — enforcePublicAuthRateLimits | Implemented |
| FR-AUTH-008 | Implementation observation — business validation required. Provide password reset request and confirmation operations; delivery remains unverified. | `apps/api/src/modules/auth/auth.service.ts:352` | `apps/api/src/modules/auth/auth.service.ts:352` — requestPasswordReset | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Submit credentials through the applicable staff or patient login route.
2. Apply account and rate-limit checks.
3. Issue the existing access and refresh session response.
4. Resolve the current user for protected requests.
5. Refresh only a valid session.
6. Change password or log out through the existing service boundary.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| INVALID_CREDENTIALS — Invalid username or password | 401 | `apps/api/src/modules/auth/auth.service.ts:102` |
| AUTH_RATE_LIMITED — Too many authentication requests. Try again later. | 429 | `apps/api/src/modules/auth/auth.service.ts:190` |
| INVALID_REFRESH_TOKEN — Invalid refresh token | 401 | `apps/api/src/modules/auth/auth.service.ts:261` |
| SESSION_NOT_ALLOWED — Account cannot refresh session | 403 | `apps/api/src/modules/auth/auth.service.ts:268` |
| AUTHENTICATION_REQUIRED — Authentication required | 401 | `apps/api/src/modules/auth/auth.service.ts:311` |
| USER_NOT_FOUND — User not found | 404 | `apps/api/src/modules/auth/auth.service.ts:321` |
| INVALID_CURRENT_PASSWORD — Current password is invalid | 400 | `apps/api/src/modules/auth/auth.service.ts:337` |
| INVALID_RESET_TOKEN — Invalid or expired reset token | 400 | `apps/api/src/modules/auth/auth.service.ts:381` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/auth/auth.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/AuthSupportPage.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/pages/LoginPage.tsx` | useAuth, useAppLocation, useState, useMemo |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| POST /api/auth/login | auth.login | loginBodySchema | `apps/api/src/modules/auth/auth.routes.ts:73` |
| POST /api/auth/refresh | auth.refresh | refreshBodySchema | `apps/api/src/modules/auth/auth.routes.ts:100` |
| POST /api/auth/logout | auth.logout | logoutBodySchema | `apps/api/src/modules/auth/auth.routes.ts:131` |
| GET /api/auth/me | auth.getCurrentUser | Inline/custom validation; inspect source | `apps/api/src/modules/auth/auth.routes.ts:156` |
| GET /api/auth/password-policy | auth.getPasswordPolicy | Inline/custom validation; inspect source | `apps/api/src/modules/auth/auth.routes.ts:165` |
| POST /api/auth/change-password | auth.changePassword | changePasswordBodySchema | `apps/api/src/modules/auth/auth.routes.ts:173` |
| POST /api/auth/password-reset/request | auth.requestPasswordReset | passwordResetRequestBodySchema | `apps/api/src/modules/auth/auth.routes.ts:194` |
| POST /api/auth/password-reset/confirm | auth.confirmPasswordReset | passwordResetConfirmBodySchema | `apps/api/src/modules/auth/auth.routes.ts:205` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### AuthAccessContext

`apps/api/src/modules/auth/auth.types.ts:3`

| Field | Observed type |
| --- | --- |
| id | string |
| code | string |
| name | string |
| code | string |
| module | string |
| screen | string |
| action | string |
| id | string |
| code | string |
| name | string |

### AuthUserRecord

`apps/api/src/modules/auth/auth.types.ts:22`

| Field | Observed type |
| --- | --- |
| id | string |
| employeeCode | string \| null |
| username | string |
| email | string \| null |
| fullName | string |
| phone | string \| null |
| patientId | string \| null |
| passwordHash | string |
| status | AuthUserStatus |
| failedLoginAttempts | number |
| lockedUntil | Date \| null |
| passwordChangedAt | Date \| null |
| lastLoginAt | Date \| null |
| createdAt | Date |
| updatedAt | Date |

### RefreshTokenRecord

`apps/api/src/modules/auth/auth.types.ts:40`

| Field | Observed type |
| --- | --- |
| id | string |
| userId | string |
| tokenHash | string |
| expiresAt | Date |
| revokedAt | Date \| null |
| replacedByTokenId | string \| null |
| createdAt | Date |

### PasswordResetTokenRecord

`apps/api/src/modules/auth/auth.types.ts:50`

| Field | Observed type |
| --- | --- |
| id | string |
| userId | string |
| tokenHash | string |
| expiresAt | Date |
| usedAt | Date \| null |
| createdAt | Date |

### RequestMetadata

`apps/api/src/modules/auth/auth.types.ts:59`

| Field | Observed type |
| --- | --- |
| ipAddress? | string |
| userAgent? | string |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

| Contract | Current values or map | Source |
| --- | --- | --- |
| AuthUserStatus | 'active' \| 'inactive' \| 'locked' | `apps/api/src/modules/auth/auth.types.ts:1` |

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

User Administration; RBAC; Patient Portal; Settings.

Observed backend import domains: `branches`, `patient-portal`, `permissions`, `roles`, `settings`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-AUTH-001 | FR-AUTH-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Configurable password policy, session timeout and account lockout on repeated failed attempts. |
| AC-AUTH-002 | FR-AUTH-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Access limited to permitted tabs/screens/actions per role and branch. |
| AC-AUTH-003 | FR-AUTH-003 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Authenticate a staff login and return the existing session representation. |
| AC-AUTH-004 | FR-AUTH-004 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Validate refresh sessions and reject invalid or disallowed sessions. |
| AC-AUTH-005 | FR-AUTH-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Revoke the presented session on logout. |
| AC-AUTH-006 | FR-AUTH-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Change a password only through the service validation path. |
| AC-AUTH-007 | FR-AUTH-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Apply public authentication rate limits. |
| AC-AUTH-008 | FR-AUTH-008 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Provide password reset request and confirmation operations; delivery remains unverified. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-AUTH-01: R1 names configurable password policy, timeout and lockout but does not fix numerical values.
- GAP-AUTH-02: Password-reset request code is not evidence of a configured delivery channel.
- GAP-AUTH-03: OTP identity proof, delivery readiness and guardian linking require explicit owner validation; no OTP or credential values are reproduced.
- GAP-AUTH-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Authentication/H-001_PATIENT_OTP_SECURITY_GAP_NOTE.md` | 1e61526e37a69fc50d87e36a41761345d69cea8dd1cd9de40a588e14c7fe44fb | Historical design evidence |
| `HMS Project/Design/Authentication/H-003_PATIENT_REFRESH_SESSION_GAP_NOTE.md` | 37c47059f11cc1d49392b3f23c6100a96c7eddb6854520b8d01b015cfa2ae665 | Historical design evidence |
| `HMS Project/Design/Authentication/M-006_OTP_LOGIN_RATE_LIMIT_GAP_NOTE__7516eb32d1.md` | 7516eb32d1de5581acd0db576487dde2dcb37a9c9d38a03cc885659c948f2265 | Historical design evidence |
| `HMS Project/Design/Authentication/M-006_OTP_LOGIN_RATE_LIMIT_GAP_NOTE__c6c9990129.md` | c6c99901294eeab4198a0dc418d97501c863369f054733e4d89e0b40f4bf0954 | Historical design evidence |
| `HMS Project/Design/Authentication/MINOR_GUARDIAN_LOGIN_ERROR_INVESTIGATION.md` | 19c4746084afef3c59c458815052f9e345c0c351ad6962cb5ae32abb268e2558 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/auth/auth.service.ts` | a43a00c5aabbec4b4a64f5f7f7818c5fec30466e4cb02336ad88524053e01c45 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/auth/auth-rate-limit.model.ts`
- `apps/api/src/modules/auth/auth-rate-limit.repository.ts`
- `apps/api/src/modules/auth/auth-session-cookie.ts`
- `apps/api/src/modules/auth/auth.model.ts`
- `apps/api/src/modules/auth/auth.repository.ts`
- `apps/api/src/modules/auth/auth.routes.ts`
- `apps/api/src/modules/auth/auth.schemas.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.types.ts`
- `apps/api/src/modules/auth/refresh-token.model.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
