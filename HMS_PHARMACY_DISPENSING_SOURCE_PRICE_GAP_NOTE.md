# Pharmacy Dispensing Source and Price Gap Note

Date: 1 September 2026

## Reusable implementation

- `OpdPrescription` already persists the canonical clinical context enum in `sourceType`: `OPD_VISIT`, `EMERGENCY_ENCOUNTER`, `INPATIENT_ADMISSION`, or `PROCEDURE_BOOKING`.
- `PharmacyDispensingRepository` already copies that source into the dispensing record and returns it as `source_type` for queue and detail responses.
- Pharmacy batch inventory is the canonical price source. `PharmacyMedicineBatch.unitPrice` is copied into `PharmacyDispensing.items[].unitPrice` with a persisted `lineTotal` snapshot.
- Dispensing confirmation passes the persisted dispensing `unitPrice` and `lineTotal` directly into Billing invoice items.
- Existing feature-hook validation already rejects missing batches, non-positive/non-integer quantities, and quantities exceeding available stock.
- The existing `useCurrencyFormatter` utility provides application-configured currency formatting with KES as the default.

## Gaps

- The web API type incorrectly declares legacy source values (`OPD`, `EMERGENCY`, `IP_ADMISSION`, `PROCEDURE`, `SURGERY`) instead of the backend clinical-context enum. `sourceLabel` therefore returns `undefined` for real API values such as `OPD_VISIT`, leaving Source blank.
- The modal's feature hook already calculates batch price and live line total, but the page does not render Unit Price, Total, or a multi-item dispensing total.
- Draft display currently prefers the live batch response price over the persisted dispensing snapshot. Existing drafts should retain their server snapshot until a pharmacist explicitly chooses another batch or saves and receives the server-validated snapshot.
- The Confirm button only reflects insufficient-stock state; the service still rejects zero, negative, fractional, and missing quantities, but the UI should expose and disable on those states immediately.

## Intended files

- `apps/web/src/api/pharmacy-dispensing.ts`
- `apps/web/src/hooks/pharmacy/usePharmacyDispensingFeature.ts`
- `apps/web/src/pages/PrescriptionQueuePage.tsx`
- `apps/web/src/features/pharmacy.css`
- Focused pharmacy dispensing display tests under `apps/web/src`.

## Dependencies and boundaries

- No API, database, inventory, billing, permission, or status-contract change is required.
- No compatible Pharmacy prototype exists under `Scope/HMS Local`; the established live modal styles remain the UI authority.
- The Developer 1 prompt document referenced by repository instructions is absent. The Release 2 FSD requires Pharmacy queues to show source and use inventory-linked rate/amount; the live models define the exact supported enum and batch-price contract.
- This is a post-release integration correction only. No subsequent phase is started.
