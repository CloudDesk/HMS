# UI Shell Functional Specification Document

## 1. Document information and status

| Field | Value |
| --- | --- |
| Status | Draft — Pending Review |
| Version | 0.1 — generated analysis draft |
| Date | 28 October 2026 |
| Current branch | DEV-GENERAL |
| Implementation snapshot | 7df97a7dc8ce7f01abfbcaeec8502bb390c213b5 |
| Module identity | UI Shell |
| Evidence assessment | Incomplete requirement evidence; implementation/design-led draft |
| Approval | No independent approval evidence established; neither source filenames nor code imply business approval. |
| Validation scope | Static source analysis only. No functional tests, UAT or live transactions were executed. |

Confirmed below means the statement is present in a retained source, not that it is approved. Implementation observations require business validation. `Implemented` is used only for a narrow behavior directly visible in source; `Partial` means related implementation exists but the full documented requirement is not demonstrated; `Missing` means the required dedicated current-branch capability was not found in the inspected module/routes; `Unverified` means evidence is insufficient. None of these labels certify runtime behavior.

## 2. Module overview

Provide staff navigation, branch context and common interaction states without granting backend authority.

The current branch has related implementation files listed in section 18.

## 3. Business objectives

Provide staff navigation, branch context and common interaction states without granting backend authority. This objective is a synthesis of the cited evidence. Success is assessed against the individual requirements and acceptance checks below; no new performance, revenue, clinical or service-level target is invented.

## 4. Scope and exclusions

Scope is limited to the documented requirements and explicitly identified implementation observations in section 6. The workflow below describes their intended or observed sequence. Where a step has no confirmed current implementation, it remains a draft gap rather than an implementation commitment.

Excluded from this document-generation task: application changes, schema migrations, newly chosen clinical thresholds, new permissions, external integrations, fabricated historical results and approval of unresolved policy. Existing shared specifications remain unchanged in `HMS Project/FSD/Cross-Module HMS/`.

## 5. User roles and permissions

Authenticated staff user within role and module visibility rules.

Role descriptions identify actors from source scope or observed boundaries; they do not grant permissions. The retained governance matrix distinguishes proposed roles from operational baseline roles. Authorization must be validated against database-loaded assignments and branch/department context.

No module-specific staff permission tuple was established in the inspected current routes. See API boundaries and the unresolved role/authorization decisions; do not invent a default grant.

## 6. Functional requirements and implementation alignment

| Requirement ID | Requirement | Source | Implementation Evidence | Status |
| --- | --- | --- | --- | --- |
| FR-UI-001 | Documented source requirement; approval unverified. Release 1 shall be organized using role-based navigation across OPD, Emergency and IPD modules. Users shall not see tabs that are outside their permission scope. | `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` ¶191 | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-UI-002 | Documented project rule; not evidence of functional approval. Preserve loading, empty, error and success states for pages performing server operations. | `PROJECT_RULES.md:155` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-UI-003 | Documented project rule; not evidence of functional approval. Permission-gate frontend actions while keeping backend authorization authoritative. | `PROJECT_RULES.md:126` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-UI-004 | Documented project rule; not evidence of functional approval. Use top-right notifications for completed saves and show red required-field asterisks. | `PROJECT_RULES.md:512` | No sufficient current-branch implementation evidence mapped; see gaps. | Unverified |
| FR-UI-005 | Implementation observation — business validation required. The current staff shell navigation pushes or replaces browser history and dispatches its navigation event. | `apps/web/src/routing/navigation.ts:15` | `apps/web/src/routing/navigation.ts:15` — export const navigate | Implemented |

Evidence matches are deliberately conservative: a service supporting part of a requirement does not prove the complete UI, concurrency, audit, integration or approval condition.

## 7. Detailed workflows

Basis: the source requirements and implementation observations in section 6. This sequence is a documented-source synthesis, not a claim that every step currently works end to end. Prerequisites: a valid patient/source context where applicable, authorized actor and the configured business rules identified below.

1. Authenticate and resolve the available navigation.
2. Select an authorized branch context.
3. Open a permitted module route.
4. Show loading, empty, error and success states.
5. Use the existing responsive sidebar and modal behavior.
6. Retain filter and navigation context according to the current page contract.

On validation failure, retain the record context and display the applicable safe error. On a state conflict, reload authoritative state before retrying; never infer completion from a local screen update. Success means the owning service has persisted the intended result; cross-module completion requires the linked downstream evidence. These handling expectations follow the project UI/API rules and remain unexecuted acceptance criteria.

## 8. Business rules and validations

The normative business-rule candidates are the documented statements in section 6. The following are additional code observations requiring business validation, not independently approved rules.

No complete module-specific business validation contract was established from simple service errors. The source gaps remain explicit; shared request validation is not a substitute for an approved rule.

## 9. User interface behavior

PROJECT_RULES.md requires loading, empty, error and success states; permission-gated queries; backend-aligned forms; top-right notifications for save/create/update; and red asterisks for required fields. These are project requirements, not proof that every current screen conforms.

| Current page or related integration surface | Observed hooks |
| --- | --- |
| `apps/web/src/App.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/components/layout/BranchSelector.tsx` | useAuth, useActiveBranch |
| `apps/web/src/components/layout/DashboardLayout.tsx` | useActiveSidebarState, useAppLocation, useRef, useState, useEffect |
| `apps/web/src/components/layout/MobileSidebarBackdrop.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/components/layout/MobileSidebarDrawer.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/components/layout/NavLink.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/components/layout/NotificationsMenu.tsx` | useState, useEffect |
| `apps/web/src/components/layout/Sidebar.tsx` | useAuth, useHospitalSettings |
| `apps/web/src/components/layout/SidebarNavGroup.tsx` | useState, useEffect |
| `apps/web/src/components/layout/SidebarUserFooter.test.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/components/layout/SidebarUserFooter.tsx` | useAuth |
| `apps/web/src/components/layout/TopHeader.tsx` | See component composition; no named hook call extracted. |
| `apps/web/src/components/layout/UserMenu.tsx` | See component composition; no named hook call extracted. |

These files include shared integration surfaces; their presence does not establish module-specific UI completion. Review permission denial, stale-data retry, modal cancellation and responsive behavior with the business owner.

## 10. Backend API and integration requirements

The following declarations are current-branch observations, including actual route handlers and named validation schemas where statically visible. Shared registration is in `apps/api/src/modules/index.ts`. Route existence is not runtime or business approval.

No dedicated current-branch endpoint family is established here. Shared implementation files and source-design contracts are listed in section 18; future API naming and payloads require approval.

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

Authentication; RBAC; Branch Management; Notifications; Settings; all staff pages.

Observed backend import domains: No dedicated import dependency list established.. These imports indicate coupling, not a complete business integration contract. Preserve source patient, visit/encounter, admission/procedure and branch references as required by the cited owning services.

## 15. Security and audit requirements

PROJECT_RULES.md requires backend authorization, database-loaded permissions, scoped queries, external-input validation and safe logging. R1 section 22 and R2 section 19 require auditable sensitive changes and access controls. Record actor, action, time and relevant before/after context with reasons where the source requires them; do not include credentials or unnecessary clinical content. These controls require verification per operation, not a blanket compliance claim.

The governance matrix is retained unchanged and remains approval-unverified. Proposed roles, dual control, supervisor overrides and retention policy require explicit owner review.

## 16. Acceptance criteria

These are future acceptance checks derived from the requirement rows, not executed tests or test results. Source-defined behavior needs business confirmation; implementation-derived behavior needs business approval before it becomes a normative acceptance baseline.

| Acceptance ID | Requirement | Expected review or verification |
| --- | --- | --- |
| AC-UI-001 | FR-UI-001 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Release 1 shall be organized using role-based navigation across OPD, Emergency and IPD modules. Users shall not see tabs that are outside their permission scope. |
| AC-UI-002 | FR-UI-002 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Preserve loading, empty, error and success states for pages performing server operations. |
| AC-UI-003 | FR-UI-003 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Permission-gate frontend actions while keeping backend authorization authoritative. |
| AC-UI-004 | FR-UI-004 | Demonstrate the sourced behavior, including its stated conditional policy, against the cited implementation or record the gap: Use top-right notifications for completed saves and show red required-field asterisks. |
| AC-UI-005 | FR-UI-005 | Business owner validates the observed behavior, then demonstrate it using the cited operation and applicable negative/scope cases: The current staff shell navigation pushes or replaces browser history and dispatches its navigation event. |

Before functional sign-off, verify authorized success, permission denial, wrong-context access, invalid input and applicable stale/concurrent updates. Where clinical or financial side effects span records, verify persistence, rollback and idempotent retry using approved test data and the existing test process. No numerical clinical threshold or SLA is introduced here.

## 17. Known gaps and unresolved decisions

- GAP-UI-01: Current navigation uses a custom history/event helper while PROJECT_RULES names React Router; record the divergence without changing architecture.
- GAP-UI-02: Historical UI modernization notes contain branch-specific work; inspect current components before assuming they landed.
- GAP-UI-03: Accessibility, keyboard navigation and responsive acceptance require review beyond source inspection.
- GAP-UI-APPROVAL: Confirm the accepted source revision, module owner, role matrix and business acceptance evidence. This draft is not final or approved.

The absence of an original module FSD is not cured by this generated document. Historical design reviews can describe fixed, open or branch-specific findings; each must be reconciled with the current revision before being treated as a current defect.

## 18. Requirement traceability and source register

Every functional row in section 6 has a source locator. Word paragraph locators (¶) count nonempty `w:p` elements in `word/document.xml` in document order, including table cells; they are not page numbers. Plain-text and code locators use one-based line numbers. File hashes below pin the exact source bytes.

| Source | SHA-256 | Interpretation |
| --- | --- | --- |
| `HMS Project/Design/UI Shell/HMS_SIDEBAR_UTILITY_UX_VERIFICATION.md` | d32a558dffe540256c049fd1102711b41049c697f062c1d095644a8bcf18733e | Historical design evidence |
| `HMS Project/Design/UI Shell/HMS_UI_MODERNIZATION_PHASE1_GAP_NOTE.md` | 985b59c13c5ed56d2d47ab78943bd3fd536db93a31ec0088f22e13a7cac228cc | Historical design evidence |
| `HMS Project/Design/UI Shell/HMS_UI_MODERNIZATION_PHASE2_GAP_NOTE.md` | 73110a872aeb856772cc32a5c15ece509bc5c81c2be4af5443b368c0931c1ad4 | Historical design evidence |
| `HMS Project/Design/UI Shell/HMS_UI_MODERNIZATION_PHASE3_GAP_NOTE.md` | 2720b6400a1ca461f385e81a99254b72c073220414fdac9119007a5cefa5b9e6 | Historical design evidence |
| `HMS Project/Design/UI Shell/HMS_UI_MODERNIZATION_PHASE4_GAP_NOTE.md` | 5863a830c4dd46f669a6f1d7bc1fd5d36c9980bc2075849366a0bd336d53f711 | Historical design evidence |
| `HMS Project/Design/UI Shell/HMS_UI_MODERNIZATION_PHASE5_GAP_NOTE.md` | 637f43d495f238af93a0b3dd9feedd82a76d5bcc3517f7f67dc61a26eb89e689 | Historical design evidence |
| `HMS Project/Design/UI Shell/HMS_UI_Modernization_Plan.md` | 77cad383158a8812c1a1a8aa301ad7032d83828a4f0a99e7f4eb49e8b1bd9e40 | Historical design evidence |
| `HMS Project/Design/UI Shell/M-009_STAFF_ROUTE_CODE_SPLITTING_GAP_NOTE.md` | c0c2b124d942cab3043731ad25736c0baf68cda65dd9c9fc33ea46d611309377 | Historical design evidence |
| `HMS Project/Design/UI Shell/UI_DESIGN_STANDARD.md` | baa50264fe0c557c13f2fa5ead01ace0009980b117864d3c6a34fadca42a471a | Historical design evidence |
| `HMS Project/FSD/Cross-Module HMS/HMS_Release_1_Scope_Document_v2.docx` | 0ce317f059492e4319254766957a26b722f1684a6cae7e2dad95958155c8dd99 | Original preserved specification |
| `HMS Project/FSD/RBAC/HMS_Role_Permission_Assignment_Matrix.docx` | 7f6917f90bcf90e481cfe29719644499bacda632e594d451ab55fcd15e9fefac | Original preserved specification |
| `PROJECT_RULES.md` | b1514b32b469aba5664a5e5772f3070e7dd3d1b3fd1014b205660916d52c6ebd | Current implementation or project rule |
| `apps/web/src/routing/navigation.ts` | d257121379ffc31454dbc1fb12a7c5a26ee6196c0bcca4998b3c2186f957a8c4 | Current implementation or project rule |

Design documents above were read as reference evidence. Their original branch/blob provenance remains in DOCUMENT_MANIFEST.json; a copied document is not necessarily from DEV-GENERAL. Internal claims such as approved or implemented are attributed to the source and are not independent approval evidence.

Current implementation files inspected for this module:

- `apps/web/src/App.tsx`
- `apps/web/src/components/layout/BranchSelector.tsx`
- `apps/web/src/components/layout/DashboardLayout.tsx`
- `apps/web/src/components/layout/MobileSidebarBackdrop.tsx`
- `apps/web/src/components/layout/MobileSidebarDrawer.tsx`
- `apps/web/src/components/layout/NavLink.tsx`
- `apps/web/src/components/layout/NotificationsMenu.tsx`
- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/layout/SidebarNavGroup.tsx`
- `apps/web/src/components/layout/SidebarUserFooter.test.tsx`
- `apps/web/src/components/layout/SidebarUserFooter.tsx`
- `apps/web/src/components/layout/TopHeader.tsx`
- `apps/web/src/components/layout/UserMenu.tsx`
- `apps/web/src/routing/navigation.ts`

The full alignment matrix is section 6 and the linked acceptance register is section 16. No requirement, code observation, historical design claim or unresolved policy is promoted to approval by this draft.
