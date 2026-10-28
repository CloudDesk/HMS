# M-010 Inpatient Workspace Layering Gap Note

## Scope

This increment is limited to `apps/web/src/pages/InpatientWorkspacePage.tsx` and the minimum existing inpatient/domain hook extensions, focused tests, and M-010 evidence needed for that page. No other page or backend module is in scope.

## Sources inspected

- `PROJECT_RULES.md`
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md`
- the current Inpatient Workspace page and its existing dirty-state clinical persistence restoration
- inpatient admission, admissions configuration, downstream clinical, Surgery, branch, doctor, service, and routing permission hooks/services/API contracts
- the established OPD, Emergency, Surgery, and Patient Profile feature-hook patterns
- `scope/HMS Local/inpatient-workspace.html` as a read-only UI reference

## Existing architecture reused

- branch, doctor, service, Surgery, admissions configuration, and inpatient downstream domain hooks
- inpatient admission, admissions configuration, and Surgery services
- existing hierarchical query-key factories and route-level permission enforcement
- authoritative inpatient round-note, vital, laboratory, and imaging APIs introduced by the completed clinical persistence work

## Direct responsibilities found

The page directly owned branch, ward, doctor, procedure-service, admitted-stay, Surgery recommendation, and Surgery booking queries. It also directly owned Surgery recommendation mutation/invalidation, inpatient-list invalidation, branch/admission server-context selection, downstream clinical hook composition, and diagnostic-order response composition.

## Intended files

- `apps/web/src/pages/InpatientWorkspacePage.tsx`
- `apps/web/src/hooks/admissions/useInpatientWorkspaceFeature.ts`
- a focused inpatient admission-list domain hook
- a focused ward-list extension to the existing admissions configuration domain hook
- focused Inpatient Workspace tests and this evidence

No API contract, backend file, route, shared registry, other page, M-011 work, or M-015 work is changed.
