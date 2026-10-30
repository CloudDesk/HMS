# Ophthalmology consultation UI refresh

Date: 29 October 2026

## Authorized scope

Apply the four supplied screenshots and https://hms-ophthalmology.vercel.app/ as presentation references for the existing consultation. Change layout and styling only. Preserve existing clinical fields, state, handlers, API contracts, permissions, validation, persistence, navigation actions, and workflow order.

## Reuse and gaps

- Reuse the patient header, permission-filtered stepper, examination dashboard, draft save, task links, camera, image import, attachments, emergency controls, and clinical intake modal.
- Use the supplied reference's light background, white bordered cards, blue actions, numbered headings, paired eye controls, segmented controls, and dark camera panels.
- Keep existing pinhole readings, task controls, acquisition details, and extra metadata even when absent from the reference. Do not copy sample patient values, completion states, autosave claims, or unsupported editable CCT fields.
- The original HMS Local directory and referenced DOCX documents are absent in this checkout. This UI request supplies its own design reference and requires no new clinical contracts.
- No backend or shared registry changes are needed. Existing service/domain layering is outside this presentation scope.

## Intended files

- `apps/web/src/pages/OphthalmologyWorkspacePage.tsx`: presentation scope, badge placement, numbered navigation.
- `apps/web/src/components/ophthalmology/OphthalmologyExaminationDashboard.tsx`: heading markup, numbered cards, visual acuity panels, keyboard-accessible attachment upload presentation.
- `apps/web/src/styles/ophthalmology-consultation.css`: styles scoped to this consultation page, including responsive rules.

## Verification

## Owner-authorized optional Clinical Summary contract

The owner explicitly requested removal of the Clinical Summary UI and its mandatory requirement. Update the existing frontend write schema, API request schema/DTO, clinical-review model and repository together. Permit omission or empty string while retaining the 10,000-character limit. Preserve an existing saved summary if an API caller omits the property; new reviews store an empty string. The configured CLINICAL_REVIEW_RECORDED requirement must still require a persisted doctor review, independently of optional narrative text. Existing transactions, actor/audit metadata, clinical versions, authorization, encounter scope, treatment references and all other completion requirements remain unchanged. No new domain, architecture or release phase is introduced.

## Diagnosis & Treatment reference UI gap note

Reuse the existing intake summary, diagnosis editor and clinical-review/treatment editor with their hooks and Zod contracts. The supplied images define the compact two-column summary, diagnosis form and purple-accent treatment panel. Keep actual saved diagnosis/eye/status, validation, stale-version protection, linked downstream records, emergency actions, draft/save handlers and revision history. Strategy, care-owner assignment and education/counselling checklist fields shown in the reference have no corresponding current clinical-review API fields; do not introduce unsaved controls or invented values. Present supported plan status, priority and follow-up decision instead. No backend contract or new functional phase is authorized. Prototype directory remains absent; no scope assets are modified.

## Optical Prescription UI gap note

Match the owner's four optical reference images using the existing OphthalmologyOpticalEditor, React Hook Form/Zod schema, optical feature hook, saved version/conflict handling, draft registration, approval permission and confirmation, and existing saved spectacle slip. Change presentation only: heading, compact cards and matrix, PD controls, readable coating display labels and authorization footer. Preserve canonical coating values, real status/version, field limits, date-time timezone conversion and approval lock. Keep previous removals of the consultation eyebrow/header intake-save controls and normal select colors. The referenced prototype directory is absent; supplied images are the visual source. No new contract, backend feature or functional phase is required.

## Prescriptions & Orders UI gap note

Reuse the existing SharedCareSection, shared OPD prescription builder, ophthalmology laboratory/imaging selectors and useOpdWorkspace draft/submit handlers. Match the owner's five screenshots with a scoped orders stylesheet: three-column medication inputs, right-hand prescription/instruction cards, two-column test selection, separate order summary and builder footer. Preserve real catalogue lookup, permissions, field validation, mutation payloads, print and pharmacy/order submission. No new domain, backend contract or release phase is required. The referenced scope/HMS Local directory is absent in this checkout; supplied screenshots are the visual source, and no prototype files are changed. Browser parity remains unverified while local browser use is disabled.

Tracked in `HMS_OPHTHALMOLOGY_CONSULTATION_UI_VERIFICATION.md`. This is a narrow UI correction; no new functional release phase is started.

## Referral & Follow-up UI gap note

Owner requests the four supplied reference layouts. Reuse OphthalmologySharedCareSection, OpdReferralSection, OphthalmologyFollowUpSchedulingSection, useOpdWorkspace, the existing registered draft handlers, referral mutations and follow-up scheduling/finalization navigation. Preserve field bindings, permissions, disabled states and backend contracts. Existing source has sample fallback identity/diagnosis/date/doctor values and automatic-save copy; presentation must show real data or explicit unselected states. Calendar choices and standard time buttons are existing UI options, not verified provider availability.

Intended files: the two referral/follow-up components, SharedCareSection, CareWorkspace and workspace page for the existing intake-modal callback, plus an ophthalmology-scoped continuing-care stylesheet and focused scheduling tests. No new backend domain, lifecycle, availability API, database change or phase implementation is required. scope/HMS Local remains untouched. Browser visual verification is currently unavailable because local browser use is disabled in Work settings.

- Owner clarification (30 October): keep optical classification, power matrix and PD sections, make them optional. Existing draft contract required these at frontend, Fastify, model and service layers. Reuse the same draft/approval endpoints, scoped repository, version checks, transaction and audit paths. Permit blank draft sections without synthetic clinical values, and retain complete-prescription checks at authorization. Other optical required fields remain unchanged. This is a correction to the existing ophthalmology workflow, not a new Scope 2 phase.

- Follow-up scheduling correction: current UI allowed every calendar date/time and initialized new plans to 12 October 2026. Reuse configured timezone, existing UTC follow-up payload, draft registration and appointment service. Disable elapsed choices in UI, remove the hard-coded date, and add a server UTC-start guard before appointment creation. No lifecycle, availability, permission or transaction contract changes; appointment service still owns availability/conflict validation.

- Consultation confirmation audit: native browser confirm calls were present in diagnosis/treatment removal, optical approval, intake, saved-result review, finalization, publication, emergency clearance and unsaved navigation. Reuse the existing ConfirmDialog/Modal and existing action handlers; add an asynchronous UI adapter and opt-in asynchronous routing guard. Audit all six consultation tabs plus associated ophthalmology editors/queue actions and shared prescription clearing. Preserve confirmation text, cancel behavior, backend versions/permissions and draft protection. Replace emergency text prompts with the existing escalation form, retaining emergency-only severity and original source context. Shared files: ConfirmDialog, new confirm-action adapter, navigation and shared OPD prescription section. No backend/contract changes, no prototype edits and no next release phase started.

- Emergency header detail request: reuse the current blocking-alert predicate, reason text and authorized clearance action. Replace the always-visible header message with a persistent red alert icon that opens the existing HMS Modal. UI state is tied to the current alert ID; closing details does not acknowledge or clear the alert. Files: workspace page/test and consultation CSS. No backend or clinical-rule changes.
- Optical approval presentation: remove the Doctor Authentication and Clinical Approval Confirmed card; move only its Locked for Dispensing badge into the prescription classification header using the same approved_at condition. Preserve all approval, read-only, version and printing behavior. Changes limited to the optical editor and its existing tests.
- Repeated emergency review card: the intake alert list was rendered outside the tab branches in the workspace page. Move that same list into the existing header alert-details modal. Keep modal content mounted while hidden to retain acknowledgement notes; preserve all alert status predicates, permissions, handlers and routine-care restrictions. No new API or workflow.
- Emergency disposition duplication: the clearance component was mounted by both the workspace page and the diagnosis/care workspace. Remove the care-workspace instance; retain one dialog controller at page level and show only cleared disposition/admission history in the alert-details modal on demand. Pending alerts use the existing review card with one authorized clearance action per alert. Keep a header history entry point after clearance; all blocking predicates and server handlers remain unchanged.
