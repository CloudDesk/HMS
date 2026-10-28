# Dental OPD Phase 9 Gap Note

## Scope

Phase 9 audits and hardens the existing Dental OPD workflow delivered in Phases 1–8. It does not introduce a new clinical, billing, pharmacy, laboratory, imaging, permission, currency, audit, or patient subsystem.

## Existing architecture reused

- OPD visits, consultation, diagnosis serialization, prescriptions, clinical orders, referrals, follow-up, and visit completion.
- `OpdDentalExamination` findings, history, soft-tissue assessment, treatment plan, lifecycle, audit, and timeline integration.
- Existing Service Catalogue validation for procedures, laboratory tests, and imaging services.
- Existing pharmacy formulary and prescription submission workflow.
- Existing invoice, payment, receipt, currency, billing audit, and Dental treatment-source integration.
- Existing JWT, RBAC middleware, branch scope resolution, doctor and department context.
- Existing patient profile workspace and EMR Timeline tab.

## Findings requiring Phase 9 work

1. Imaging clinical-order items needed an optional persisted FDI tooth association for verified Dental OPD visits.
2. Laboratory orders needed an explicit server rejection for tooth associations.
3. Non-Dental imaging and source-neutral clinical-order contexts needed server rejection for Dental tooth associations.
4. Dental visits needed relevant formulary, laboratory, and imaging entries prioritized while retaining each complete existing catalogue.
5. The OPD Patient Timeline button targeted the retired `/patients/emr` route instead of the canonical patient profile EMR Timeline tab.
6. The initial clinical-order implementation queried the Department model from the service layer; department lookup must remain repository-owned.
7. Phase 8 treatment identifiers and invoice-linked treatment mutation safeguards needed final regression coverage.

## Intended changes

- Extend the existing clinical-order item contract with optional `tooth_number` and validate it in the existing clinical-order service.
- Use `DepartmentRepository` to resolve verified visit department context.
- Add Dental-only relevance sorting and indicators to existing prescription/laboratory/imaging screens; retain all catalogue entries.
- Route Patient Timeline to `/patients/profile?...&tab=EMR%20Timeline`.
- Add focused high-value backend and frontend regression tests.
- Record the complete automated and manual evidence in `HMS_DENTAL_PHASE9_VERIFICATION.md`.

## Explicit exclusions

- No new collection, role, permission, currency configuration, billing/payment subsystem, clinical order subsystem, or global CSS architecture.
- No automatic diagnosis, treatment, prescription, laboratory, imaging, invoice, payment, or receipt creation.
- No Phase 10 work.
