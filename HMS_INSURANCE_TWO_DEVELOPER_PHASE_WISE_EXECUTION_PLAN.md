# HMS Insurance Two-Developer Phase-Wise Execution Plan

## 1. Purpose

This plan divides Insurance implementation between Kamesh and Fazil so
they can work in parallel with minimal merge conflicts while preserving
the existing HMS backend, frontend, data and workflows.

This plan is subordinate to `PROJECT_RULES.md`, the repository `AGENTS.md`
instructions, and the authoritative repository-alignment addendum in
`agents_final.md`. It does not authorize implementation before Phase 0
decisions are approved.

## Current execution status

**Phase 0: COMPLETE — architecture decisions accepted.**

**Phase 1A: IN PROGRESS — Kamesh backend Slice 1 complete; later slices not started.**

**Finance Foundation: REQUIRED — separate shared-HMS workstream.**

**Phase 1B: BLOCKED — until all Finance Foundation gates F-01 through F-06 pass.**

Active Phase 1A backend assignment:

``` text
Developer: Kamesh
Branch: Insurance-module-k
Ownership: apps/api Insurance implementation and assigned backend shared files
```

Active Phase 0 artifacts:

``` text
doc/insurance/PHASE_0_GAP_AND_DECISION_NOTE.md
doc/insurance/INSURANCE_V1_PHASE0_FIELD_AND_API_CONTRACT_DRAFT.md
doc/insurance/PHASE_0_VERIFICATION.md
```

Kamesh Phase 1A Slice 1 now implements backend operating configuration,
Insurance Provider, and effective-dated Provider-to-Branch mapping. Payer,
contract, scheme, policy, member and approval-foundation slices have not
started.

## 2. Permanent Ownership Boundary

| Area | Kamesh | Fazil |
|---|---|---|
| `apps/api/src/modules/insurance/**` | Sole owner | No edits |
| Insurance models, indexes and repositories | Sole owner | No edits |
| Insurance services, transitions and transactions | Sole owner | No edits |
| Insurance routes, schemas and OpenAPI | Sole owner | No edits |
| Backend permission seeds and module/service registries | Sole owner | No edits |
| `apps/web/src/api/insurance.ts` | No edits | Sole owner |
| `apps/web/src/services/insurance.service.ts` | No edits | Sole owner |
| `apps/web/src/hooks/insurance/**` | No edits | Sole owner |
| `apps/web/src/pages/insurance/**` | No edits | Sole owner |
| `apps/web/src/components/insurance/**` | No edits | Sole owner |
| Frontend routes, navigation and access control | No edits | Sole owner |
| Existing Patient/Billing domain files | Read-only unless explicitly assigned | Read-only unless explicitly assigned |

Neither developer may refactor shared infrastructure as part of Insurance.
Any required change outside the owned paths must be listed in the phase gap
note and assigned to exactly one owner before editing.

## 3. Contract-First Working Method

At the start of each phase, Kamesh publishes the approved API contract:

``` text
Endpoint and method
Permission
Request path/query/body schema
Response DTO
Enums and transition actions
Error codes
Pagination/filter/sort behavior
Concurrency version and idempotency requirements
```

After the contract is frozen:

- Kamesh implements the backend without editing frontend files.
- Fazil implements the frontend against the frozen contract without
  inventing fields, enums or mock production responses.
- Fazil may build loading, empty, error and permission states before an
  endpoint is live, but live acceptance waits for the real API.
- Contract changes require a reviewed contract revision. Silent backend or
  frontend divergence is not allowed.

## 4. Branch and Merge Rules

Recommended branches:

``` text
feature/insurance-api-<phase>-kamesh
feature/insurance-web-<phase>-fazil
```

Approved Kamesh Phase 1A branch: `Insurance-module-k`.

Merge order for every phase:

1. Approve and freeze the phase contract.
2. Merge Kamesh's backend branch.
3. Rebase Fazil's frontend branch on the merged backend baseline.
4. Run live frontend-to-backend acceptance.
5. Merge Fazil's frontend branch.
6. Run the full API and web verification gate.
7. Record approval before opening the next phase branches.

Do not carry unfinished files into the next phase. Do not combine both
developers' work into one branch. Each developer keeps commits limited to
the files they own.

## 5. Phase 0 — Contract, Gap and Safety Decisions

### Kamesh — backend/data contract owner

- Inventory Patient, Patient Document, clinical context, Service, Billing
  Invoice/Item, Settings, Audit, Notification and RBAC contracts.
- Define the Insurance bounded context and collection boundaries.
- Propose common fields, indexes, uniqueness, version and idempotency.
- Define approved state-transition maps for every phase.
- Document strict transaction behavior for utilization and finance.
- Resolve the decisions in `agents_final.md` Section 58.7.
- Publish API contract revision `insurance-v1-phase0`.

### Fazil — frontend/UX contract owner

- Inventory existing page, table, filter, form, dialog, status, timeline,
  query-key and permission-gating patterns.
- Inspect relevant HMS Local patterns without modifying the prototype.
- Produce the Insurance information architecture and route map.
- Map every screen field to the approved API DTO; flag missing fields.
- Define loading, empty, error, permission, conflict and retry states.
- Do not create mocks or production UI mutations in this phase.

### Exit gate

- Business authority and tenancy are approved.
- Clinical context, money, invoice eligibility and cross-ledger rules are
  approved.
- Field mapping contains no unresolved required field.
- API/DTO/status/error contract is signed off.

## 6. Phase 1 — Insurance Foundation

Scope is split to avoid mixing incompatible money representations:

``` text
Phase 1A: operating configuration, provider/branch mapping, payer,
          contract, scheme, policy, approval foundation and non-monetary
          membership structure
Phase 1B: benefits with monetary limits and tariffs, only after the shared
          Finance Foundation is approved and available
```

Authoritative Phase 1A contract:

`doc/insurance/INSURANCE_V1_PHASE1A_IMPLEMENTATION_CONTRACT.md`

### Kamesh

- Create Insurance module structure, models, repositories and services.
- Add operating-mode configuration using the existing system-settings
  architecture; do not create an Organization/Tenant subsystem.
- Add legal Insurance Provider and effective-dated branch mappings.
- Add the approval-rule/request foundation with server-side self-approval
  prevention.
- Implement paginated CRUD, filters, scope, status and unique indexes.
- Reference existing Patient and Service records through narrow reads.
- Add backend permissions, module registration and service registry wiring.
- Add audit events and stale-version conflict handling.
- Test duplicate membership, overlapping effective dates, invalid scope,
  inactive references and concurrent updates.

### Fazil

- Create Insurance API client, service and query-key/domain-hook layer.
- Implement operating-mode, provider mapping and approval-queue screens
  using the frozen permission contract.
- Implement Phase 1A list/detail/form screens with existing components.
- Implement monetary Benefit/Tariff screens only in Phase 1B after the
  shared Finance Foundation contract is available.
- Add Insurance routes, sidebar entry and frontend permission gates.
- Add a Patient Profile Insurance tab through a cross-domain feature hook;
  do not place Insurance logic in the Patient domain hook.
- Use on-demand lookups, URL query state and targeted invalidation.

### Exit gate

Foundation CRUD works against MongoDB with RBAC, scope, audit, pagination,
indexes and live UI. No Patient or Service master is duplicated.

## 7. Phase 2 — Eligibility and Benefit Verification

### Kamesh

- Implement eligibility requests/results and benefit verification.
- Enforce member/policy/effective-date and payer configuration rules.
- Store verification snapshots, response source and correlation IDs.
- Add idempotent retry behavior and non-sensitive integration logging.
- Provide a test adapter only under explicit test/non-production config.

### Fazil

- Implement patient coverage selection and eligibility workspace.
- Display benefit limits, exclusions, effective dates and verification
  source without treating document evidence as active coverage.
- Handle unavailable, expired, not-covered, retry and payer-unavailable
  states using explicit text and status indicators.

### Exit gate

Eligibility is reproducible and audited; duplicate requests are safe; no
production path silently falls back to the test adapter.

## 8. Phase 3 — Authorization and Utilization

### Kamesh

- Implement authorization header, lines, history and explicit transitions.
- Resolve clinical source through the existing polymorphic context.
- Add expiration, extension, cancellation and rejection reason rules.
- Implement utilization `RESERVE/CONSUME/RELEASE/REVERSE/ADJUST` ledger.
- Use conditional writes and strict transactions for coupled changes.

### Fazil

- Implement authorization queue, request/detail forms and status timeline.
- Add service-line decisions, required-document handling and reason capture.
- Show conflicts, stale versions, expiry and utilization balance clearly.
- Gate approval/override actions independently from request actions.

### Exit gate

Concurrent authorization/utilization tests pass and every transition has an
actor, reason where required, timestamp and audit trail.

## 9. Phase 4 — Claim Preparation, Validation and Submission

### Kamesh

- Create claims, immutable claim versions, lines, documents and validation
  findings from eligible Invoice/Invoice Item records.
- Snapshot service, charge, tariff, currency and source-version facts.
- Enforce duplicate-claim and invoice eligibility rules.
- Implement draft, validate, submit and acknowledgement transitions.
- Record idempotent outbound messages and safe retry outcomes.

### Fazil

- Implement claim worklist, creation wizard, detail and validation views.
- Reuse invoice/item selectors through approved APIs only.
- Show snapshot values separately from current master values where needed.
- Implement document linking/upload, validation issue navigation,
  submission confirmation and acknowledgement status.

### Exit gate

A real invoice can produce one controlled claim version, pass validation and
submit idempotently without changing patient-payment or invoice status.

## 10. Phase 5 — Queries, Adjudication, Correction and Appeal

This phase starts only if Phase 0 confirms that HMS owns payer-side actions.
Otherwise, replace it with inbound decision and status tracking.

### Kamesh

- Implement queries/responses, adjudication lines, denial reasons,
  corrections, resubmission versions and appeals.
- Prevent self-approval where approval rules require segregation.
- Protect submitted and closed versions from direct editing.

### Fazil

- Implement query inbox, response workspace, decision detail, correction
  comparison and appeal timeline.
- Permission-gate requester, reviewer, approver and appeal actions.

### Exit gate

Partial decisions, denials, query responses, corrections, appeals and
resubmissions retain complete version history and authorization evidence.

## 11. Phase 6 — Payer Finance and Reconciliation

This phase cannot start until money representation, rounding, accounting
ownership and cross-ledger behavior are approved.

### Kamesh

- Implement dedicated payer payment, remittance, allocation,
  reconciliation, variance, adjustment and reversal records.
- Enforce strict MongoDB transactions with no non-transaction fallback.
- Add immutable posting references, idempotency and segregation of duties.
- Keep payer settlement separate from existing patient payments.
- Produce efficient finance audit and reconciliation projections.

### Fazil

- Implement remittance import/review, allocation workspace,
  reconciliation queue and variance-resolution UI.
- Require confirmation and reasons for adjustments and reversals.
- Show allocated, unallocated, underpaid, overpaid and disputed amounts.
- Do not present payer settlement as patient payment or invoice settlement.

### Exit gate

Full, partial, duplicate, under-, over- and unallocated-payment tests pass;
rollback tests prove no partial financial posting is retained.

## 12. Phase 7 — Production Integration, Reporting and Hardening

### Kamesh

- Implement approved payer adapters, authentication, timeout/retry, webhook
  verification and failed-message operational handling using existing
  infrastructure only.
- Add indexed reporting projections or dashboard snapshots; avoid expensive
  synchronous aggregations.
- Run security, privacy, performance, retention and recovery tests.

### Fazil

- Implement integration monitoring, retry visibility, reports and dashboard
  screens against approved snapshot/read APIs.
- Complete responsive, accessibility and live-browser acceptance.
- Remove test-only controls from production builds.

### Exit gate

Production connectivity, operational recovery, audit evidence, performance,
privacy and end-to-end live acceptance are approved.

## 13. Required Verification for Every Phase

Both developers run and record:

``` bash
npm run typecheck --workspace=@hms/api
npm run lint --workspace=@hms/api
npm run build --workspace=@hms/api
npm run typecheck --workspace=@hms/web
npm run lint --workspace=@hms/web
npm run build --workspace=@hms/web
```

Focused verification covers, as applicable:

- Permissions and organization/branch scope
- Invalid and stale transitions
- Unique and duplicate records
- Concurrent update or submission
- Transaction rollback and idempotent retry
- Audit and notification events
- Persistence after logout/login
- Live responsive workflows without production mock data

## 14. Phase Completion Note

Each developer supplies only their owned portion of:

``` text
Implemented functionality
Existing functionality reused
Files changed, including assigned shared files
Validation, permissions, scope, audit and errors
Automated checks and live tests
Known dependency or approved deferral
Confirmation that the next phase has not started
```

The phase is complete only after both portions are reconciled and the live
frontend-to-backend workflow passes.
