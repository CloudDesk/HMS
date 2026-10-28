# M-010 Surgery Workspace Layering Gap Note

## Scope

This M-010 increment is limited to `apps/web/src/pages/SurgeryWorkspacePage.tsx` and the minimum Surgery hook/test support needed to make the existing Surgery feature hook the page's only server-state boundary.

## Reusable architecture

- `useSurgeryWorkspaceFeature` for URL filters, lookups, availability, and cross-domain coordination.
- `useSurgery` for recommendation/booking queries, mutations, and cache invalidation.
- `useSurgeryDownstreamFeature` and `useSurgeryDownstream` for procedure-context prescriptions and clinical orders.
- Existing advance-payment, consent, patient-document, billing-link, patient, doctor, department, branch, and service hooks.
- Existing Surgery service and API client.

## Page-owned responsibilities found

- Direct mounting of advance-payment and Surgery-downstream feature hooks using selected-booking context.
- Direct invocation of recommendation creation, booking creation, recommendation cancellation, booking confirmation, rescheduling, cancellation, and completion mutations.
- Action-mode branching and reschedule/cancellation business validation before mutation dispatch.
- Direct traversal of mutation pending state.

The page did not directly import API clients, `fetch`, `useQuery`, or `useMutation`; its layering gap was raw domain/feature orchestration below the intended single feature boundary.

## Intended change

- Extend the existing `useSurgeryWorkspaceFeature`; do not create a duplicate feature hook or service.
- Compose advance-payment and downstream-order hooks inside the Surgery feature hook using the page's selected-booking context.
- Expose typed recommendation, booking, and workflow actions plus aggregate pending/loading/error state.
- Keep forms, tabs, modal selection, validation rendering, and toast presentation in the page.

## Dependencies and boundaries

- No matching Surgery/procedure prototype exists under `scope/HMS Local`; no prototype file was modified.
- No backend, API contract, authentication, permission, or unrelated page changes are required.
- Patient profile, inpatient pages, M-011, M-015, and completed findings remain untouched.
