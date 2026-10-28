# HMS Ophthalmology gap closure report — audit checkpoint

21 October 2026 · DEV-OPHTHALMOLOGY-F-V2 · HEAD 334605dd45e75a47149da43f65e2e339120c6a77.

**Outcome: partially aligned; the connected journey is not accepted as complete.** This checkpoint delivers the requested audit and integration decisions first. No production fixes are claimed in this phase.

## Reused implementation

Shared patient/appointment/OPD identity; specialty context/intake/configuration; versioned test tasks/results and repeats; shared diagnosis/prescription/referral/follow-up; optical prescription; transactional clinical completion, audit and timeline; current source summary; separate publication; existing Emergency/admission/bed and billing domains. The August baseline's “no Emergency backend” description does not represent current source.

The current source already includes emergency receipt-versus-clearance guards, stale-reference revalidation at sign-off, repeat preservation and separate downstream summary labels. These are pre-existing fixes, not changes made during this audit. Fresh focused tests pass; historical reports are not counted as fresh execution.

## Gap register and intended work

| ID | Finding | Evidence | Action / owner | Current safety boundary |
|---|---|---|---|---|
| G01 | Registration-time warning escalation absent from inspected specialty path | Alert creation in completeIntake only; D1-03/D2-03 | Clinical + integration owners define authorized source/trigger | No simulated alert success |
| G02 | Later assessment/doctor-review escalation not a standalone action | D1-09/D2-12/D2-25; intake service/routes | Approve re-screen/re-escalation semantics before adding action | Existing completed intake is not evidence of later screening |
| G03 | Existing OPD/alert -> urgent episode link absent | CreateEmergencyDTO; outbound referral trace | Emergency/OPD owners: inbound provenance and retry contract | Display unconfirmed, never infer from patient equality |
| G04 | No authorized clinical clearance/return-to-routine transition | requireEmergencyClearance; alert enums | Clinical owner: explicit policy/permissions/evidence | ACTIVE and ACKNOWLEDGED remain blocked; urgent tasks retain path |
| G05 | Specialty sign-off has no invoice handoff; generic completion rejects specialty | Completion hook; useOpdVisitFeature | Billing + specialty owners: approved operation mapping | Sign-off does not imply invoice/payment success |
| G06 | Ordinary invoice create lacks operation idempotency | billing.service.ts create; billing-context-index test | Billing owner defines duplicate operation semantics; add request replay safely after approval | Do not forbid legitimate multiple invoices per visit |
| G07 | Auto-populated consultation selected by name, not specialty charge mapping | useBillingAutoPopulate.ts | Billing owner supplies actual catalogue mapping; inspect pagination and permission gating before editing | No fabricated charge items or values |
| G08 | Optical fulfillment and aggregate completion undefined | Optical approval and summary only | Optical/product/clinical owners supply contract | Approved prescription/sign-off not whole-journey completion |
| G09 | Multi-role transitions, logout/login and responsive journey unverified | No live browser scenario in this audit | Authorized local/staging fixtures and acceptance execution | Unit tests are not UAT |
| G10 | Sixteen connected prototype states remain a later-phase deliverable | Existing three-image documentation is not full sequence | After phase approval, derive from actual screens; same synthetic IDs and honest blocked branch | Images must remain labeled design previews |

## Intended files for the next approved phase

Start from the gap findings and inspect exact ownership before changes. Likely specialty files: useOphthalmologyCompletionFeature, OphthalmologyCompletionWorkspace, OphthalmologyConsultationSummaryCard and their tests; existing Billing feature/API/service/model only after approved idempotency/mapping contract. Emergency schema/type/service/repository changes require the explicit source/clearance decisions above. No shared registry, permission seed, router, schema or model was edited here.

Prototype destination remains docs/ophthalmology-prototypes/ with README mapping the requested 16 states to current components. Use existing ophthalmology.css, OPD cards, sticky patient header, white/light canvas, blue primary actions and shared HMS navigation. scope/HMS Local/opd-consultation.html was inspected as a visual reference; scope/HMS Local is untouched. Reference images 4–7 were not attached to this request; current source remains the primary styling reference. Existing locally ignored prototype assets are preserved.

## Verification and phase gate

See HMS_OPHTHALMOLOGY_WORKFLOW_VERIFICATION.md for exact commands and results. First focused run: 6 suites / 75 tests passed, including isolated Mongo transaction/version/idempotency regressions and summary rendering. No new regression test is needed for documentation-only changes; implementation changes in the next phase require their own regressions.

No live browser/staging UAT, deployment, commit, push, PR, branch switch, merge, rebase or cherry-pick was performed. The two pre-existing documentation changes remain. The next implementation/prototype phase has not started, as required by AGENTS.md's explicit phase stop gate. Clinical and billing contract decisions are not guessed.
