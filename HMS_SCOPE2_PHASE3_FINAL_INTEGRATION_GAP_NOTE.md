# HMS Scope 2 Phase 3 - Final Cross-Developer Integration Gap Note

**Phase:** Final Developer 1 / Developer 2 integration
**Status:** Completed on 24 August 2026

## Sources Reconciled

- `PROJECT_RULES.md`
- `AGENTS.md`
- `HMS_SCOPE2_PHASE3_PHASE_WISE_EXECUTION_PLAN.md`
- `HMS_SCOPE2_PHASE3_CONTRACT.md`
- `docs/HMS_Release2_FSD.docx`
- P3-5 and P3-6 gap/verification records
- Current API and web contracts for Admissions, Emergency, Surgery, Pharmacy, Laboratory, Imaging, Billing, Consents, Reception and Reports
- HMS Local admission, consent, billing and reporting patterns

The referenced `HMS_Scope2_Developer1(Kamesh)_Phase_3_Prompts.docx` is not present in the repository. No behavior will be inferred from that missing file.

## Reusable Contracts

- Emergency-to-IP uses the existing admission request and transactional confirmation path.
- Admissions and Surgery already verify Billing-owned, context-linked deposit invoices.
- Admissions and Surgery already verify signed Patient Document consent by workflow context.
- Emergency prescriptions and clinical orders persist `EMERGENCY_ENCOUNTER` source context.
- Pharmacy, Laboratory and Imaging operational queues consume the shared prescription/clinical-order collections.
- Existing Reception-facing Admission, Surgery, Emergency and bed-availability pages use live APIs.

## Confirmed Integration Gaps

1. The Patient Document consent upload route validates Phase 3 admission-request and procedure-booking contexts against legacy admission/OPD-procedure records and compares incompatible template context enums. The Admission UI also omits required template/branch fields and uploads `ATTACHED`, while confirmation requires `SIGNED`.
2. Billing exposes admission/procedure context-link endpoints, but the web client does not consume them and the backend does not validate that the target admission request or procedure booking belongs to the same patient and branch.
3. Phase 2 reports query legacy OPD Emergency visits and Appointment procedures rather than the dedicated Emergency and Surgery models.
4. Phase 2 consent-pending reports query legacy admission/procedure document fields instead of the Phase 3 contextual consent contract.
5. Phase 2 pending-department/dashboard queries use source enums that do not match the persisted Emergency order/prescription source contract.
6. Required IP Conversion and Advance Payment reports are absent.

## Contract Dependencies Not Implemented Here

- The completed IP and Surgery domains do not expose Pharmacy prescription or Laboratory/Imaging order-creation contracts. Their downstream modules therefore cannot safely receive new IP/procedure requests without an approved owner contract. No substitute visit or fabricated source record will be created.
- Billing invoice creation remains visit-oriented. Existing invoices can be context-linked and consumed as deposits, but creating a standalone direct/Emergency admission deposit invoice is not defined by the current Billing create contract.
- Refund/adjustment allocation lifecycle is not present in Billing; Advance Payment reporting will expose only the statuses supported by invoices, payments and confirmed context consumption.

## Intended Files

- Patient consent route and related web consent types/hooks/pages.
- Billing service/repository wiring and web context-link client/hooks.
- Phase 2 report repository, schemas, types, feature hook and page.
- Shared service registry only where required to validate Billing context links through existing repositories.
- This gap note and a final integration verification record.

No Developer 2 subsystem will be rebuilt, and no HMS Local file will be modified.
