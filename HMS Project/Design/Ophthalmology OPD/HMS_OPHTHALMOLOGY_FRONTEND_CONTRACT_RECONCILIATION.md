# Ophthalmology frontend contract reconciliation

**Date:** 17 October 2026  
**Contract baseline:** `HMS_OPHTHALMOLOGY_BACKEND_API_CONTRACT_V1.md` v1.12.0  
**Status:** COMPLETE for reconciliation; runtime implementation remains PARTIAL  
**Readiness:** READY WITH BLOCKERS

## Purpose and boundary

This is the first step of the approved remaining-frontend sequence. It reconciles the implemented backend routes and schemas with the current staff frontend and the B1-B6 gap records. It does not modify backend or frontend runtime code, approve new clinical values, or declare a frontend phase complete.

The current backend route implementation is the wire-contract authority. The FSD, approved DEC-01 through DEC-12, `PROJECT_RULES.md`, existing frontend architecture and existing OPD/reporting patterns remain applicable. `scope/HMS Local` contains shared OPD and reporting references but no dedicated Ophthalmology prototype; those shared patterns may be reused without modifying the prototype.

## Reconciled status

| Area | Backend contract | Current frontend | Disposition |
|---|---|---|---|
| Configuration, stations and workflows | Implemented | Administration UI/client/hooks implemented | Retain; B1 remains partial because opaque value schemas, clinical lookup permission and live acceptance are unresolved. |
| Context and intake | Implemented | Context/intake/emergency UI implemented | Retain; appointment specialty mapping and history-master contracts remain owner handoffs. |
| Result entry and attachments | Implemented for all 21 form families through profile-bound payloads | Initial controls, repeated rows, document references, upload/download and amendments implemented | Continue only for explicitly contracted paths. Full 178-row acceptance is blocked by nested schemas, approved values and comparison eligibility. |
| Queue and task actions | Implemented except no action moves `COMPLETED` to `SUBMITTED_FOR_REVIEW` | Queue/task operations implemented; UI explicitly reports review submission unavailable | Backend owner must publish a submission transition or revise the lifecycle/report contract. Do not infer submission from completion. |
| Clinical review and optical prescription | Implemented | Draft/review/approval UI implemented | Continue approved B4 work only after shared version transport, projections and eligible-reference contracts are resolved. |
| Completion readiness, deferral and override | Implemented; mandatory configured codes require matching reviewed/deferred evidence | Implemented | C3 safety defect resolved; retain exact prerequisite snapshots and conflict handling. |
| Final completion, summary, reopen and source correction | Contract 1.12.0 exposes safe projections, three typed atomic correction commands and specialty completion guard | Implemented through live clients, domain/feature hooks, dialogs and completion workspace | C4 implementation complete; retain live multi-role conflict and responsive acceptance at the release gate. |
| Six Ophthalmology operational reports | Implemented | Implemented with exact endpoint semantics and pagination | B6 partial; retain. Export is not implemented by the backend and must not export a partial page. |
| Dashboard and dashboard refresh | Implemented | Not integrated | Safe next frontend-only B6 slice. `View` gates dashboard reads; `Export` currently gates refresh. Refresh must not be labelled as export. |
| Publication and withdrawal | Write routes implemented; no staff list/history/eligible-source read route | Not integrated | Blocked until a reloadable staff publication projection and approved confidential-field payload policy are published. |
| Surgery, follow-up compliance and revenue reporting | Existing shared report APIs partly available outside Ophthalmology | Not integrated into Ophthalmology reports | Cross-domain owner confirmation and permission-safe composition are required. Reuse shared clients; do not create frontend aggregates or duplicate APIs. |

## Contract blockers requiring backend or owning-domain action

| ID | Blocking contract | Evidence | Required action |
|---|---|---|---|
| CR-01 | Appointment specialty mapping | Appointment DTOs do not publish sub-speciality, affected eye and referral context mappings. | Appointment owner publishes exact read/write fields and validation. |
| CR-02 | Opaque clinical-master values | `SUB_SPECIALITY`, `VISUAL_ACUITY_SCALE`, `DIAGNOSIS_REFERENCE`, `DRUG_OPTION`, `OPTICAL_PRODUCT`, `IOL_CATALOGUE`, `GRADE` and `REASON` values lack approved structured schemas. | Backend/clinical owner publishes typed value schemas and hospital-approved values. |
| CR-03 | Clinical lookup permissions | Clinical users need configuration/context data but current reads can require Configuration View or Intake View. | Publish least-privilege clinical projections or approve explicit grants. Do not grant administration edit rights implicitly. |
| CR-04 | Eligible staff/station membership | Generic users lookup does not guarantee every offered user is an eligible active station member. | Publish an eligibility-filtered projection or equivalent exact contract. |
| CR-05 | Intake history masters | Previous-eye-disease and family-history choice bindings are unspecified. | Publish their master types and codes; preserve existing unknown values. |
| CR-06 | Nested result structures | PD, segment height, cycloplegic medication, objective/reflex/media, JCC/binocular/near, fundus, motility/dry-eye/VF/OCT, IOL, B-scan, gonioscopy and paediatric structures are only partially typed. | Publish field paths, types, units, allowed values and conditional validation. |
| CR-07 | Eligible comparisons | No projection guarantees same patient/eye/test/protocol/unit-compatible comparison candidates. | Publish eligible comparison records and compatibility rules. |
| CR-08 | Queue review submission | **Resolved in contract 1.11.0 and C2.** `POST /api/ophthalmology/test-tasks/:id/submit-for-review` performs the versioned, audited, transactional transition and the queue UI consumes it. | Closed; retain focused concurrency, rollback, permission, and assignment tests. |
| CR-09 | Shared OPD version transport | Shared consultation/order schemas and service expectations need a single documented request transport for version/status preconditions. | Owning API reconciles body/params contract before new structured writes rely on it. |
| CR-10 | Completion prerequisite correctness | **Resolved in contract 1.12.0 and C3.** Every configured mandatory code requires matching reviewed or validly deferred task evidence; missing codes are explicit resources. | Closed; retain empty-set and deferral regression coverage. |
| CR-11 | Permission-safe summary/history | **Resolved in contract 1.12.0 and C3.** Explicit response allowlists omit raw payloads, private documents, request fingerprints and frozen internal snapshots. | Closed; C4 must consume only the published projections. |
| CR-12 | Source-record amendment workflow | **Resolved in contract 1.12.0 and C3.** Three typed transactional correction commands update exact authoritative source versions and append source references to history. | Closed; C4 must not recreate arbitrary before/after journals. |
| CR-13 | Generic OPD completion guard | **Resolved in contract 1.12.0 and C3.** Shared OPD completion rejects visits with an Ophthalmology context. | Closed; retain backend bypass regression coverage. |
| CR-14 | Publication read/payload policy | Publish/withdraw writes exist without staff current-version/history/eligible-source reads; broad summary copy policy is not approved. | Add reloadable scoped publication reads and an explicit confidential-field allowlist plus reopen/amend withdrawal rules. |
| CR-15 | Report ownership and export | Ophthalmology export does not exist; cross-domain procedure/follow-up/revenue endpoints have separate permissions and semantics. | Report owners confirm approved composition/export contracts. Frontend must reuse their domain services and must not infer totals. |

## Approved implementation order

Only one item may be started after explicit approval, implemented, verified and stopped before the next item.

1. **C1 — Dashboard integration:** implemented with focused verification complete; repository-wide web typecheck/build and authenticated live acceptance remain open. See `HMS_OPHTHALMOLOGY_FRONTEND_C1_VERIFICATION.md`.
2. **C2 — Queue review-submission contract:** complete. Contract 1.11.0 adds the transactional submission command and the verified frontend queue action. See `HMS_OPHTHALMOLOGY_FRONTEND_C2_VERIFICATION.md`.
3. **C3 — Completion safety backend handoff:** complete. Contract 1.12.0 resolves CR-10 through CR-13. See `HMS_OPHTHALMOLOGY_FRONTEND_C3_VERIFICATION.md`.
4. **C4 — Completion frontend:** complete. Typed safe summary, completion/reapproval, controlled reopen, authoritative source corrections and corrected-optical approval are implemented. See `HMS_OPHTHALMOLOGY_FRONTEND_C4_VERIFICATION.md`.
5. **C5 — Publication backend handoff:** next after explicit approval; resolve CR-14.
6. **C6 — Publication frontend:** after C5, implement staff publication history, eligible source selection, publish/withdraw and refresh-safe state.
7. **C7 — B1/B2 clinical contract handoff:** resolve CR-01 through CR-07 and CR-09.
8. **C8 — B1/B2 field completion:** finish the 178-row mapping and row-by-row clinical acceptance without inventing values.
9. **C9 — B4 shared-care completion:** finish structured diagnosis, eligible treatment references, specialty order fields, safe history/comparisons and approved optical delivery.
10. **C10 — Cross-domain reports/export:** resolve CR-15, then integrate through cross-domain feature hooks.
11. **C11 — Release validation:** run required API/web checks, focused and full regression, authenticated multi-role/multi-branch browser acceptance, responsive/accessibility checks, logout/login persistence and real GCS upload/download/delete/idempotent-retry smoke testing.

## First executable slice

The next planned item is **C5 — Publication backend handoff**. C4 is implemented and verified at the automated gate; C5 still requires explicit approval.

## Reconciliation verification

- Inspected current Ophthalmology backend routes, schemas, services, repository behavior and Phase 10 dashboard/publication/report implementation.
- Inspected current frontend API clients, service registry, domain/feature hooks, pages, route permission gates and B1-B6 verification records.
- Confirmed all current frontend Ophthalmology routes are wired: workspace, configuration, queue and reports.
- Confirmed the six operational report clients exist, while dashboard/publication/final-completion clients do not.
- Confirmed the queue review-submission transition is implemented and consumed by C2.
- Confirmed C3 closes the mandatory-test empty-set, safe projection, authoritative correction and generic completion-bypass gaps.
- Confirmed shared OPD/reporting prototypes exist under `scope/HMS Local`; no dedicated Ophthalmology prototype was found. No prototype file was modified.
- No runtime source, permission seed, dependency, generated file, backend contract or database state was changed in this reconciliation step.

## Stop gate

Contract reconciliation is complete. C1 through C4 implementation and focused verification are recorded separately. **C5 has not started.** Wait for explicit approval before implementing the publication backend handoff.
