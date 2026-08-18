# R1 Pharmacy and Inventory Integration

## Delivered

- Added the `PharmacyDispensing` aggregate linked to the existing OPD prescription, visit, patient, branch, inventory batch, and billing invoice records.
- Added branch-scoped queue, detail, save, confirm, cancel, and reverse API operations under `/api/pharmacy/dispensings`.
- Added permission checks for `View`, `Edit`, `Dispense`, `Cancel`, and `Reverse`.
- Added optimistic version checks and idempotency keys for stock-changing actions.
- Confirmation validates the submitted prescription, active medicine, branch-owned non-expired batch, and available quantity in a MongoDB transaction.
- Confirmation creates a `STOCK_OUT` movement, updates the inventory snapshot, creates a pending pharmacy invoice, links the invoice to dispensing, and changes the clinical prescription to `DISPENSED` atomically.
- Draft and cancelled prescriptions do not change inventory.
- Reversal restores only the originally confirmed quantities, creates `STOCK_IN` restoration movements, cancels an unpaid invoice, and changes the prescription to `CANCELLED` atomically.
- Paid or partially paid dispensing reversal is rejected and requires a future refund workflow.
- The legacy direct prescription status endpoint cannot set `DISPENSED` or `CANCELLED`.
- Replaced the pharmacy queue page's direct API calls and local status mutation with an API client, service, TanStack Query hooks, live queue, quantity editing, loading, empty, error, success, and action states.

## Verification Commands

Passed:

```text
npm run typecheck --workspace=@hms/web
npx eslint apps/api/src/modules/pharmacy-dispensing apps/web/src/api/pharmacy-dispensing.ts apps/web/src/services/pharmacy-dispensing.service.ts apps/web/src/hooks/usePharmacyDispensing.ts apps/web/src/pages/PrescriptionQueuePage.tsx
npm run build --workspace=@hms/web
```

The API typecheck/build remains blocked by the pre-existing department repository error in `apps/api/src/modules/departments/department.repository.ts`, where existing code references `branchId` while the current department type exposes `branchIds`. No R1 file has a remaining TypeScript or lint error.

## Manual Test Steps

Use a seeded pharmacy user with an authorized branch and a doctor who can submit prescriptions.

1. Submit a prescription with one or more medicines from the OPD consultation workflow.
2. Open Pharmacy -> Prescription Dispensing. Confirm the submitted prescription appears under Pending and no local/mock row is shown.
3. Open Review. Confirm the patient, doctor, prescribed medicine, selected active batch, available stock, requested quantity, and line total are loaded from the backend.
4. Change a confirmed quantity to a positive value within available stock, select Save quantities, refresh, and confirm the saved value persists.
5. Attempt a quantity greater than available stock. Confirm the save is rejected with no stock movement.
6. Confirm a valid dispensing. Verify the UI success message, prescription status `DISPENSED`, dispensing status `CONFIRMED`, one pending billing invoice, one pharmacy invoice item per confirmed medicine, and one `STOCK_OUT` movement.
7. Refresh and retry the same completed record. Confirm no second stock deduction or invoice is created.
8. Cancel a different draft dispensing. Verify prescription status `CANCELLED` and confirm that no stock quantity or invoice changed.
9. Attempt cancellation or reversal with a user lacking the permission. Verify HTTP 403 and no state or stock change.
10. Reverse an authorized unpaid confirmation. Verify the exact original quantities are restored, one `STOCK_IN` restoration movement is recorded, the invoice is cancelled, dispensing is `REVERSED`, and the prescription is `CANCELLED`.
11. Record a payment against the invoice, then attempt reversal. Verify the operation is rejected with `PAID_DISPENSING_REVERSAL_REQUIRES_REFUND` and stock remains unchanged.
12. Repeat the queue and detail tests using a user assigned only to a second branch. Verify first-branch prescriptions, batches, invoices, and movements are not visible or actionable.
13. Verify a missing branch assignment shows the error state instead of loading an unscoped queue.

## Stop Condition

R1 is complete. Do not begin R2 Ward and Bed Configuration until the next explicit approval.
