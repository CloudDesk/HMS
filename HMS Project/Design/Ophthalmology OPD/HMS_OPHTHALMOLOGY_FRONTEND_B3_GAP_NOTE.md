# Ophthalmology frontend B3 gap and execution note

16 October 2026. User authorised continuing B1–B3 frontend implementation. Preserve all previous B0/B1/B2 source changes. Backend contract v1.10.0 and actual A4/A5/A9 routes were inspected read-only; do not change Developer A code or invent transitions.

Reuse the specialty API/service/domain/feature layers, existing OPD/patient hooks, configuration station/workflow schemas, RHF/Zod, URL filters, Sonner and OPD cards/tables/modal patterns. `scope/HMS Local` is absent. Implement a scoped queue route, paginated filters/sort, task detail/history, configured creation, exact-version action dialogs, idempotent repeat/create retry and links to the existing result editor. Mutations refresh affected queue/detail/context/result caches. Loading/error/denied/conflict and dirty-form states are mandatory. Intended files: new queue API, domain/feature hook, page/dialogs/tests, minimal route/sidebar/access-control/service registry and frontend documentation updates.

## Contract findings before implementation

- Calling requires PATIENT_WAITING; starting requires PATIENT_CALLED and an eligible assigned station member. Unavailable returns to PATIENT_WAITING with a reason. Unable/cancel/reassign/repeat/route have exact schema/status/reason requirements; no unrestricted status selector.
- There is no submit-for-review endpoint. SUBMITTED_FOR_REVIEW enum vocabulary is not an action API. Show this dependency; do not route to a guessed endpoint or mark review locally.
- Queue DTO contains patient/visit/station/user IDs and times but no patient name/MRN/age/gender, visit number, subtype/consultant or station/assignee labels. Use authorised shared lookups on selected detail only; no N+1 list enrichment or fabricated labels. A scoped queue projection is required for full FSD row coverage.
- List projection excludes special instructions and histories; read those from authorised task detail. Create returns an ORDERED task but the current list/detail visibility predicate only includes explicit assignment, station membership or eligible doctor-review work. Unassigned creator/assigner discovery is a backend-owner dependency; do not weaken that predicate from the frontend.
- No dedicated eligible-user or clinical station lookup projection exists. Existing Configuration View and Users View may provide scoped station/member candidates; backend must revalidate Start permission/active membership. No shift availability claim.
- Only the bound workflow version may describe sequencing. Load it by its exact ID on selected encounter detail with Configuration View; never substitute today's active profile for a historical bound workflow. No computed prerequisite/bypass projection or sequential-stage start validation was found in the current service; full FSD sequencing remains a backend-owner dependency. The frontend does not assert that prerequisites have passed.
- B1 appointment/master and B2 nested clinical/QA prerequisites remain in the existing handoff register. B4/B5 and portal publication are outside this request.

## Verification plan

Test exact schemas/routes/versions and idempotency, permission/branch/query gates, server-only transitions, error-preserved action forms, stale edit baselines, duplicate-click prevention and late responses. Run six API/web checks plus owned lint and relevant/full web tests. Check responsive live list/dialog states without seeding clinical choices or weakening access. Do not declare full release completion while missing contracts or clinical acceptance remain.
