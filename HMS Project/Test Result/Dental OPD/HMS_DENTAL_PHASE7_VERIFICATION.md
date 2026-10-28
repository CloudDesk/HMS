# Dental OPD Phase 7 verification

Date: 9 September 2026

Scope: Dental Treatment Plan integration with the existing HMS Billing, Invoice, Payment, Receipt, Service Catalogue, currency, RBAC, branch-scope, transaction, and audit architecture. Phase 8 was not started.

## Implementation and architecture reuse

- The existing `billing_invoices`, `billing_invoice_items`, and `billing_payments` collections remain the financial source of truth. No Dental invoice, payment, receipt, currency, service, role, or permission subsystem was added.
- A persisted Dental treatment-plan item is linked to its existing invoice item through `BillingInvoiceItem.originatingOrderId`. The invoice stores no copied Dental examination document or tooth payload. The Dental row continues to provide the tooth context by resolving that source reference against its examination.
- The existing Billing routes, repository, service, MongoDB transaction helper, invoice/payment number generators, Billing Workspace, payment collection, receipt response, and audit events are reused.
- The existing permissions `Billing / Invoices / View` and `Billing / Invoices / Create` protect Dental billing state and invoice creation. Existing Edit, Cancel, CollectPayment, and ViewReceipt permissions continue to protect later financial actions.
- The existing Service Catalogue is resolved server-side. Only an active `PROCEDURE` in the verified visit department can be billed. `standard_price` is authoritative; client price, estimated cost, currency, patient, visit relationship, branch, department, and doctor data are not accepted by the action endpoint.
- Explicit billing is allowed for `PROPOSED`, `ACCEPTED`, `IN_PROGRESS`, and `COMPLETED` items. Nothing bills automatically. `DECLINED`, `CANCELLED`, and custom items without `service_id` are rejected.
- Completed Dental examinations remain immutable. Billing creates only existing Billing documents and does not update the Dental examination.

## Final hardening findings and fixes

- Billing now independently resolves the visit department and verifies the visit is Dental before reading the Dental examination. This closes the malformed-record case where a Dental examination document could otherwise be attached directly to a non-Dental visit.
- The OPD feature hook now enables Dental billing-state queries only for an active Dental visit and Dental Examination tab. A stale Dental tab value can no longer issue Dental billing requests after switching to a non-Dental visit.
- The web Billing source-type contract now includes the API's existing `IP_ADMISSION` value and maps it to the existing Billing label. This removes a frontend/backend enum mismatch without changing Dental billing behavior.
- Coverage was added for deleted and non-PROCEDURE catalogue services, unrelated treatment references, malformed Dental records on non-Dental visits, and transaction rollback after invoice-item validation failure.

## Final release-gate regression closure

- `auth-refresh.test.tsx` was a pre-existing test-harness defect. `AuthProvider` has required TanStack Query since 25 August 2026, while the test last changed on 1 September and rendered it without `QueryClientProvider`. The harness now supplies and clears a test QueryClient.
- `PatientProfilePage.test.tsx` contained a stale fixture. The production page has correctly required SUPER_ADMIN or Appointments / Appointment Booking / Create since 5 September 2026, but the test expected Book Appointment while mocking an ADMIN with no permissions. The fixture now receives the exact permission required by its unchanged assertion.
- Both `SurgeryWorkspacePage.test.tsx` failures were a pre-existing test-harness defect. An always-mounted closed recommendation modal calls `useAuth`, while the page test mocked only the feature hook. The harness now provides a stable `useAuth` fixture consistent with the mocked branch context.
- None of those test files, related production pages, Auth provider, or Surgery components changed in the Phase 7 commit. No Phase 7 production code was changed for regression closure, and no assertion was skipped or weakened.

## Database and API

- Existing invoice-item `serviceType` now supports the existing Service Catalogue `PROCEDURE` type. Generic/manual invoice payloads remain restricted to their prior service types.
- A partial unique index, `procedure_originating_order_unique`, covers `{ serviceType, originatingOrderId }` for active PROCEDURE invoice items. It is the concurrency and retry guard for one treatment item.
- The migration script was executed against the development database. A direct database read confirmed the applied index is unique, version 2, and has the partial filter `{ serviceType: "PROCEDURE", originatingOrderId: { $type: "objectId" }, deletedAt: null }`.
- `GET /api/billing/dental/visits/:visitId/treatment-items` returns existing invoice status for persisted treatment items and requires Billing Invoice View.
- `POST /api/billing/dental/visits/:visitId/treatment-items/:treatmentItemId/invoice` accepts an empty body, requires Billing Invoice Create, validates the complete server-side relationship, and creates or idempotently returns the existing invoice.
- The server validates the URL visit before returning an existing invoice, preventing a known treatment-item ID from being paired with another same-branch patient's visit.

## Frontend

- The Dental treatment table shows the tooth, procedure, authoritative currently loaded catalogue price, clinical status, existing invoice status/reference, and an explicit Create Invoice action.
- Custom treatment rows show `Clinical plan only`; declined/cancelled rows show `Not billable`; unsaved rows require draft save first; users without Billing mutation permission see no billing action.
- Existing invoice states are displayed as Invoice draft, Invoice pending, Partially paid, Paid, or Invoice cancelled. No second financial state machine was introduced.
- Successful creation invalidates Dental billing state, invoice lists, and Billing summaries, caches invoice detail, and opens the existing Billing Workspace for payment/receipt work.
- All new Dental presentation rules are in `DentalExamination.module.css`. No global, generic OPD, or generic Billing stylesheet was changed.
- Every monetary Dental display continues to use `useCurrencyFormatter()` and the current system setting. No currency code or symbol was added to Dental billing code.

## Automated verification actually executed

- Dental backend integration: 1 file, 52 tests passed.
- Existing Billing, payment validation, doctor access, nurse access, and department authorization regression: 5 files, 26 tests passed.
- Dental Billing hooks and OPD feature integration: 2 files, 5 tests passed.
- Dental component: 1 file, 18 tests passed.
- Final-gate consolidated Dental, Billing-hook, diagnosis, OPD Visit Page, and router regression: 8 files, 51 tests passed.
- Repaired unrelated Web harness regression: 3 files, 8 tests passed.
- Full API run: 62 files passed; 339 tests passed.
- Full web run after safe test-harness repair: 44 files passed; 214 tests passed.

## Static and build verification actually executed

- `npm run typecheck --workspace=@hms/api`: passed.
- `npm run lint --workspace=@hms/api`: passed.
- `npm run build --workspace=@hms/api`: passed.
- `npm run typecheck --workspace=@hms/web`: passed.
- `npm run lint --workspace=@hms/web`: passed.
- `npm run build --workspace=@hms/web`: passed; Vite transformed 783 modules.
- `git diff --check`: passed with line-ending warnings only and no whitespace errors.

## Manual browser verification actually performed

- Signed in as the supplied Anderson Dental doctor account and opened live Dental OPD visit `OPD-2026-000052`. The persisted examination and treatment plan loaded, Service Catalogue price rendered using the configured currency, and no Create Invoice action appeared because the Doctor role lacks existing Billing Invoice permissions.
- Signed in as SUPER_ADMIN and reopened the same visit. The existing Tooth Extraction catalogue item showed an explicit Create Invoice action, demonstrating the existing Billing permission gate.
- Opened completed Dental visit `OPD-2026-000050`. It showed `Completed & Locked`; all Dental clinical inputs were disabled; Tooth #36 retained CARIOUS, K02.9, and the planned Tooth Extraction; the permitted financial action remained available without reopening clinical data.
- Opened completed non-Dental visit `OPD-2026-000048` (Open heart surgery). Its tabs were the existing Consultation, Diagnosis, Prescription, Lab, Imaging, Referral, and Follow-up tabs. It had no Dental Examination or Dental Billing UI.
- The final hardening run tested the Dental page at the default 1280 x 720 viewport, exact 1366 x 768, and narrow 768 x 720. In each case document scroll width equalled viewport width, so no page-level horizontal overflow occurred. At 1366 x 768 and 768 x 720 the treatment table retained its Dental-scoped internal horizontal scroller (`overflow-x: auto`); the Create Invoice control remained in the table and was reachable by scrolling.
- After explicit action-time confirmation, the authorized SUPER_ADMIN Create Invoice action created development draft invoice `INV-20260909-4DDF5416` for Mark Patient / `OPD-2026-000050`. The existing Billing Workspace showed one Tooth Extraction line sourced from treatment item `6a9f9ea865a96e9e0a965b07`, quantity 1, configured-currency unit price and total of 45,000.00, zero collected, and a 45,000.00 balance. No payment or receipt action was performed.
- Reloading the Billing Workspace preserved the invoice reference, Draft status, patient, visit, service, amount, and zero-collected state. Reopening the Dental visit displayed `Invoice draft` with the same reference, removed Create Invoice, and retained Completed & Locked, Tooth #36 CARIOUS, K02.9, and the treatment note. All visible Dental clinical controls remained disabled; only the visit selector was visibly enabled.
- A direct post-invoice database read could not be repeated because DNS resolution to the development Atlas cluster failed. Invoice persistence was verified through the live API/UI reload and Dental-page refetch; the database index itself had already been verified directly earlier in this run.
- Nurse and Receptionist browser sessions were not manually opened. Their actual HTTP enforcement was verified in the backend integration test; Doctor and SUPER_ADMIN UI behavior was manually observed.

## Files created in Phase 7

- `HMS_DENTAL_PHASE7_GAP_NOTE.md`
- `HMS_DENTAL_PHASE7_VERIFICATION.md`
- `apps/api/src/scripts/migrate-dental-billing-index.ts`
- `apps/web/src/hooks/billing/useDentalBilling.test.tsx`

## Files modified in Phase 7

- `apps/api/package.json`
- `apps/api/src/modules/billing/billing.model.ts`
- `apps/api/src/modules/billing/billing.repository.ts`
- `apps/api/src/modules/billing/billing.routes.ts`
- `apps/api/src/modules/billing/billing.schemas.ts`
- `apps/api/src/modules/billing/billing.service.ts`
- `apps/api/src/modules/billing/billing.types.ts`
- `apps/api/src/modules/opd/opd-visit.repository.ts`
- `apps/api/src/modules/opd/opd-dental-examination.repository.ts`
- `apps/api/src/modules/services/service.repository.ts`
- `apps/api/src/shared/services/service-registry.ts`
- `apps/api/test/opd-dental-examination.test.ts`
- `apps/web/src/api/billing.ts`
- `apps/web/src/services/billing.service.ts`
- `apps/web/src/hooks/billing/useBilling.ts`
- `apps/web/src/hooks/billing/useBillingFeature.ts`
- `apps/web/src/hooks/opd/useOpdVisitFeature.ts`
- `apps/web/src/hooks/opd/useOpdVisitFeature.test.tsx`
- `apps/web/src/pages/OpdVisitPage.tsx`
- `apps/web/src/pages/billing-utils.ts`
- `apps/web/src/components/opd/dental/DentalTreatmentPlanSection.tsx`
- `apps/web/src/components/opd/dental/OpdDentalExaminationTab.tsx`
- `apps/web/src/components/opd/dental/OpdDentalExaminationTab.test.tsx`
- `apps/web/src/components/opd/dental/DentalExamination.module.css`

## Remaining and out of scope

- Existing generic Billing has a legacy currency-specific payment-overage error string covered by an existing exact regression assertion. It was left unchanged because replacing it requires a cross-cutting Billing contract decision outside Dental Phase 7. Dental UI and the new Dental endpoints contain no hardcoded currency.
- Chair scheduling, appointment redesign, procedure execution, insurance pre-authorization/claims, and any Phase 8 functionality were not implemented.

## Files modified during final release gate

- `apps/web/src/auth/auth-refresh.test.tsx`
- `apps/web/src/pages/PatientProfilePage.test.tsx`
- `apps/web/src/pages/SurgeryWorkspacePage.test.tsx`
- `HMS_DENTAL_PHASE7_VERIFICATION.md`
