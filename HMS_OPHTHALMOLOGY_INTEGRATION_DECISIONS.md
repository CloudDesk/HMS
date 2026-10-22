# HMS Ophthalmology integration decisions

21 October 2026 · DEV-OPHTHALMOLOGY-F-V2 · HEAD 334605dd45e75a47149da43f65e2e339120c6a77.

This is an evidence-based decision request, not approval of a new contract. The existing user-modified reports remain untouched. See HMS_OPHTHALMOLOGY_WORKFLOW_TRACEABILITY.md for both diagrams and HMS_OPHTHALMOLOGY_WORKFLOW_VERIFICATION.md for fresh checks.

## 1. Emergency-to-OPD linkage

**Current implementation:** an Emergency referral can reference an appointment. Ophthalmology traces EmergencyEncounter.referral.appointmentId -> OpdVisit.appointmentId, validates patient/branch/department against the appointment and specialty context, and returns metadata only. Multiple sources conflict; mismatches produce no confirmed source. It does not expose Emergency notes through OPD permissions.

Evidence:

- apps/api/src/modules/ophthalmology/ophthalmology.repository.ts:951, getEmergencyReferralTrace.
- apps/api/src/modules/ophthalmology/ophthalmology.service.ts:1162, getConsultationSummary.
- apps/api/src/modules/ophthalmology/ophthalmology.phase9.test.ts:108, valid/mismatched/ambiguous source regression (freshly passed).
- apps/api/src/modules/emergency/emergency.service.ts:155 and :217, referral submission/booking.
- apps/api/src/modules/emergency/emergency.types.ts:26, CreateEmergencyDTO; emergency.model.ts and emergency.routes.ts.

**Missing:** the reverse journey from an already-existing Ophthalmology encounter/alert to a newly created or retrieved urgent Emergency episode has no approved source relationship in CreateEmergencyDTO. Same patient is not proof of same clinical episode. An outgoing referral to a later appointment is not return-to-the-original-OPD clearance. Registration and later assessment/review triggers are not covered by the single intake-completion alert path.

**Safe now:** retain metadata-only outbound trace and honest unconfirmed-link messaging. Do not synthesize an inbound link, reuse unrelated order source IDs, or create a second Emergency subsystem.

**Owner decision required:** Emergency + OPD integration owners, with Ophthalmology consumer review. Approve relationship direction/cardinality; source OPD/context/alert identifiers; eligible actors; patient/branch/department checks; existing urgent-episode selection; duplicate/concurrent/retry behavior; transaction or compensation boundary; audit; and handling of an original-OPD return versus a new referral visit. No shared schema change is authorized by this document.

## 2. Emergency disposition and clinical clearance

**Current implementation:** Ophthalmology alert states are ACTIVE and ACKNOWLEDGED. Acknowledgement checks the actor, scope and expected state/version, and persists receipt with audit. requireEmergencyClearance rejects any EMERGENCY_SCREENING alert for routine task start/result writes and readiness/sign-off, including an acknowledged alert. The guard runs before configurable completion requirements and cannot be removed by omitting ALERTS_ACKNOWLEDGED or applying an override. Eligible EMERGENCY-priority task execution retains its existing path.

Evidence:

- apps/api/src/modules/ophthalmology/ophthalmology-intake.model.ts:95; ophthalmology.types.ts:233.
- apps/api/src/modules/ophthalmology/ophthalmology.service.ts:307, :1335, :1501, :1535.
- Fresh phase3, phase4, phase5 and phase9 regression suites, including direct writes after acknowledgement and override/sign-off denial.
- apps/web/src/pages/OphthalmologyWorkspacePage.tsx, EmergencyAlert warning and acknowledgement action.

The shared Emergency domain has DISCHARGE, ADMIT, TRANSFER and LEFT dispositions. emergency.service.ts:933 requires a doctor evaluation, applies source-state transitions, persists actor/time/reason and creates an admission request for ADMIT. Shared status and disposition do not update or clear the specialty alert. Emergency discharge also has its own billing-closure requirement; do not confuse it with routine Ophthalmology sign-off.

**Missing:** approved specialty clearance/disposition semantics and a permitted return-to-routine action. Current safe blocking is not a completed emergency round-trip. Existing shared disposition values are not automatically an approved mapping to Ophthalmology clearance.

**Safe now:** preserve the guard and emergency-priority exception; preserve receipt history and explicit unconfirmed-link warning. Do not introduce a clear button, infer clearance from a note/discharge, or delete alerts to unblock care.

**Owner decision required:** Ophthalmology clinical owner plus Emergency/IP owners. Specify allowed dispositions/transitions/reversal/re-escalation; authorized permission/role and attribution; required clinical evidence and linked episode; which routine actions may resume; reason and timestamp requirements; expected-version/retry semantics; immutable history; legacy acknowledged alerts and already-signed records. This is a release blocker for the alternate branch.

## 3. Clinical completion versus downstream fulfillment

**Current implementation:** completeConsultation commits an attributable clinical snapshot and coordinated OPD/specialty state transaction. The summary subsequently reads current source records. The snapshot remains unchanged when a follow-up source changes. Source status is separately shown for medication requests, procedure recommendations/linked booking, referral and follow-up; publication uses separate APIs. The UI explicitly says that clinical sign-off does not confirm downstream fulfillment.

Evidence:

- apps/api/src/modules/ophthalmology/ophthalmology.service.ts:1081 and :1162.
- apps/api/src/modules/ophthalmology/ophthalmology.repository.ts, getDoctorReviewProjection.
- apps/web/src/components/ophthalmology/OphthalmologyConsultationSummaryCard.tsx:92 and its freshly passed tests.
- ophthalmology.phase9.test.ts:144 and :168: current source state versus signed snapshot and validated same-patient booking (freshly passed).
- ophthalmology-phase10.service.ts and ophthalmology.phase10.test.ts: publication subsystem (existing evidence, not rerun this audit).

**Missing:** optical dispensing/fulfillment contract and an authoritative aggregate patient-journey completion definition. Medication request SUBMITTED is not dispensing; a booking is not performance; a draft follow-up is not scheduled. Summary does not establish the requested invoice/payment handoff.

**Safe now:** maintain separate statuses, unknown/failed states and explicit refresh behavior; never label the entire journey complete merely because clinical finalization succeeded. No reason to couple unrelated fulfillment delay to mutation of the signed snapshot.

**Owner decisions required:** downstream owners define authoritative fulfillment resources and failure/retry semantics; optical owner defines fulfillment if required; product/clinical owner defines aggregate completion. Billing owner defines charge mapping and repeat-request identity without prohibiting legitimate multiple invoices.

### Billing-specific evidence and boundary

BillingService.create (billing.service.ts:174) creates a new invoice with no request idempotency key. validateInvoiceContext (:367) validates patient/visit/branch/appointment; resolveItems (:393) uses active catalogue services and server prices. billing.model.ts:105 has a nonunique visit index; the partial unique context index applies only when contextId is an ObjectId. billing-context-index.test.ts explicitly permits multiple ordinary OPD invoices (fresh PASS).

useOphthalmologyCompletionFeature.ts:83 invokes only specialty completion. useOpdVisitFeature.ts:135 rejects specialty completion before the generic optional invoice handoff at :150. Therefore the generic completion handoff cannot close the specialty billing gap. useBillingAutoPopulate.ts chooses a consultation service by name from a limited catalogue response; no approved mapping from specialty test code to billable item was established.

Approve which catalogue service(s) correspond to each chargeable specialty action and whether/how the operation may be invoiced again, then implement idempotency around the chosen billing operation. Do not invent prices or enforce one-invoice-per-visit. No billing/shared-domain contract changes made in this audit.

## Approval checkpoint

The audit and three decision findings are delivered first. AGENTS.md requires: “Stop and wait for explicit approval before starting the next phase.” Implementation and the requested sixteen-state prototype sequence have not started. Approving the safe implementation/prototype phase does not approve missing clinical policies; those items remain blocked until their named owners supply a contract.
