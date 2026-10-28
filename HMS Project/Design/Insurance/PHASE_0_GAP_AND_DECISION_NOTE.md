# Insurance Phase 0 — Gap and Decision Note

**Status:** COMPLETE — decisions D-01 through D-08 accepted and repository-reconciled  
**Date:** 24 September 2026  
**Implementation state:** No Insurance code, schema or production data change started

## 1. Objective

Establish the approved Insurance boundary, reuse map, safety rules and
contract decisions before Kamesh and Fazil begin Phase 1 implementation.

## 2. Sources inspected

1. `PROJECT_RULES.md`
2. `HMS_INSURANCE_TWO_DEVELOPER_PHASE_WISE_EXECUTION_PLAN.md`
3. `agents_final.md`
4. `doc/HMS_Release2_FSD.docx` — not present
5. Existing API and web implementation
6. `scope/HMS Local` billing and patient prototypes — visual reference only
7. `Insurance end to end workflow.pdf` — Insurance Management & Claims System, Kenya, BRD v1.0
8. Owner-supplied `Phase 0 — Final Architecture Decisions` dated 24 September 2026

The supplied BRD and final architecture decisions are the approved Phase 0
business input. Repository-specific adaptations in Section 6 take
precedence where the proposed text assumed infrastructure that does not
exist in the current HMS.

## 3. Repository-backed decisions

These decisions are supported by the current codebase and can be treated as
the Phase 0 technical baseline.

| ID | Decision |
|---|---|
| T-01 | Insurance is a new bounded module; it does not duplicate Patient, Service, Invoice or clinical records. |
| T-02 | Clinical linkage uses `source_type` and `source_id`, with optional `encounter_id`, `admission_id`, `procedure_id` and `visit_id`. |
| T-03 | Patient documents with type `INSURANCE` are supporting evidence, not structured membership or verified eligibility. |
| T-04 | Claims reference Billing invoices/items and preserve immutable claim snapshots. |
| T-05 | Payer payments, remittances and allocations are separate from existing patient billing payments. |
| T-06 | Insurance follows Fastify route, Zod schema, service, repository, Mongoose, RBAC and standard response patterns. |
| T-07 | Authenticated database scope is authoritative; frontend branch/role/permission values are not trusted. |
| T-08 | Existing audit, notification, settings and storage infrastructure is reused. |
| T-09 | Insurance transitions use versioned conditional writes, idempotency and explicit transition maps. |
| T-10 | Coupled utilization and finance writes require strict MongoDB transactions and may not use the existing non-transaction fallback. |
| T-11 | Production screens use live APIs and MongoDB; prototype/localStorage insurance behavior is not ported. |
| T-12 | Kamesh owns backend files; Fazil owns frontend files. Shared files have one named owner. |

## 4. Existing capability reuse map

| Existing capability | Reuse | Insurance responsibility | Prohibited adaptation |
|---|---|---|---|
| Patient | `patient_id`, number, identity display | Membership links and coverage history | Policy/member arrays on Patient |
| Patient Document | Document ID, storage, review metadata | Link evidence to member/auth/claim | Treat upload as active coverage |
| Clinical context | Source type/ID and clinical identifiers | Coverage/auth/claim context | Duplicate generic Encounter |
| Service master | ID, code, name, category, price | Benefits, tariffs and line snapshots | Duplicate service catalogue |
| Billing invoice/item | Charge source and item references | Claim version and line snapshots | Claim states on invoice |
| Billing payment | Patient/self-pay record | None | Payer settlement in this collection |
| Branch/user/RBAC | Scope and actor | Insurance permissions | Trust frontend scope |
| Audit | Existing immutable audit record | Structured Insurance metadata | Second audit subsystem |
| Notification | Existing delivery infrastructure | Insurance events/types if approved | Separate notification engine |
| Settings | Currency/configuration | Monetary currency snapshot | Hardcoded currency |

## 5. Current gaps

| Gap | Impact | Resolution phase |
|---|---|---|
| No Insurance backend or frontend domain | All functionality is new | Phase 1 onward |
| No approved Insurance FSD | Lifecycle and finance decisions cannot be finalized | Phase 0 owner approval |
| No universal Encounter entity | Generic workflow cannot be copied literally | Use clinical source context |
| Billing `visit_id` is required even for mixed contexts | Claim source must not force a Billing refactor | Reference invoice and approved context |
| Billing amounts do not carry currency per transaction | Claim/finance snapshot rule unresolved | Phase 0 decision D-05 |
| Existing transaction helper can fall back without a transaction | Unsafe for finance/utilization | Insurance strict wrapper in later phase |
| Notification types are narrow | Insurance notification taxonomy absent | Additive synchronized change when needed |
| Audit Insurance fields are not first-class | Reporting/index needs may emerge | Structured metadata first; index only if justified |
| HMS Local Insurance UI uses local mock state | Cannot become production logic | Visual pattern only |
| No Organization/Tenant model exists | `organizationId` cannot be added only inside Insurance without introducing inconsistent tenancy | Map organization-level intent to existing system Settings and branch scope |
| Unpaid `PENDING` invoices remain editable | Claim snapshot can become stale after claim creation | Revalidate snapshot or approve a narrow claim-lock contract before Phase 4 |

## 6. Final architecture decisions D-01 through D-08

| ID | Final decision | Repository adaptation | Status |
|---|---|---|---|
| D-01 | One Insurance module supports `PROVIDER`, `PAYER`, `TPA` and `HYBRID` operating contexts. Server-side permissions remain authoritative; a provider deployment cannot manufacture payer decisions. | Store operating mode in an Insurance section of the existing singleton System Settings. Do not create an Organization model. Mock decisions are test/non-production external-source decisions only. | APPROVED |
| D-02 | One system-level Payer identity; contracts, schemes and commercial configuration are branch-authorized/scoped. Do not duplicate payer identity per branch. | Current HMS has no `organizationId`. Payer code is globally unique in this deployment; contract/scheme indexes include `branchId`. A future tenancy project may add organization scope consistently across HMS. | APPROVED WITH ADAPTATION |
| D-03 | Create `insurance_providers` and effective-dated provider-to-branch mappings. Legal provider identity is independent from branch name. | Claims reference both `provider_id` and `branch_id`; provider mappings validate that the branch may act for the provider. | APPROVED |
| D-04 | Claims use only Billing-approved issued/final invoices, never `DRAFT` or `CANCELLED`. | Repository mapping: eligible statuses are `PENDING`, `PARTIALLY_PAID`, `PAID`; excluded statuses are `DRAFT`, `CANCELLED`. There is no `VOID` status. Because unpaid `PENDING` remains editable, submission must revalidate the invoice/item snapshot; any Billing claim lock requires separate approval before Phase 4. | APPROVED WITH PHASE-4 GUARD |
| D-05 | Use one shared HMS Finance Money & Currency Policy. Persist new financial amounts as integer minor units plus ISO 4217 currency; use high-precision decimal calculations, centralized rounding/tolerances, effective-dated versioned policies and transaction policy snapshots. No implicit currency conversion. | Current HMS has singleton Settings, not Organization tenancy. Current Billing persists floating-point numbers without currency and hard-rounds to two decimals. Therefore the target is approved, but a separately approved shared Finance Foundation and compatibility/migration contract must precede Insurance tariffs or financial transactions. Engineering defaults may seed a `DRAFT` policy but cannot become production `ACTIVE` without Finance approval. | TARGET APPROVED; SHARED FOUNDATION REQUIRED |
| D-06 | Member uniqueness is configurable per payer (`payer + member number` or `payer + policy + member number`). Multiple coverages use numeric priority; only one overlapping active priority `1` per patient. MVP processes primary coverage only; secondary coordination is deferred. | Implement partial unique/effective-date conflict checks in Insurance repositories. Claims always identify payer, policy and member explicitly. | APPROVED |
| D-07 | Member and Policy have separate transition maps. Member follows the BRD lifecycle; Policy uses controlled approval and terminal states. | Member: `DRAFT`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `CANCELLED`, `DECEASED`, `TERMINATED`. Policy: `DRAFT`, `PENDING_APPROVAL`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `CANCELLED`, `TERMINATED`, plus approval rejection history rather than unsafe arbitrary edits. | APPROVED |
| D-08 | Generic Insurance maker-checker rules cover configured activations, contracts, tariffs, overrides, high-value actions, payments, adjustments and write-offs. Self-approval is prohibited. | Create Insurance approval-rule/request records; enforce maker/checker in backend services and preserve reason, before/after, actor and timestamp in existing Audit. | APPROVED |

### 6.1 D-05 shared Finance Foundation prerequisite

D-05 introduces a cross-HMS finance contract, not an Insurance-only helper.
Before a tariff or other monetary Insurance field is implemented, approve a
shared Finance Foundation phase covering:

``` text
ISO 4217 currency-master source, update and deactivation governance
Singleton-system mapping now; future Organization migration boundary
Versioned finance-policy model and maker-checker activation
Direct approved high-precision decimal dependency or equivalent implementation
MoneyService API and deterministic rounding/allocation tests
Integer-minor-unit persistence and API serialization contract
Compatibility adapter for existing Billing number fields
Migration/backfill strategy if existing Billing storage is converted
Base/supported currency and production Finance approval workflow
Separate claim and reconciliation tolerances
LINE/DOCUMENT tax-rounding ownership with Billing
Historical policy snapshots and no implicit FX conversion
```

Technical defaults such as `HALF_UP` and zero claim tolerance may be stored
only in a non-active draft policy. Financial processing must fail closed if
no approved active policy applies.

Non-monetary Phase 1A foundation may proceed after its contract is frozen.
Benefits with monetary limits, tariffs, claims, remittance, allocation and
reconciliation remain blocked until the shared Finance Foundation is live.

### 6.2 Later-phase decisions

The following remain open but do not block the Phase 1 non-monetary
foundation when explicitly deferred with an owner and due phase.

| ID | Decision area | Detail to approve | Required owner | Due |
|---|---|---|---|---|
| D-09 | Eligibility validity | Validity period, caching/recheck rules, offline/manual verification | Insurance Operations | Before Phase 2 |
| D-10 | Authorization rules | Required services, limits, expiry, extension, cancellation and emergency override | Clinical + Insurance Operations | Before Phase 3 |
| D-11 | Utilization timing | Reserve/consume/release/reverse trigger events | Clinical + Finance | Before Phase 3 |
| D-12 | Claim numbering/versioning | Number scope, correction, replacement, resubmission and closure | Insurance Operations | Before Phase 4 |
| D-13 | Document requirements | Required types by payer/service/claim and retention | Compliance + Insurance Operations | Before Phase 4 |
| D-14 | Cross-ledger behavior | Whether/how payer decisions affect receivables and patient responsibility | Finance + Billing | Before Phase 6 |
| D-15 | External integration | Initial payer, protocol, credentials, certification and retry SLA | Integration Owner | Before Phase 7 |

## 7. Phase 0 ownership

### Kamesh

- Own the backend/data contract and the technical proposals for D-02 through
  D-08.
- Confirm indexes, unique constraints, versions, transition maps,
  idempotency and transaction boundaries.
- Make no production model, route, permission seed or registry change until
  this note and the contract draft are approved.

### Fazil

- Own the screen-to-DTO mapping, route map and UI state inventory.
- Use HMS Local only for established visual patterns.
- Make no production route, sidebar, access-control, API client or screen
  change until the contract is approved.

## 8. Phase 0 exit checklist

- [x] Existing reusable backend contracts inventoried.
- [x] Existing reusable frontend patterns inventoried.
- [x] Prototype behavior classified as non-authoritative.
- [x] Technical ownership and merge boundary documented.
- [x] Draft field/API contract prepared.
- [x] D-01 through D-08 architecture decisions supplied and reconciled.
- [x] Actual Billing statuses inspected and mapped for D-04.
- [x] Organization assumptions adapted to existing Settings/Branch architecture.
- [x] D-05 target architecture supplied and repository-reconciled.
- [x] Shared Finance Foundation separated as a required shared-HMS workstream.
- [ ] Active production Finance policy approved before financial go-live.
- [x] Phase 1A status/permission/error contract frozen.
- [x] `insurance-v1-phase0` architecture marked APPROVED.
- [x] Phase 1A marked READY TO START.
- [ ] Explicit instruction given to begin application implementation.

## 9. Current stop decision

Phase 0 is **COMPLETE**. The non-monetary Phase 1A contract is frozen and
ready for implementation when explicitly started. Tariff, benefit-limit,
claim-amount and finance implementation must not start until the shared
Finance Foundation gates pass. No application implementation has started.
