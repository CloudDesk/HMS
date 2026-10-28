# M-010 OPD Visit Layering Gap Note

## Scope

First incremental M-010 pass, limited to `apps/web/src/pages/OpdVisitPage.tsx` and the minimum OPD hook/test support required to remove page-owned server orchestration.

## Reusable code

- OPD TanStack Query hooks and keys in `hooks/opd/useOpd.ts`.
- The cross-domain OPD workspace composition hook in `hooks/opd/useOpdWorkspace.ts`.
- Patient, branch, department, doctor, medicine, pharmacy inventory, service catalogue, billing, and patient-document domain hooks.
- Existing OPD API request/response types and error mappers.
- Existing HMS Local consultation workspace layout and interaction patterns from `scope/HMS Local/opd-consultation.html`, `opd-module.js`, and `opd-module.css`.

## Page-owned responsibilities found

- Queries/lookups: recent visits, selected visit and patient context, vitals, consultation, prescription, laboratory and imaging drafts, documents, doctors, medicines, inventory, services, branches, and departments.
- Mutations: vitals creation, referral submission, consultation/prescription/order draft saves, prescription and clinical-order submission, consultation completion, visit completion, document upload/download/delete, and call-next.
- Cross-domain orchestration: consultation completion followed by pharmacy/laboratory/imaging routing, billing invoice creation, and final visit status update.
- Cache/query behavior: imperative reloads after mutations and local copies of server data.
- URL selection: selected visit lookup and navigation.

## Intended change

- Keep form and presentation state in the page.
- Coordinate the workflow through `useOpdVisitFeature`.
- Reuse domain hooks through `useOpdWorkspace` and add only the missing prescription/clinical-order draft domain mutations.
- Preserve request parameters, payloads, mutation order, best-effort downstream error behavior, status updates, messages, UI, and navigation.

## Dependencies and boundaries

- No backend, API contract, authentication, permission model, or unrelated page change is required.
- Existing OPD domain hooks directly wrap the established OPD API client; no duplicate service wrapper is introduced in this pass.
- Broader M-010 page migrations remain out of scope.
