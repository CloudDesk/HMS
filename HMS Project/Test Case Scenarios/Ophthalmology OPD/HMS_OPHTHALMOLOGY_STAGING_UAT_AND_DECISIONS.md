# Ophthalmology final workflow review and staging UAT

Date: 21 October 2026. Assessment: **PARTIALLY ALIGNED — GAPS REMAIN**.

This continues the existing implementation; it does not authorize a new phase or introduce a clinical clearance policy. The request ended at Section C; continuation uses the previously established clinical-completion requirements. Prototype images are design previews with synthetic data, not evidence of implemented controls or staging acceptance.

## Repository checkpoint

Branch: `DEV-OPHTHALMOLOGY-F-V2`. Current HEAD: `334605dd45e75a47149da43f65e2e339120c6a77`. At this checkpoint the working tree was clean. Since the previous verification checkpoint, commits `3dd05ad` (Flow Fixes 2) and `334605d` (config fixes) appeared in the repository. This agent did not create them. The first contains the preserved workflow work; the second changes only generated `apps/web/tsconfig.tsbuildinfo`. No clinical source changes occurred between these commits. Do not manually edit the generated file.

The protected audit report SHA256 remains `B658D9D118760C8D95FBD6EF7A4D2E1098FC8284B19A9181C2F76D3A22392C18`. No branch switch, commit, push, PR or deployment performed by this agent.

## A. Emergency traceability: implemented contract and proposed dependency

Implemented outbound chain: `EmergencyEncounter.referral.appointmentId -> OpdVisit.appointmentId`. The specialty repository validates the context/visit patient, branch and department; validates the appointment against the same context; then finds matching Emergency referral metadata. Invalid relationships return no confirmed source; multiple sources fail with `OPHTHALMOLOGY_SOURCE_CONFLICT`. OPD access does not grant access to Emergency clinical notes. The existing OPD appointment uniqueness is reused.

Emergency referral booking conditionally links the matching patient/doctor/department and commits linkage with its audit in a required MongoDB transaction. On failure, the existing Appointment service cancels an unlinked appointment; uncertain commits are reread before compensation. Failed compensation returns `EMERGENCY_REFERRAL_BOOKING_RECONCILIATION_REQUIRED`. A process crash between appointment creation and linkage still requires a durable owner-provided recovery contract. Direct same-branch tracing does not establish rescheduling ancestry or cross-branch access.

Evidence: `apps/api/src/modules/emergency/emergency.{model,repository,service}.ts`, `apps/api/src/modules/ophthalmology/ophthalmology.{repository,service}.ts`, `apps/api/test/emergency-referral-booking.test.ts`, `ophthalmology.phase9.test.ts`.

### Proposed inbound integration contract — NOT APPROVED OR IMPLEMENTED

Owner: Emergency with core OPD; Ophthalmology consumes the approved contract. Existing `POST /api/emergency/encounters` accepts branch, department, existing patient or provisional identity, arrival and complaint data. Its `createEmergencySchema` has no OPD visit/context/alert source or durable request-id contract. `link-patient` links identity, not OPD provenance. A frontend adapter must not insert identifiers into free-text notes or fabricate confirmation.

Proposed backward-compatible extension: retain the existing registration DTO and response for legacy callers; add an optional, typed source envelope only after owner approval. Names below describe semantic requirements, not approved database fields or endpoint names.

| Concern | Proposed minimum contract / approval required |
|---|---|
| Identifiers | Existing OPD visit ID, specialty context ID, emergency alert ID and expected alert version; server-derived patient and source branch; authorized destination department; optional existing Emergency encounter ID for a link operation. Persist an explicit owner-managed source relation, not another appointment or duplicate encounter subsystem. Owner chooses field names/storage/index migration. |
| Validation | Re-read all references server-side; alert belongs to context, context to visit, visit to patient/branch. Existing Emergency encounter must match the patient and approved branch policy. Reject stale alerts, mismatches, deleted sources and unsupported provisional-identity conversion. Never infer identity from display text. |
| Cardinality | Owner must define whether multiple alerts in one visit share an urgent encounter and when a new emergency episode is justified. Until approved, conflicting links fail closed; do not silently choose the newest encounter. |
| Authorization | Retain existing Emergency/Encounters/Register for creation, existing scope checks and OPD/specialty source access. Owners must approve a specific permission for linking an existing encounter and the eligible role intersection; do not assume registration permission grants source-clinical access. Read responses remain metadata-only unless the caller independently has Emergency clinical permissions. |
| Idempotency | Durable key scoped to tenant/branch, operation and source episode; payload fingerprint and persisted outcome. Same key/same payload returns the original confirmed relation; same key/different payload conflicts. Concurrent equivalent requests must yield one relation/encounter. Retention and episode uniqueness require owner decisions; in-memory or UI-only deduplication is insufficient. |
| Atomicity | Within the shared MongoDB boundary, registration/link, source relation, idempotency outcome and audit must commit together using existing required transaction infrastructure. Validate expected versions in the transaction. For an external boundary, use an approved durable outbox/reconciliation mechanism; do not add an ad hoc saga or report linked before confirmation. |
| Responses | Creation returns confirmed Emergency ID and minimal source identifiers; replay returns the same outcome. Reuse existing envelopes. Proposed HTTP categories: validation 400, authentication 401, authorization 403, unavailable/inaccessible source according to existing non-disclosure policy, stale/conflicting/idempotency mismatch 409, retryable dependency failure 503. Emergency/core OPD must assign exact codes and retriable semantics. |
| Recovery | A timeout is an unknown outcome, not proof of failure. Retry/query by the same key; never create a second encounter with a fresh key. Explicit reconciliation-required response must surface an actionable pending state. Owners define operational reconciliation ownership and permissions. |
| Audit | Record source IDs, destination ID, actor, source/destination scope, timestamp, request key, expected versions, reason, before/after linkage and correlation ID in the same transaction. Owners approve event names and minimum clinical evidence. Keep clinical narrative out of general logs. |
| UI | Show unconfirmed/pending/failed link separately from acknowledgement. Only display a confirmed linked encounter from the server response. No automatic clearance, discharge or routine resumption follows linking. |
| Acceptance | Add schema/backward-compatibility, denied-role/scope, invalid references, stale version, concurrent duplicate, replay/payload mismatch, rollback, timeout/recovery, redaction and logout/login persistence tests before enabling the adapter. |

Affected owner files: Emergency schemas/types/model/repository/service/routes and their tests; approved core OPD encounter contract where provenance/cardinality is defined; specialty API DTO/service and feature hook only after that contract exists. Shared permission/audit registries and indexes change only if the approved design requires them. This proposal adds no production fields, permission grants, endpoint or adapter.

## B. Clinical disposition and clearance: owner decision record

`requireEmergencyClearance` rejects both ACTIVE and ACKNOWLEDGED emergency-screening alerts at routine test start/result writes and completion readiness/sign-off. Transactional checks prevent bypass through stale UI, omitted receipt configuration or override. Emergency-priority tasks retain their existing permitted path. Viewing or acknowledging never clears an emergency. The current guard intentionally has no routine-resumption action.

| Decision awaiting clinical owner | Required approval evidence |
|---|---|
| Disposition values | Exact meanings, terminal/nonterminal distinction, applicability to existing alerts; no inferred mapping from Emergency discharge/admission. |
| Transition map | Allowed transitions, reversals, correction and re-escalation; expected-version and conflict behavior. |
| Roles | Named roles/permissions for each transition and correction; doctor attribution and delegation limits. |
| Routine resumption | Clinical evidence and criteria, required Emergency/IP review, and whether each routine action is independently permitted. Do not replace this with an acknowledged flag. |
| Required documentation | Notes/reason, assessor, time, evidence and linked episode; mandatory fields for corrections/reversals. |
| History and migration | Immutable before/after audit, new-alert behavior, legacy acknowledged-alert handling, and previously signed consultation treatment. |

Approval record: owner __________ date __________ approved contract/version __________. Status: **PENDING APPROVAL**. No values or thresholds are proposed as clinical fact. Staging must demonstrate the present block; successful authorized clearance remains a future dependency test.

## C. Clinical completion and downstream state

Clinical approval requires existing configured clinical prerequisites, authorized doctor sign-off, valid references and the emergency guard. Pending independent dispensing/scheduling does not itself invalidate clinical sign-off. Signed snapshots remain immutable while the current summary reflects source-owner status changes.

The summary separates clinical sign-off from medication request state, procedure recommendation/linked booking state, referral/appointment state, follow-up/appointment state and portal publication. A draft follow-up is not scheduled. SUBMITTED is not dispensed; BOOKED is not performed. Missing linked booking data is not completion. Summary refresh errors hide stale rows and offer retry. Publication uses the existing exact-key retry and transactional rollback. There is no approved optical-fulfillment or aggregate patient-journey completion contract; do not display an overall completed claim.

Evidence: `OphthalmologyConsultationSummaryCard.tsx` and its tests; `ophthalmology.phase9.test.ts` (current projection versus signed snapshot); `ophthalmology.phase10.test.ts` (publication failure/retry). Shared Pharmacy and Surgery tests provide separate service evidence, not multi-role browser acceptance.

## D. Staging UAT execution sheet

Current result for every row: **NOT EXECUTED / NOT VERIFIED**. Supported browser discovery on 21 October returned `Local browser use is disabled in Work settings`. Earlier session was stuck verifying access/session. No authentication bypass attempted. Enable the supported browser and use authorized staging accounts before execution; do not repeatedly retry unchanged conditions.

Record staging URL/build SHA, database/index migration version, configuration versions, branch/department, synthetic patient/visit IDs, role account, UTC time, actual result and redacted screenshot/request/audit evidence per row. Use isolated synthetic records; never production clinical data. Have receptionist, triage/authorized preliminary assessor, ophthalmologist, diagnostic technician, Emergency clinician, admission/bed coordinator and downstream fulfillment roles available. Verify the actual configured permission grants instead of assuming job titles confer access.

| ID | Role / scenario | Expected outcome and persistence evidence |
|---|---|---|
| U01 | Reception: search/register, appointment and walk-in | Existing patient reuse; valid check-in and single linked OPD encounter. Repeated submission does not duplicate the visit. Refresh/login preserves linkage. |
| U02 | Registration/triage: emergency warning | Immediate escalation visible; no claim of confirmed inbound Emergency link. Alert actor/time/reason retained; unauthorized action denied. |
| U03 | Preliminary assessor: later emergency | Saved assessment remains; newly recorded warning blocks routine progression. Existing scope/role restrictions hold. |
| U04 | Ophthalmologist: warning during examination/review | New alert follows escalation; acknowledgement records receipt only. Routine task/result APIs and sign-off remain blocked even after acknowledgement. |
| U05 | Emergency-priority diagnostic task | Authorized emergency-priority action remains available. Changing a browser field cannot promote a routine task or bypass server authorization. |
| U06 | Doctor/technician: diagnostic order and assigned queue | Eye, reason and priority retained; only authorized assigned/scoped actions succeed. Finalized results return to the doctor for configured review. |
| U07 | Doctor: unacceptable result / repeat | Required repeat reason retained; original result immutable and visible; repeat linked once under retry/concurrent submission; review the new result separately. |
| U08 | Doctor: assessment and conditional treatment | Eye-specific diagnosis and indicated medication, optical prescription, procedure, referral or follow-up persist through shared APIs. Non-indicated items are not fabricated as required. |
| U09 | Doctor: completion blockers / direct API | Missing configured clinical data, pending required reviews, wrong/deleted references and unresolved emergencies block readiness/sign-off. Unauthorized role, stale version and override bypass rejected without partial finalization. |
| U10 | Doctor: eligible routine clinical sign-off | Valid routine encounter signs once; retry returns existing result, signature attribution and snapshot retained after logout/login. Pending independent fulfillment remains accurately pending. |
| U11 | Emergency -> appointment -> OPD | Same patient/branch/department chain displays metadata-only source. Mismatch does not claim linked; duplicate sources conflict; no Emergency notes exposed to OPD-only account. |
| U12 | Emergency referral booking failure/retry | Inject staging-safe failure under test-owner control; link/audit rollback, cancellation compensation and replay verified. Failed compensation exposes reconciliation state; no automatic blind retry. |
| U13 | Emergency admission / bed coordination | Existing authorized admission request and bed workflow only. Concurrent occupied/held/unavailable bed cannot be assigned twice; failed transaction leaves no partial occupancy. Inpatient handoff references and audit persist. Do not claim specialty alert integration exists. |
| U14 | Emergency without admission | Existing shared disposition documented by authorized clinician. Its status does not automatically clear the Ophthalmology alert or authorize routine resumption. |
| U15 | Pharmacy / scheduling | Actual dispensing, booking, referral and follow-up updates reflected after refresh; signed clinical snapshot unchanged. Source failures/pending values remain distinguishable. |
| U16 | Publication / patient portal | Publish only approved documents via existing action; injected failure leaves clinical sign-off intact, no false publication success; same-key retry produces one publication/audit. Portal authorization/redaction verified. |
| U17 | Error, denied scope, responsive and keyboard | Loading/empty/error/retry states, stale-summary hiding, branch/department denial, modal focus, keyboard controls, text+color status and small-screen layout tested. No stale clinical status shown as current. |
| U18 | Cross-session persistence / audit | Re-login in each authorized role; verify stored state and source links, actor/timestamp/reason and before/after audit. Capture evidence from authorized server/API inspection, not UI alone. |
| U19 | Future approved clearance / inbound integration | **BLOCKED BY CONTRACT**. After owner approval and implementation, test authorized/unauthorized transitions, invalid/stale transitions, concurrent/repeated requests, rollback, audit, re-escalation and persistence. |
| U20 | Overall journey completion | **BLOCKED BY CONTRACT** for absent optical fulfillment/aggregate journey definition. Clinical sign-off alone must never satisfy this row. |

Each row requires: actual result __________ PASS/FAIL/BLOCKED __________ evidence __________ tester/date __________ defect/reference __________. A rendered prototype or passing unit test cannot satisfy a UAT row. Clinical-owner sign-off and shared-owner contract approvals remain separate from automated checks.

## E. Prototype interpretation

Designs reuse `apps/web/src/tokens.css`, `styles/ophthalmology.css`, `features/doctor-directory.css`, existing OPD cards and workspace navigation. Inter, navy text, slate metadata, pale canvas, blue actions, 8–10px corners, 20px card padding and red emergency emphasis are source-derived. Layout refinements in raster previews are proposals, not claims of pixel-identical running screens. All identities and values are synthetic. No new production UI is introduced by the image deliverables.

Completed review images: [emergency acknowledgement with routine hold](docs/ophthalmology-prototypes-20261021/01-emergency-hold.png); [diagnostic repeat with preserved original](docs/ophthalmology-prototypes-20261021/02-diagnostic-repeat.png); [clinical sign-off with separate downstream states](docs/ophthalmology-prototypes-20261021/03-clinical-completion.png). No clearance action or invented clinical thresholds. Generated with built-in imagegen; [exact prompts and interpretation notes](docs/ophthalmology-prototypes-20261021/README.md) are recorded alongside the images. All three were visually reviewed for readable labels, safety distinctions and source-derived styling.

## F. Final verification and changes in this continuation

The prior final production-source run passed **53 suites / 349 tests** with `npx vitest run --maxWorkers=1 --hookTimeout=120000 ophthalmology emergency-referral`. Source files are unchanged since that run. The earlier exact 32-test reproduction and additional shared-domain runs are recorded in the combined gap report; counts overlap. No prototype or documentation edit required repeating those suites.

Fresh API and web typechecks and production builds all passed (exit 0). Repository-wide lint fails with 50 API and 14 web errors on unchanged, unrelated paths; workflow-owned lint passed. Exact commands and path-level details are in the combined gap report. Browser acceptance remains blocked; clinical UAT is not executed.

Files added/updated after the clean `334605d` checkpoint:

| Path | Change |
|---|---|
| `HMS_OPHTHALMOLOGY_COMBINED_WORKFLOW_GAP_CLOSURE.md` | Final check outcomes, current HEAD provenance, browser limitation and deliverable links. |
| `HMS_OPHTHALMOLOGY_STAGING_UAT_AND_DECISIONS.md` | Proposed inbound contract, clinical-owner decision record, completion interpretation and 20-scenario staging sheet. |
| `docs/ophthalmology-prototypes-20261021/README.md` | Exact generation prompts, design caveats and image index. |
| `docs/ophthalmology-prototypes-20261021/01-emergency-hold.png` | Synthetic emergency acknowledgement/hold design preview. |
| `docs/ophthalmology-prototypes-20261021/02-diagnostic-repeat.png` | Synthetic repeat-request and original-preservation design preview. |
| `docs/ophthalmology-prototypes-20261021/03-clinical-completion.png` | Synthetic clinical sign-off versus downstream-state design preview. |

Final working tree: the combined report is the only tracked modification; this UAT document is untracked. The four prototype files exist locally under `docs/` and are ignored by the existing `.gitignore:21` rule; no ignore rule was changed and nothing was force-staged. Preserve/copy these local artifacts explicitly when preparing a future review package. No previously untracked file was removed. No application-source changes, approved-contract substitutions or new phase work were needed in this final continuation. Remaining dependencies: inbound Emergency source contract, durable cross-service booking recovery, approved clinical clearance policy, rescheduling/cross-branch policy, optical fulfillment/aggregate journey definition, global lint baseline and staging clinical acceptance.
