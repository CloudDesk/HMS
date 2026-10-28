# Notifications Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | Notifications |
| Evidence assessment | Sufficient evidence for a core workflow draft; detailed rules and approval remain open |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Deliver scoped operational notification records and track user read state.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Deliver scoped operational notification records and track user read state. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Intended user or role recipient; authorized notification creator; operational supervisors.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

| Module permission group | Screen | Action |
| --- | --- | --- |
| Administration | Notifications | Create |
| Administration | Notifications | View |

These tuples are extracted from the current route declarations. Dynamic checks and user assignments must also be inspected; an absent tuple is not evidence that an endpoint is public.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-NOTIFY-001 | Documented source requirement; approval unverified. Release 1 shall provide in-app and, where configured, SMS-based notifications for key operational events across OPD, Emergency and IPD. Automated payment gateway and patient-portal notifications are Release 2. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1166 | `apps/api/src/modules/notifications/notification.service.ts:9` — createNotification | Partial |
| FR-NOTIFY-002 | Documented source requirement; approval unverified. In-app notification and optional SMS to reception/patient contact where enabled. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1170 | `apps/api/src/modules/notifications/notification.service.ts:9` — createNotification | Partial |
| FR-NOTIFY-003 | Documented source requirement; approval unverified. In-app alert to admission office for patients in Awaiting Bed status. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1174 | `apps/api/src/modules/notifications/notification.service.ts:9` — createNotification | Partial |
| FR-NOTIFY-004 | Documented source requirement; approval unverified. In-app alert to referral coordinator and referring/receiving clinician. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1178 | `apps/api/src/modules/notifications/notification.service.ts:9` — createNotification | Partial |
| FR-NOTIFY-005 | Documented source requirement; approval unverified. Configured notification events trigger correctly to the intended recipient role. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1183 | `apps/api/src/modules/notifications/notification.service.ts:72` — listForUser | Partial |
| FR-NOTIFY-006 | Documented source requirement; approval unverified. Critical result and bed-availability notifications are delivered without noticeable delay. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶1185 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-NOTIFY-007 | Implementation observation — business validation required. Validate explicit recipient and branch scope before creation. | `apps/api/src/modules/notifications/notification.service.ts:9` | `apps/api/src/modules/notifications/notification.service.ts:9` — createNotification | Implemented |
| FR-NOTIFY-008 | Implementation observation — business validation required. List and mark notifications for the authorized user. | `apps/api/src/modules/notifications/notification.service.ts:76` | `apps/api/src/modules/notifications/notification.service.ts:76` — markAsRead | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. An owning workflow identifies its notification event and recipient.
2. Validate branch and recipient eligibility.
3. Persist the notification through the shared service.
4. List only records visible to the authenticated recipient.
5. Mark a visible item read.
6. Escalate urgent events only under an agreed delivery and acknowledgement policy.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

| Observed validation/error | HTTP | Evidence |
| --- | --- | --- |
| NOTIFICATION_RECIPIENT_REQUIRED — A recipient role or user is required | 400 | `apps/api/src/modules/notifications/notification.service.ts:16` |
| BRANCH_NOT_FOUND — Recipient branch not found | 404 | `apps/api/src/modules/notifications/notification.service.ts:23` |
| BRANCH_ACCESS_DENIED — Recipient branch access denied | 403 | `apps/api/src/modules/notifications/notification.service.ts:26` |
| BRANCH_SCOPE_REQUIRED — A recipient branch within your assigned scope is required | 403 | `apps/api/src/modules/notifications/notification.service.ts:29` |
| RECIPIENT_ROLE_NOT_FOUND — Recipient role not found | 404 | `apps/api/src/modules/notifications/notification.service.ts:37` |
| RECIPIENT_USER_NOT_FOUND — Recipient user not found | 404 | `apps/api/src/modules/notifications/notification.service.ts:43` |
| RECIPIENT_USER_BRANCH_ACCESS_DENIED — Recipient user is outside the selected branch | 403 | `apps/api/src/modules/notifications/notification.service.ts:46` |

Request validation definitions to reconcile before approval:

- `apps/api/src/modules/notifications/notification.schemas.ts`

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

No dedicated current-branch page was mapped. Source workflow descriptions remain design evidence only; no new screen, button or form field is invented.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

| Method and path | Handler | Schema references | Source |
| --- | --- | --- | --- |
| POST /api/notifications | notification.createGlobalNotification | createNotificationBodySchema | `apps/api/src/modules/notifications/notification.routes.ts:14` |
| GET /api/notifications | notification.listNotifications | listNotificationsQuerySchema | `apps/api/src/modules/notifications/notification.routes.ts:28` |
| GET /api/notifications/me | notification.listForUser | Inline/custom validation; inspect source | `apps/api/src/modules/notifications/notification.routes.ts:42` |
| PATCH /api/notifications/:id/read | notification.markAsRead | notificationIdParamsSchema | `apps/api/src/modules/notifications/notification.routes.ts:63` |

Cross-module handoffs must preserve the identifiers and authorization required by the originating service. Existing standard response/error handling and request validation apply; exact payload fields belong to the cited schemas, not a newly invented contract.

## 11. Data entities and relevant fields

Fields below are excerpts from current TypeScript contracts. `?` means optional in that type; nullable unions are retained. These are observed API/domain shapes, not an approved database redesign. The linked schemas and models determine runtime requiredness and constraints.

### Notification

`apps/api/src/modules/notifications/notification.types.ts:3`

| Field | Observed type |
| --- | --- |
| id | string |
| recipient_role | string \| null |
| recipient_user_id | string \| null |
| recipient_branch_id | string \| null |
| title | string |
| message | string |
| type | NotificationType |
| related_entity_id | string \| null |
| is_read | boolean |
| created_at | Date |
| updated_at | Date |

### CreateNotificationDTO

`apps/api/src/modules/notifications/notification.types.ts:17`

| Field | Observed type |
| --- | --- |
| recipient_role? | string \| null |
| recipient_user_id? | string \| null |
| recipient_branch_id? | string \| null |
| title | string |
| message | string |
| type | NotificationType |
| related_entity_id? | string \| null |

### NotificationListQuery

`apps/api/src/modules/notifications/notification.types.ts:27`

| Field | Observed type |
| --- | --- |
| recipient_role? | string |
| recipient_user_id? | string |
| recipient_branch_id? | string |
| is_read? | boolean |
| page? | number |
| limit? | number |

## 12. Status transitions and lifecycle

Source status lists and current enums are distinct evidence. An enum is not a transition map. No transition is approved merely because both status values exist.

No complete explicit current transition map was established. Inspect the linked service guards or obtain an approved lifecycle before specifying new status actions. A simple active flag or report state must not be expanded into an invented clinical lifecycle.

The module-specific gaps below identify conflicting source vocabulary or missing state policy. Rejection and terminal-state behavior must be reviewed against both source intent and guarded repository updates.

## 13. Error handling and user notifications

Use the current standard API error code and safe message; section 8 lists directly observed examples. PROJECT_RULES requires distinguishable validation/API errors and recoverable loading/error states. Do not display raw stack traces, credentials, private URLs or full clinical records.

For an authorization failure, deny the action without revealing another patient or branch. For a missing record, avoid creating a replacement implicitly. For a conflict, refresh authoritative state and ask the user to review before retrying. For an uncertain external operation, first retrieve current status; local success feedback must not imply external settlement or clinical completion. Domain-specific notification recipients and escalation timing remain those documented in source or explicitly unresolved.

## 14. Cross-module dependencies

User Administration; RBAC; Branch Management; Appointments; Laboratory; IPD; Referral Management.

Observed backend import domains: `branches`, `roles`, `users`. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-NOTIFY-001 | FR-NOTIFY-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Release 1 shall provide in-app and, where configured, SMS-based notifications for key operational events across OPD, Emergency and IPD. Automated payment gateway and patient-portal notifications are Release 2. |
| AC-NOTIFY-002 | FR-NOTIFY-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: In-app notification and optional SMS to reception/patient contact where enabled. |
| AC-NOTIFY-003 | FR-NOTIFY-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: In-app alert to admission office for patients in Awaiting Bed status. |
| AC-NOTIFY-004 | FR-NOTIFY-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: In-app alert to referral coordinator and referring/receiving clinician. |
| AC-NOTIFY-005 | FR-NOTIFY-005 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Configured notification events trigger correctly to the intended recipient role. |
| AC-NOTIFY-006 | FR-NOTIFY-006 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Critical result and bed-availability notifications are delivered without noticeable delay. |
| AC-NOTIFY-007 | FR-NOTIFY-007 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: Validate explicit recipient and branch scope before creation. |
| AC-NOTIFY-008 | FR-NOTIFY-008 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: List and mark notifications for the authorized user. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-NOTIFY-01: The generic inbox does not prove that every R1 event is emitted or delivered immediately.
- GAP-NOTIFY-02: SMS and push availability, retries, acknowledgement and escalation remain separate policy decisions.
- GAP-NOTIFY-03: Read-state support must not be treated as clinical receipt or acknowledgement.
- GAP-NOTIFY-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/Notifications/H-002_NOTIFICATION_AUTHORIZATION_GAP_NOTE.md` | 986a09d9765601945f6e007714d7a4c985ba738c488e8e4b96f7382e97cfbde0 | Historical design evidence |
| `HMS Project/Design/Notifications/review.md` | 75e5435b2767f7e9724516798873001a2af827826ab282ed0086fc2393925702 | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/api/src/modules/notifications/notification.service.ts` | b4e154b438192e883607ea8f29fa1d178ab9989fd23a4ab95d8e783f7de1b16e | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/api/src/modules/notifications/index.ts`
- `apps/api/src/modules/notifications/notification.model.ts`
- `apps/api/src/modules/notifications/notification.repository.ts`
- `apps/api/src/modules/notifications/notification.routes.ts`
- `apps/api/src/modules/notifications/notification.schemas.ts`
- `apps/api/src/modules/notifications/notification.service.ts`
- `apps/api/src/modules/notifications/notification.types.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
