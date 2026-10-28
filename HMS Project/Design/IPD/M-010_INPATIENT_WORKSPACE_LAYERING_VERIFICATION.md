# M-010 Inpatient Workspace Layering Verification

## Implemented

- Removed runtime API clients and direct TanStack Query orchestration from `InpatientWorkspacePage.tsx`.
- Added `useInpatientWorkspaceFeature` as a small coordinator over existing branch, ward, doctor, service, inpatient admission, Surgery, and inpatient downstream hooks.
- Added a focused admitted-inpatient list/refresh domain hook and extended the existing admissions configuration hook with a focused ward list query.
- Kept filters, tabs, modals, temporary form values, UI validation, toast wording, and presentation interactions in the page.

## Contract and workflow checks

- Admission and patient IDs, branch/ward/bed context, query parameters, and request gating remain scoped to the selected server-derived admission.
- Surgery recommendation, round-note, vital, and diagnostic-order payloads and sequencing remain unchanged.
- Inpatient refresh, Surgery, round-note, vital, and diagnostic-order invalidation remain owned by their domain hooks.
- Existing route-level permission enforcement remains unchanged.
- The authoritative clinical persistence and legacy browser-storage cleanup behavior remains intact.

## Validation

Focused tests, staff-web typecheck/build, scoped ESLint, and `git diff --check` results are recorded in the completion report.

## Scope confirmation

No other page, backend module, completed finding, M-011 work, or M-015 work was changed. The next M-010 increment has not started.
