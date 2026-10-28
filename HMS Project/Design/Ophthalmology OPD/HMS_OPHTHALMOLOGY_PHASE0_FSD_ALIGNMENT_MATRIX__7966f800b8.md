# HMS Ophthalmology OPD Phase 0 FSD Alignment Matrix

## Purpose and readiness

This matrix reconciles the Ophthalmology OPD FSD with the current backend baseline and the revised Developer A plan. It is the implementation gate for Developer A.

**Phases 0 through 9 status: COMPLETE - AWAITING PHASE 10 APPROVAL.** On 15 October 2026, the project owner approved the resolutions for DEC-01 through DEC-12 as binding project decisions. Phase 9 exact-version result review, configured completion readiness, doctor approval, atomic OPD finalization, locking, reopening, amendments, and summary/history APIs are recorded in its gap and verification documents. Later phases remain subject to their phase exit/entry gates. Approval of the decision framework does not invent missing clinical master values, file policies, or vendor adapter contracts; those remain explicit configuration or integration dependencies.

No backend feature implementation was performed while producing this matrix.

## Source identity

| Source | Exact path | Identity or status | Authority |
|---|---|---|---|
| Project rules | `PROJECT_RULES.md` | Current | Architecture, security, database, API, testing, completion |
| Engineering checklist | `HMS_Engineering_Best_Practices_Checklist.md` | Current | Engineering and release gate |
| Functional specification | `Ophthalmology_OPD_Consultation_Functional_Specification_Document.docx` | v1.0, 10 September 2026, document label: For Review; project decision baseline approved 15 October 2026 | Controlling functional scope under DEC-01; missing clinical content remains configuration-gated |
| Backend plan | `HMS_Ophthalmology_OPD_Developer_A_Backend_Prompts.md` | Revised in Phase 0 | Ownership, phases, stop gates, verification |
| Phase 0 gap note | `HMS_OPHTHALMOLOGY_PHASE_0_GAP_NOTE.md` | Complete, 15 October 2026 | Code inventory, architecture, data/index plan, dependencies |
| Backend API contract | `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md` | v1.0.0-draft | Approved vocabulary, endpoint families, lifecycles, errors, concurrency |
| Phase 0 verification | `HMS_OPHTHALMOLOGY_PHASE_0_VERIFICATION.md` | Complete, 15 October 2026 | Baseline commands, focused tests, limitations and handoff |

## Legend

- Baseline: `COVERED`, `PARTIAL`, `MISSING`, `CONFLICT`, `ASSESS`.
- Disposition: `OWNED`, `REUSED`, `DEPENDENCY`, `FRONTEND`, `BLOCKED`, `N/A`.
- Decision approval resolves the former approval blockers. A requirement row marked `BLOCKED` remains gated only when its required clinical configuration, security/storage policy, vendor adapter, or concrete shared-domain contract is still unavailable; reassess that state in the phase gap note.

## Targeted baseline findings

| ID | Evidence | Alignment | Required Phase 0 action |
|---|---|---|---|
| BASE-01 | No dedicated Ophthalmology backend resource was found; Ophthalmology currently appears as a department value. | MISSING | Implement the approved module placement using existing registration/service patterns. |
| BASE-02 | OPD consultation supports only `DRAFT` and `COMPLETED`. | PARTIAL | Map the FSD consultation lifecycle to visit and consultation state. |
| BASE-03 | Diagnosis currently stores code, display, coding system, primary/secondary type, and notes. | PARTIAL | Implement DEC-03/DEC-09 additive laterality, clinical status, severity/stage, differential, history, and one-primary extensions. |
| BASE-04 | OPD clinical orders aggregate multiple lab/imaging items under one order status. | PARTIAL | Design per-test activities linked to authoritative shared orders/results. |
| BASE-05 | OPD order submission currently requires a completed consultation. | CONFLICT | Implement approved ordering-during-consultation behavior through the verified shared contract. |
| BASE-06 | Typed clinical-service lookup falls back to generic billing services. | CONFLICT | Remove the fallback without weakening catalogue type validation. |
| BASE-07 | Consultation completion writes consultation, visit, appointment, timeline, and audit without one transaction. | CONFLICT | Implement the approved atomic/recoverable transaction boundary. |
| BASE-08 | Existing OPD visit statuses differ from FSD consultation statuses. | CONFLICT | Implement the DEC-05 overlay and transition mapping. |
| BASE-09 | Existing repository, service, RBAC, audit, storage, and transaction patterns are reusable. | COVERED | Inventory exact utilities before design. |
| BASE-10 | Patient, appointment, laboratory, imaging, pharmacy, billing, referral, follow-up, surgery/procedure, portal, and document domains exist. | ASSESS | Complete contract-by-contract reuse/gap analysis. |

## Requirement alignment

### Scope encounter and appointment

| ID | FSD reference | Backend requirement | Baseline | Disposition | Phase | Blocker/dependency | Verification |
|---|---|---|---|---|---|---|---|
| OPH-SCP-01 | 1, 2.1-2.4 | Enhance existing OPD; no separate Ophthalmology application. | PARTIAL | REUSED/OWNED | 2 | Confirm department activation. | Department and regression tests. |
| OPH-SCP-02 | 2.2-2.3 | Reuse all named shared HMS domains; no duplicate source of truth. | ASSESS | REUSED/DEPENDENCY | 0, 10 | Shared contract review. | Duplicate-record/source tests. |
| OPH-SCP-03 | 5.1 | Support New, Follow-up, Emergency, Post-operative, Screening, Procedure Review. | PARTIAL | OWNED/REUSED | 2 | DEC-02 subtype and shared-type mapping approved. | Enum/compatibility tests. |
| OPH-SCP-04 | 5.2, Table 6 | Service, consultant, sub-speciality, affected eye, referral, priority, notes. | IMPLEMENTED / ACCEPTANCE OPEN | REUSED/CONFIGURATION | 2 | Appointment owns scheduling intent; encounter owns confirmed findings. Scoped active lookups, DEC-02 REVIEW mapping, reschedule retention and conditional transactional intent edits implemented on 20 October. Clinical master values and live acceptance remain open. | Isolated replica-set booking/reference/scope/stale/audit rollback tests. |
| OPH-SCP-05 | 1, 5 | One encounter and consolidated record across staff/stations. | MISSING | OWNED | 4, 8 | Design the aggregate/read model under DEC-05/DEC-09. | Multi-station end-to-end test. |
| OPH-SCP-06 | 3.1 | Consistent OD/OS/OU/Bilateral/NA/Not Specified rules by record type. | MISSING | OWNED | 2 | DEC-03 canonical laterality contract approved. | Schema/persistence tests. |
| OPH-SCP-07 | 3.1 | Copied findings create separate eye-specific values. | MISSING | OWNED | 5-7 | Decide copy provenance. | Eye-isolation/audit tests. |

### Roles permissions and scope

| ID | FSD reference | Backend requirement | Baseline | Disposition | Phase | Blocker/dependency | Verification |
|---|---|---|---|---|---|---|---|
| OPH-RBAC-01 | Table 4, Table 37 | Map every FSD role to exact permission resources/actions and approval rights. | PARTIAL | OWNED/DEPENDENCY | 2 | DEC-07 screen/actions approved; role grants beyond `SUPER_ADMIN` require explicit assignment. | Positive/negative action matrix. |
| OPH-RBAC-02 | 13.1 | Enforce auth, org, branch, department, encounter, patient, station, assignment, resource, user, and state scope. | PARTIAL | OWNED | 2 onward | Inventory central scope helpers. | Negative scope matrix. |
| OPH-RBAC-03 | 13.2 | No implicit clinical elevation for reception/nursing/technicians. | PARTIAL | OWNED | 2 | Apply DEC-07 seed restrictions. | Direct API denial tests. |
| OPH-RBAC-04 | 13.2 | Read-only responses expose only permitted scoped fields. | PARTIAL | OWNED | 2 onward | Define least-privilege projections per endpoint. | Sensitive-field response tests. |
| OPH-RBAC-05 | Table 39 | Reject and audit unauthorized actions per security policy. | PARTIAL | OWNED | 2 onward | Clarify denied-read audit policy. | Audit tests. |

### Triage history and emergency

| ID | FSD reference | Backend requirement | Baseline | Disposition | Phase | Blocker/dependency | Verification |
|---|---|---|---|---|---|---|---|
| OPH-TRI-01 | 8.1, Table 9 | Structured complaint fields and conditional rules. | MISSING | OWNED/BLOCKED | 3 | Complaint master/mandatory-field approval. | Schema/draft/audit tests. |
| OPH-TRI-02 | 8.2, Table 10 | Structured ophthalmic/medical history and previous reports. | MISSING | OWNED/REUSED | 3 | Shared allergy/history/document references. | Source-of-truth tests. |
| OPH-TRI-03 | 8.3 | All listed emergency criteria; no automatic diagnosis. | MISSING | OWNED/BLOCKED | 3 | Clinical approval/configuration. | Criteria and non-diagnosis tests. |
| OPH-TRI-04 | 8.3 | Alert reason/time/actor, routing/notification, station bypass. | MISSING | OWNED/DEPENDENCY | 3 | Apply DEC-08/DEC-12 semantics and verify the notification delivery contract. | Retry/permission/audit tests. |
| OPH-TRI-05 | 14.1 | Authorized acknowledgement of emergency and abnormal IOP alerts. | MISSING | OWNED | 3, 9 | DEC-08 acknowledgement/override behavior approved; clinical thresholds remain configured. | Completion-block tests. |

### Queue task lifecycle and metadata

| ID | FSD reference | Backend requirement | Baseline | Disposition | Phase | Blocker/dependency | Verification |
|---|---|---|---|---|---|---|---|
| OPH-QUE-01 | 6, Table 7 | One task per test linked to patient, encounter, appointment, order. | MISSING | OWNED | 4 | Apply DEC-09 and verify the concrete task/shared-order relation. | Creation/link tests. |
| OPH-QUE-02 | 5, 6 | Parallel/sequential assignments with configured sequence. | MISSING | OWNED/BLOCKED | 2, 4 | Define sequence and prerequisites. | Parallel/sequential tests. |
| OPH-QUE-03 | 6.1 | All 11 queue actions plus controlled amendment. | MISSING | OWNED | 4 | DEC-04/DEC-07 transitions and permissions approved. | Transition table tests. |
| OPH-QUE-04 | 6.2 | Performer/reviewer, times, station/device, laterality, quality, attachments, versions, audit. | MISSING | OWNED | 4 | Device/attachment contracts. | Metadata/audit tests. |
| OPH-QUE-05 | Table 36 | Complete test status map with stale-state rejection. | MISSING | OWNED | 4 | DEC-04 resolves `Closed` and `Doctor Review`. | Allowed/denied transition tests. |
| OPH-QUE-06 | 12.3 | Reassign only to eligible user at correct branch/station. | MISSING | OWNED | 4 | DEC-12 eligibility source approved; real-time shift availability is deferred. | Scope/eligibility tests. |
| OPH-QUE-07 | 12.3 | Repeat preserves and links original result. | MISSING | OWNED | 4 | DEC-04 repeat identity/status approved. | Preservation/idempotency tests. |
| OPH-QUE-08 | 12.3 | Completed form immediately visible to next permitted user. | MISSING | OWNED/FRONTEND | 4 | Define permission-scoped visibility projection under DEC-07. | Read-after-write/permission tests. |
| OPH-QUE-09 | 6, 17 | Paginated scoped queues, filters, sorts, waiting time, indexes. | MISSING | OWNED | 4, 10 | Filter/timezone contract. | Pagination/index/time tests. |

### Diagnostic and assessment forms

Every form requires field-level request/response schemas plus patient/encounter/order/task linkage, laterality where applicable, performer, timestamps, branch/station/device, reliability/quality, draft/completion/review, versioning, audit, and specified attachments.

| ID | FSD reference | Form scope | Baseline | Disposition | Phase | Blocker/dependency | Verification |
|---|---|---|---|---|---|---|---|
| OPH-TST-01 | 9.1, Table 11 | Visual acuity: conditions, presenting/current/pinhole/BCVA, low-vision/near, reliability, conclusion. | IMPLEMENTED | OWNED/CONFIGURATION | 5 | Production VA master/mandatory values pending. | Phase 5 per-form completion/error/amendment tests. |
| OPH-TST-02 | 9.2, Table 12 | Lensometry: OD/OS power/add, prism, lens attributes, PD/centre, height, condition/use, file. | IMPLEMENTED | OWNED/CONFIGURATION | 5 | Production optical masters/units pending. | Phase 5 axis/form/document tests. |
| OPH-TST-03 | 9.3, Table 13 | Autorefraction/keratometry: device/calibration, cycloplegia, readings/final, SE, PD/pupil, K/derived, quality/impression. | IMPLEMENTED | OWNED/CONFIGURATION | 5 | Vendor adapter and production calculation rules pending. | Phase 5 source/selected/derived tests. |
| OPH-TST-04 | 9.4, Table 14 | Objective refraction: method/type/distance, drug/timing, raw/final power, reflex/media, impression. | IMPLEMENTED | OWNED/CONFIGURATION | 5 | Production drug master/timing rules pending. | Phase 5 conditional/axis tests. |
| OPH-TST-05 | 9.5, Table 15 | Subjective refraction: starting/final, BCVA, duochrome/JCC/fogging, acceptance, balance, near/use, impression. | IMPLEMENTED | OWNED/CONFIGURATION | 5 | Production required/option values pending. | Phase 5 completion/error/amendment tests. |
| OPH-TST-06 | 9.6, Table 16 | IOP: readings, method/time/position/drugs, repeats/final, reliability, configured alerts. | IMPLEMENTED | OWNED/CONFIGURATION | 5 | Production thresholds/units/method codes pending; acknowledgement is later review scope. | Phase 5 selected/final, configured-threshold, no-auto-diagnosis tests. |
| OPH-TST-07 | 9.7, Table 17 | Pachymetry: method, thickness, repeats/average, quality, impression, report. | IMPLEMENTED | OWNED/CONFIGURATION | 6 | Production units/ranges/impressions pending. | Phase 6 retained-reading/average/quality/document tests. |
| OPH-TST-08 | 9.8, Table 18 | Colour vision: method, eye, plate counts, result, defect/severity, reliability. | IMPLEMENTED | OWNED/CONFIGURATION | 6 | Production methods/scoring options pending. | Phase 6 score/laterality/conditional tests. |
| OPH-TST-09 | 9.9, Table 19 | Motility/squint/binocular: methods, fixation, deviation/measurements, movements, positive findings, stereopsis, impression. | IMPLEMENTED | OWNED/CONFIGURATION | 6 | Production grading/measurement masters pending. | Phase 6 positive-detail/completion/amendment tests. |
| OPH-TST-10 | 9.10, Table 20 | Slit-lamp/anterior segment: OD/OS structures, status/finding/location/grade, diagram/image/remarks. | IMPLEMENTED | OWNED/CONFIGURATION | 5 | Production finding/grade masters and role grants pending. | Phase 5 eye/permission/document/amendment tests. |
| OPH-TST-11 | 9.11, Table 21 | Dry eye: symptoms/score, Schirmer, TBUT, staining, meniscus, glands, blink/lid/sensation, impression. | IMPLEMENTED | OWNED/CONFIGURATION | 6 | Production questionnaire/grades/units pending. | Phase 6 structured-eye/completion/amendment tests. |
| OPH-TST-12 | 9.12, Table 22 | Visual field: equipment/protocol, eye/correction, setup, reliability/result indices, pattern, eligible comparison, report/impression. | IMPLEMENTED | OWNED/CONFIGURATION | 6 | Production equipment/protocol options pending. | Phase 6 exact prior-version/reliability/laterality tests. |
| OPH-TST-13 | 9.13, Table 23 | OCT: type/scans, eye, quality/signal, measurements, artefact, comparison, images/report, observation. | IMPLEMENTED | OWNED/CONFIGURATION | 6 | Production scan/measurement masters and order attributes pending. | Phase 6 artefact/comparison/document/review-routing tests. |
| OPH-TST-14 | 9.14, Table 24 | Fundus photography: eye/type/field/dilation, quality/count, abnormality, images/notes/repeat. | IMPLEMENTED | OWNED/CONFIGURATION | 6 | Production image/findings masters and policy limits pending. | Phase 6 eye-linked image/quality/repeat tests. |
| OPH-TST-15 | 9.15, Table 25 | Posterior/fundus: dilation consent/check/drug/timing, method, vitreous/disc/macula/retina, diagrams/images. | IMPLEMENTED | OWNED/REUSED/CONFIGURATION | 5 | Production consent/medication option values pending. | Phase 5 dilation/permission/document/amendment tests. |
| OPH-TST-16 | 9.16, Table 26 | Topography: K/axes, Kmax/average, astigmatism/thickness, elevation/maps, asphericity/pupil/WTW, files/impression. | IMPLEMENTED | OWNED/CONFIGURATION | 6 | Production units/maps/options pending. | Phase 6 source/derived/axis/file tests. |
| OPH-TST-17 | 9.17, Table 27 | Biometry/IOL: measurements, target, formula/model/power, predicted refraction, quality/factors, selected/backup IOL, report. | IMPLEMENTED | OWNED/REUSED/CONFIGURATION | 6, 8 | Formula/catalogue values pending; final approval remains Phase 8. | Phase 6 proposed-only selection/calculation/document/review-routing tests. |
| OPH-TST-18 | 9.18, Table 28 | B-scan: eye/indication, setup, axial length, structures, lesion, media/report, observation/review. | IMPLEMENTED | OWNED/CONFIGURATION | 6, 9 | Production findings/media options remain configuration dependencies. | Phase 6 lesion/file/pending-review plus Phase 9 exact-version review tests. |
| OPH-TST-19 | 9.19, Table 29 | Gonioscopy: per-eye/per-quadrant grade/pigment/PAS/NV, other, overall examination. | IMPLEMENTED | OWNED/CONFIGURATION | 6 | Production grading options pending. | Phase 6 configured-quadrant/positive-detail tests. |
| OPH-TST-20 | 9.20, Table 30 | Contact lens: trial/final details, power/schedule, fit, over-refraction/VA, response, outcome, education/follow-up. | IMPLEMENTED | OWNED/REUSED/CONFIGURATION | 7, 8 | Production optical-product/options remain configuration; prescription approval remains Phase 8. | Phase 7 trial/final, reference, conditional, laterality, amendment, review-routing, concurrency, rollback and audit tests. |
| OPH-TST-21 | 9.21, Table 31 | Paediatric: methods, cycloplegia, alignment/red reflex, amblyopia/binocular, cooperation, parent symptoms/history, result. | IMPLEMENTED | OWNED/REUSED/CONFIGURATION | 7 | Production methods/results, age boundary and drug options remain configuration dependencies. | Phase 7 age/guardian derivation, medication/timing, conditional, amendment, permission, concurrency, rollback and audit tests. |
| OPH-TST-22 | 9 intro, Table 38 | Distinguish imported/manual/modified values and retain provenance. | PARTIAL | OWNED/DEPENDENCY/BLOCKED | 5-7 | Manual/correction provenance implemented for every result form; imports await approved adapters. | Phase 5-7 provenance/amendment/adapter-rejection tests. |
| OPH-TST-23 | 9, Table 38 | Retain source readings/units for derived values; validate configured formats/ranges. | IMPLEMENTED | OWNED/CONFIGURATION | 5-7 | Production clinical ranges/options remain configuration dependencies. | Phase 5-7 selected-source/configured-range/derived-value and server-derived paediatric-context tests. |

### Doctor review diagnosis treatment and outcomes

| ID | FSD reference | Backend requirement | Baseline | Disposition | Phase | Blocker/dependency | Verification |
|---|---|---|---|---|---|---|---|
| OPH-REV-01 | 10.1 | Consolidated doctor read model and eye/encounter historical comparison. | MISSING | OWNED/BLOCKED | 8 | Projection/comparison eligibility. | Correct-eye/no-leak tests. |
| OPH-REV-02 | 10.2, Table 32 | Diagnosis coding, laterality, status, primary/secondary, severity/stage, differential, history. | PARTIAL | OWNED/REUSED/BLOCKED | 8 | Terminology/extension/one-primary. | Validation/history tests. |
| OPH-REV-03 | Table 32 | Structured treatment plan linked to diagnosis/laterality/priority/status/clinician. | MISSING | OWNED/BLOCKED | 8 | Treatment/status masters. | Cross-record tests. |
| OPH-REV-04 | Tables 32, 34 | Eye-specific medication fields through existing prescribing/pharmacy. | PARTIAL | REUSED/DEPENDENCY/BLOCKED | 8, 10 | Shared contract and authority. | Pharmacy regression tests. |
| OPH-REV-05 | 10.3, Table 33 | Separate optical prescription with all FSD fields, approval, validity, print/share. | MISSING | OWNED/BLOCKED | 8 | Fields/masters/authority/validity. | Schema/version/approval tests. |
| OPH-REV-06 | Tables 32, 34 | Further tests, procedure, surgery, referral, follow-up retain clinical context. | ASSESS | REUSED/DEPENDENCY | 8, 10 | Shared-domain contracts. | Handoff/idempotency tests. |
| OPH-REV-07 | Table 32 | Digital doctor approval required for final completion. | IMPLEMENTED | OWNED | 9 | Authenticated approval event; cryptographic signature remains out of contract. | Phase 9 doctor identity, unauthorized, completion, and audit tests. |

### Shared integrations

| ID | FSD reference | Backend requirement | Baseline | Disposition | Phase | Blocker/dependency | Verification |
|---|---|---|---|---|---|---|---|
| OPH-INT-01 | 11, Table 35 | Every record linked to authoritative patient and encounter. | PARTIAL | OWNED/REUSED | All | Define invariant. | Cross-patient/encounter tests. |
| OPH-INT-02 | 11.1 | Order during consultation; authoritative result returns to review. | IMPLEMENTED | OWNED/REUSED | 1, 4, 10 | Source-domain-first create/link contract approved. | Linked-order/result and completion validation tests. |
| OPH-INT-03 | 11.1 | Record reviewer/time and preserve assessment versions. | IMPLEMENTED | OWNED | 8, 9 | External result adapters remain Phase 10 dependencies. | Phase 9 exact-version review and append-only amendment tests. |
| OPH-INT-04 | Table 35 | Imaging order/result carries laterality and reason. | IMPLEMENTED | REUSED | 8, 10 | Existing OPD Imaging order is authoritative and linked by ID/item. | Imaging reference regression. |
| OPH-INT-05 | Table 35 | Procedure/surgery links diagnosis, laterality, context. | IMPLEMENTED | REUSED | 8, 10 | Source-domain-first procedure recommendation with validated ID link. | Reference/handoff tests. |
| OPH-INT-06 | Table 35 | Billing/insurance uses authoritative existing charge rules. | IMPLEMENTED | REUSED | 10 | Shared OPD services/orders are billable sources; Billing owns price/idempotency/reversal. | No-duplicate/no-local-calculation tests. |
| OPH-INT-07 | 18 | Timeline/audit retain safe ophthalmology context. | IMPLEMENTED | REUSED/OWNED | All | External adapter audit remains with owning domains. | Phase 10 transactional publication/withdrawal audit and safe timeline tests. |

### Lifecycle completion amendment and portal

| ID | FSD reference | Backend requirement | Baseline | Disposition | Phase | Blocker/dependency | Verification |
|---|---|---|---|---|---|---|---|
| OPH-LIF-01 | 12.2 | Map all consultation states to existing OPD states. | IMPLEMENTED | OWNED | 0, 9 | External/downstream states remain Phase 10. | Phase 9 atomic context/OPD transition tests. |
| OPH-LIF-02 | 12.3 | Pending mandatory results keep encounter open unless approved override. | IMPLEMENTED | OWNED/CONFIGURATION | 9 | Production mandatory-test list remains approved configuration. | Phase 9 block/exact-snapshot override tests. |
| OPH-LIF-03 | 14.1, Table 43 | Enforce all completion prerequisites and return unmet items. | IMPLEMENTED | OWNED/CONFIGURATION | 9 | Production requirement selection remains approved configuration. | Phase 9 structured prerequisite tests. |
| OPH-LIF-04 | 16.1 | Summary contains all FSD sections. | IMPLEMENTED | OWNED/REUSED | 9 | Portal publication is Phase 10. | Phase 9 consolidated summary/history tests. |
| OPH-LIF-05 | 16.2 | Record approver/time and lock completed information. | IMPLEMENTED | OWNED | 9 | None for local completion. | Phase 9 approval, lock, stale-write tests. |
| OPH-LIF-06 | 14-16 | Reopen/amend with permission, reason, before/after, actor/time, downstream consistency. | IMPLEMENTED | OWNED/DEPENDENCY | 9, 10 | Republish/downstream consistency remains Phase 10. | Phase 9 append-only reopen/amend/reapproval tests. |
| OPH-LIF-07 | 16.2 | Completion and downstream handoffs are atomic/idempotent or recoverable. | IMPLEMENTED | OWNED/DEPENDENCY | 1, 9, 10 | External handoff compensation remains Phase 10. | Phase 9 atomic rollback/concurrent/idempotent retry tests. |
| OPH-PORT-01 | 16.3 | Publish approved summary, final prescriptions, selected verified results, instructions, follow-up, bills. | PARTIAL | REUSED/DEPENDENCY/BLOCKED | 10 | Exact Ophthalmology summary/optical/result publication implemented; shared-domain patient-visible version contract remains pending. | Phase 10 ownership/idempotency/publication/withdrawal tests. |
| OPH-PORT-02 | 16.3 | Exclude draft/internal/confidential/unverified/staff-only content. | IMPLEMENTED | OWNED/DEPENDENCY | 10 | Shared-domain publication classification remains owned by each source domain. | Phase 10 exact-version eligibility and restricted-projection tests. |

### Validation exception and file handling

| ID | FSD reference | Backend requirement | Baseline | Disposition | Phase | Blocker/dependency | Verification |
|---|---|---|---|---|---|---|---|
| OPH-VAL-01 | Table 38 | Patient/encounter, scope, laterality, numeric/axis, conditional, reliability, repeat, duplicate, amendment, provenance, cross-patient rules. | PARTIAL | OWNED/BLOCKED | All | Clinical ranges and record rules. | Boundary/negative/idempotency tests. |
| OPH-VAL-02 | Table 39 | Emergency bypass and direct ophthalmologist route. | MISSING | OWNED | 3 | DEC-08/DEC-12 routing and bypass semantics approved. | Emergency tests. |
| OPH-VAL-03 | Table 39 | Unable-to-perform reason and doctor review/repeat. | MISSING | OWNED | 4 | DEC-04 resolves Doctor Review as routing and repeat as a linked task. | Reason/transition tests. |
| OPH-VAL-04 | Table 39 | Retain unreliable result and allow linked repeat. | MISSING | OWNED/BLOCKED | 4-7 | Progression policy. | Retention/repeat tests. |
| OPH-VAL-05 | Table 39 | Patient unavailable/left preserves work and incomplete status. | MISSING | OWNED/BLOCKED | 4, 9 | Approve encounter status. | Partial-work tests. |
| OPH-VAL-06 | Table 39 | Device unavailable permits reassign/reschedule/cancel without lost order. | MISSING | OWNED/BLOCKED | 4 | Availability contract. | Preservation tests. |
| OPH-VAL-07 | Table 39 | Controlled wrong-eye correction before review; amendment after completion. | MISSING | OWNED/BLOCKED | 4-9 | Correction authority. | Pre/post-completion tests. |
| OPH-VAL-08 | Table 39 | Abnormal IOP alert/acknowledgement, never automatic glaucoma diagnosis. | MISSING | OWNED/BLOCKED | 5, 9 | Threshold/route approval. | Boundary/non-diagnosis tests. |
| OPH-VAL-09 | Table 39 | Pending external result supports Awaiting Results or approved deferral. | MISSING | OWNED | 9 | DEC-08 deferral semantics approved; configured completion prerequisites still apply. | Defer/override tests. |
| OPH-FILE-01 | Tables 10-33 | Secure reports/images/videos/diagrams/maps with encounter/eye metadata. | PARTIAL | REUSED/OWNED/BLOCKED | 3, 5-7, 10 | Types/sizes/annotation/publication policy. | Upload/failure/auth tests. |

### Reports masters nonfunctional and acceptance

| ID | FSD reference | Backend requirement | Baseline | Disposition | Phase | Blocker/dependency | Verification |
|---|---|---|---|---|---|---|---|
| OPH-RPT-01 | 17, Table 40 | Station queue dashboard. | IMPLEMENTED | OWNED | 10 | None for Ophthalmology task metrics. | Phase 10 snapshot/scope tests. |
| OPH-RPT-02 | Table 40 | Test turnaround metrics. | IMPLEMENTED | OWNED | 10 | None for approved task timestamps. | Phase 10 order/start/complete/review metric tests. |
| OPH-RPT-03 | Table 40 | Pending review and repeat/unable reports. | IMPLEMENTED | OWNED | 10 | None for Ophthalmology task state. | Phase 10 filter/scope tests. |
| OPH-RPT-04 | Table 40 | Clinical volume and diagnostic utilization. | IMPLEMENTED | OWNED | 10 | None for Ophthalmology context/task counts. | Phase 10 paginated aggregation and snapshot tests. |
| OPH-RPT-05 | Table 40 | Surgery pipeline and follow-up compliance. | IMPLEMENTED | REUSED | 10 | `/api/reports/phase-2` procedure schedule and `/api/opd/reports/follow-up-compliance`. | Authoritative branch/department/status tests. |
| OPH-RPT-06 | Table 40 | Revenue view from authoritative finance reporting. | IMPLEMENTED | REUSED | 10 | `/api/reports/phase-2` payment status with Billing permission. | No-fabrication/permission tests. |
| OPH-MST-01 | Appendix A, Table 42 | All ten FSD master groups. | PARTIAL/MISSING | OWNED/DEPENDENCY/BLOCKED | 2 | Ownership/values/configuration/admin permissions. | CRUD/scope/reference tests. |
| OPH-NFR-01 | 18 | High-volume drafts, correct encounter/eye history, complete audit. | PARTIAL | OWNED | All | Automated concurrency, bounded-query, history and audit evidence passes; production load/retention validation remains deployment-owned. | Phase 1-11 focused suite and critical-index regression. |
| OPH-NFR-02 | 18 | No cross-patient/branch/organization leakage. | IMPLEMENTED | OWNED | All | None for the approved automated boundary; interactive role/branch acceptance remains a release condition. | Cross-patient, cross-encounter, branch, station, assignment and portal negative tests. |
| OPH-NFR-03 | 18 | No General OPD, Dental, or shared-module regression. | PARTIAL | OWNED/REUSED | 1, 11 | Known unrelated department-visibility API regression and four unrelated web-test failures remain. | Full API/web regression evidence in Phase 11 verification. |
| OPH-MIN-01 | Appendix B, Table 43 | Minimum data for tests, complaint, VA, refraction, IOP, result, diagnosis, prescription, plan, completion. | MISSING/PARTIAL | OWNED/BLOCKED | 3-9 | Global versus configured mandatory rules. | Per-record minimum tests. |
| OPH-ACC-01 | 20.1 | Full workflow acceptance from activation through reopening. | PARTIAL | OWNED/DEPENDENCY | 2-11 | Automated Phase 1-11 workflow passes; live GCS and interactive end-to-end acceptance remain. | 160-test focused release suite plus full API suite. |
| OPH-ACC-02 | 20.2 | Full permission/scope acceptance. | PARTIAL | OWNED | 2-11 | Automated inventory/scope passes and direct optical route gates were corrected; interactive assigned-role coverage remains. | Permission seed, route-boundary, negative-scope and full regression suites. |
| OPH-ACC-03 | 20.3 | Patient/appointment/check-in/queue/vitals and shared-domain regression, no duplicates, authoritative results, audit. | PARTIAL | OWNED/REUSED | 1, 10, 11 | Full automated suites retain one unrelated API failure and four unrelated web failures; manual persistence/browser acceptance remains. | Phase 11 full-suite evidence. |

## Approved decision register

| ID | Decision topic | Affected requirements | Approval/dependency owner | Approved resolution | Approval state |
|---|---|---|---|---|---|
| DEC-01 | Confirm FSD v1.0 authority despite For Review/pending approvals. | All | Project owner | Use v1.0 as the implementation scope baseline; track later revisions through change control. | APPROVED - 15 OCT 2026 |
| DEC-02 | Canonical visit types and Procedure Review. | OPH-SCP-03 | Project owner | Use the approved Ophthalmology subtype and global OPD mapping below. | APPROVED - 15 OCT 2026 |
| DEC-03 | Canonical laterality by record type. | OPH-SCP-06, forms | Project owner | Use the canonical type and record-specific subsets below. | APPROVED - 15 OCT 2026 |
| DEC-04 | Complete test lifecycle; resolve Closed and Doctor Review. | OPH-QUE-05, OPH-VAL-03 | Project owner | Use the approved transition map, terminal state, and routing semantics below. | APPROVED - 15 OCT 2026 |
| DEC-05 | Consultation lifecycle mapping to existing OPD states. | OPH-LIF-01 | Project owner | Use the Ophthalmology overlay and coarse OPD mapping below. | APPROVED - 15 OCT 2026 |
| DEC-06 | Masters, scales, ranges, units, thresholds, mandatory fields/tests. | OPH-TST-01-23, OPH-MST-01, OPH-MIN-01 | Project owner; Ophthalmology leadership supplies values | Implement the approved versioned configuration framework; do not invent clinical values. | APPROVED STRUCTURE - VALUES PENDING |
| DEC-07 | Exact permissions and staff/station scopes. | OPH-RBAC-01-05 | Project owner | Seed the approved permission inventory; initially auto-grant only through existing `SUPER_ADMIN` reconciliation. | APPROVED - 15 OCT 2026 |
| DEC-08 | Review, acknowledgement, deferral, override, completion, signature, reopening, amendment. | OPH-TRI-05, OPH-REV-07, OPH-LIF-02-07 | Project owner | Use the approved lifecycle, authority, version, and audit rules below. | APPROVED - 15 OCT 2026 |
| DEC-09 | Shared-domain changes for diagnosis, prescriptions, imaging, surgery/procedure, referral/follow-up, billing, portal. | OPH-REV-02-06, OPH-INT-04-06, OPH-PORT-01-02 | Project owner; shared-domain owners verify concrete contracts | Use additive/versioned extensions and preserve each shared source of truth. | APPROVED STRATEGY - PHASE CONTRACT REVIEW |
| DEC-10 | Device imports and file/image/video/diagram/map storage/publication. | OPH-TST-22, OPH-FILE-01 | Project owner; security/clinical owners supply policies | Use the approved storage/publication architecture; do not invent format, limit, retention, or adapter policy. | APPROVED ARCHITECTURE - POLICY PENDING |
| DEC-11 | Mandatory versus future reports. | OPH-RPT-01-06 | Project owner | Deliver the mandatory workflow reports and integrate authoritative cross-domain reports. | APPROVED - 15 OCT 2026 |
| DEC-12 | Station sequencing and eligible-user/availability source. | OPH-QUE-02, OPH-QUE-06 | Project owner | Use server-derived eligibility and the approved branch/station/workflow configuration model. | APPROVED - 15 OCT 2026 |

## Approved decision resolutions

The project owner approved these resolutions on 15 October 2026. They are binding project rules for the Ophthalmology backend. Approval establishes the architecture and lifecycle contracts but does not infer any clinical value, threshold, grading scale, mandatory test, role assignment beyond `SUPER_ADMIN`, storage policy value, or vendor adapter detail that has not been supplied.

### DEC-01 FSD authority

**Approved decision:** Adopt FSD v1.0 dated 10 September 2026 as the controlling functional scope for development, subject to the decision register in this matrix. Configurable clinical content remains disabled or empty until supplied by Ophthalmology leadership.

**Rationale:** The document is complete enough to define functional areas and integration intent, but it is marked `For Review` and all approval roles are pending. Treating every example list as production-approved would violate the FSD's own final note.

**Required approval record:** Product Owner, Clinical Representative, Development Lead, and QA should approve the document or approve an identified revision. Record approver, date, version, and any excluded/deferred requirement IDs.

**Review outcome:** `APPROVED - 15 OCTOBER 2026`. FSD v1.0 is the controlling implementation scope baseline. A later approved FSD revision must be reconciled through change control rather than silently changing implemented contracts.

### DEC-02 Canonical visit types and Procedure Review

**Approved decision:** Keep the existing global OPD visit type unchanged for backward compatibility and add an Ophthalmology specialty visit subtype with:

- `NEW_CONSULTATION`
- `FOLLOW_UP`
- `EMERGENCY`
- `POST_OPERATIVE`
- `SCREENING`
- `PROCEDURE_REVIEW`

Map the specialty subtype to the existing OPD type only for shared scheduling/reporting: New Consultation to `NEW_CONSULTATION`, Follow-up to `FOLLOW_UP`, Emergency to `EMERGENCY`, Post-operative and Procedure Review to `REVIEW`, and Screening to `REVIEW` unless the product owner approves a new global type. Do not infer `WALK_IN` from an Ophthalmology subtype; it remains an appointment/arrival channel.

**Rationale:** The existing OPD enum does not express Post-operative, Screening, or Procedure Review. A specialty subtype preserves FSD meaning without breaking General OPD, Dental, appointment, and reporting contracts.

**Review outcome:** `APPROVED - 15 OCTOBER 2026`. This is the binding visit-context contract for Phase 2.

### DEC-03 Canonical laterality

**Approved decision:** Use one backend enum:

`OD | OS | OU | NOT_APPLICABLE | NOT_SPECIFIED`

Apply record-specific allowed subsets:

- Eye measurements and images: `OD | OS`; save separate identifiable records/values for each eye.
- Findings/treatments that genuinely apply to both eyes: `OD | OS | OU`.
- Diagnoses: `OD | OS | OU | NOT_APPLICABLE`; reject missing laterality when the configured diagnosis requires it.
- Complaint/appointment context: `OD | OS | OU | NOT_SPECIFIED`.
- Never use `NOT_SPECIFIED` to bypass a required clinical laterality rule.
- API responses use the canonical codes; UI may display Right, Left, Bilateral, Not Applicable, or Not Specified.

**Rationale:** This reconciles the FSD's OD/OS/OU, Bilateral, Not Applicable, and Not Specified terms while preserving strict per-eye measurement storage.

**Review outcome:** `APPROVED - 15 OCTOBER 2026`. This is the binding laterality contract for Phases 2 through 9.

### DEC-04 Test lifecycle and undefined targets

**Approved decision:** Use these persisted statuses:

`ORDERED -> PATIENT_WAITING -> PATIENT_CALLED -> IN_PROGRESS <-> DRAFT -> COMPLETED -> SUBMITTED_FOR_REVIEW -> REVIEWED`

Controlled branches:

- `ORDERED | PATIENT_WAITING | PATIENT_CALLED | DRAFT -> CANCELLED`, with reason.
- `IN_PROGRESS | DRAFT -> UNABLE_TO_PERFORM`, with reason.
- `COMPLETED | SUBMITTED_FOR_REVIEW -> REPEAT_REQUIRED`, preserving the original result and creating one linked repeat task.
- `REPEAT_REQUIRED -> PATIENT_WAITING` for the linked repeat, not by overwriting the original task.
- Reassignment and station handoff are audited actions that do not invent a status unless the approved transition requires one.

Resolve the FSD ambiguities as follows:

- Treat `REVIEWED` as the terminal successful status; do not add a redundant `CLOSED` status.
- Treat `Doctor Review` as a routing destination/action. An unable-to-perform task retains `UNABLE_TO_PERFORM` and creates a review item for the ophthalmologist; it does not transition to an undefined status.
- Amendment creates a new version linked to the reviewed result and requires re-review; it never changes historical content in place.

Use `expected_status` and `expected_version` on mutations and return `409` for stale transitions. Transition validation belongs in the service and updates are conditional in the repository.

**Review outcome:** `APPROVED - 15 OCTOBER 2026`. This is the binding lifecycle contract for Phase 4 and the test portions of Phases 5 through 7.

### DEC-05 Consultation lifecycle mapping

**Approved decision:** Keep the global OPD visit status as the coarse shared workflow and store an Ophthalmology workflow status separately:

- `CHECKED_IN`
- `PRELIMINARY_EXAMINATION`
- `AWAITING_DOCTOR`
- `UNDER_CONSULTATION`
- `TESTS_ORDERED`
- `AWAITING_RESULTS`
- `CLINICAL_REVIEW`
- `REVIEW_COMPLETED`
- `CONSULTATION_COMPLETED`

Recommended transitions:

- `CHECKED_IN -> PRELIMINARY_EXAMINATION | AWAITING_DOCTOR`
- `PRELIMINARY_EXAMINATION -> AWAITING_DOCTOR | UNDER_CONSULTATION`
- `AWAITING_DOCTOR -> UNDER_CONSULTATION`
- `UNDER_CONSULTATION -> TESTS_ORDERED | CLINICAL_REVIEW`
- `TESTS_ORDERED -> AWAITING_RESULTS`
- `AWAITING_RESULTS -> CLINICAL_REVIEW` when required results are reviewed or explicitly deferred
- `CLINICAL_REVIEW -> TESTS_ORDERED | REVIEW_COMPLETED`
- `REVIEW_COMPLETED -> CONSULTATION_COMPLETED`

Recommended coarse mapping:

- Checked In and Preliminary Examination map to the existing pre-consultation OPD states.
- Awaiting Doctor maps to `READY_FOR_CONSULTATION`.
- Under Consultation through Review Completed map to `IN_CONSULTATION`.
- Consultation Completed maps to `COMPLETED` only in the same finalization transaction.

Do not reuse `SKIPPED`, `CANCELLED`, or `NO_SHOW` as Ophthalmology clinical statuses. Preserve them as global operational visit outcomes.

**Rationale:** A separate specialty state prevents breaking existing OPD transitions while representing the FSD workflow precisely.

**Review outcome:** `APPROVED - 15 OCTOBER 2026`. This is the binding consultation-state mapping for Phases 1, 4, 8, and 9.

### DEC-06 Masters thresholds units and mandatory rules

**Approved decision:** Implement branch-scoped, versioned configuration rather than hardcoded clinical constants. Configuration groups should cover:

- Sub-specialities and complaints.
- Test catalogue and station compatibility.
- Equipment/device/calibration metadata.
- Visual-acuity scales.
- Diagnosis terminology references and laterality requirements.
- Drugs/dilating agents and approved options.
- Optical products and IOL catalogue references.
- Clinical alert thresholds.
- Grading and reason masters.
- Mandatory fields/tests/completion rules by branch, visit type, test type, and applicable patient context.

Rules:

- No production threshold or mandatory test is seeded from an example in the FSD.
- Seed only structural/system records needed to administer configuration.
- A missing required configuration fails clearly; it must not silently use a clinical default.
- Store the configuration version/snapshot used for a completed result or consultation.
- Changes apply prospectively unless an authorized migration is approved.
- Threshold alerts never create diagnoses.

**Rationale:** The FSD explicitly requires hospital-approved configurable values. Current general settings do not support clinical masters, so this needs a scoped clinical configuration resource rather than additions to generic system settings.

**Review outcome:** `APPROVED STRUCTURAL RULE - CLINICAL VALUES PENDING`. Implement the configuration framework as specified. Forms and completion behavior cannot be declared production-ready until Ophthalmology leadership supplies and approves the applicable clinical values; they must never be inferred or hardcoded.

### DEC-07 Permissions and staff/station scope

**Approved decision:** Extend the existing `module/screen/action` permission system under module `OPD` with dedicated Ophthalmology screens and granular actions. Approved permission inventory:

| Screen | Actions |
|---|---|
| Ophthalmology Configuration | View, Create, Edit, Deactivate |
| Ophthalmology Intake | View, Edit, Escalate |
| Ophthalmology Test Queue | View, Assign, Reassign, Call, Start, Edit, Complete, Cancel |
| Ophthalmology Test Review | View, Review, Request Repeat, Amend |
| Ophthalmology Consultation | View, Edit, Diagnose, Prescribe, Complete, Override, Reopen, Amend |
| Ophthalmology Optical Prescription | View, Create, Edit, Approve, Cancel |
| Ophthalmology Portal Publication | View, Publish, Withdraw |
| Ophthalmology Reports | View, Export |

Seed permissions, not clinical authority assumptions. Grant all new permissions to `SUPER_ADMIN` through the existing reconciliation behavior. Do not automatically grant them to Receptionist, Nurse, Technician, Optometrist, Doctor, or other system roles until the approved role-permission matrix is supplied. Custom roles may receive approved subsets.

Every action also revalidates user status, organization, branch, department, encounter, station membership, assignment, test/resource type, and record state. Doctor availability is not technician availability and must not be reused for station staff.

**Review outcome:** `APPROVED - 15 OCTOBER 2026`. Implement the named permission infrastructure in Phase 2. Default assignments beyond existing `SUPER_ADMIN` reconciliation require explicit administrative/clinical assignment and must not be assumed.

### DEC-08 Review completion override signature reopening and amendment

**Approved decision:**

- A test review is a separate authorized action recording reviewer, time, version, decision, and optional reason/comment.
- Alert acknowledgement records the alert version, actor, timestamp, and note; it does not change the underlying result or create a diagnosis.
- Deferred results require a result/order reference, reason, due date or review plan, and responsible clinician. Deferral does not mark the result reviewed.
- Override requires a dedicated permission, reason, and snapshot of unmet prerequisites. Overrides are never implicit.
- Digital approval means server-recorded authenticated actor, linked doctor identity, timestamp, consultation version, and approval event. Do not claim cryptographic/e-signature compliance unless separately required and implemented.
- Completion validates a single version and runs atomically with local status, approval, audit, and timeline changes.
- Reopening creates an amendment episode; it does not unlock or mutate the finalized version.
- Each amendment is append-only, references the superseded version, stores before/after values and reason, and requires re-review/re-approval when it affects reviewed or patient-visible content.
- Portal-visible or downstream records affected by amendment are republished or superseded through explicit idempotent actions.

**Review outcome:** `APPROVED - 15 OCTOBER 2026`. Phase 1 may implement the transaction/version foundations. Phase 9 must obtain its actual completion prerequisites from the DEC-06 approved configuration; missing clinical values remain a stop condition.

### DEC-09 Shared-domain changes

**Approved decision:** Extend existing domains minimally and preserve their identifiers/source-of-truth records:

- Diagnosis: extend the existing structured OPD diagnosis contract with optional laterality, clinical status, severity/stage, differential marker, and version metadata; keep backward compatibility.
- Medication prescription: extend prescription items with optional eye laterality, start date, taper schedule, refill, and ophthalmic administration instructions; keep pharmacy dispensing on the same prescription record.
- Optical prescription: create a separate Ophthalmology-owned structured resource because it is not a medication order.
- Laboratory/imaging: retain existing order and verified-result records; create Ophthalmology test activities that reference the shared order item/result. Add laterality and clinical reason only through an approved compatible contract.
- Procedure/surgery: use the existing recommendation/booking domain and pass diagnosis, laterality, encounter, and clinical reason by approved fields/references.
- Referral/follow-up: reuse existing records and extend only missing laterality/pre-review-test/instruction fields where approved.
- Billing/insurance: generate idempotent charges from authoritative service/procedure/prescription events; Ophthalmology must not calculate finance totals independently.
- Portal: create explicit publication records/references; do not expose active documents or results by default.

All extensions must be additive/versioned, nullable for existing records, and regression-tested for General OPD, Dental, pharmacy, laboratory, imaging, surgery, billing, and portal flows.

**Review outcome:** `APPROVED ADDITIVE STRATEGY - 15 OCTOBER 2026`. Each consuming phase must still inspect and document the concrete shared contract, keep changes minimal and backward-compatible, and stop if the existing domain contract conflicts with this strategy.

### DEC-10 Device imports files and publication

**Approved decision:** Separate structured clinical data from binary attachments:

- Store clinical values in the applicable Ophthalmology result/version record.
- Store reports, images, videos, diagrams, maps, and machine exports through the existing patient-document/storage abstraction, linked by document ID and metadata rather than embedding binaries in MongoDB.
- Add metadata for patient, encounter, task/test, order/result, eye, device, acquisition time, source type (`MANUAL`, `DEVICE_IMPORT`, `MANUAL_CORRECTION`), checksum, MIME type, size, original file name, review status, and publication status.
- Validate MIME type, size, extension/signature where supported, and authorization before persistence.
- Use configured Google Cloud Storage in production. The existing local storage path is development-only and currently lacks full Ophthalmology media/publication semantics.
- Do not implement vendor/device parsing until a versioned adapter contract and sample payload are approved. Phase 5/6 may support authorized manual entry plus attachment upload first.
- Publication states should be `INTERNAL`, `APPROVED_FOR_PORTAL`, and `WITHDRAWN`; only an authorized explicit action publishes a reviewed/final resource.

Do not guess supported MIME types, file-size limits, retention, DICOM support, video formats, or annotation formats. Those remain policy inputs.

**Review outcome:** `APPROVED ARCHITECTURE - POLICY VALUES PENDING`. Manual entry and generic attachment integration may proceed under existing approved storage policy. MIME types, size limits, retention, vendor formats, DICOM/video support, and adapter contracts must be configured or separately supplied and must not be guessed.

### DEC-11 Mandatory and deferred reports

**Approved decision:** Treat these as release-mandatory operational reports because they are generated wholly from the new Ophthalmology workflow and are needed to operate it:

- Station queue dashboard.
- Test turnaround.
- Pending review.
- Repeat and unable-to-perform.
- Clinical volume.
- Diagnostic utilization.

Treat these as required integrations with existing authoritative domains, not duplicate Ophthalmology reporting calculations:

- Procedure/surgery pipeline.
- Follow-up compliance.
- Revenue view.

If product defers any report, retain its requirement ID with an approved target release; do not mark it `N/A`. Use snapshot/background refresh patterns for dashboard metrics and paginated indexed query APIs for detailed reports.

**Review outcome:** `APPROVED - 15 OCTOBER 2026`. The six workflow reports are release-mandatory; the three cross-domain views are mandatory integrations with their authoritative reporting domains.

### DEC-12 Station sequencing and eligible users

**Approved decision:** Implement branch-scoped configuration:

- Station: code/name, branch, active status, supported test types, assigned devices, and explicit user memberships where required.
- Workflow profile: branch, Ophthalmology visit subtype, ordered stage groups, tests within each group, parallel/sequential mode, bypass rules, and effective version.
- Test assignment: station, optional assigned user, priority, instructions, expected status/version, and assignment history.

Eligibility is derived server-side from active user status, branch assignment, Ophthalmology department access, required action permission, supported station/test membership, and record scope. Do not trust client-supplied role/branch/station eligibility.

The repository has doctor availability but no general technician/station availability contract. Therefore:

- Do not reuse doctor appointment availability for technicians.
- Initial assignment may use active/eligible membership without claiming real-time availability.
- If real-time staff shifts/availability are required, record a separate dependency and do not invent it inside Ophthalmology.
- Revalidate eligibility immediately before assign/reassign and reject stale changes with `409`.

Emergency bypass records the skipped stages and reason. It does not delete pending tasks silently.

**Review outcome:** `APPROVED - 15 OCTOBER 2026`. This unlocks station configuration in Phase 2 and assignment lifecycle in Phase 4. Real-time technician shift availability remains a separate deferred dependency; active eligible membership is the initial authoritative rule.

## Phase implementation decision map

| Phase | Approved decisions governing the phase | Entry constraint |
|---|---|---|
| Phase 1 | DEC-01, DEC-04, DEC-05, DEC-08, DEC-09 | Complete the phase gap note, API contract draft, and baseline checks before code changes. |
| Phase 2 | DEC-02, DEC-03, DEC-06, DEC-07, DEC-12 | Implement the configuration structure without inventing clinical values. |
| Phase 3 | DEC-03, DEC-06, DEC-07, DEC-08, DEC-10 | Required complaint/emergency values and applicable file policy must exist before production completion. |
| Phase 4 | DEC-04, DEC-05, DEC-07, DEC-12 | Publish the exact queue model and transition contract in the phase gap note. |
| Phase 5 | DEC-03, DEC-06, DEC-07, DEC-08, DEC-10 | Core-test clinical values and applicable storage policy must be configured. |
| Phase 6 | DEC-03, DEC-06, DEC-07, DEC-08, DEC-10 | Advanced-test clinical values and applicable storage policy must be configured. |
| Phase 7 | DEC-03, DEC-06, DEC-07, DEC-08, DEC-09, DEC-10 | Consent, prescription, follow-up, clinical values, and file contracts must be verified. |
| Phase 8 | DEC-03, DEC-06, DEC-07, DEC-08, DEC-09 | Shared data contracts must be verified before the consolidated read model is frozen. |
| Phase 9 | DEC-04, DEC-05, DEC-06, DEC-07, DEC-08, DEC-09 | Configured completion prerequisites must exist; no missing clinical rule may be defaulted. |
| Phase 10 | DEC-09, DEC-10, DEC-11 | Verify authoritative integration APIs and any required storage/vendor policy. |
| Phase 11 | DEC-01 through DEC-12 | Verification only; no unresolved requirement or pending required configuration may be silently omitted. |

## Shared dependency register

| Dependency | Required contract/change | Owner | State |
|---|---|---|---|
| Appointment/OPD | Specialty context and canonical status/visit mapping | OPD/appointments | APPROVED DESIGN - PHASE CONTRACT REVIEW |
| Diagnosis | Laterality, status, severity/stage, differential, history | Shared clinical | APPROVED ADDITIVE EXTENSION - PHASE CONTRACT REVIEW |
| Laboratory/imaging | Ordering during consultation and per-test activity/result mapping | Laboratory/imaging | APPROVED REUSE STRATEGY - PHASE CONTRACT REVIEW |
| Medication/pharmacy | Eye-specific fields without duplicate prescription domain | Pharmacy/OPD | APPROVED REUSE STRATEGY - PHASE CONTRACT REVIEW |
| Procedure/surgery | Diagnosis/laterality/context handoff | Procedure/surgery | APPROVED REUSE STRATEGY - PHASE CONTRACT REVIEW |
| Referral/follow-up | Reason, laterality, instructions, pre-review tests | OPD | APPROVED REUSE STRATEGY - PHASE CONTRACT REVIEW |
| Billing/insurance | Idempotent charge triggers and finance reporting | Billing/insurance | APPROVED REUSE STRATEGY - PHASE CONTRACT REVIEW |
| Consents | Dilation/procedure/guardian references | Consent/patient | APPROVED REUSE STRATEGY - PHASE CONTRACT REVIEW |
| Documents/storage | Ophthalmic media and publication metadata | Documents/storage | APPROVED ARCHITECTURE - POLICY VALUES PENDING |
| Patient portal | Explicit publish/withdraw/restricted-content policy | Portal | APPROVED ARCHITECTURE - POLICY VALUES PENDING |
| Audit/timeline | Safe event types and version references | Patient/audit | APPROVED REUSE STRATEGY - PHASE CONTRACT REVIEW |
| Developer B | Versioned API contract, lifecycles, errors, permissions, examples | Frontend | READY FOR PHASE 0 CONTRACT HANDOFF |

## Proposed transaction concurrency and idempotency boundaries

| Workflow | Required protection |
|---|---|
| Assignment/reassignment | Expected state/version, scope and eligibility revalidation, idempotent retry. |
| Draft save | Upsert intended draft/version with unique encounter/test/task identity. |
| Completion/review | Expected state/version, immutable completed version, transactional audit where required. |
| Repeat | Preserve original and create/link repeat exactly once. |
| Consultation completion | Transaction across local consultation/visit/appointment/approval/audit/timeline; idempotent or compensated external handoffs. |
| Amendment/reopening | New version with reason and before/after references; no overwrite. |
| Orders/charges/publication | Idempotency/source keys; no duplicates on retry. |
| File upload | Authorized metadata/file consistency, compensation, orphan cleanup. |

## Phase 0 deliverable status

- [x] Code-level inventory of every shared dependency.
- [x] Proposed data model, indexes, and module placement.
- [x] Approved test and consultation transition maps published in the API contract.
- [x] Approved permission inventory translated into the API contract and proposed seed behavior.
- [x] `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md` with examples and error catalogue.
- [x] Master/configuration ownership contract, with missing clinical values marked `PENDING CONFIGURATION`.
- [x] Portal/file publication contract, with missing policy values marked `PENDING POLICY`.
- [x] API and web baseline typecheck, lint and build results plus focused OPD tests recorded.
- [x] The 15 October 2026 owner approval recorded in the gap note and contract changelog.

## Exit recommendation

**APPROVED BACKEND IMPLEMENTATION COMPLETE; FRONTEND HANDOFF READY; PHASE 11 RELEASE VALIDATION PARTIALLY COMPLETE.** DEC-01 through DEC-12 remain binding project rules. Developer B may proceed against API contract version 1.10.0 and the live backend APIs. Phase 11 automated hardening corrected the direct optical-prescription permission boundary and passed the complete focused release suite. The owner-deferred live GCS smoke test, interactive multi-role/multi-branch acceptance, one unrelated API department-visibility regression, existing repository lint failures and four unrelated web-test failures remain recorded release conditions. No later backend phase or release has started.


### 20 October 2026 comparison/report clarification

The new exact-version comparison projection and protocol/eye/department/unit checks are documented in backend contract 1.12. Unit codes are explicit versioned FORM_PROFILE configuration, never guessed. Missing clinical options/thresholds/nested clinical semantics remain configuration/contract dependencies. Visit volume now includes no-test visits and linked scheduling subtype/sub-speciality; pending review includes exact unreviewed completed results before submission; repeat/unable reports expose current reasons and explicitly labelled current-task-status percentages. These changes do not close diagnosis/optical amendments, all clinical master schemas, downstream business reports or live clinical/storage/permission/responsive acceptance.
