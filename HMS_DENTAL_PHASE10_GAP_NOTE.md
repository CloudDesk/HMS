# Dental OPD Phase 10 Gap Assessment

**Date:** 10 September 2026  
**Scope:** Final release and operational-readiness certification of Dental OPD Phases 1–9

## Existing architecture to reuse

- Dental Examination owns odontogram findings, Dental history, soft-tissue examination, and the immutable draft/completed lifecycle.
- Existing OPD diagnosis persistence owns general and FDI tooth-associated diagnoses.
- Existing Service Catalogue-backed treatment items own planned procedures; the billing domain owns invoices, invoice items, payments, and receipts.
- Existing generic OPD prescription, laboratory clinical-order, imaging clinical-order, pharmacy dispensing, audit, and patient-timeline domains remain authoritative.
- Existing RBAC middleware and repository/service scope checks enforce role, branch, department, doctor, patient, visit, examination, treatment-item, and invoice ownership.
- Existing TanStack Query domain/feature hooks own frontend server state and targeted invalidation.

## Coverage already present

- Permanent/primary FDI validation, Dental-only detection, draft persistence, completion, immutability, concurrency, audit/timeline, and doctor/nurse/receptionist/SUPER_ADMIN/unauthenticated access.
- Examination → diagnosis → treatment persistence, invalid treatment fields, catalogue-service ownership, inactive/wrong-department service rejection, and invoice-linked treatment immutability.
- Authoritative pricing, spoof resistance, duplicate/concurrent invoice protection, payment and receipt continuation, and completed-examination billing independence.
- Dental medication/lab/imaging prioritization, full shared catalogues, laboratory tooth rejection, Dental imaging FDI validation, and non-Dental imaging rejection.
- Frontend Dental isolation, permission-gated billing actions, invoice state refresh, dirty-state protection, cross-visit form reset, and completed read-only behavior.

## Phase 10 work

1. Run the full API and Web suites plus typecheck, lint, build, and `git diff --check` on the existing working tree.
2. Audit production diffs for global CSS leakage, hardcoded currency, debug code, new roles/permissions/collections, unsafe casts, and stale TODO/FIXME markers.
3. Re-run the live Dental and non-Dental workflows, exact responsive breakpoints, persistence checks, timeline checks, and restricted-role API checks.
4. Prepare the existing invoice for finalization/payment/receipt verification. Because those are real financial record mutations, execute them only after action-time user confirmation.
5. Fix only defects demonstrated by these checks and rerun affected validation.

## Current architectural decision

No missing contract or release requirement requires a new Dental subsystem, collection, role, permission, currency model, or shared CSS change. Phase 11 is outside scope and will not be started.
