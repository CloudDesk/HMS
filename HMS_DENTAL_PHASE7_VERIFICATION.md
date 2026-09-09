# Dental OPD Phase 7 verification

Date: 8 September 2026

Scope: Dental Treatment Plan integration with the existing HMS Billing, Invoice, Payment, Receipt, Service Catalogue, currency, RBAC, branch-scope, transaction, and audit architecture. Phase 8 was not started.

## Implementation and architecture reuse

- The existing `billing_invoices`, `billing_invoice_items`, and `billing_payments` collections remain the financial source of truth. No Dental invoice, payment, receipt, currency, service, role, or permission subsystem was added.
- A persisted Dental treatment-plan item is linked to its existing invoice item through `BillingInvoiceItem.originatingOrderId`. The invoice stores no copied Dental examination document or tooth payload. The Dental row continues to provide the tooth context by resolving that source reference against its examination.
- The existing Billing routes, repository, service, MongoDB transaction helper, invoice/payment number generators, Billing Workspace, payment collection, receipt response, and audit events are reused.
- The existing permissions `Billing / Invoices / View` and `Billing / Invoices / Create` protect Dental billing state and invoice creation. Existing Edit, Cancel, CollectPayment, and ViewReceipt permissions continue to protect later financial actions.
- The existing Service Catalogue is resolved server-side. Only an active `PROCEDURE` in the verified visit department can be billed. `standard_price` is authoritative; client price, estimated cost, currency, patient, visit relationship, branch, department, and doctor data are not accepted by the action endpoint.
- Explicit billing is allowed for `PROPOSED`, `ACCEPTED`, `IN_PROGRESS`, and `COMPLETED` items. Nothing bills automatically. `DECLINED`, `CANCELLED`, and custom items without `service_id` are rejected.
- Completed Dental examinations remain immutable. Billing creates only existing Billing documents and does not update the Dental examination.

## Database and API

- Existing invoice-item `serviceType` now supports the existing Service Catalogue `PROCEDURE` type. Generic/manual invoice payloads remain restricted to their prior service types.
- A partial unique index, `procedure_originating_order_unique`, covers `{ serviceType, originatingOrderId }` for active PROCEDURE invoice items. It is the concurrency and retry guard for one treatment item.
- The migration script was executed against the development database with `.env.dev`; it returned `{"index":"procedure_originating_order_unique"}`.
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

- Dental backend integration: 1 file, 49 tests passed. This includes authoritative price, spoof rejection, cross-branch and cross-patient rejection, missing/inactive/wrong-department service rejection, RBAC, completed immutability, audit, idempotent retry, simultaneous requests, payment, and receipt.
- Existing collect-payment validation: 1 file, 7 tests passed.
- Existing billing integration, doctor access, nurse access, and department authorization: 4 files, 19 tests passed in the focused regression run.
- Dental component: 1 file, 18 tests passed.
- Dental billing query integration plus Dental component: 2 files, 19 tests passed. The new query test verifies Billing service dispatch and Dental/list/summary invalidation.
- OPD feature/domain hooks, Dental diagnosis, and Dental utilities: 4 files, 24 tests passed.
- OPD Visit Page, settings, access-control, and router regression: 4 files, 19 tests passed.
- Full API run: 57 files passed; 298 tests passed and 36 skipped. Five unrelated files did not complete because concurrent MongoMemoryServer workers hit startup/hook/test timeouts. The affected doctor and nurse files passed in the focused run. The two expired-bed-cleanup timeouts and two auth/notification Mongo startup failures are outside Phase 7.
- Full web run: 35 files passed and 110 tests passed. Four unrelated existing test-harness assertions failed (`auth-refresh`, `PatientProfilePage`, and two `SurgeryWorkspacePage` tests), and six workers failed to start under resource contention. Dental, diagnosis, OPD, settings, and router files were rerun successfully in focused commands.

## Static and build verification actually executed

- `npm run typecheck --workspace=@hms/api`: passed.
- `npm run lint --workspace=@hms/api`: passed.
- `npm run build --workspace=@hms/api`: passed.
- `npm run typecheck --workspace=@hms/web`: passed.
- `npm run lint --workspace=@hms/web`: passed.
- `npm run build --workspace=@hms/web`: passed; Vite transformed 783 modules.
- `git diff --check`: passed with line-ending warnings only and no whitespace errors.

## Manual browser verification actually performed

- Signed in as the supplied Anderson Dental doctor account and opened live Dental OPD visit `OPD-2026-000052`. The persisted examination and treatment plan loaded, Service Catalogue price rendered as the configured KES currency, and no Create Invoice action appeared because the Doctor role lacks existing Billing Invoice permissions.
- Signed in as SUPER_ADMIN and reopened the same visit. The existing Tooth Extraction catalogue item showed an explicit Create Invoice action, demonstrating the existing Billing permission gate.
- Opened completed Dental visit `OPD-2026-000050`. It showed `Completed & Locked`; all Dental clinical inputs were disabled; Tooth #36 retained CARIOUS, K02.9, and the planned Tooth Extraction; the permitted financial action remained available without reopening clinical data.
- Opened completed non-Dental visit `OPD-2026-000048` (Open heart surgery). Its tabs were the existing Consultation, Diagnosis, Prescription, Lab, Imaging, Referral, and Follow-up tabs. It had no Dental Examination or Dental Billing UI.
- The available in-app browser viewport measured 731 x 580. Both Dental and non-Dental pages had document scroll width equal to viewport width (731 px), so there was no page-level horizontal overflow. The treatment table used its scoped internal horizontal scroller (`overflow-x: auto`) at the narrow width.
- Exact desktop, laptop, and 1366 x 768 emulation was not available and was not claimed.
- The final live Create Invoice click and resulting invoice/payment navigation remain pending the required computer-use financial-action confirmation. Duplicate creation was therefore verified automatically, not manually.
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

