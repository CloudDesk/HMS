# HMS Ophthalmology C10 Structured Treatment Plan Frontend Gap Note

## Phase authority and scope

The project owner explicitly approved C10 on 22 October 2026. C10 is limited to migrating the Ophthalmology treatment-plan frontend to backend API contract 2.0.0 and verifying the live workflow. No backend contract, shared-domain lifecycle, permission seed, route registry, or HMS Local prototype change is authorized.

Controlling requirements are the Ophthalmology FSD workflow step 11, Tables 9, 33, 35, 36, 38 and 44; approved DEC-03, DEC-07, DEC-08 and DEC-09; the C9 gap and verification records; and API contract 2.0.0.

## Reusable implementation

- `OphthalmologyClinicalReviewEditor` already uses React Hook Form, Zod, draft guards, diagnosis selection, optimistic version submission and Sonner-backed feature mutations.
- `useOphthalmologyTreatmentLinksFeature` already loads the live encounter summary only when the reference panel is opened and validates context, visit, patient, branch and department scope.
- The summary projection already provides medication prescriptions, clinical orders, procedure recommendations, referrals, follow-ups and the separate optical prescription.
- `OphthalmologyFinalizationTools` already provides typed controlled amendments, stale-state protection and confirmation.
- Existing HMS OPD patterns provide compact white cards, two-column form grids, explicit required markers, status text, retry states, confirmation actions and responsive behavior.

## Gaps to close

1. Frontend request/read schemas still require free-text `category` and do not accept `action_type`, `legacy_category` or `optical_prescription_id`.
2. The draft editor renders a category input and allows unrelated references to be selected together.
3. The live reference panel displays every shared-domain selector instead of only the selector owned by the chosen action.
4. Optical treatment linkage is not selectable.
5. Historical category-only rows cannot be read or explicitly reclassified.
6. Controlled treatment-plan amendments still edit category and lack action-specific selectors.
7. Consultation summary rendering still labels treatment classification as Category.
8. Focused frontend tests assert the retired contract.

## Approved C10 behavior

- Required action choices are `MEDICATION`, `OPTICAL`, `INVESTIGATION`, `PROCEDURE`, `REFERRAL`, `FOLLOW_UP` and `OTHER`.
- The editor renders only the matching live selector for the selected action. `OTHER` has no downstream selector.
- Changing action clears every previously selected downstream reference before a new selection is made.
- A client-side Zod refinement mirrors the backend matching-reference rules, duplicate diagnosis/laterality/action rule and unique order rule. Backend validation remains authoritative.
- Live lookups remain on demand when the user opens a row's reference panel. Loading, empty, error, unavailable-saved-reference and retry states remain explicit.
- Historical rows render their `legacy_category`, start with no selected action, and cannot be saved or amended until an authorized clinician explicitly classifies them and selects the required current reference.
- `RULED_OUT` status is displayed in diagnosis choices and active/planned conflicts surface through existing validation/error handling; the backend remains authoritative under concurrent diagnosis changes.
- The consultation summary displays Action, using `legacy_category` only for historical data.

## Intended files

- `apps/web/src/api/ophthalmology-care.ts`
- `apps/web/src/api/ophthalmology-completion.ts` only if required by derived amendment typing
- `apps/web/src/components/ophthalmology/OphthalmologyClinicalReviewEditor.tsx`
- `apps/web/src/components/ophthalmology/OphthalmologyTreatmentLinks.tsx`
- `apps/web/src/components/ophthalmology/OphthalmologyFinalizationTools.tsx`
- `apps/web/src/components/ophthalmology/OphthalmologyConsultationSummaryCard.tsx`
- `apps/web/src/hooks/ophthalmology/useOphthalmologyTreatmentLinksFeature.ts`
- Focused frontend contract/component tests
- API contract, alignment matrix, workflow traceability, Developer A prompt and C10 verification documentation

## Verification design

- Schema tests cover every action/reference pair, missing reference, conflicting reference, `OTHER`, duplicates, strict-field rejection and legacy reads.
- Component tests cover explicit classification, action-specific selector behavior, incompatible-reference clearing, exact version submission, stale-record protection and legacy warnings.
- Summary tests cover current action and historical category presentation.
- Run focused frontend tests, API/web typecheck, lint and build, record pre-existing unrelated failures precisely, and perform a responsive live browser workflow if the local application and authenticated test context are available.

## Stop gate

C10 ends after implementation, automated verification, available manual verification, alignment updates and a C10 verification record. No subsequent corrective item or release phase may start without explicit approval.
