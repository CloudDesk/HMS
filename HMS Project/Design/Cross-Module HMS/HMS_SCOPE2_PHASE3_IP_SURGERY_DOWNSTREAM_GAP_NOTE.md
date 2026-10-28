# HMS Scope 2 Phase 3 - IP/Surgery Downstream Integration Gap Note

**Phase:** IP/Admission and Surgery/Procedure to Pharmacy, Laboratory and Imaging
**Status:** In progress on 24 August 2026

## Sources Reconciled

- `PROJECT_RULES.md`, `AGENTS.md` and the phase execution plan.
- `docs/HMS_Release2_FSD.docx`, especially sections 10, 11, 12, 14, 15 and 19.
- Current Admission, Surgery, prescription, clinical-order, Pharmacy Dispensing, Laboratory, Imaging, Billing, Patient and service-catalogue contracts.
- Current API clients, domain hooks, feature hooks and operational pages.
- Existing `node:test` and `mongodb-memory-server` infrastructure and the 15-test Advance Payment baseline.
- HMS Local inpatient, Pharmacy, Laboratory and Imaging workspace/queue patterns.

## Required Integration Matrix From the FSD

| Integration | Requirement evidence | Current state |
|---|---|---|
| IP to Pharmacy | Admission-related prescriptions and IP Pharmacy queue | Missing source creation contract |
| IP to Laboratory | IP laboratory requests/results | Missing source creation and result context |
| IP to Imaging | IP scan requests/reports | Missing source creation and report context |
| Surgery to Pharmacy | Surgery-related prescriptions | Missing source creation contract |
| Surgery to Laboratory | Explicit pre-procedure test scenario | Missing source creation and result context |
| Surgery to Imaging | Explicit pre-procedure scan scenario | Missing source creation and report context |

## Reusable Foundations

- `OpdPrescription` is already the Pharmacy queue source and Pharmacy Dispensing owns medicine mapping, stock validation, dispensing, billing and reversal.
- `OpdClinicalOrder` is already the canonical Laboratory/Imaging queue source; Laboratory and Imaging own status transitions and result/report processing.
- Admission and Procedure Booking models already retain patient, branch, provider and originating source context.
- Existing unique source indexes can prevent duplicate prescription and per-type clinical-order records.
- Existing source permissions (`OPD Prescription` and `OPD Clinical Orders`) can authorize clinical ordering without creating new permissions; Admission/Surgery services remain authoritative for source branch/department/state access.

## Confirmed Gaps

1. Prescription and clinical-order persisted source enums only accept OPD and Emergency.
2. Admission and Surgery services expose no downstream order contract.
3. Laboratory and Imaging result/report services reject every non-OPD context because `visit_id` is required.
4. Pharmacy Dispensing maps non-visit prescriptions to Emergency/OPD placeholders and discards admission/procedure identifiers.
5. Existing broad source labels (`IP_ADMISSION`, `PROCEDURE`, `SURGERY`) are not consistently mapped to the actual source identifiers (`INPATIENT_ADMISSION`, `PROCEDURE_BOOKING`).
6. Retry behavior prevents duplicate documents through unique indexes but can overwrite an already submitted source record; target services need an explicit idempotent same-payload/conflict contract.
7. Frontend Admission and Surgery workspaces do not expose their contextual downstream requests.

## Billing Boundary

- Surgery prescriptions can reuse their originating OPD encounter for the existing Pharmacy invoice contract while retaining the Procedure Booking identifier.
- Direct inpatient admissions do not always have an OPD visit, while the current Pharmacy/Billing invoice contract requires `visit_id`. This phase will not invent a Billing contract. IP prescriptions can enter the Pharmacy queue with correct admission context, but final bill/dispense for a direct admission remains blocked until Billing supports a dedicated admission service-invoice context.
- Laboratory and Imaging do not currently auto-create invoices; their existing payment visibility behavior will be preserved without adding Billing functionality.

## Intended Files

- Existing prescription and clinical-order types, models, repositories and services.
- Admission and Surgery routes, schemas, services and dependency wiring.
- Laboratory/Imaging result/report models, repositories and services.
- Pharmacy Dispensing context mapping only where required for new sources.
- Minimal typed web integration API/service/hook/workspace UI.
- Focused downstream integration tests and phase verification documentation.

Advance Payment files and tests are protected baseline. HMS Local files will not be modified.
