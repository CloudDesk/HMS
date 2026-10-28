# Settings Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Settings |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Manage hospital, localization and user-preference configuration through existing authorized settings operations.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Manage hospital, localization and user-preference configuration through existing authorized settings operations. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Authorized administrator; user preference owner where permitted.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Administration | Settings | Edit |
| Administration | Settings | Export |
| Administration | Settings | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-SET-001 | Documented source requirement; approval unverified. Organization profile, branches, departments, rooms/consultation areas, service locations and country/currency settings. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶225 | `apps/api/src/modules/settings/settings.service.ts:72` — updateHospital | Partial |
| FR-SET-002 | Documented source requirement; approval unverified. Release 1 shall include the master data required to operate OPD, Emergency and IPD services from day one. Master data must be configurable by authorized users only and shall support multi-country/multi-currency hospital groups. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶221 | `apps/api/src/modules/settings/settings.service.ts:55` — updateGeneral | Partial |
| FR-SET-003 | Documented source requirement; approval unverified. Configurable password policy, session timeout and account lockout on repeated failed attempts. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1146 | `apps/api/src/modules/settings/settings.service.ts:55` — updateGeneral | Partial |
| FR-SET-004 | Implementation observation — business validation required. Update localization through the current settings contract. | `apps/api/src/modules/settings/settings.service.ts:93` | `apps/api/src/modules/settings/settings.service.ts:93` — updateLocalization | Implemented |
| FR-SET-005 | Implementation observation — business validation required. Maintain user runtime preferences. | `apps/api/src/modules/settings/settings.service.ts:104` | `apps/api/src/modules/settings/settings.service.ts:104` — updateUserPreferences | Implemented |
| FR-SET-006 | Implementation observation — business validation required. Validate hospital logo upload and support authorized retrieval or removal. | `apps/api/src/modules/settings/settings.service.ts:153` | `apps/api/src/modules/settings/settings.service.ts:153` — uploadHospitalLogo | Implemented |
| FR-SET-007 | Implementation observation — business validation required. Export available settings audit records. | `apps/api/src/modules/settings/settings.service.ts:136` | `apps/api/src/modules/settings/settings.service.ts:136` — exportAuditLogs | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Load current hospital and runtime preferences.
2. Open the relevant authorized settings group.
3. Validate and save the supported general, hospital or localization fields.
4. Refresh affected runtime preferences.
5. Manage the hospital logo through the controlled upload path.
6. Audit or export settings changes where permitted.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| EMPTY_LOGO_FILE — Hospital logo file is empty | 400 | `apps/api/src/modules/settings/settings.service.ts:160` |
| LOGO_TOO_LARGE — Hospital logo must not exceed 2 MB | 400 | `apps/api/src/modules/settings/settings.service.ts:164` |
| LOGO_NOT_FOUND — Hospital logo has not been uploaded | 404 | `apps/api/src/modules/settings/settings.service.ts:193` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/settings/settings.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/pages/SystemSettingsPage.tsx` | useSystemSettingsFeature, useMemo |
| `apps/web/src/hooks/settings/useSystemSettingsFeature.ts` | useSystemSettingsFeature, useAuth, useCallback, useState, useSystemSettings, useUpdateGeneralSettings, useUpdateHospitalSettings, useUpdateLocalizationSettings |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| GET /api/settings/runtime/first-day-of-week | settings.getRuntimeFirstDayOfWeek | Inline/custom validation; inspect source | `apps/api/src/modules/settings/settings.routes.ts:31` |
| GET /api/settings/runtime/hospital | settings.getRuntimeHospitalSettings | Inline/custom validation; inspect source | `apps/api/src/modules/settings/settings.routes.ts:39` |
| GET /api/settings | settings.get | Inline/custom validation; inspect source | `apps/api/src/modules/settings/settings.routes.ts:45` |
| PATCH /api/settings/general | settings.updateGeneral | generalSettingsBodySchema | `apps/api/src/modules/settings/settings.routes.ts:51` |
| PATCH /api/settings/hospital | settings.updateHospital | hospitalSettingsBodySchema | `apps/api/src/modules/settings/settings.routes.ts:67` |
| PATCH /api/settings/localization | settings.updateLocalization | localizationSettingsBodySchema | `apps/api/src/modules/settings/settings.routes.ts:83` |
| PATCH /api/settings/user-preferences | settings.updateUserPreferences | userPreferencesBodySchema | `apps/api/src/modules/settings/settings.routes.ts:99` |
| POST /api/settings/:section/reset | settings.reset | settingsSectionParamsSchema | `apps/api/src/modules/settings/settings.routes.ts:115` |
| POST /api/settings/hospital/logo | settings.uploadHospitalLogo | Inline/custom validation; inspect source | `apps/api/src/modules/settings/settings.routes.ts:131` |
| GET /api/settings/hospital/logo | settings.downloadHospitalLogo | Inline/custom validation; inspect source | `apps/api/src/modules/settings/settings.routes.ts:151` |
| DELETE /api/settings/hospital/logo | settings.deleteHospitalLogo | Inline/custom validation; inspect source | `apps/api/src/modules/settings/settings.routes.ts:160` |
| GET /api/settings/audit-logs | settings.listAuditLogs | auditLogQuerySchema | `apps/api/src/modules/settings/settings.routes.ts:172` |
| GET /api/settings/audit-logs/export | settings.exportAuditLogs | auditLogQuerySchema | `apps/api/src/modules/settings/settings.routes.ts:181` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### GeneralSettings

`apps/api/src/modules/settings/settings.types.ts:1`

| Field | Observed type |
| --- | --- |
| applicationName | string |
| version | string |
| defaultLanguage | 'en' \| 'sw' |
| dateFormat | 'DD MMM YYYY' \| 'YYYY-MM-DD' \| 'MM/DD/YYYY' |
| timeFormat | '12-hour' \| '24-hour' |
| sessionTimeoutMinutes | number |
| maintenanceMode | boolean |
| darkMode | boolean |
| auditLogging | boolean |
| multiBranchMode | boolean |

### HospitalSettings

`apps/api/src/modules/settings/settings.types.ts:14`

| Field | Observed type |
| --- | --- |
| hospitalName | string |
| phone | string |
| email | string |
| address | string |
| logoBlobName | string \| null |
| logoContentType | string \| null |

### LocalizationSettings

`apps/api/src/modules/settings/settings.types.ts:23`

| Field | Observed type |
| --- | --- |
| country | 'Kenya' \| 'Uganda' \| 'Tanzania' \| 'Nigeria' \| 'India' |
| timezone | 'Africa/Nairobi' \| 'Africa/Lagos' \| 'Africa/Cairo' \| 'Africa/Kampala' \| 'Africa/Dar_es_Salaam' \| 'Asia/Kolkata' |
| currency | 'KES' \| 'UGX' \| 'USD' \| 'TZS' \| 'NGN' \| 'INR' |
| currencySymbol | string |
| numberFormat | '1,000.00' \| '1.000,00' |
| firstDayOfWeek | 'Monday' \| 'Sunday' |

### UserPreferenceSettings

`apps/api/src/modules/settings/settings.types.ts:32`

| Field | Observed type |
| --- | --- |
| passwordMinLength | number |
| passwordExpiryDays | number |
| maxFailedLoginAttempts | number |
| requireStrongPasswords | boolean |
| forcePasswordChangeOnFirstLogin | boolean |
| allowUserSelfRegistration | boolean |

### SystemSettings

`apps/api/src/modules/settings/settings.types.ts:41`

| Field | Observed type |
| --- | --- |
| general | GeneralSettings |
| hospital | HospitalSettings |
| localization | LocalizationSettings |
| userPreferences | UserPreferenceSettings |
| updatedAt | Date |
| updatedBy | string \| null |

### AuditLogItem

`apps/api/src/modules/settings/settings.types.ts:61`

| Field | Observed type |
| --- | --- |
| id | string |
| id | string \| null |
| name | string |
| profilePhotoUrl | string \| null |
| eventType | string |
| action | AuditAction |
| description | string |
| module | string |
| createdAt | Date |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

No complete explicit current transition map was established. Inspect the linked service guards or obtain an approved lifecycle before specifying new status actions. A simple active flag or report state must not be expanded into an invented clinical lifecycle.

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

Branch Management; Authentication; UI Shell; Billing; all locale-sensitive modules.

Observed backend import domains: `auth`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-SET-001 | FR-SET-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Organization profile, branches, departments, rooms/consultation areas, service locations and country/currency settings. |
| AC-SET-002 | FR-SET-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Release 1 shall include the master data required to operate OPD, Emergency and IPD services from day one. Master data must be configurable by authorized users only and shall support multi-country/multi-currency hospital groups. |
| AC-SET-003 | FR-SET-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Configurable password policy, session timeout and account lockout on repeated failed attempts. |
| AC-SET-004 | FR-SET-004 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Update localization through the current settings contract. |
| AC-SET-005 | FR-SET-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Maintain user runtime preferences. |
| AC-SET-006 | FR-SET-006 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Validate hospital logo upload and support authorized retrieval or removal. |
| AC-SET-007 | FR-SET-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Export available settings audit records. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-SET-01: R1 multi-country scope and historical localized defaults require an approved deployment profile; no live environment values are copied.
- GAP-SET-02: Determine which settings are operationally enforced versus merely stored.
- GAP-SET-03: Reset behavior, security settings and change approval need business/operations review.
- GAP-SET-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Settings/HMS_SYSTEM_SETTINGS_QUICK_WINS_GAP_NOTE.md` | b15e56ce249cc16e6ffa577f097fb0e0c4baee4f521fa0eea48e874eb6b4b696 | Historical design evidence |
| `HMS Project/Design/Settings/INITIALIZATION.md` | 2b08f99c2f8ec8a01f194ef5a98c2f8220348132817db6e237275c67e272d7da | Historical design evidence |
| `HMS Project/Design/Settings/review.md` | 897809661959765673a9e28ee04ae37b9c4bba3cb193e02fe174fa90d5397360 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/settings/settings.service.ts` | 9da85409e9868b8a27ff685da2b2d737ab3c6965d8f5ffe98ac285abf7eee8d7 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/settings/settings.defaults.ts`
- `apps/api/src/modules/settings/settings.logo-storage.ts`
- `apps/api/src/modules/settings/settings.model.ts`
- `apps/api/src/modules/settings/settings.repository.ts`
- `apps/api/src/modules/settings/settings.routes.ts`
- `apps/api/src/modules/settings/settings.schemas.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `apps/api/src/modules/settings/settings.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
