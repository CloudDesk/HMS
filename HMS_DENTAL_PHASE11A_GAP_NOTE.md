# Dental Phase 11A — Imaging integration gap assessment

Date: 15 September 2026. Scope: Dental Imaging only; 11B/11C excluded.

## Sources and reusable implementation

Read PROJECT_RULES.md, AGENTS.md, the Scope 2 execution plan, the supplied Phase 11A request, Dental Phase 8/10 evidence, Dental Examination/odontogram/tooth panel, clinical-order models/repository/service/routes, Imaging/report workflow, catalogue, permissions, frontend hooks/API clients and existing tests. The older Developer 1 prompt and Release2 FSD DOCX files are absent. This work uses the explicit Phase 11A request and existing approved order lifecycle; no new lifecycle/business configuration is needed. Inspected HMS Local OPD order-builder/table/status patterns and Imaging workspace; prototypes remain read-only.

- Existing OpdClinicalOrder stores optional item toothNumber, validates FDI and Dental context, and links patient/visit/doctor/branch. Existing catalogue provides IMAGING_SERVICE records.
- Existing imaging workflow processes the same order and stores reports in the existing ImagingReport model, with transactional status changes, audit and report context.
- Existing consultation completion submits explicitly selected investigations. Draft requests are not yet in the Radiology queue. Preserve that contract and explain it in the UI.
- Existing OPD clinical-order hooks/query keys and Imaging report hooks can be composed by a Dental feature hook.

## Gaps / intended changes

- Add explicit Add X-Ray / Scan at the selected tooth, plus optional full-mouth context, catalogue selection, save feedback, persisted status and on-demand report viewing inside Dental Examination.
- Keep the same consultation order shared with the existing Imaging tab; no second local order store or collection. Do not create orders from examination changes.
- Gate new queries by Dental visibility and existing permissions; load catalogue only when the add dialog opens. Keep search/page in URL state.
- Existing order service checks branch only. Add Dental imaging department/doctor authorization using repository-owned actor lookup, including toothless Dental orders and report reads. Preserve non-Dental behavior.
- Doctor has OPD Clinical Orders View but not Imaging Orders View. Reuse the existing report URL with a Dental-only, verified visit/order fallback under OPD Clinical Orders View. Do not grant access to the generic queue or report mutations, add roles, or seed permissions.
- Add conditional draft writes/version conflict handling to prevent overwriting a submitted/stale order.
- Add focused HTTP/database and component tests for scope, FDI, optional tooth, explicit creation, persistence and full existing report lifecycle.

Intended files: Dental imaging component/CSS and feature hook; Dental Examination/page integration; existing OPD order API/types/schema/service/repository; Imaging report route; focused tests; phase plan and verification note. Shared changes will be itemized in verification. No Lab, billing, prescription, global CSS or prototype changes.
