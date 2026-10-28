# HMS Ophthalmology — continuous workflow storyboard

## Review order and branch rules

Routine lane: **01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 13 → 14 → 15**. Screens **11 → 12** are an explicitly labelled alternate branch from screen 04. They use the same synthetic identity but a separate counterfactual clinical state; they do not inherit the routine treatment approvals. That branch stops while disposition/clearance and inbound linkage remain unapproved. There is no arrow back to routine sign-off.

[Open the end-to-end overview](00-end-to-end-workflow.png). Each numbered image below is a separate full screen, not a collage. All images are design prototypes, not screenshots, implemented functionality, clinical advice or browser acceptance evidence.

## Continuity ledger

- Patient **Asha Demo**, MRN **HMS-DEMO-000021**; OPD **OPD-DEMO-000031**; appointment **APT-DEMO-000041**.
- Main Branch; 21 October 2026; new consultation; Dr Mira Shah; laterality **OU**. IDs are synthetic display references, not valid production ObjectIds.
- Complaint: gradual blurred distance vision OU. Routine screening: no warning indicators reported. VA unaided OD 6/18, OS 6/12; pinhole 6/6 OU; near N6 OU; IOP OD15 / OS16 mmHg. These are fictional observations, not approved thresholds or catalogue options.
- Original subjective refraction **SR-DEMO-0031 → RES-DEMO-0031**: saved then completed 10:00 with POOR reliability; OD −1.25/−0.50×180, OS −1.00/−0.50×175, BCVA6/9 OU. Reviewed 10:05 with REPEAT_REQUIRED, reason inconsistent responses.
- Linked repeat **SR-DEMO-0032 → RES-DEMO-0032**: queued screen08, started10:15, draft saved10:20, completed10:25, accepted10:30. OD −1.50/−0.50×180, OS −1.25/−0.50×175, BCVA6/6 OU; reliability GOOD. Original immutable.
- Screen05 working assessment: suspected bilateral refractive error. Confirmed free-text assessment after accepted repeat: bilateral refractive error OU. No unverified ICD catalogue entry claimed.
- **PLAN-DEMO-0031** saved10:35; optical correction indicated. No medication, surgery or referral requested. **FU-DEMO-0031** DRAFT, four-week review advice, no appointment.
- **OPT-DEMO-0031** draft saved10:37 → approved10:40; approved powers match the repeat; PD62mm. Lens/material display is explicitly a bound-profile demo selection, not a claimed approved product. Refraction itself does not imply approval.
- Routine clinical snapshot **SNAP-DEMO-0031** signed10:45. Optical fulfillment unconfirmed; follow-up still DRAFT. Clinical sign-off does not prove downstream fulfillment.
- Alternate alert **ALT-DEMO-0031**: examination09:36 → routing09:37 → acknowledgement09:38 → urgent handoff documentation09:42. Receipt does not mean clearance. Emergency encounter link not confirmed; no admission or bed invented.
- Billing screen15: completed routine consultation can select an active catalogue service. Current catalogue/pricing is unavailable; candidate quantity1, discount0, tax0, paid0; subtotal/total/balance pending. No invoice number or issued/paid invoice fabricated. Specialty test/optical/follow-up requests are not auto-charged. Generation action remains pending authoritative pricing.

## Screen sequence

| Screen / image | Purpose | Entry condition | Primary action | Exit condition |
|---|---|---|---|---|
| [01 — OPD worklist / after appointment](01-opd-worklist.png) | OPD worklist / after appointment | Appointment booked; visit not checked in | Check in | Patient selected for check-in |
| [02 — Check-in and triage](02-check-in-triage.png) | Check-in and triage | Selected appointment | Save triage | Checked in; routine screening negative |
| [03 — Preliminary eye assessment](03-preliminary-eye-assessment.png) | Preliminary eye assessment | Triage saved | Save preliminary assessment | Visual acuity recorded |
| [04 — Comprehensive ophthalmologist examination](04-comprehensive-examination.png) | Comprehensive ophthalmologist examination | Preliminary VA saved | Save examination | Examination recorded; refraction pending |
| [05 — Diagnosis and clinical assessment](05-diagnosis-clinical-assessment.png) | Diagnosis and clinical assessment | Examination recorded | Save assessment draft | Working assessment recorded; refraction needed |
| [06 — Diagnostic orders and queue](06-diagnostic-orders-queue.png) | Diagnostic orders and queue | Working assessment needs refraction | Create task | SR-DEMO-0031 queued |
| [07 — Diagnostic test execution and results](07-diagnostic-test-execution.png) | Diagnostic test execution and results | SR-DEMO-0031 queued | Save draft then complete saved result | RES-DEMO-0031 completed with poor reliability |
| [08 — Doctor result review and repeat testing](08-result-review-repeat-testing.png) | Doctor result review and repeat testing | Original result completed; review pending | Request repeat with reason | SR-DEMO-0032 queued; original immutable |
| [09 — Treatment plan](09-treatment-plan.png) | Treatment plan | Linked repeat explicitly executed and accepted | Save diagnosis-linked plan | Plan saved; optical approval pending |
| [10 — Optical prescription and approval](10-optical-prescription-approval.png) | Optical prescription and approval | Accepted repeat and saved treatment draft | Approve saved optical draft | OPT-DEMO-0031 approved; fulfillment unconfirmed |
| [11 — Emergency escalation — alternate branch](11-emergency-escalation.png) | Emergency escalation — alternate branch | Counterfactual warning during screen04 | Authorized acknowledgement and routing | Acknowledged; routine progression blocked |
| [12 — Emergency disposition and handoff — alternate branch](12-emergency-disposition-handoff.png) | Emergency disposition and handoff — alternate branch | Alert acknowledged; routine held | Document urgent handoff through existing authorized pathway | Handoff pending; no approved clearance |
| [13 — Consultation completion and doctor sign-off](13-consultation-completion-signoff.png) | Consultation completion and doctor sign-off | Routine lane from10; all configured prerequisites met | Doctor sign-off | Clinical snapshot completed |
| [14 — Consultation summary and downstream handoff](14-consultation-summary-downstream-handoff.png) | Consultation summary and downstream handoff | Clinical snapshot signed | Review summary and applicable handoffs | Billing consultation eligibility shown; fulfillment pending |
| [15 — Billing and invoice](15-billing-invoice.png) | Billing and invoice | Signed routine consultation; catalogue lookup required | Prepare encounter-linked invoice draft | Draft preparation pending authoritative price |

The numbered sequence reserves11–12 for the alternate branch. Screen13 explicitly resumes the unchanged routine state from10. Screen09 shows the timed repeat execution and review that occurred after08; this is an explicit recorded transition, not an implication that requesting a repeat completes it. Screen13 shows readiness followed by authorized sign-off, not a bypass of the gate.

## Source mapping and visual reference

- Shell/tokens: `apps/web/src/tokens.css`, `features/doctor-directory.css`, `styles/ophthalmology.css`; Inter, pale canvas, bordered white cards, blue actions and compact fields.
- Worklist: `apps/web/src/pages/OpdQueuePage.tsx`; encounter: `OpdVisitPage.tsx`.
- Intake: `OphthalmologyIntakeForm.tsx`, `useOphthalmologyWorkspaceFeature.ts`, `consultation-areas.ts`.
- Examination: `OphthalmologyTestsWorkspace.tsx`, `hooks/ophthalmology/result-fields.ts`; actual supported forms include visual acuity, subjective refraction, IOP, slit-lamp and posterior fundus. Detailed tabs in the images are a prototype composition of existing areas/forms, not a claim of exact deployed layout.
- Assessment/treatment: `OphthalmologyDiagnosisEditor.tsx`, `OphthalmologyClinicalReviewEditor.tsx`, `OphthalmologyCareWorkspace.tsx`.
- Optical slip: `OphthalmologyOpticalEditor.tsx`; approval and print styling are source-derived.
- Readiness/summary: `OphthalmologyCompletionWorkspace.tsx`, `OphthalmologyConsultationSummaryCard.tsx`; existing service guard blocks unresolved emergency screening alerts.
- Billing: `BillingWorkspacePage.tsx`, `features/billing.css`, `useBillingAutoPopulate.ts`, `api/billing.ts`. Supported invoice states are DRAFT, PENDING, PARTIALLY_PAID, PAID, CANCELLED; no new ISSUED enum proposed. Existing categories: CONSULTATION, LAB_TEST, IMAGING_SERVICE. Consultation auto-population uses an active GENERAL catalogue service containing “consultation”; specialty task billing is not assumed.
- Referenced Images4–7 were not attached in accessible conversation files. The source code and existing repository UI previews provide the available visual baseline. No pixel-identical match to missing references is claimed.

## Pending contracts and interpretation

Clinical clearance values/roles/transitions, inbound alert-to-Emergency provenance, rescheduled/cross-branch policies and durable cross-service recovery remain owner dependencies. Screen12 presents documented urgent management plus an unresolved disposition; it does not fabricate an authorized disposition. No clinical catalogue or normal range is approved by this storyboard. Mandatory markers illustrate UI hierarchy; actual backend configuration remains authoritative.

Optical fulfillment and aggregate patient-journey completion remain unconfirmed. Billing eligibility, pricing and source mappings must be revalidated server-side; screen15 is a pending draft-preparation state because no live service catalogue was queried. A saved draft/issued invoice is not claimed.

## Generation, preservation and QA

Generated with built-in imagegen using the exact prompts in [generation-prompts.json](generation-prompts.json). This task changes only prototype artifacts/workflow documentation. Branch baseline: DEV-OPHTHALMOLOGY-F-V2 at334605dd45e75a47149da43f65e2e339120c6a77. Existing report/UAT edits preserved; protected audit hash remains recorded in the prior report. No commit, branch integration, push, PR or deployment.

The existing `docs/` ignore rule means these requested deliverables are local ignored artifacts; they are not force-staged. See [quality review](QUALITY_REVIEW.md) and [contact sheet](contact-sheet.png) for inspection results.

