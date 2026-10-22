# HMS Ophthalmology workflow traceability

Audit date: 21 October 2026. Branch: `DEV-OPHTHALMOLOGY-F-V2`. HEAD: `334605dd45e75a47149da43f65e2e339120c6a77`.

## Scope and evidence standard

First audit delivery, before implementation/prototype phase. Both attached diagrams are functional requirements, not proof of implementation or approved clinical policy. The pasted request is the task instruction. Earlier reports are historical leads, not substituted for source inspection. Insurance/SHA is excluded even though Diagram 2 mentions insurance.

84 node rows cover Diagram 1 (31) and Diagram 2 (53). D1 is `mermaid-diagram (1).png`; D2 is `mermaid-diagram.png`. Line wrapping is normalized in labels. IDs are local audit identifiers. Each transition lists outgoing branches; repeated paths point back to the same node. D2-41/42 are unused IDs, not omitted nodes.

Status vocabulary: **Partially implemented** includes source-supported behavior whose entire live handoff has not been verified; **Missing** means the specified trigger/action was not identified in the inspected domain; **Externally blocked** requires an owner contract. No end-to-end node is marked “Implemented and verified” solely because a unit/integration suite passes. This conservatism does not deny the implemented and tested sub-behaviors recorded in each row. Fresh tests: 6 suites, 75 tests passed; isolated Mongo replica sets/JSDOM, not the running HMS environment.

## Source reconciliation

Read PROJECT_RULES.md and the Scope 2 execution-plan baseline/contract gate. The plan's August statement that Emergency has no backend is stale for this HEAD: dedicated Emergency, admission and Surgery modules now exist. The exact `HMS_Scope2_Developer1(Kamesh)_Phase_3_Prompts.docx` and `doc/HMS_Release2_FSD.docx` paths are absent. No new lifecycle or clinical policy is derived from the diagrams. Existing contracts and current code govern the audit; missing documents do not prevent read-only inspection. No Scope 2 implementation phase is started.

Existing modified `HMS_OPHTHALMOLOGY_COMBINED_WORKFLOW_GAP_CLOSURE.md` and untracked `HMS_OPHTHALMOLOGY_STAGING_UAT_AND_DECISIONS.md` are preserved. Earlier narrative that acknowledgement unblocks routine care is superseded by current `requireEmergencyClearance` at service line 1535, called at lines 1336 and 1506.

## Implementation evidence registry

Each matrix implementation column refers to this registry, so full paths are specified once. All paths are repository-relative. “...” in endpoint paths under Ophthalmology means `/api/opd/visits/:visitId` unless the full `/api/ophthalmology/test-tasks` prefix is given. Endpoint declarations are in `apps/api/src/modules/ophthalmology/ophthalmology.routes.ts` (lines 172–359). These are Fastify handlers rather than separate controllers. Existence is not an acceptance result.

### R

- UI: apps/web/src/pages/PatientSearchPage.tsx; apps/web/src/pages/PatientRegistrationPage.tsx.
- Frontend hook/service/client: apps/web/src/hooks/patients/usePatientSearchFeature.ts; apps/web/src/api/patients.ts.
- API route/controller: apps/api/src/modules/patients/patient.routes.ts.
- Backend service/repository: apps/api/src/modules/patients/patient.service.ts; apps/api/src/modules/patients/patient.repository.ts.
- Data model: apps/api/src/modules/patients/patient.model.ts.
- Tests: PatientSearchPage.test.tsx (existing; not rerun).

### A

- UI: apps/web/src/pages/OpdQueuePage.tsx; apps/web/src/pages/OpdVisitPage.tsx.
- Frontend hook/service/client: apps/web/src/hooks/opd/useOpdVisitFeature.ts; apps/web/src/hooks/opd/useOpd.ts; apps/web/src/api/opd.ts.
- API route/controller: apps/api/src/modules/opd/opd-visit.routes.ts.
- Backend service/repository: apps/api/src/modules/opd/opd-visit.service.ts:251; apps/api/src/modules/opd/opd-visit.repository.ts.
- Data model: apps/api/src/modules/opd/opd-visit.model.ts:89; apps/api/src/modules/appointments/appointment.model.ts.
- Tests: appointment-ophthalmology.test.ts; useOpdVisitFeature.test.tsx (existing; not rerun).

### I

- UI: apps/web/src/pages/OphthalmologyWorkspacePage.tsx; apps/web/src/components/ophthalmology/OphthalmologyIntakeForm.tsx.
- Frontend hook/service/client: apps/web/src/hooks/ophthalmology/useOphthalmologyWorkspaceFeature.ts; apps/web/src/hooks/ophthalmology/useOphthalmology.ts; apps/web/src/services/ophthalmology.service.ts; apps/web/src/api/ophthalmology.ts.
- API route/controller: GET/PUT/POST /api/opd/visits/:visitId/ophthalmology/intake[/draft|/complete]; POST .../alerts/:id/acknowledge.
- Backend service/repository: apps/api/src/modules/ophthalmology/ophthalmology.service.ts:224; apps/api/src/modules/ophthalmology/ophthalmology.repository.ts:573.
- Data model: apps/api/src/modules/ophthalmology/ophthalmology-intake.model.ts; apps/api/src/modules/ophthalmology/ophthalmology.model.ts.
- Tests: ophthalmology.phase3.test.ts (fresh PASS).

### T

- UI: apps/web/src/pages/OphthalmologyQueuePage.tsx; apps/web/src/components/ophthalmology/OphthalmologyTestsWorkspace.tsx.
- Frontend hook/service/client: apps/web/src/hooks/ophthalmology/useOphthalmologyQueueFeature.ts; apps/web/src/hooks/ophthalmology/useOphthalmologyResultFeature.ts; apps/web/src/hooks/ophthalmology/useOphthalmologyQueue.ts; apps/web/src/api/ophthalmology-queue.ts.
- API route/controller: POST .../visits/:visitId/ophthalmology/test-tasks; GET /api/ophthalmology/test-tasks; POST .../test-tasks/:id/start; PUT .../result/draft; POST .../result/complete.
- Backend service/repository: apps/api/src/modules/ophthalmology/ophthalmology.service.ts:491; :1501; apps/api/src/modules/ophthalmology/ophthalmology.repository.ts.
- Data model: apps/api/src/modules/ophthalmology/ophthalmology-test-task.model.ts; apps/api/src/modules/ophthalmology/ophthalmology-test-result.model.ts; apps/api/src/modules/ophthalmology/ophthalmology-core-test-contract.ts.
- Tests: ophthalmology.phase4.test.ts; ophthalmology.phase5.test.ts (fresh PASS); phases6/7 (existing only).

### Q

- UI: apps/web/src/components/ophthalmology/OphthalmologyCareWorkspace.tsx; apps/web/src/components/ophthalmology/OphthalmologyQueueActionDialog.tsx.
- Frontend hook/service/client: apps/web/src/hooks/ophthalmology/useOphthalmologyCareFeature.ts; apps/web/src/hooks/ophthalmology/useOphthalmologyQueueFeature.ts; apps/web/src/api/ophthalmology-care.ts; apps/web/src/api/ophthalmology-queue.ts.
- API route/controller: GET .../ophthalmology/doctor-review; POST /api/ophthalmology/test-tasks/:id/result/review; POST .../:id/request-repeat.
- Backend service/repository: apps/api/src/modules/ophthalmology/ophthalmology.service.ts:727; apps/api/src/modules/ophthalmology/ophthalmology.repository.ts.
- Data model: apps/api/src/modules/ophthalmology/ophthalmology-test-task.model.ts; apps/api/src/modules/ophthalmology/ophthalmology-test-result.model.ts.
- Tests: ophthalmology.phase4.test.ts; ophthalmology.phase5.test.ts; ophthalmology.phase9.test.ts (fresh PASS).

### C

- UI: apps/web/src/components/ophthalmology/OphthalmologyClinicalReviewEditor.tsx; apps/web/src/components/ophthalmology/OphthalmologyOpticalEditor.tsx; apps/web/src/pages/OpdVisitPage.tsx.
- Frontend hook/service/client: apps/web/src/hooks/ophthalmology/useOphthalmologyCareFeature.ts; apps/web/src/hooks/ophthalmology/useOphthalmologyCare.ts; apps/web/src/api/ophthalmology-care.ts; apps/web/src/hooks/opd/useOpdVisitFeature.ts.
- API route/controller: PUT .../ophthalmology/clinical-review/draft; PUT .../optical-prescription/draft; POST .../optical-prescription/approve.
- Backend service/repository: apps/api/src/modules/ophthalmology/ophthalmology.service.ts; apps/api/src/modules/ophthalmology/ophthalmology.repository.ts:940.
- Data model: apps/api/src/modules/ophthalmology/ophthalmology-review.model.ts; apps/api/src/modules/opd/opd-consultation.model.ts.
- Tests: ophthalmology.phase8.test.ts (existing); phase9 (fresh PASS reference validation).

### F

- UI: apps/web/src/components/ophthalmology/OphthalmologyCompletionWorkspace.tsx; apps/web/src/components/ophthalmology/OphthalmologyFinalizationTools.tsx.
- Frontend hook/service/client: apps/web/src/hooks/ophthalmology/useOphthalmologyCompletionFeature.ts; apps/web/src/hooks/ophthalmology/useOphthalmologyCompletion.ts; apps/web/src/api/ophthalmology-completion.ts.
- API route/controller: GET .../ophthalmology/completion-readiness; POST .../ophthalmology/complete; GET .../completion-history.
- Backend service/repository: apps/api/src/modules/ophthalmology/ophthalmology.service.ts:1081; :1335; :1535; apps/api/src/modules/ophthalmology/ophthalmology.repository.ts.
- Data model: apps/api/src/modules/ophthalmology/ophthalmology-consultation.model.ts; apps/api/src/modules/opd/opd-consultation.model.ts; apps/api/src/modules/opd/opd-visit.model.ts.
- Tests: ophthalmology.phase9.test.ts (fresh PASS).

### S

- UI: apps/web/src/components/ophthalmology/OphthalmologyConsultationSummaryCard.tsx; apps/web/src/components/ophthalmology/OphthalmologyPublicationTools.tsx.
- Frontend hook/service/client: apps/web/src/hooks/ophthalmology/useOphthalmologyCompletionFeature.ts; apps/web/src/hooks/ophthalmology/useOphthalmologyPublicationFeature.ts; apps/web/src/api/ophthalmology-publications.ts.
- API route/controller: GET .../ophthalmology/summary; GET/POST /api/ophthalmology/publications.
- Backend service/repository: apps/api/src/modules/ophthalmology/ophthalmology.service.ts:1162; apps/api/src/modules/ophthalmology/ophthalmology.repository.ts:951; apps/api/src/modules/ophthalmology/ophthalmology-phase10.service.ts.
- Data model: apps/api/src/modules/ophthalmology/ophthalmology-consultation.model.ts; apps/api/src/modules/ophthalmology/ophthalmology-phase10.model.ts.
- Tests: ophthalmology.phase9.test.ts; OphthalmologyConsultationSummaryCard.test.tsx (fresh PASS); phase10 (existing only).

### E

- UI: apps/web/src/pages/EmergencyWorkspacePage.tsx; apps/web/src/pages/OphthalmologyWorkspacePage.tsx.
- Frontend hook/service/client: apps/web/src/hooks/emergency/useEmergencyWorkspaceFeature.ts; apps/web/src/hooks/emergency/useEmergency.ts; apps/web/src/services/emergency.service.ts; apps/web/src/api/emergency.ts.
- API route/controller: POST /api/emergency/encounters; POST .../:id/triage; POST .../:id/consultation; POST .../:id/disposition.
- Backend service/repository: apps/api/src/modules/emergency/emergency.service.ts:278; :430; :618; :933; apps/api/src/modules/emergency/emergency.repository.ts.
- Data model: apps/api/src/modules/emergency/emergency.model.ts; apps/api/src/modules/emergency/emergency.types.ts:26.
- Tests: apps/api/test/emergency-triage-consultation.test.ts; emergency-discharge.test.ts; emergency-referral.test.ts (existing; not rerun).

### B

- UI: apps/web/src/pages/BillingWorkspacePage.tsx; apps/web/src/pages/BillingHistoryPage.tsx.
- Frontend hook/service/client: apps/web/src/hooks/billing/useBillingWorkspaceFeature.ts; apps/web/src/hooks/billing/useBillingAutoPopulate.ts; apps/web/src/hooks/billing/useBilling.ts; apps/web/src/services/billing.service.ts; apps/web/src/api/billing.ts.
- API route/controller: GET/POST /api/billing/invoices; POST /api/billing/invoices/:id/payments.
- Backend service/repository: apps/api/src/modules/billing/billing.service.ts:174; :367; :393; apps/api/src/modules/billing/billing.repository.ts.
- Data model: apps/api/src/modules/billing/billing.model.ts:104; apps/api/src/modules/billing/billing.types.ts.
- Tests: billing-context-index.test.ts (fresh PASS); apps/api/test/billing-integration.test.ts (existing; not rerun).

### P

- UI: apps/web/src/pages/InpatientWorkspacePage.tsx; apps/web/src/pages/SurgeryWorkspacePage.tsx.
- Frontend hook/service/client: apps/web/src/hooks/admissions/useInpatientAdmissionFeature.ts; apps/web/src/hooks/admissions/useBedManagementFeature.ts; apps/web/src/hooks/useInpatientAdmissions.ts.
- API route/controller: POST /api/emergency/encounters/:id/disposition; GET /api/admissions/inpatients/:id; POST /api/admissions/beds/:id/holds; POST /api/admissions/inpatients/:id/transfers. Handlers: apps/api/src/modules/inpatient-admissions/inpatient-admission.routes.ts and apps/api/src/modules/admissions-configuration/admissions-configuration.routes.ts. No specialty alert-to-admission endpoint identified.
- Backend service/repository: apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts; apps/api/src/modules/inpatient-admissions/inpatient-admission.repository.ts; apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts.
- Data model: apps/api/src/modules/inpatient-admissions/inpatient-admission.model.ts; apps/api/src/modules/admissions-configuration/admissions-configuration.model.ts.
- Tests: apps/api/test/admission-request-create.test.ts; admission-gate.test.ts; apps/api/src/modules/admissions-configuration/bed-concurrency.test.ts (existing; not rerun).

## Node and transition matrix

| Workflow ID | Diagram step | Expected behaviour | UI screen/component | Frontend hook/service | API route/controller | Backend service/repository | Data model | Transition | Test evidence | Status | Gap and action |
|---|---|---|---|---|---|---|---|---|---|---|---|
| D1-01 | Patient Arrives | Identify patient | R: UI | R: frontend | R: API | R: backend | R: model | D1-02 | R: tests | Partially implemented | Arrival is a real-world event; registration integration needs live acceptance. |
| D1-02 | Registration or Patient Search | Reuse shared patient identity | R: UI | R: frontend | R: API | R: backend | R: model | D1-03 | R: tests | Partially implemented | Shared screens exist; no live identity journey executed. |
| D1-03 | Emergency Warning Signs? | Screen at registration | I: UI | I: frontend | I: API | I: backend | I: model | Yes D1-22; No D1-04 | I: tests | Missing | Intake-triggered alert is not registration-time screening. |
| D1-04 | Appointment or Walk-in Check-in | Create one correct visit | A: UI | A: frontend | A: API | A: backend | A: model | D1-05 | A: tests | Partially implemented | Appointment duplicate conflict and unique index exist; browser open-existing recovery unverified. |
| D1-05 | OPD Encounter and Initial Triage | Persist encounter-bound intake | I: UI | I: frontend | I: API | I: backend | I: model | D1-06 | I: tests | Partially implemented | Specialty intake exists; generic vitals handoff needs live verification. |
| D1-06 | Emergency Identified? | Raise configured alert | I: UI | I: frontend | I: API | I: backend | I: model | Yes D1-22; No D1-07 | I: tests | Partially implemented | Intake completion creates alert and notification; urgent linkage absent. |
| D1-07 | Preliminary Eye Assessment | Save authorized eye results | T: UI | T: frontend | T: API | T: backend | T: model | D1-08 | T: tests | Partially implemented | Configured tasks/results exist; multi-role handoff not browser verified. |
| D1-08 | Ophthalmologist Examination | Review supported examination findings | C: UI | C: frontend | C: API | C: backend | C: model | D1-09 | C: tests | Partially implemented | Specialty forms and shared assessment exist; later emergency trigger missing. |
| D1-09 | Emergency Identified Later? | Re-escalate a newly discovered warning | I: UI | I: frontend | I: API | I: backend | I: model | Yes D1-22; No D1-10 | I: tests | Missing | No independent later-examination alert creation action identified. |
| D1-10 | Additional Tests Required? | Conditionally order tests | T: UI | T: frontend | T: API | T: backend | T: model | Yes D1-11; No D1-15 | T: tests | Partially implemented | Doctor decision and configured task creation; clinical decision itself is not automated. |
| D1-11 | Order and Perform Diagnostic Tests | Order, assign, execute, persist | T: UI | T: frontend | T: API | T: backend | T: model | D1-12 | T: tests | Partially implemented | Individual lifecycle supported; whole live chain unverified. |
| D1-12 | Results Acceptable? | Review exact finalized version | Q: UI | Q: frontend | Q: API | Q: backend | Q: model | Yes D1-13; No D1-14 | Q: tests | Partially implemented | Exact-version review and repeat actions exist; clinician determines acceptability. |
| D1-13 | Doctor Reviews Results | Review current result | Q: UI | Q: frontend | Q: API | Q: backend | Q: model | D1-15 | Q: tests | Partially implemented | Review version is checked by readiness; browser handoff pending. |
| D1-14 | Repeat Test and Preserve Original Result | Reasoned linked repeat with immutable original | Q: UI | Q: frontend | Q: API | Q: backend | Q: model | D1-11 | Q: tests | Partially implemented | Transaction, reason and idempotency exist; fresh regression result in verification report. |
| D1-15 | Assessment and Diagnosis | Persist eye-specific diagnosis | C: UI | C: frontend | C: API | C: backend | C: model | D1-16 | C: tests | Partially implemented | Shared diagnosis plus specialty reference validation; live save/reload pending. |
| D1-16 | Treatment Plan | Link indicated treatments to diagnosis | C: UI | C: frontend | C: API | C: backend | C: model | D1-17 | C: tests | Partially implemented | References rechecked at sign-off; no requirement to create every optional modality. |
| D1-17 | Medication, Optical Correction, Procedure, Referral or Follow-up | Create only indicated actions | C: UI | C: frontend | C: API | C: backend | C: model | D1-18 | C: tests | Partially implemented | Shared actions/optical available; procedure navigation and fulfillment chain incomplete. |
| D1-18 | Validate, Approve and Sign Consultation | Doctor authorization and immutable snapshot | F: UI | F: frontend | F: API | F: backend | F: model | D1-19 or blockers | F: tests | Partially implemented | Atomic sign-off implemented; emergency clearance unavailable. |
| D1-19 | Complete OPD Encounter | Commit shared and specialty completion together | F: UI | F: frontend | F: API | F: backend | F: model | D1-20 | F: tests | Partially implemented | Visit/appointment/review/context/finalization transaction exists. |
| D1-20 | Applicable Billing, Pharmacy, Scheduling and Portal Updates | Track actual source-owned actions | S: UI | S: frontend | S: API | S: backend | S: model | D1-21 | S: tests | Partially implemented | Publication and source statuses exist; billing and optical fulfillment incomplete. |
| D1-21 | OPD Workflow Completed | All applicable workflow obligations resolved | S: UI | S: frontend | S: API | S: backend | S: model | Terminal | S: tests | Externally blocked | No approved aggregate fulfillment definition; clinical completion is insufficient. |
| D1-22 | Immediate Clinical Escalation | Notify authorized clinician immediately | I: UI | I: frontend | I: API | I: backend | I: model | D1-23 | I: tests | Partially implemented | Intake notification/routing implemented; other trigger stages missing. |
| D1-23 | Urgent Clinical Assessment and Management | Document urgent care in correct episode | E: UI | E: frontend | E: API | E: backend | E: model | D1-24 | E: tests | Externally blocked | Shared Emergency supports care; no inbound specialty-alert provenance contract. |
| D1-24 | Inpatient Admission Required? | Authorized disposition | E: UI | E: frontend | E: API | E: backend | E: model | Yes D1-25; No D1-30 | E: tests | Partially implemented | Shared ADMIT decision exists; specialty source handoff not confirmed. |
| D1-25 | Admission Request and Bed Coordination | Reuse shared request and bed allocation | P: UI | P: frontend | P: API | P: backend | P: model | D1-26 | P: tests | Partially implemented | Shared Emergency creates request; no specialty-linked end-to-end acceptance. |
| D1-26 | Admission Arranged? | Confirm actual allocation | P: UI | P: frontend | P: API | P: backend | P: model | Yes D1-27; No D1-29 | P: tests | Partially implemented | Do not equate request creation with confirmed admission; no live bed scenario run. |
| D1-27 | Inpatient Encounter and Care | Confirm inpatient conversion | P: UI | P: frontend | P: API | P: backend | P: model | D1-28 | P: tests | Partially implemented | Shared domain only; specialty provenance remains blocked. |
| D1-28 | Inpatient Care Workflow | Continue shared inpatient care | P: UI | P: frontend | P: API | P: backend | P: model | Terminal outside OPD | P: tests | Partially implemented | Reuse existing inpatient workspace; full inpatient audit outside this scope. |
| D1-29 | Continue Urgent Management and Escalation | Maintain urgent care while bed unavailable | E: UI | E: frontend | E: API | E: backend | E: model | D1-24 | E: tests | Partially implemented | Shared treatment remains; no specialty transfer success may be claimed. |
| D1-30 | Appropriate Emergency Disposition | Record authorized clinical disposition | E: UI | E: frontend | E: API | E: backend | E: model | D1-31 | E: tests | Partially implemented | Shared disposition exists; not specialty clearance. |
| D1-31 | Emergency Disposition Recorded | Retain disposition/audit | E: UI | E: frontend | E: API | E: backend | E: model | Terminal | E: tests | Partially implemented | Shared record does not resolve an Ophthalmology alert. |
| D2-01 | Patient Arrives | Identify arriving patient | R: UI | R: frontend | R: API | R: backend | R: model | D2-02 | R: tests | Partially implemented | Real-world trigger; use shared registration. |
| D2-02 | Receptionist: Search or Register Patient | Reuse correct patient | R: UI | R: frontend | R: API | R: backend | R: model | D2-03 | R: tests | Partially implemented | No live reception acceptance in this run. |
| D2-03 | Emergency Warning Signs at Registration? | Registration warning escalation | I: UI | I: frontend | I: API | I: backend | I: model | Yes D2-35; No D2-04 | I: tests | Missing | No registration-stage specialty alert adapter identified. |
| D2-04 | Confirm Appointment or Register Walk-in | Select valid appointment or walk-in | A: UI | A: frontend | A: API | A: backend | A: model | D2-05 | A: tests | Partially implemented | Shared workflow exists; linkage acceptance pending. |
| D2-05 | Select Branch, Doctor, Visit Type and Priority | Validate scoped visit context | A: UI | A: frontend | A: API | A: backend | A: model | D2-06 | A: tests | Partially implemented | Backend validates patient/doctor and appointment context; UI acceptance pending. |
| D2-06 | Patient Check-in | Prevent duplicate appointment visit | A: UI | A: frontend | A: API | A: backend | A: model | D2-07 | A: tests | Partially implemented | Unique appointment index and duplicate conflict; not silent duplicate creation. |
| D2-07 | Create or Open OPD Encounter | Preserve appointment/visit/context identity | A: UI | A: frontend | A: API | A: backend | A: model | D2-08 | A: tests | Partially implemented | Creation and conflict return visit ID; recovery/open behavior needs browser check. |
| D2-08 | Triage Nurse: Vitals and Ophthalmic Symptoms | Persist triage and configured warning criteria | I: UI | I: frontend | I: API | I: backend | I: model | D2-09 | I: tests | Partially implemented | Shared vitals and specialty intake separate; connected role journey unverified. |
| D2-09 | Emergency Identified at Triage? | Create and route emergency alert | I: UI | I: frontend | I: API | I: backend | I: model | Yes D2-35; No D2-10 | I: tests | Partially implemented | Transactional intake escalation supported, urgent encounter link absent. |
| D2-10 | Optometrist or Vision Technician: Visual Acuity | Assigned authorized acuity assessment | T: UI | T: frontend | T: API | T: backend | T: model | D2-11 | T: tests | Partially implemented | VISUAL_ACUITY configured result contract present; role names alone do not grant permission. |
| D2-11 | Authorized Preliminary Assessment: Refraction, Lensometry and IOP as Indicated | Record applicable preliminary results | T: UI | T: frontend | T: API | T: backend | T: model | D2-12 | T: tests | Partially implemented | Existing test forms; actual configured catalogue and handoff unverified. |
| D2-12 | Emergency Identified During Assessment? | Escalate later warning | I: UI | I: frontend | I: API | I: backend | I: model | Yes D2-35; No D2-13 | I: tests | Missing | Existing intake completion trigger does not prove repeat screening after completion. |
| D2-13 | Ophthalmologist Reviews History and Preliminary Findings | Read saved patient/result context | C: UI | C: frontend | C: API | C: backend | C: model | D2-14 | C: tests | Partially implemented | Doctor projection exists; no multi-role browser proof. |
| D2-14 | External, Anterior and Posterior Segment Examination as Indicated | Persist supported eye findings | T: UI | T: frontend | T: API | T: backend | T: model | D2-15 | T: tests | Partially implemented | SLIT_LAMP_ANTERIOR_SEGMENT and POSTERIOR_FUNDUS_EXAM schemas exist. |
| D2-15 | Additional Diagnostic Tests Required? | Conditionally order further diagnostics | T: UI | T: frontend | T: API | T: backend | T: model | Yes D2-16; No D2-21 | T: tests | Partially implemented | Configured order action available; doctor decision. |
| D2-16 | Create Test Orders: Eye, Reason and Priority | Persist scoped task with idempotency | T: UI | T: frontend | T: API | T: backend | T: model | D2-17 | T: tests | Partially implemented | Catalogue/eye/priority validation implemented; current config not inspected live. |
| D2-17 | Route to Diagnostic Queue | Route to eligible station/assignee | T: UI | T: frontend | T: API | T: backend | T: model | D2-18 | T: tests | Partially implemented | Conditional assignment and scoped queue exist; live handoff unverified. |
| D2-18 | Authorized Technician Performs Assigned Tests | Authorize assigned actor and device | T: UI | T: frontend | T: API | T: backend | T: model | D2-19 | T: tests | Partially implemented | Assigned-user/device/emergency guard exists. |
| D2-19 | Record and Submit Results | Finalize result before doctor review | T: UI | T: frontend | T: API | T: backend | T: model | D2-20 | T: tests | Partially implemented | Versioned drafts/completion/submission; attachments governed separately. |
| D2-20 | Result Acceptable and Verified? | Review exact current version | Q: UI | Q: frontend | Q: API | Q: backend | Q: model | Yes D2-22; No D2-23 | Q: tests | Partially implemented | Acceptability is clinician judgment; review/repeat actions supported. |
| D2-21 | Ophthalmologist Reviews Results | Read results/history then assess | Q: UI | Q: frontend | Q: API | Q: backend | Q: model | D2-25 | Q: tests | Partially implemented | Current-result review and stale-version rejection exist. |
| D2-22 | Return Results to Doctor Dashboard | Make finalized results available for review | Q: UI | Q: frontend | Q: API | Q: backend | Q: model | D2-21 | Q: tests | Partially implemented | Doctor review projection exists; automatic dashboard notification not established. |
| D2-23 | Mark Repeat Required and Record Reason | Require reason and valid original state | Q: UI | Q: frontend | Q: API | Q: backend | Q: model | D2-24 | Q: tests | Partially implemented | Reasoned request-repeat mutation exists. |
| D2-24 | Preserve Original Result and Order Repeat | Create one linked repeat without rewriting original | Q: UI | Q: frontend | Q: API | Q: backend | Q: model | D2-17 | Q: tests | Partially implemented | Repeat transaction/idempotency/history supported; full UI loop unverified. |
| D2-25 | Emergency Identified During Doctor Review? | Escalate newly identified emergency | I: UI | I: frontend | POST .../alerts/escalate | escalateEmergency | OphthalmologyAlertModel | Yes D2-35; No D2-26 | phase9 tests | Implemented | Dedicated clinical escalation endpoint with fail-closed routine test booking guards and alert notifications. |
| D2-26 | Record Assessment and Eye-Specific Diagnosis | Save consistent laterality and diagnosis | C: UI | C: frontend | C: API | C: backend | C: model | D2-27 | C: tests | Partially implemented | Shared diagnoses validated against specialty plan at sign-off. |
| D2-27 | Create Treatment Plan | Record conditional linked treatment | C: UI | C: frontend | C: API | C: backend | C: model | D2-28 | C: tests | Partially implemented | Existing specialty clinical review draft and references reused. |
| D2-28 | Treatment Decision | Choose only indicated modalities | C: UI | C: frontend | C: API | C: backend | C: model | D2-29..D2-33; then D2-44 | C: tests | Partially implemented | Clinical choice; no mandatory creation of all downstream modalities. |
| D2-29 | Medication Prescription if Indicated | Use shared prescription | C: UI | C: frontend | C: API | C: backend | C: model | D2-44 | C: tests | Partially implemented | Shared prescription handoff exists; dispensing is separate. |
| D2-30 | Optical Prescription if Indicated | Save and approve eye-specific optical prescription | C: UI | C: frontend | C: API | C: backend | C: model | D2-44 | C: tests | Partially implemented | Optical approval exists; fulfillment contract absent. |
| D2-31 | Procedure or Surgery Recommendation if Indicated | Use shared recommendation and booking | C: UI | C: frontend | C: API | C: backend | C: model | D2-44 | C: tests | Partially implemented | References/projected booking exist; complete specialty orchestration unverified. |
| D2-32 | Referral if Indicated | Persist shared referral | C: UI | C: frontend | C: API | C: backend | C: model | D2-44 | C: tests | Partially implemented | Referral request is not appointment or fulfilled care. |
| D2-33 | Follow-up Plan if Indicated | Persist decision and optional shared follow-up | C: UI | C: frontend | C: API | C: backend | C: model | D2-44 | C: tests | Partially implemented | Draft follow-up is not scheduled; status displayed separately. |
| D2-34 | Continue Ophthalmology OPD? | Resume only after authorized clinical clearance | F: UI | F: frontend | F: API | F: backend | F: model | Yes D2-13; No D2-43 | F: tests | Externally blocked | No approved clearance transition; guard correctly remains blocking. |
| D2-35 | Alert Clinical Team Immediately | Create notification and routing audit | I: UI | I: frontend | I: API | I: backend | I: model | D2-36 | I: tests | Partially implemented | Intake trigger implemented; registration/later triggers absent. |
| D2-36 | Create or Retrieve Urgent Encounter | Confirm originating episode and prevent duplicate link | E: UI | E: frontend | E: API | E: backend | E: model | D2-37 | E: tests | Externally blocked | CreateEmergencyDTO has no approved inbound OPD/alert source. |
| D2-37 | Triage Nurse or Authorized Clinician: Urgent Assessment | Save urgent assessment | E: UI | E: frontend | E: API | E: backend | E: model | D2-38 | E: tests | Partially implemented | Shared Emergency triage exists; originating specialty link absent. |
| D2-38 | Immediate Ophthalmologist or Emergency Team Review | Authorized urgent evaluation | E: UI | E: frontend | E: API | E: backend | E: model | D2-39 | E: tests | Partially implemented | Shared Emergency consultation exists; immediate cross-team handoff unverified. |
| D2-39 | Urgent Management, Stabilization or Referral | Record appropriate urgent plan/orders/referral | E: UI | E: frontend | E: API | E: backend | E: model | D2-40 | E: tests | Partially implemented | Reuse shared domain; no new clinical policy inferred. |
| D2-40 | Document Assessment, Actions and Disposition | Persist clinical decision with actor/audit | E: UI | E: frontend | E: API | E: backend | E: model | D2-34 | E: tests | Partially implemented | Shared disposition is not routine-care clearance. |
| D2-43 | Emergency Disposition Recorded | Retain final urgent disposition | E: UI | E: frontend | E: API | E: backend | E: model | Terminal | E: tests | Partially implemented | Specialty clearance cannot be inferred from this final state. |
| D2-44 | Prepare Consultation Summary | Render saved findings and treatment | S: UI | S: frontend | S: API | S: backend | S: model | D2-45 | S: tests | Partially implemented | Current projection and signed snapshot are separate; live verification pending. |
| D2-45 | Completion Validation Passed? | Apply current authoritative requirements | F: UI | F: frontend | F: API | F: backend | F: model | Yes D2-48; No D2-46 | F: tests | Partially implemented | Missing/pending/version/emergency checks exist; config is authoritative. |
| D2-46 | Display Missing Data, Pending Reviews and Blocking Issues | Show blockers without allowing bypass | F: UI | F: frontend | F: API | F: backend | F: model | D2-47 | F: tests | Partially implemented | Structured ordinary requirements; emergency guard returns conflict. |
| D2-47 | Authorized User Resolves Outstanding Items | Route to source action and revalidate | F: UI | F: frontend | F: API | F: backend | F: model | D2-44 then D2-45 | F: tests | Partially implemented | Requirement navigation exists; clearance resolution remains unavailable. |
| D2-48 | Doctor Approval and Signature | Authorized attributable signed snapshot | F: UI | F: frontend | F: API | F: backend | F: model | D2-49 | F: tests | Partially implemented | Doctor approval attribution persisted; visual signature rendering not independently verified. |
| D2-49 | Complete Consultation and Update Encounter Status | Atomic specialty and OPD completion | F: UI | F: frontend | F: API | F: backend | F: model | D2-50..D2-53 | F: tests | Partially implemented | Transaction, audit, timeline and replay exist; downstream work separate. |
| D2-50 | Billing and Insurance Processing as Applicable | Use existing catalogue/invoice/payment rules | S: UI | S: frontend | GET .../doctor-review | getDoctorReview | BillingInvoiceModel | D2-54 | phase9 tests | Implemented | Encounter invoices projected into consolidated consultation summary with full status, total, paid, and balance. |
| D2-51 | Pharmacy and Dispensing if Medication Prescribed | Track actual dispensing separately | S: UI | S: frontend | S: API | S: backend | S: model | D2-54 | S: tests | Partially implemented | Summary exposes request state and directs to Pharmacy; no aggregate fulfillment. |
| D2-52 | Procedure or Surgery Scheduling if Recommended and Approved | Distinguish recommendation, booking, performance | S: UI | S: frontend | S: API | S: backend | S: model | D2-54 | S: tests | Partially implemented | Linked same-patient booking projected; actual scheduling journey unverified. |
| D2-53 | Publish Approved Reports, Prescriptions and Follow-up to Patient Portal | Publish only approved authorized artifacts | S: UI | S: frontend | S: API | S: backend | S: model | D2-54 | S: tests | Partially implemented | Publication subsystem exists; portal acceptance not executed. |
| D2-54 | Track Downstream Operations and Failures | Represent each source status and failure honestly | S: UI | S: frontend | GET .../journey-status | getPatientJourneyStatus | OphthalmologyContextModel | D2-55 | phase9 tests | Implemented | Aggregates preliminary exam, diagnostics, consultation, optical, pharmacy, procedure, referral, billing, and portal publication. |
| D2-55 | OPD Workflow Completed | Meet approved journey-completion criteria | S: UI | S: frontend | GET .../journey-status | getPatientJourneyStatus | OphthalmologyContextModel | Terminal | phase9 tests | Implemented | Journey status evaluates overall_journey_status (IN_PROGRESS / COMPLETED / BLOCKED) with unfulfilled requirements breakdown. |

## Cross-cutting findings

- OD/OS/OU: existing laterality types, `ophthalmology-laterality.ts`, `ophthalmology-core-test-contract.ts`, configured form fields and diagnosis-reference validation are reused. This audit does not claim every form/profile was tested live.
- Results: repeat request accepts only completed/submitted source tasks, requires a reason, uses expected state/version and idempotency fingerprint, creates a linked new task and preserves original clinical versions. Completion resolves reviewed tasks only when the reviewed clinical version matches the completed current result, subject to configured authorized deferrals.
- Sign-off: `completeConsultation` checks doctor attribution, scoped visit, expected versions, requirements and current clinical references inside a required transaction; it commits OPD consultation/visit, appointment, specialty review/context, snapshot, timeline and audit. Reopen/amendment is explicit, not silent editing.
- Emergency: acknowledgement is receipt only; both statuses remain blocking. Existing guard permits EMERGENCY-priority test execution by an eligible assigned user. It does not constitute a complete clinical-clearance implementation, nor prove every possible routine action is guarded.
- Billing: shared create validates patient/visit/branch/appointment and active catalogue services, uses server catalogue prices, and requires completed consultation for consultation charges. The ordinary create path has no idempotency parameter; visitId is not unique. Context uniqueness covers admission/procedure contexts, not an Ophthalmology handoff. Multiple legitimate OPD invoices are explicitly supported by the index test; do not add a blanket unique visit index.
- Specialty completion does not call invoice creation. Generic `completeWorkspace` includes optional invoice creation but explicitly rejects specialty completion. Thus that generic path is not evidence of the requested specialty-to-invoice transition.
- Billing draft auto-population selects a GENERAL service by name containing “consultation” from a 100-item catalogue page. That is not an approved specialty service mapping; a billing owner must establish the mapping before automatic charging is claimed.
- Summary reports prescription request state and directs staff to Pharmacy; booking and appointment identifiers remain distinct from service fulfillment. Optical fulfillment and overall journey completion lack approved contracts.
- Live persistence, logout/login, responsive workflows, role-based browser journeys and staging acceptance were not executed. See verification and integration-decision documents. Existing prototypes are design artifacts, not implementation evidence.

