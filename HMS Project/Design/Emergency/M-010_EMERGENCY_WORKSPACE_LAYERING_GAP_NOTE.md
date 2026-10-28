# M-010 Emergency Workspace Layering Gap Note

## Scope

This M-010 increment is limited to `apps/web/src/pages/EmergencyWorkspacePage.tsx` and the minimum Emergency hook/test support needed to remove page-owned server orchestration.

## Reusable architecture

- `useEmergencyWorkspaceFeature` for permissions, URL state, encounter context, and cross-domain coordination.
- `useEmergency` for Emergency TanStack queries, mutations, cache updates, and invalidation.
- Existing Emergency service and API client.
- Existing medicine, pharmacy inventory, service catalogue, patient, doctor, department, and branch domain hooks.
- Existing HMS Local Emergency workspace patterns from `scope/HMS Local/emergency-workspace.html`, `emergency-module.js`, and `emergency-module.css`.

## Page-owned responsibilities found

- Direct TanStack queries for the active medicine catalogue and branch pharmacy inventory.
- Direct runtime imports of medicine, pharmacy inventory, and service API clients.
- Formulary merging and laboratory/imaging service classification based on server data.
- Selected-encounter fallback between detail and list responses.
- Direct dispatch of triage, consultation, order, disposition, patient-linking, priority-override, and doctor-assignment mutations.
- Disposition success sequencing across mutation, toast, and queue navigation.
- Direct mutation pending-state traversal.

## Intended change

- Extend `useEmergencyWorkspaceFeature`; do not create another feature hook or duplicate service.
- Keep forms, tabs, modals, validation, local selections, and ordinary UI event handling in the page.
- Preserve all request parameters, mutation payloads, cache behavior, success/error copy, permissions, and navigation.

## Boundaries

- No backend, API contract, authentication, permission, or unrelated page changes are required.
- Surgery, patient profile, inpatient, M-011, M-015, and completed findings remain untouched.
