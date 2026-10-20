# Ophthalmology gap closure — 20 October 2026

The user authorized fixing the remaining backend/frontend gaps and asked the agent to choose the technical flow. Preserve all existing working-tree changes, including the newer queue eligibility work. Reuse PROJECT_RULES, FSD v1.0 Table 6 / section 17, approved DEC-01–12 and the existing repositories/services/hooks/UI. No unrelated Scope2 work or clinical data seeding.

## Current batch gap note

Reuse the scoped report service, report projections, streaming CSV, existing OPD visit indexes and report permissions. Add an explicit VISITS clinical-volume basis from authoritative active Ophthalmology departments and non-deleted OPD visits, including visits with no context or test orders. Date filters use visitDate for this basis. Preserve the existing ORDERED_ENCOUNTERS basis when the parameter is omitted. Reject station filters for visit volume rather than silently changing the population. Return visit/branch/department/doctor/type/date/status only; do not expose patient identifiers/names or notes. Route the staff clinical-volume screen to VISITS with clear date labels, pagination and the same export filters. Add no-test, scope, date, pagination, export and compatibility regressions.

Further technical direction: appointment scheduling intent belongs on the existing Appointment, while confirmed clinical findings belong on the encounter. Use approved subtype mappings and configured values; no inferred hospital-specific units, thresholds, scales, drugs or grants. Broader correction workflows must update immutable source versions transactionally, not just a change journal. Missing external business rules/clinical values will be recorded as specific setup requirements, not pushed to the user as architecture questions.

## Structured amendment gap note

Reuse existing clinical-review source fields and treatment plan validators. Extend supported corrections to follow-up decision and treatment plans. Preserve plan IDs when supplied, reject foreign/duplicate identities, validate current diagnosis/eye and all existing medication/order/procedure/referral/follow-up references through the same service helper as draft saving. Preserve previous immutable versions; reopen/reapproval and transaction/audit behavior stay in place. Staff forms edit structured fields and retain original expected versions and exact before snapshots, with no raw JSON editor and no downstream order-status mutation implied.

## Appointment integration gap note

FSD Table 6 is scheduling intent: store a nullable structured Ophthalmology object on the existing appointment; do not create a second appointment or rewrite confirmed clinical findings. Reuse the active doctor/branch/department, existing GENERAL service catalogue within the Ophthalmology department (booking reference only, no inferred billing), and explicit active SUB_SPECIALITY configuration options. Add REVIEW as the shared scheduling type for the already approved POST_OPERATIVE/SCREENING/PROCEDURE_REVIEW → REVIEW mapping. Validate service/master references on create, update and portal reschedule, preserve metadata when rescheduling, reject mismatched doctor/department changes, and use the existing updated_at timestamp for conditional edits. No clinical choices or services are seeded. Booking lookups use existing Booking permissions, minimal projections and pagination. Existing non-specialty appointments remain compatible.

## Intermediate evidence

- Visit-volume regressions: API report/CSV 2 files / 13 tests; staff report API/feature/page 3 files / 16 tests passed.
- Structured clinical amendments: API finalization 11 tests and staff finalization API/feature 12 tests passed, including immutable source history, foreign reference/identity rejection, no-op rejection and audit rollback.
- Appointment integration: real isolated replica-set create/reschedule/catalogue/scope/timestamp/audit rollback tests passed (4 tests). New frontend intent/field/configuration regressions passed (10 tests). No production data was seeded.
- Intermediate typecheck found and corrected literal query typing and the newly required REVIEW performance bucket; final full checks remain necessary after source changes settle.

Shared additions are confined to existing appointment persistence/service/schema/routes, existing OPD/Emergency referral adapters, appointment booking/domain transport and the review visit label/performance bucket. New appointment options are branch/department scoped and paginated and contain no prices/clinical rules. Existing active/historical catalogue versions remain traceable; the new sub-speciality code/label/active editor and activation validation do not seed clinical defaults.

## Comparison and report coverage gap note

Reuse immutable FORM_PROFILE snapshots and exact prior completed result versions. Add optional explicit measurement-path/unit maps with structured admin authoring; no default units, thresholds or automatic conversion. Progression requires matching form/schema, exact tested eye, VF machine/program/strategy or OCT type/scan set, numeric measurements and identical configured unit maps. Also require same patient/branch/department and earlier performed time. Add a minimal paginated prior-version projection bound to the saved result version; incompatible rows remain visible with reasons, so server totals are never counts of an in-memory filtered page. Staff lookup is gated by result permissions, matching context, saved/unchanged source, explicit open state and URL pagination. Save/completion/amendment remain authoritative.

Correct pending-review population to include completed results requiring review before explicit submission, and stale reviewed versions; require the current exact completed result to exist and be unreviewed. Reuse this population for dashboard counts. Repeat/unable rows expose only the latest recorded transition reason for their current status. Visit volume joins the existing appointment with patient/branch/department/doctor consistency checks, exposes scheduling subtype/sub-speciality only, preserves visits without appointments and never claims that booking intent is a confirmed finding.


Dashboard scope safety: branch snapshots include only active authoritative Ophthalmology departments. Reading or refreshing requires access to every department included in the branch aggregate; partial-scope users use the existing filtered reports. Snapshots persist their department set. Legacy unbound snapshots or changed active department sets return DASHBOARD_NOT_READY until refreshed, rather than exposing an aggregate of unknown scope. Existing Dashboard permissions still apply, and no new grants or indexes are introduced.
