# Dental OPD Phase 7 gap note

Scope: Dental Treatment Plan integration with the existing HMS billing and invoice workflow only. Phases 1–6 are the current working-tree baseline and remain unchanged except for the smallest integration points needed by Phase 7. Phase 8 is excluded.

## Architecture audited and reused

- Existing `billing_invoices`, `billing_invoice_items`, and `billing_payments` collections, BillingRepository, BillingService, Billing routes, transactions, invoice/payment numbers, audit events, receipt response, and Billing Workspace are the financial source of truth.
- Existing Billing permissions are `Billing / Invoices / View`, `Create`, `Edit`, `Cancel`, `CollectPayment`, and `ViewReceipt`. No new role or permission is required.
- Existing invoices derive and validate patient, OPD visit, appointment, and branch relationships server-side. Billing reads authoritative active Service Catalogue prices. Payments and receipts remain entirely in the Billing module.
- Existing invoice items already have `originatingOrderId`, which is the suitable minimal source reference for a Dental treatment-plan subdocument ID. The invoice does not need embedded Dental clinical data.
- Existing currency formatting comes from HMS runtime settings through `useCurrencyFormatter`; invoices do not persist a client-provided currency.
- HMS Local Billing Workspace and OPD patterns were inspected for invoice navigation, status badges, compact tables, and explicit actions. Prototype files will not be modified.

## Verified gaps and minimal integration

- Invoice item `serviceType` does not currently include the Service Catalogue's existing `PROCEDURE` type. Add `PROCEDURE` to the existing invoice-item enum while keeping manual generic invoice creation limited to its current service types.
- Add Billing-owned Dental endpoints that accept only server-verifiable visit and treatment-item IDs. They will load the treatment item, visit, and Service Catalogue record server-side; ignore all client price, currency, patient, branch, department, and doctor values; and use the existing Billing `View`/`Create` permissions.
- Use invoice-item `originatingOrderId` for the treatment-item relationship and a partial unique index for `PROCEDURE` source references. Repeated and concurrent requests return the existing invoice instead of creating a second charge.
- Billable Dental statuses will be `PROPOSED`, `ACCEPTED`, `IN_PROGRESS`, and `COMPLETED`, but only through the explicit billing action. `DECLINED` and `CANCELLED` are rejected. No status automatically creates an invoice.
- Custom/free-text treatment items without `service_id` remain clinical-only because the existing billing architecture does not support arbitrary custom charges.
- Add Billing-owned TanStack Query state/mutation hooks and compose them into the OPD visit feature. Dental rows show existing invoice statuses and navigate to the existing Billing Workspace. Dental clinical data, including completed examinations, will not be mutated.
- Keep the existing generic payment and receipt behavior unchanged. Dental financial displays use the existing runtime currency formatter and do not add a Dental currency default or configuration.

## Intended files

- Existing Billing types, model, schemas/routes, repository, service, registry, API/service/hooks, and billing utility display.
- Existing Dental treatment-plan component, Dental tab, OPD feature/page integration, scoped Dental CSS, and focused tests.
- Phase 7 backend integration tests and this phase's verification report.

No Dental billing, payment, receipt, currency, or service-catalogue collection will be created.
