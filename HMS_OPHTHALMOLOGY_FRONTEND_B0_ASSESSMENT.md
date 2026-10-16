# Ophthalmology frontend B0 assessment and dependency register

**Date:** 16 October 2026  
**Phase:** B0 UI assessment and backend dependency mapping  
**Phase status:** COMPLETE for assessment deliverables  
**Implementation readiness:** READY WITH BLOCKERS  
**Branch inspected:** `DEV-OPHTHALMOLOGY-FRONTEND`

This assessment identifies the staff frontend work needed to deliver the Ophthalmology FSD through the existing OPD application. No feature implementation is included. B1 can begin after explicit phase approval with independently testable OPD fixes; specialty integration remains gated by the dependencies below. Completing B0 does not certify the feature or release.

## Sources and authority

| Source | Identity and finding |
|---|---|
| `PROJECT_RULES.md` and `AGENTS.md` | Existing architecture, source ownership, strict types, live APIs, UI conventions, verification and phase stop gates apply. |
| `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md` | Existing release phase boundaries retained; this frontend track uses B0–B6 to avoid confusion. |
| `HMS_Engineering_Best_Practices_Checklist.md` | Accessible root checklist; review outcome below. Its generic Azure wording does not supersede project Google Cloud Storage rules. |
| Supplied FSD | `C:/Users/Admin/Downloads/Ophthalmology_OPD_Consultation_Functional_Specification_Document 1.docx`, v1.0, 10 September 2026, For Review and Approval. Read in the preceding source analysis and re-extracted for the 178-row field inventory in B0. Document digest is recorded in the field mapping. |
| Supplied workflow diagram | `C:/Users/Admin/AppData/Local/Temp/codex-clipboard-7f8362f7-1587-4892-a568-ed148b69ba25.png`, viewed in the conversation. Supporting interaction reference; configured station sequencing remains authoritative. |
| `HMS_OPHTHALMOLOGY_PHASE0_FSD_ALIGNMENT_MATRIX.md` | Approved DEC-01–DEC-12, recorded 15 October 2026; clinical content and media/vendor policy still require inputs. Earlier baseline rows are historical, not proof a resource remains absent. |
| `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md` | Current v1.4.0: backend A1–A5 implemented; A6 onward planned. Actual routes/types/schemas checked read-only. |
| `HMS_OPHTHALMOLOGY_PHASE_5_VERIFICATION.md` | Prior backend verification and unresolved production configuration; not a live browser test performed by B0. |
| `HMS_Ophthalmology_OPD_Developer_B_Frontend_Prompts.md` | Frontend-only ownership and B0–B6 scope. Existing modified prompt preserved and updated only with phase tracking. |
| HMS Local | `scope/HMS Local` absent; repository search found no matching OPD/Ophthalmology HTML prototype. Exact visual comparison is pending. |

The supplied FSD matches the specialty track. The matrix's recorded approval of v1.0 resolves the pending-signature label for the implementation baseline; no new clinical thresholds, masters, tests, permissions or policies are approved by this assessment. Older Scope 2 source DOCX and Release2 FSD paths are absent in this checkout and are not substituted for the supplied specialty FSD.

## Existing frontend and shared workflow inventory

| Layer or workflow | Reusable current files | Findings |
|---|---|---|
| Patient identity/registration | `apps/web/src/pages/PatientRegistrationPage.tsx`, `hooks/patients/usePatientRegistrationFeature.ts`, `hooks/patients/usePatients.ts` | Reuse existing identity and patient APIs; no specialty patient system. |
| Appointment/check-in | `pages/AppointmentBookingPage.tsx`, `hooks/appointments/useAppointments.ts`, `pages/OpdQueuePage.tsx`, `hooks/opd/useOpdQueue.ts` | Shared scheduling/arrival remains authoritative; extra specialty context needs its owning contract. |
| OPD workspace | `pages/OpdVisitPage.tsx`, `hooks/opd/useOpdVisitFeature.ts`, `hooks/opd/useOpdWorkspace.ts` | Existing seven-tab operational layout and patient context; no dedicated Ophthalmology context/intake/task/result integration found by repository search. |
| Domain queries/API | `hooks/opd/useOpd.ts`, `api/opd.ts`, `api/client.ts`, `api/api-error.ts` | Stable query-key conventions and standard authentication/error handling reusable. Existing OPD hooks directly use `opdApi`; new specialty flow must follow the mandated service layer without an unrelated OPD-wide rewrite. |
| Clinical sections | `components/opd/OpdConsultationSection.tsx`, `OpdDiagnosisTab.tsx`, `OpdPrescriptionSection.tsx`, `OpdLabOrdersTab.tsx`, `OpdImagingOrdersTab.tsx`, `OpdReferralTab.tsx`, `OpdFollowUpTab.tsx`, `OpdDocumentsTab.tsx`, `OpdSummaryPanel.tsx` | Reuse controls and shared operations; they do not supply specialty laterality, review or optical prescription by themselves. |
| Laboratory and imaging | `hooks/laboratory/useLaboratoryQueueFeature.ts`, `useLaboratoryWorkspaceFeature.ts`, `hooks/imaging/useImagingQueueFeature.ts`, `useImagingWorkspaceFeature.ts`; corresponding services/API clients | Queue, result and report patterns available for integration. Never clone their order/result ownership. |
| Billing/pharmacy/documents | `hooks/billing/useBilling.ts`, `services/billing.service.ts`, `services/pharmacy-dispensing.service.ts`, `services/patient-documents.service.ts`, `hooks/patients/usePatientDocumentsFeature.ts` | Reuse owning-domain operations and safe document references. Specialty handoff/publication still needs approved contracts. |
| Routing and permissions | `routing/AppRouter.tsx`, `routing/navigation.ts`, `auth/access-control.ts`, `data/ui-foundation.ts` | Existing custom navigation and permission registry; specialty entries absent. Any minimal additions are shared frontend file changes to report in B1. Do not migrate routing infrastructure. |
| Common UI | `components/ui/DataTable.tsx`, `components/ui/Modal.tsx`, `domains/opd.css` | Reuse operational tables, panels, dialog/focus and OPD styling. Prototype fidelity cannot be verified while source prototypes are absent. |

Paths in this table are relative to `apps/web/src` after the first fully prefixed example where applicable. This is source inspection, not rendered browser acceptance.

## FSD to frontend phase mapping

| FSD section | Required frontend delivery | Phase | Current state and acceptance evidence required |
|---|---|---|---|
| 1 Purpose | One continuous encounter with traceable eye/test/performer data | All | Shared encounter reusable; multi-station end-to-end test pending. |
| 2 Scope/principles | Specialty overlay activated only for eligible Ophthalmology department; preserve General OPD/Dental | B1/B6 | Specialty shell missing; department isolation/regression required. |
| 3 Notation/laterality | Independent OD/OS controls and record-specific OU/NA/unspecified rules | B1/B2/B4 | Backend vocabulary available; UI mapping and persistence tests pending. |
| 4 Roles | Separate entry, test, review, prescribe, configuration and completion capabilities | B1–B6 | Existing permission helper reusable; explicit role grants and assignment scope required. |
| 5 Workflow/appointment | Six specialty subtypes, service/consultant/sub-speciality/eye/referral/priority/notes; check-in | B1/B3 | Context API available; some appointment-owned fields need mapping. |
| 6 Queues | Task identity, scoped queue columns, all actions, time/quality/device metadata, handoffs | B3/B2 | A4 routes available except later review actions; role/transition/browser tests pending. |
| 7 Consultation sections | Thirteen specialty areas, draft/read-only/pending/completed distinctions, progressive disclosure | B1–B5 | General OPD tabs reusable; specialty sections missing. |
| 8 Intake | Structured complaint/history and shared-history review; emergency escalation, reason/time/actor and bypass | B2a | A3 available; approved clinical options and eligible recipients required. |
| 9 Diagnostic forms | All 21 forms and per-field rules | B2b–B2d | Separate field mapping contains 178 source rows; eight core types available, 13 blocked by A6/A7. |
| 10 Doctor review/outcomes | Consolidated review/history/IOP graph, structured diagnosis/plan, medication and separate optical prescription | B4 | A8 planned; exact outcomes/read model not implemented. |
| 11 Shared integrations | Feedback loop through authoritative shared orders/results/prescriptions/procedure/referral/follow-up/billing | B4/B6 | Shared foundations present; additive specialty contract review required. |
| 12 Status/handoff | Specialty overlay separate from OPD/task states; versioned actions and eligible routing | B3/B5 | A4 task subset available; review/completion lifecycle requires A8/A9. |
| 13 Permissions | Action/resource/branch/department/encounter checks and read-only/no-access views | All | UI cannot replace backend checks. Scope/denial acceptance pending. |
| 14 Validation | Draft/final rules, eye/range/condition/reliability/repeat/version/provenance/cross-patient controls | B1–B5 | Structural core validation exists; production configuration absent/unverified. |
| 15 Exceptions | Emergency, unable/poor/left/device unavailable/wrong eye/external result/repeat/amendment/scope | B2–B6 | Map each action to supported API; no local state shortcuts. |
| 16 Completion/portal | Full summary, unmet requirements, doctor approval, locked records and explicit publication | B5/B6 | A9/A10 planned; portal owner implements patient-facing client. |
| 17 Reports | Six workflow reports plus authoritative surgery/follow-up/revenue integration | B6 | APIs planned; no invented metrics or counts from partial pages. |
| 18 Nonfunctional | High-volume forms, accessible responsive UI, safe history, configurable masters, audit | All | Existing style patterns reusable; browser/performance acceptance pending. |
| 19 Phasing | Respect B0–B6 and distinct A0–A11 dependencies | All | Do not equate backend phase completion with frontend completion. |
| 20 Acceptance | Normal/exception, permission, persistence and cross-specialty regression evidence | B6 and each slice | Existing selected tests establish baseline only. |
| Appendix A | Masters/devices/thresholds/scales/reasons and configuration UX | B1/B2 | Framework exists; clinical content/admin grants required. |
| Appendix B | Minimum fields per record and final completion | B2/B4/B5 | Enforce server profiles/structural rules; no guessed mandatory tests. |

## Confirmed frontend gaps and intended fixes

These findings are source-confirmed. B0 does not modify the implementation or claim new tests have reproduced all defects.

| ID | Evidence | Impact and phase action |
|---|---|---|
| B-G01 | `OpdVisitPage.tsx` `handleAddDiagnosis` appends code/name to assessment; `handleRemoveDiagnosis` changes only selected chips | Removed diagnoses can remain in saved assessment and reappear through assessment parsing. B1 must define consistent persisted diagnosis/assessment handling, including free-text preservation and reload tests. |
| B-G02 | Consultation/vitals/prescription synchronization effects return/do nothing on null records; diagnosis restoration only replaces chips when matches exist | Encounter switch to a patient with no record may retain prior form/chip/file state. B1 needs immediate context reset and obsolete-response/mutation protection, tested across filled/empty encounters. |
| B-G03 | `useOpdVisitFeature` calls `useOpdWorkspace(activeVisitId || null)` without `activeTab`; workspace conditions use `!activeTab || ...` | Inactive-tab data/lookups are enabled. B1 should wire active-tab/context/permission gating and verify request counts without changing shared contracts. |
| B-G04 | `masterMedicines` falls back to `available_quantity: 120` in `useOpdVisitFeature.ts` | Missing stock may appear as real inventory. Remove fabricated quantity in the approved affected slice; model unavailable stock explicitly and check consuming components. |
| B-G05 | `saveWorkspaceDraft` catches prescription/lab/imaging failures as null; completion catches invoice/status failures | Partial failure can be hidden. B1 should surface truthful per-operation outcomes and retain retry context without duplicate writes. Backend transaction changes stay with the owner. |
| B-G06 | Staff `api/opd.ts` request/response types omit A1 `version`, `expected_version`, `expected_status` | New specialty clients cannot safely infer version preconditions from these types. Add verified additive frontend types in B1; do not alter backend or permit silent overwrite. |
| B-G07 | Page stores diagnoses/form payload orchestration and custom toast state; domain hooks call API directly | Existing layering/notification debt. Make minimal phase-owned extraction into feature/service layers; avoid broad refactoring. Retain top-right Sonner and RHF/Zod for new specialty forms. |
| B-G08 | Specialty client/service/domain/feature hooks, routes/permissions and controls absent in staff source search | Add through B1–B6 only as contracts become usable. No placeholders presented as clinical functionality. |
| B-G09 | `setActiveTab` is local state; URL provides only initial tab; no matching specialty route exists | B1 must keep workspace tab and filters in validated URL state without initial navigation loops. |

## Backend contracts and newly identified integration blockers

| ID | Required contract or decision | Evidence/owner | Gate and next action |
|---|---|---|---|
| B-D01 | Active clinical configuration and grants | DEC-06/07; clinical leadership/admin | Before production form use, supply branch-approved scales/options/ranges/reasons/thresholds/form/completion profiles and explicit user/station assignments. No new values are approved here. |
| B-D02 | Clinician-safe configuration/station lookup | Configuration/station GET routes require Configuration View; no dedicated eligible-user lookup family is published | Developer A must confirm permitted projections for clinical forms and eligible assignment options. Do not grant administration access or invent a lookup endpoint to make a dropdown work. |
| B-D03 | Exact nested core field shapes | `OphthalmologyCoreTestPayloads` uses broad maps for PD, selected indices, BCVA/JCC, cycloplegic medication, posterior structures and other fields | Before integrating affected controls, Developer A supplies concrete nested request/response examples/schema. See field rows marked PARTIAL CONTRACT. Independent typed controls can proceed in their approved slice. |
| B-D04 | Distinct unaided/presenting VA and cooperation | A5 has `unaided_or_presenting` and common reliability; FSD names additional clinical distinctions | Owner/Developer A confirms intended mapping or additive contract. Do not overwrite two independent findings in a single field or equate reliability and cooperation silently. |
| B-D05 | Advanced and specialist forms | A6/A7 not started per v1.4.0 | Developer A publishes implemented exact schemas, units/calculations and comparison rules for 13 forms; B2c/B2d blocked meanwhile. |
| B-D06 | Submit/review, consolidated doctor model and outcomes | Enum includes review states; routes currently stop at core completion/amendment | A8/review owner delivers submission/review and doctor model/diagnosis/plan/optical endpoints. No automatic progression from COMPLETED to REVIEWED. |
| B-D07 | Completion, deferral, override, reopening and signature | A9 endpoint family planned | Backend implementation, readiness reasons and exact downstream amendment effects required for B5. Generic OPD completion is not an approved specialty bypass. |
| B-D08 | Attachment/import/publication policy | A5 supports same-patient document references; imports explicitly unavailable; A10 planned | Storage/security/Developer A provide supported media, size, retention, consent/publication and adapter contracts. Portal owner implements patient client. |
| B-D09 | Reports/export and downstream summaries | A10 plus shared procedure/follow-up/finance reporting | Use implemented scoped APIs before B6; no client reconstruction of totals. |
| B-D10 | Appointment-owned field representation | Context DTO covers specialty subtype/eye/profile, not every FSD booking field | Shared scheduling owner/Developer A confirms field ownership and additive contracts for service/sub-speciality/referral context. |
| B-D11 | Visual reference | HMS Local absent | Owner restores accessible prototype reference or approves existing live OPD patterns before visual fidelity acceptance. Independent state/type fixes remain possible. |
| B-D12 | Live integration acceptance | No authenticated live browser/API exercise performed in B0 | Before claiming an implemented slice complete, use authorized test environment/users/configurations and real persistence. B0's source mapping does not require test-patient writes. |

No backend route, model, repository, configuration, permission seed or service registry was changed. Transaction, audit, eligibility, clinical thresholds and authoritative transitions remain backend responsibilities. Frontend sends exact versions/statuses and renders errors; it never duplicates these enforcement mechanisms.

## Intended frontend file boundaries

For B1, inspect current diffs immediately before editing shared frontend files. Candidate existing files are `apps/web/src/pages/OpdVisitPage.tsx`, `hooks/opd/useOpdVisitFeature.ts`, `useOpdWorkspace.ts`, `api/opd.ts` and their focused tests. New specialty clients/services/domain hooks/feature hooks should follow `api/ophthalmology.ts`, `services/ophthalmology.service.ts`, `hooks/ophthalmology/useOphthalmology.ts` and `hooks/ophthalmology/useOphthalmologyWorkspaceFeature.ts` conventions, subject to the phase gap note and approved slice. No such files are created in B0.

Specialty UI integration may require minimal changes in `routing/AppRouter.tsx`, `auth/access-control.ts`, `data/ui-foundation.ts`, `components/opd/**` and `domains/opd.css`. Report each shared file. Do not edit API, patient-web, dependency locks, root build/lint configuration, Developer A documents or missing prototypes.

## Checklist assessment

| Checklist area | B0 review outcome |
|---|---|
| Architecture and contracts | Existing OPD flow inventoried; direct API hook usage, missing version fields and broad backend payload containers recorded. New code follows mandated service/feature layering. |
| Types/forms/errors | Current typecheck evidence recorded separately; new forms require RHF/Zod and exact endpoint schemas. Null record/reset, diagnosis mismatch and swallowed errors documented. |
| Auth/scope/session | Existing helpers/API refresh reusable; no new grants. Explicit action/assignment/branch gating and session-expiry acceptance required later. |
| Lists/performance | Existing query factories/tables reusable; eager lookup issue confirmed. Specialty queues/reports use server pagination and scoped metrics. |
| Clinical safety | Independent eyes, versioned records, no automatic diagnosis, repeat preservation and approved configuration required. Field inventory preserves source requirements. |
| Files/privacy/publication | Existing document references reusable; uploads and portal publication require later contracts/policy. No clinical payload persisted in analysis artifacts. |
| UI/accessibility | Existing patterns inspected in source. Responsive/keyboard/rendered acceptance remains unexecuted; no claim of prototype fidelity. |
| Automated checks | See B0 verification. Baseline lint failures remain unrelated and are listed precisely; B0 changes only Markdown. |
| Shared regression | Four selected web test files pass; full ophthalmology and live cross-domain acceptance remains future work. |

## Phase recommendation and handoff

1. B0 assessment is delivered with source identity, all-section traceability, 21-form/178-row field inventory, confirmed gap list, dependency owners, candidate files and baseline evidence.
2. Next proposed slice is B1a: fix diagnosis removal/persistence, context reset and obsolete-response safety, then tab/permission request gating and truthful error/stock display with focused tests. Do not merge all B1 scope into an unreviewable broad rewrite.
3. B1b specialty context/configuration and administration requires the available A2 contract plus resolved permission-safe lookups and visual reference. B2b depends on configured forms and task identity; any B3 task-entry slice brought forward requires explicit scope approval.
4. B2c/B2d/B4/B5/B6 remain subject to their backend and configuration gates. Backend phase numbering must never be used as frontend completion evidence.

**Stop:** B1 has not started. Explicit approval is required before the next frontend phase under AGENTS.md and the Developer B prompt's execution discipline.
