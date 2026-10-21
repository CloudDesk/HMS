# Combined Ophthalmology workflow gap closure — 21 October 2026

## Follow-on request: three integration gaps

Pre-edit gap note: preserve all 15 existing changed files and the original untracked audit. Reuse Emergency referral.appointmentId -> OPD appointmentId, existing summary projection, source-domain statuses, finalization transactions, role gates and publication retries. Add minimal read-only trace metadata after patient/branch/appointment validation; do not manufacture a new encounter or referral. Close the acknowledged-alert routine-start/finalization bypass with a fail-closed service guard while the clinical owner defines clearance values/roles; preserve urgent-priority testing and clinical documentation. Show source downstream statuses separately from clinical approval, correcting the unconditional “Follow-up Scheduled” label. No new disposition enum, fulfillment aggregate, or duplicate subsystem. Intended files: specialty repository/service and phase4/phase9 tests, existing summary UI and its focused tests, Emergency referral model index if the lookup requires it, plus this evidence/plan checkpoint. Missing approved disposition remains an explicit dependency. Existing shared statuses and configured result-review prerequisites remain authoritative.

### Follow-on implementation findings (supersedes historical findings below)

- **Gap 1:** Reused Emergency `referral.appointmentId` -> unique OPD `appointmentId`. Summary returns nullable metadata-only source trace after visit/context, appointment, patient, branch and target-department validation. No Emergency assessment/notes are exposed through OPD permissions. Invalid relationships are not reported linked; multiple matching sources produce a conflict. No new encounter/referral is created by a read. A nonunique index covers existing source fields. Conditional booking linkage now also validates patient/doctor/department. Inspection identified a concrete audit gap: link persistence preceded its audit transaction. Link plus audit now share a required transaction; failed linking compensates through the existing Appointment cancellation service. An uncertain commit is reread before compensation. Failed compensation explicitly requires reconciliation; existing appointment history is retained.
- **Gap 2:** ACTIVE and ACKNOWLEDGED emergency screening alerts now block routine test start, result save/finalize (including transactional checks), readiness, override and sign-off. Omitting the receipt requirement from configuration does not bypass the guard. Emergency-priority tests remain available, as do documentation/review and the shared Emergency pathway. Existing acknowledgement actor/version/audit restrictions are retained. No clearance endpoint, disposition value or role grant is invented. Routine resumption for these encounters intentionally remains blocked pending the clinical-owner contract.
- **Gap 3:** Existing clinical prerequisites, doctor sign-off and signed snapshots remain authoritative. Independent pending scheduling/dispensing does not become a sign-off prerequisite. Current summary shows actual prescription status (including Pharmacy's DISPENSED), recommendation status and validated same-patient booking status, referral status/appointment, and follow-up status/date/appointment. Corrected procedure source fields to serviceName/clinicalReason and follow-up date to nextVisitDate. Draft follow-ups are no longer labelled scheduled. Source-request state is explicitly distinct from whole-journey completion. Query failures hide stale summary rows, show the API error and offer the existing retry. Existing exact-key publication mutation/retry remains the only publication path.

### Follow-on unresolved decisions and limits

1. **Clinical owner:** approve disposition values/transitions, clearance and re-escalation conditions, eligible roles, required rationale/evidence, linked Emergency/IP references, legacy handling and audit semantics. Emergency ADMIT/DISCHARGE/TRANSFER is not automatically Ophthalmology clearance. Authorized-clearance/disposition-change tests are not claimed because the endpoint/approved policy does not exist. Negative receipt, authorization, stale-state and guard tests are separate evidence.
2. **Emergency/OPD owners:** approve cross-branch tracing, rescheduled-appointment ancestry, and reverse existing-OPD-alert -> urgent-registration linkage. Current trace supports the direct same-branch referral appointment chain.
3. **Appointments/Emergency owners:** durable cross-service idempotency/reconciliation remains needed for process failure between appointment creation and linking or unavailable compensation. The reconciliation-required error is not an automatic-retry authorization; no distributed transaction is claimed.
4. **Downstream owners:** optical-dispensary fulfillment and aggregate patient-journey completion contracts remain absent. SUBMITTED, SCHEDULED, BOOKED and portal approval mean only their source-domain states. No invented fulfillment aggregate is used.
5. **Acceptance:** browser/clinical UAT remains NOT VERIFIED. Earlier browser blockage is recorded below. Automated tests use isolated replica sets/JSDOM. Projection tests simulate independent source-owner updates; separate shared-domain suites test existing services. These are not multi-role staging acceptance.

### Follow-on changed-file register

Paths are exact and repository-relative. All previous changes remain preserved; files not listed here retain their prior edits documented in the historical register.

| File | Follow-on change |
|---|---|
| `apps/api/src/modules/emergency/emergency.model.ts` | Index existing branch/patient/referral appointment fields. |
| `apps/api/src/modules/emergency/emergency.repository.ts` | Conditional patient/doctor/department checks and session-aware referral link. |
| `apps/api/src/modules/emergency/emergency.service.ts` | Atomic link/audit, uncertain-commit reread, cancellation compensation and reconciliation error. |
| `apps/api/test/emergency-referral-booking.test.ts` | Rollback, retry/reuse, compensation failure and branch authorization tests. |
| `apps/api/src/modules/ophthalmology/ophthalmology.repository.ts` | Validated source trace and linked booking status; prior scope repair retained. |
| `apps/api/src/modules/ophthalmology/ophthalmology.service.ts` | Emergency service guard, source conflict and actual downstream mappings; prior finalization repair retained. |
| `apps/api/src/modules/ophthalmology/ophthalmology.phase4.test.ts` | Acknowledgement cannot authorize routine start; urgent-priority action preserved. |
| `apps/api/src/modules/ophthalmology/ophthalmology.phase5.test.ts` | Late acknowledged alert blocks direct result writes; urgent results remain possible. |
| `apps/api/src/modules/ophthalmology/ophthalmology.phase9.test.ts` | Configuration/override bypass rejection, source validation/reuse/duplicates, pending fulfillment sign-off, immutable snapshots and current status projection. |
| `apps/api/src/modules/ophthalmology/ophthalmology.phase10.test.ts` | Publication rollback and exact-key retry without duplicates. |
| `apps/web/src/components/ophthalmology/OphthalmologyConsultationSummaryCard.tsx` | Separate clinical/source states, source trace, truthful follow-up label, linked booking status and error/retry display. |
| `apps/web/src/components/ophthalmology/OphthalmologyConsultationSummaryCard.test.tsx` | Source statuses/trace, no journey-complete claim and stale-error retry tests. |
| `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md` | Additive metadata, guard/error behavior and remaining policy boundaries. |
| `HMS_OPHTHALMOLOGY_FULL_IMPLEMENTATION_PLAN.md` | Follow-on checkpoint. |
| `HMS_OPHTHALMOLOGY_COMBINED_WORKFLOW_GAP_CLOSURE.md` | Current evidence; historical report retained. |

Shared-source edits are limited to the three Emergency files above. No insurance/SHA, global styling, navigation, permission, storage, prototype or unrelated source changes. No next historical phase started.

### Follow-on checks

Common test prefix: `npx vitest run --maxWorkers=1 --hookTimeout=120000`. The following are exact filters and actual results; counts overlap.

```powershell
# 4 files / 49 passed; exit 0; 107.83 s (before final booking-status additions)
npx vitest run --maxWorkers=1 --hookTimeout=120000 apps/api/src/modules/ophthalmology/ophthalmology.phase4.test.ts apps/api/src/modules/ophthalmology/ophthalmology.phase9.test.ts apps/api/src/modules/ophthalmology/ophthalmology.phase10.test.ts apps/web/src/components/ophthalmology/OphthalmologyConsultationSummaryCard.test.tsx
# 10 files / 70 passed; exit 0; 71.46 s
npx vitest run --maxWorkers=1 --hookTimeout=120000 apps/api/src/modules/ophthalmology/ophthalmology.phase3.test.ts apps/api/src/modules/ophthalmology/ophthalmology.phase5.test.ts apps/api/test/emergency-referral.test.ts apps/api/test/emergency-triage-consultation.test.ts apps/api/test/emergency-discharge.test.ts apps/api/test/admission-request-create.test.ts apps/api/test/admission-request-authorization.test.ts apps/api/test/admission-gate.test.ts apps/api/src/modules/admissions-configuration/bed-concurrency.test.ts apps/web/src/components/ophthalmology/OphthalmologyConsultationSummaryCard.test.tsx
# 7 files / 33 passed; exit 0; 66.18 s
npx vitest run --maxWorkers=1 --hookTimeout=120000 apps/api/src/modules/ophthalmology/ophthalmology.phase9.test.ts apps/web/src/components/ophthalmology/OphthalmologyConsultationSummaryCard.test.tsx apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.test.ts apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.model.test.ts apps/api/test/surgery-gate.test.ts apps/api/test/surgery-concurrency.test.ts apps/api/test/surgery-pharmacy-integration.test.ts
# 2 files / 5 passed; exit 0; 13.06 s
npx vitest run --maxWorkers=1 --hookTimeout=120000 apps/api/test/emergency-referral-booking.test.ts apps/api/test/emergency-referral.test.ts
```

Final broader regression: `npx vitest run --maxWorkers=1 --hookTimeout=120000 ophthalmology emergency-referral` — **53 files / 349 tests passed**, exit 0, 424.28 seconds. This run includes all final production/test edits. Shared Pharmacy/Surgery/admission checks above remain separate evidence and counts overlap.

Changed-file lint: **API and web PASS**, both exit 0. Exact PowerShell commands:

```powershell
$hmsApiChanged = @(git diff --name-only -- 'apps/api/**/*.ts')
npx eslint @hmsApiChanged apps/api/test/emergency-referral-booking.test.ts
$hmsWebChanged = @(git diff --name-only -- 'apps/web/**/*.ts' 'apps/web/**/*.tsx')
npx eslint @hmsWebChanged apps/web/src/components/ophthalmology/OphthalmologyConsultationSummaryCard.test.tsx
```

`git diff --check` passed. Final six repository-wide typecheck/lint/build commands are running at this checkpoint. Assessment remains PARTIALLY ALIGNED — GAPS REMAIN. Branch/HEAD unchanged, no commit/push/PR/deployment.

## Historical baseline and scope

User request: combined diagrams and the implementation request supplied on 21 October. Branch: `DEV-OPHTHALMOLOGY-F-V2`. Original HEAD: `8ca7dc34138f1b2148e4a461f41a9b50c04f1ab1`. Initial status: only untracked `HMS_OPHTHALMOLOGY_IMPLEMENTATION_AUDIT_REPORT.md`; preserve it unchanged. No branch integration, push, PR or deployment is authorized.

Read PROJECT_RULES.md, AGENTS.md, the Scope 2 execution plan, current specialty contracts/evidence, and actual code. The named Developer 1 prompt and specialty field-level FSD are absent from the checkout. The shared FSD exists at `docs/HMS_Release2_FSD.docx`, rather than `doc/`; it specifies shared Emergency disposition and admission ownership. The supplied diagrams establish sequence, not new clinical thresholds or lifecycle contracts. Existing approved service contracts govern this repair. `Scope/HMS Local/opd-consultation.html` and existing OPD styles remain the UI reference and are not edited.

## Evidence register

Paths are relative to this repository. Every matrix row inherits the exact paths in its evidence IDs. PARTIALLY_IMPLEMENTED also denotes a connected implementation whose live end-to-end acceptance has not been demonstrated; it does not assert the code is absent.

| ID | Implementation and verification sources |
|---|---|
| A | `apps/web/src/hooks/patients/usePatientSearchFeature.ts`; `apps/api/src/modules/patients/patient.service.ts`; `apps/api/src/modules/appointments/appointment.service.ts`; `apps/api/src/modules/appointments/appointment-ophthalmology.test.ts`; `apps/web/src/hooks/opd/useOpdVisitFeature.ts`; `apps/api/src/modules/opd/opd-visit.service.ts`; `apps/api/src/modules/opd/opd-visit.model.ts` (visit uniqueness). |
| B | `apps/web/src/hooks/ophthalmology/useOphthalmologyWorkspaceFeature.ts`; `apps/web/src/components/ophthalmology/OphthalmologyIntakeForm.tsx`; `apps/web/src/api/ophthalmology.ts`; `apps/api/src/modules/ophthalmology/ophthalmology.service.ts` (`completeIntake`, `routeEmergency`, `acknowledgeAlert`, `validateStartEligibility`); `apps/api/src/modules/ophthalmology/ophthalmology-intake.model.ts`; `apps/api/src/modules/ophthalmology/ophthalmology.phase3.test.ts`; `apps/api/src/modules/ophthalmology/ophthalmology.phase4.test.ts`. |
| C | `apps/api/src/modules/emergency/emergency.service.ts`; `apps/api/src/modules/inpatient-admissions/inpatient-admission.service.ts`; `apps/api/src/modules/admissions-configuration/admissions-configuration.service.ts`. Shared urgent assessment, disposition, admission requests and bed transactions exist. No specialty alert-to-Emergency source/disposition adapter was found. Shared service presence alone does not verify the combined branch. |
| D | `apps/web/src/hooks/ophthalmology/useOphthalmologyCareFeature.ts`; `apps/web/src/components/ophthalmology/OphthalmologyCareWorkspace.tsx`; `apps/web/src/components/ophthalmology/OphthalmologyDiagnosisEditor.tsx`; `apps/web/src/api/ophthalmology-care.ts`; `apps/api/src/modules/opd/opd-consultation.service.ts`; `apps/api/src/modules/ophthalmology/ophthalmology.service.ts` (`requireDoctor`, `saveClinicalReviewDraft`); `apps/api/src/modules/ophthalmology/ophthalmology.phase8.test.ts`. |
| E | `apps/web/src/hooks/ophthalmology/useOphthalmologyQueueFeature.ts`; `apps/web/src/hooks/ophthalmology/useOphthalmologyResultFeature.ts`; `apps/web/src/components/ophthalmology/OphthalmologyQueueActionDialog.tsx`; `apps/web/src/api/ophthalmology-queue.ts`; `apps/api/src/modules/ophthalmology/ophthalmology.service.ts` (task/result/repeat/review methods); `apps/api/src/modules/ophthalmology/ophthalmology.repository.ts`; `apps/api/src/modules/ophthalmology/ophthalmology-test-task.model.ts`; `apps/api/src/modules/ophthalmology/ophthalmology-test-result.model.ts`; `apps/api/src/modules/ophthalmology/ophthalmology.phase4.test.ts` through `ophthalmology.phase7.test.ts`; `apps/api/src/modules/ophthalmology/ophthalmology.phase9.test.ts`. |
| F | D plus `apps/web/src/components/ophthalmology/OphthalmologyClinicalReviewEditor.tsx`; `apps/web/src/components/ophthalmology/OphthalmologyOpticalEditor.tsx`; `apps/api/src/modules/ophthalmology/ophthalmology.repository.ts` (`validateReviewReferences`); `apps/api/src/modules/opd/opd-prescription.service.ts`; `apps/api/src/modules/opd/opd-follow-up.service.ts`; `apps/api/src/modules/opd/opd-follow-up.model.ts`; `apps/api/src/modules/opd/opd-referral.service.ts`; `apps/api/src/modules/surgery/surgery.service.ts`. |
| G | `apps/web/src/hooks/ophthalmology/useOphthalmologyCompletionFeature.ts`; `apps/web/src/components/ophthalmology/OphthalmologyCompletionWorkspace.tsx`; `apps/web/src/api/ophthalmology-completion.ts`; `apps/api/src/modules/ophthalmology/ophthalmology.service.ts` (`evaluateCompletionReadiness`, `completeConsultation`, amendments); `apps/api/src/modules/ophthalmology/ophthalmology-consultation.model.ts`; `apps/api/src/modules/ophthalmology/ophthalmology.phase9.test.ts`; `apps/web/src/hooks/ophthalmology/useOphthalmologyCompletionFeature.test.tsx`. |
| H | `apps/web/src/components/ophthalmology/OphthalmologyConsultationSummaryCard.tsx`; `apps/web/src/components/ophthalmology/OphthalmologyPublicationTools.tsx`; `apps/web/src/hooks/ophthalmology/useOphthalmologyPublications.ts`; `apps/api/src/modules/ophthalmology/ophthalmology-phase10.service.ts`; `apps/api/src/modules/ophthalmology/ophthalmology-phase10.repository.ts`; `apps/api/src/modules/ophthalmology/ophthalmology.phase10.test.ts`; `apps/api/src/modules/billing/billing.service.ts`; `apps/api/src/modules/pharmacy-dispensing/pharmacy-dispensing.service.ts`. |
| R | `apps/api/src/modules/ophthalmology/ophthalmology.routes.ts`, `ophthalmology.schemas.ts`, `ophthalmology.types.ts`; `apps/web/src/services/ophthalmology.service.ts`; domain hooks and API clients above. Routes enforce per-action permissions; service checks enforce branch/department, doctor identity and expected versions; repositories own persistence and required transactions. |

## Workflow matrix before repair

Numbering matches sections A–H of the supplied implementation request. Grouped numbers share the same evidence and limitation; no numbered requirement is omitted. Test sources above are located evidence, not a claim of execution until the verification section is populated.

| Requirements | Status | Evidence / confirmed gap or acceptance limit |
|---|---|---|
| A1 patient search/registration | PARTIALLY_IMPLEMENTED | A; shared persistence exists, browser acceptance pending. |
| A2 warning signs at registration | MISSING | A/B; specialty screening is intake completion, not registration. |
| A3 immediate escalation from registration | BLOCKED_BY_DEPENDENCY | B/C; missing approved alert/source handoff contract before OPD context exists. |
| A4 appointment/walk-in; A5 branch/type/priority; A6 check-in; A7 encounter; A8 triage | PARTIALLY_IMPLEMENTED | A/B; connected shared visit/intake, uniqueness indexes; full arrival-to-triage and retry acceptance pending. |
| B1 findings/vitals/symptoms | PARTIALLY_IMPLEMENTED | B and shared OPD vitals; no certification of clinically configured fields. |
| B2 emergency at triage; B3 escalation | PARTIALLY_IMPLEMENTED | B; configured intake creates transactional alert/notifications; urgent encounter not linked. |
| B4 routine station routing; B5 preliminary assessment | PARTIALLY_IMPLEMENTED | E/R; assignment and configured results persist; role-specific browser path pending. |
| B6 emergency during assessment | BLOCKED_BY_DEPENDENCY | B/C; intake alert is not a general later-stage emergency disposition contract. |
| B7 stable route to doctor | PARTIALLY_IMPLEMENTED | E; routeTestTask supports doctor handoff; no explicit clinical clearance/disposition state. |
| C1 clinical alert | PARTIALLY_IMPLEMENTED | B; intake alert/notifications exist; registration and later-stage triggers absent. |
| C2 urgent encounter retrieval | BLOCKED_BY_DEPENDENCY | C; shared Emergency exists but source-link/duplicate handling from specialty alert is undefined. |
| C3 urgent assignment; C4 immediate assessment; C5 management/referral; C6 disposition documentation | PARTIALLY_IMPLEMENTED | C; shared functionality, no combined specialty handoff acceptance. |
| C7 routine-care continuation decision | BLOCKED_BY_DEPENDENCY | B/C; ACKNOWLEDGED is not a clinical disposition. Needs approved clearance/re-escalation semantics. |
| C8 admission request/bed coordination; C9 arranged inpatient handoff; C10 unavailable admission; C11 no-admission disposition | PARTIALLY_IMPLEMENTED | C; shared admission/bed/Emergency services exist. Combined source linkage and negative branch acceptance remain pending. |
| D1 history/findings; D2 examination | PARTIALLY_IMPLEMENTED | D/E; persisted review/result sources, browser and clinical form acceptance pending. |
| D3 emergency evaluation; D4 immediate escalation | BLOCKED_BY_DEPENDENCY | B/C; no general examination-stage urgent-encounter/disposition adapter. |
| D5 assessment/eye diagnosis; D6 code/field validation | PARTIALLY_IMPLEMENTED | D/R; backend doctor identity and scope checks present; approved terminology/configuration acceptance pending. |
| E1 test decision; E2 order fields; E3 queue; E4 assignment/execution | PARTIALLY_IMPLEMENTED | E/R; explicit conditional task creation; no invented test defaults. |
| E5 draft; E6 configured finalization | REQUIRES_CLINICAL_ACCEPTANCE | E; immutable result versions and configured validators exist; deployed clinical profiles need acceptance. |
| E7 return to doctor; E8 accept/review | PARTIALLY_IMPLEMENTED | D/E; exact-version review; direct repeat action missing from doctor review screen. |
| E9 repeat reason; E10 original preserved/link; E11 repeat queue | PARTIALLY_IMPLEMENTED | E; existing transactional repeat action and idempotency. Connect review screen to this action. |
| E12 additional orders; E13 pending/repeat failures visible | PARTIALLY_IMPLEMENTED | E/H; explicit queue/status/report paths; browser/error acceptance pending. |
| F medication action; F optical action; F referral action; F follow-up action | PARTIALLY_IMPLEMENTED | F; separate conditional shared actions exist; valid follow-up plan references incorrectly filter on nonexistent branchId. |
| F procedure/surgery action | PARTIALLY_IMPLEMENTED | F; shared recommendation exists, specialty selection/link authoring is incomplete. |
| F1 save plan; F2 conditional applicability; F3 existing services; F4 optical approval | PARTIALLY_IMPLEMENTED | F/R; draft and approved optical are separate; not every treatment type required. |
| F5 patient/encounter links | PARTIALLY_IMPLEMENTED | F; fix follow-up scope and revalidate plan/diagnosis links at finalization. |
| F6 surfaced action failure | PARTIALLY_IMPLEMENTED | D/G; inline errors retained, missing Sonner error feedback in these feature hooks. |
| G1 required documentation; G2 result reviews/tasks; G3 blockers; G4 backend prevention; G5 resolution/revalidation | PARTIALLY_IMPLEMENTED | G; configured readiness and exact override snapshots exist; saved plan references can become stale before finalization. |
| G6 doctor sign-off; G7 service finalization; G8 audit/amendments | PARTIALLY_IMPLEMENTED | G/R; authenticated active doctor, atomic statuses and immutable history exist; clinical UAT pending. |
| H1 persisted summary | PARTIALLY_IMPLEMENTED | H/G; current DTO mapping exists; browser verification pending. |
| H2 billing; H3 pharmacy | PARTIALLY_IMPLEMENTED | H/F; shared operations remain explicit; no end-to-end downstream acceptance this run. |
| H4 optical dispensary | BLOCKED_BY_DEPENDENCY | F/H; approved prescription/publication exist, no supported optical-dispensary fulfillment contract identified. |
| H5 scheduling; H6 referrals/follow-up | PARTIALLY_IMPLEMENTED | F; explicit shared workflows, specialty orchestration incomplete. |
| H7 authorized portal | PARTIALLY_IMPLEMENTED | H/R; backend permission correct; completion hook incorrectly uses Consultation View for publication list. |
| H8 statuses/failures; H9 pending/failed display | PARTIALLY_IMPLEMENTED | H; publication tooling and shared statuses exist, no unified handoff status contract. |
| H10 overall completion criteria | BLOCKED_BY_DEPENDENCY | G/H; clinical completion is defined; criteria for overall downstream completion are not approved. Do not equate clinical completion with successful fulfillment. |

## Implemented repairs

1. Follow-up references: use authoritative visit/patient/branch/department scope, then the follow-up's actual visit/patient fields. Reuse the shared model without adding a second branch field or model.
2. Finalization: rerun existing diagnosis/laterality and reference checks inside its existing transaction before any completion write. Existing override must not bypass reference integrity.
3. Review-to-repeat navigation: permission/state-gated link to the existing queue repeat dialog; preserve original result and existing reason/station/idempotency workflow.
4. Completion publication requests: removed the unused duplicate publication read/mutations from the completion hook. Existing dedicated publication tools retain their own permission and refresh gates. Preserve inline errors and add Sonner failure feedback in the care/completion feature hooks.
5. Alert display: explicitly says acknowledgement is receipt, not clinical disposition or OPD clearance, and does not claim an Emergency encounter link. Added acknowledgement persistence/replay assertions and ACTIVE/ACKNOWLEDGED UI regression cases.

No new clinical enums, thresholds, emergency disposition rules, shared layouts, permission seeds or architecture. No new phase of the historical Scope 2 plan is started. The user's combined repair/verification stages are authorized together.

## Historical boundary findings before the three-gap follow-on

### Emergency registration to OPD

There IS an existing indirect relationship for an Emergency referral booked into OPD: `EmergencyEncounter.referral.appointmentId` -> `OpdVisit.appointmentId`. `EmergencyService.bookReferral` reuses Appointments, returns an already-booked referral on retry, conditionally links the appointment and compensates a concurrent loser by cancellation. `OpdVisitService.createFromAppointment` authorizes branch scope, derives patient/doctor/department from the appointment, rejects terminal appointments and duplicate/active visits, and creates the visit/check-in transactionally. This path needs no parallel source field. It does not prove all cross-service failure windows are atomic or that the full chain passed live acceptance. `emergency-referral.test.ts` covers schema and referring-doctor derivation, not the entire booking/check-in chain.

This outgoing referral chain does NOT connect an existing Ophthalmology OPD encounter/alert to an urgent Emergency registration. `CreateEmergencyDTO` and `EmergencyEncounter` have patient identity, but no approved inbound OPD/alert reference. Patient equality is not encounter provenance. Existing Emergency order `sourceId` and admission references describe downstream resources and must not be repurposed. The alert UI makes no successful-link claim.

Owner: Emergency + OPD shared-domain maintainers, with Ophthalmology consuming the approved contract. Affected files for a future approved change: `apps/api/src/modules/emergency/emergency.{types,schemas,model,repository,service,routes}.ts`, OPD visit contract/service if a reverse lookup is required, Ophthalmology intake/alert DTO and adapter, and their web API/domain/feature hooks. Minimum decision: authoritative relationship direction/cardinality, identifier and duplicate/retry rules, patient/branch/department validation, eligible actor, audit and transaction/compensation boundary, and how a return to the original OPD differs from a new referral appointment. No speculative schema field or duplicate Emergency subsystem was added.

### Alert acknowledgement versus clinical disposition

Approved alert lifecycle remains `ACTIVE -> ACKNOWLEDGED` in `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md` and `ophthalmology-intake.model.ts`. `acknowledgeAlert` checks visit, scope, exact version/status and eligible clinician, conditionally persists actor/time/note and audits in a required transaction. Repeated stale or already-acknowledged requests conflict; they do not add a second acknowledgement. It neither creates a disposition nor resolves an Emergency encounter. Reading the alert performs no resolution mutation.

Important unresolved behavior: `validateStartEligibility` blocks routine tests only while the alert is ACTIVE; ACKNOWLEDGED removes that receipt gate. `ALERTS_ACKNOWLEDGED` completion readiness also checks receipt only. Neither is a clinical-clearance gate. Existing phase4 behavior must not be cited as evidence that emergency disposition is implemented. No approved clearance/re-escalation lifecycle exists, so this run does not invent new statuses, a permanent hold, or a silent resolution transition. This remains a release-blocking workflow gap, despite the explicit UI warning.

Owner: Ophthalmology clinical contract owner with Emergency/IP integration owners. Future affected files: `ophthalmology-intake.model.ts`, `ophthalmology.types.ts`, `ophthalmology.schemas.ts`, `ophthalmology.repository.ts`, `ophthalmology.service.ts`, routes/permissions as approved, web alert API types/workspace feature/page, and phase3/phase4/phase9 tests. Minimum approved contract: dispositions and allowed transitions; eligible role; required rationale and linked Emergency/admission evidence; routine-care clearance and re-escalation semantics; exact-version/retry behavior; immutable audit; legacy-alert handling. Acknowledgement notes cannot substitute for this contract. No new disposition action exists to test; current acknowledgement authorization, persistence, replay rejection and UI semantics are tested separately.

## Historical resume verification of the 13 requested stages

Evidence IDs refer to exact paths above. These are implementation findings, not clinical or browser acceptance.

| Stage | Code and test evidence | Current conclusion |
|---|---|---|
| 1. Search/registration/emergency screening | A/B; appointment-ophthalmology, phase3 | Search/registration reused; configured intake screening exists. Registration-time screening/escalation remains missing. |
| 2. Appointment/walk-in/check-in/OPD | A; `opd-visit.service.ts` createFromAppointment; appointment-ophthalmology | Persisted appointment-to-visit relationship exists. Indirect Emergency referral chain described above; full chain UAT pending. |
| 3. Triage/escalation | B/C; phase3 and emergency-triage-consultation | Transactional alert/notification and eligible acknowledgement; no specialty urgent-encounter adapter. |
| 4. Preliminary assessment/reassessment | B/E; phase3–phase7 | Configured result forms/task lifecycle exist; later-stage emergency reassessment/disposition gap remains. |
| 5. Ophthalmologist examination/reassessment | D; phase8 | Doctor review/diagnosis persists. General examination-stage emergency adapter and clinical clearance remain absent. |
| 6. Orders/queue/finalization/review/repeat | D/E; phase4–phase7; care feature tests | Existing task/result workflow reused; doctor review now opens existing repeat dialog under permission/state gates. |
| 7. Preserve originals/repeat reason | E; phase5 added rollback/retry/replay test | Original completed result/history retained; repeat uses existing reason and link/idempotency contract. |
| 8. Conditional diagnosis/plan | D/F; phase8/phase9 | Shared treatment references and laterality revalidated at finalization. Does not require every optional treatment type. |
| 9. Medication/optical/procedure/referral/follow-up | F; phase8; shared OPD services | Follow-up scope defect repaired; optical/shared actions reused. Specialty procedure-selection orchestration and downstream clinical UAT remain incomplete. |
| 10. Validation/blockers/sign-off/finalization | G/R; phase9; completion feature tests | Authoritative doctor/version/transaction gates retained; stale references now block completion without partial writes. Alert receipt is not clinical disposition. |
| 11. Admission/bed/IP | C; admission-request-create/authorization/gate, bed-concurrency, Emergency tests | Existing shared contracts reused; combined specialty provenance/return and live negative branches not verified. |
| 12. Summary/downstream handoffs | H; phase10 and publication tests | Persisted summary and permission-gated publication tools; no new duplicate billing/pharmacy. Optical fulfillment and unified handoff contracts missing. |
| 13. Pending/failed/final completion | E/G/H; phases9–10 | Individual task/publication failures and clinical completion exist. Overall downstream success criteria and live workflow acceptance remain unverified. |

## Historical resume verification and final outcome

Assessment: **PARTIALLY ALIGNED — GAPS REMAIN**. Branch and HEAD unchanged: `DEV-OPHTHALMOLOGY-F-V2`, `8ca7dc34138f1b2148e4a461f41a9b50c04f1ab1`. No commit, branch integration, push, PR or deployment.

Focused rerun command:

```powershell
npx vitest run --maxWorkers=1 --hookTimeout=120000 apps/api/src/modules/ophthalmology/ophthalmology.phase8.test.ts apps/api/src/modules/ophthalmology/ophthalmology.phase9.test.ts apps/web/src/hooks/ophthalmology/useOphthalmologyCareFeature.test.tsx apps/web/src/hooks/ophthalmology/useOphthalmologyCompletionFeature.test.tsx
```

Result: **4 files, 32 tests passed**, exit 0, 75.62 seconds on resume (prior successful run: 92.54 seconds). Earlier parallel attempts hit resource/setup timeouts and were not counted as passing. Tests use isolated Mongo replica sets/JSDOM, not the running HMS database or browser.

Broader specialty regression: `npx vitest run --maxWorkers=1 --hookTimeout=120000 ophthalmology` — **50 files, 334 tests passed**, exit 0, 592.03 seconds. Includes API phases2–11, appointment specialty integration, result comparisons/public payload/export/permission seed, staff API/hooks/components/pages and patient-portal publication client tests. This passes the new phase5 preservation/rollback/retry test. Counts overlap the 32 focused tests and must not be added as unique coverage. Since alert/page assertions were edited while this larger run was active, they are explicitly rerun with the selected shared-domain checks below.

Selected shared-domain verification plus final alert assertions:

```powershell
npx vitest run --maxWorkers=1 --hookTimeout=120000 apps/api/src/modules/ophthalmology/ophthalmology.phase3.test.ts apps/web/src/pages/OphthalmologyWorkspacePage.test.tsx apps/api/test/emergency-referral.test.ts apps/api/test/emergency-triage-consultation.test.ts apps/api/test/emergency-discharge.test.ts apps/api/test/admission-request-create.test.ts apps/api/test/admission-request-authorization.test.ts apps/api/test/admission-gate.test.ts apps/api/src/modules/admissions-configuration/bed-concurrency.test.ts
```

Result: **9 files, 46 tests passed**, exit 0, 112.42 seconds. Includes 7 shared-domain suites plus 2 explicitly rerun specialty suites. These test existing contracts and isolated transaction/concurrency paths; they are not a full Emergency-referral-to-OPD or specialty-to-IP browser scenario. No new disposition lifecycle is implemented or claimed.

Repository-wide lint baseline: API FAIL (50 pre-existing errors): insurance repository 1, service 18, tests 23; patient service 8. Web FAIL (14 pre-existing errors): doctors/DoctorSignatureCard 1; patients/PatientAvatar.test 1, PatientCardModal 1, PatientProfileHeader 1; ui/AuthenticatedMediaImage 1; AppointmentBookingPage 4, AppointmentCalendarPage 2, PatientProfilePage 1, UserManagementPage 2. `git diff --exit-code HEAD -- <listed paths>` returned exit 0 with no changes; excluded modules were not repaired.

Owned-file lint: **API PASS, web PASS**, both exit 0, running `npx eslint` on the changed API `.ts` paths and changed web `.ts/.tsx` paths returned by `git diff --name-only`. `git diff --check` PASS; only Git's existing LF/CRLF normalization notices were emitted.

Final post-alert-change rerun (executed sequentially, every command completed):

| Exact command | Result |
|---|---|
| `npm run typecheck --workspace=@hms/api` | PASS, exit 0 |
| `npm run lint --workspace=@hms/api` | FAIL, exit 1; same 50 unchanged-file errors listed above |
| `npm run build --workspace=@hms/api` | PASS, exit 0 |
| `npm run typecheck --workspace=@hms/web` | PASS, exit 0 |
| `npm run lint --workspace=@hms/web` | FAIL, exit 1; same 14 unchanged-file errors listed above |
| `npm run build --workspace=@hms/web` | PASS, exit 0; Vite 8.3.1, 865 modules; advisory plugin timing warning only |

Final working tree: 14 modified tracked files listed in the changed-file register; new untracked gap-closure report; preserved pre-existing untracked audit report. No staged changes or new commits. No runtime schema/shared registry changes, generated files manually edited, or unrelated source changes. Verification is complete to the feasible automated extent; clinical/browser acceptance and documented contract gaps remain open.

### Browser acceptance: BLOCKED

Earlier observation at `http://localhost:5173`: “Verifying access & session” / synchronizing clinical workspace. On the resumed one-time recheck, browser tooling returned “Local browser use is disabled in Work settings.” No authentication bypass, clinical browser mutation or browser acceptance claim. Whether the session bootstrap has recovered is unknown. Unit/integration tests are separate evidence.

### Remaining staging UAT

Use authorized staging accounts/fixtures and approved clinical configurations once browser access and session bootstrap work. Verify reception search/register/appointment/walk-in/check-in and duplicate retry; triage escalation and reception/later-exam emergency branches; nurse/technician/doctor scope and forbidden actions; result drafts/finalization, unacceptable-result reason/repeat and original history; conditional prescriptions/optical/procedure/referral/follow-up; missing-data/stale-reference blockers and doctor sign-off; concurrent admission/bed unavailability/rollback and disposition; summary/publication/downstream failures; logout/login persistence; narrow-screen behavior. Record actual patient/encounter-linked evidence without putting clinical data in logs. Emergency clearance/source linkage and overall downstream completion cannot pass until approved missing contracts are implemented.

### Changed-file register

| File (repository-relative) | Change |
|---|---|
| `HMS_OPHTHALMOLOGY_COMBINED_WORKFLOW_GAP_CLOSURE.md` | New gap/evidence matrix, boundary analysis, verification and UAT record. |
| `apps/api/src/modules/ophthalmology/ophthalmology.repository.ts` | Authoritative visit scope and correct shared follow-up reference validation. |
| `apps/api/src/modules/ophthalmology/ophthalmology.service.ts` | Revalidate clinical references inside finalization transaction. |
| `apps/api/src/modules/ophthalmology/ophthalmology.phase3.test.ts` | Acknowledgement persistence and repeated/invalid replay assertions. |
| `apps/api/src/modules/ophthalmology/ophthalmology.phase5.test.ts` | Original preservation, repeat audit rollback, retry and idempotency regression. |
| `apps/api/src/modules/ophthalmology/ophthalmology.phase8.test.ts` | Valid follow-up and foreign/deleted reference regressions. |
| `apps/api/src/modules/ophthalmology/ophthalmology.phase9.test.ts` | Stale diagnosis/deleted follow-up block finalization; retry rollback evidence. |
| `apps/web/src/components/ophthalmology/OphthalmologyCareWorkspace.tsx` | Doctor result-review entry to existing repeat action. |
| `apps/web/src/hooks/ophthalmology/useOphthalmologyCareFeature.ts` | Repeat permission/state/navigation and error toast. |
| `apps/web/src/hooks/ophthalmology/useOphthalmologyCareFeature.test.tsx` | Repeat navigation and denied/stale task cases. |
| `apps/web/src/hooks/ophthalmology/useOphthalmologyCompletionFeature.ts` | Remove duplicate publication operations; retain dedicated tools; error toast. |
| `apps/web/src/hooks/ophthalmology/useOphthalmologyCompletionFeature.test.tsx` | No duplicate publication requests on mount/refresh. |
| `apps/web/src/pages/OphthalmologyWorkspacePage.tsx` | Acknowledgement/disposition and unconfirmed-link warning. |
| `apps/web/src/pages/OphthalmologyWorkspacePage.test.tsx` | Warning persists for both alert statuses. |
| `HMS_OPHTHALMOLOGY_FULL_IMPLEMENTATION_PLAN.md` | Link current verification checkpoint without changing historical phase status. |

No permission seeds, shared domain schemas, router/navigation registries or prototype files changed. Existing OPD card/button/alert/queue patterns and Sonner used. No next historical Scope 2 phase started. Preserved pre-existing untracked `HMS_OPHTHALMOLOGY_IMPLEMENTATION_AUDIT_REPORT.md`, SHA256 `B658D9D118760C8D95FBD6EF7A4D2E1098FC8284B19A9181C2F76D3A22392C18`.
