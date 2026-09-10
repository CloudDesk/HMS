# Dental OPD Phase 8 gap note

Date: 9 September 2026

Scope: final Dental OPD integration, clinical safety, persistence, security, regression, and production-readiness hardening. Phase 9 is excluded.

## Reused architecture

- Existing OPD visit, consultation diagnosis, Dental Examination, Service Catalogue, Billing invoice/item/payment/receipt, patient timeline, audit, RBAC, branch/department/doctor scope, MongoDB transaction, TanStack Query, currency formatter, and Dental CSS module implementations.
- Existing optimistic Dental draft version (`expected_updated_at`), completed-state immutability, explicit invoice endpoint, invoice-item `originatingOrderId`, and PROCEDURE partial unique index.

## Verified gaps

- Treatment-plan item IDs were only typed as arbitrary strings at the API boundary, and any valid ObjectId supplied by a client was preserved by the repository. A client with clinical edit access could therefore inject an ID owned by another examination.
- A treatment item already referenced by an invoice item could be removed from an editable draft examination, leaving the invoice origin without its Dental source context.
- Dental draft/completion audit payloads recorded patient and visit context but omitted explicit branch, department, and doctor identifiers.
- Focused coverage did not exercise foreign treatment-item ID injection or removal of an invoiced source item.

## Intended changes

- Require submitted treatment item IDs to be valid ObjectIds and to belong to the current persisted examination; new items must omit the ID.
- Reject duplicate submitted treatment IDs and preserve any item already referenced by Billing. Keep allowed clinical status/notes updates independent from financial state.
- Hide the remove action for an invoiced row while keeping invoice navigation and billing status visible.
- Add branch, department, and doctor identifiers to existing Dental audit events.
- Add focused backend/frontend tests, run complete regression/static checks, and perform the specified live browser verification without collecting payment.

No migration, new collection, role, permission, currency system, diagnosis system, billing system, or Phase 9 functionality is planned.
