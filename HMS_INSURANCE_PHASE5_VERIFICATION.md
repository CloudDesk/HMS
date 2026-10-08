# Insurance Phase 5 verification — 8 October 2026

Implemented the internal authorization backend; live SHA submission is blocked by the missing confirmed contract. This is not evidence of live SHA integration or full production acceptance.

## Domain and boundaries

InsuranceAuthorization embeds service-referenced lines and append-only transition history. It references existing member, patient, policy, payer, scheme, branch, optional OPD visit, doctor and patient document records. No master data is duplicated. Dates, context, correlation, version, normalized decision and clearly marked integration mode are persisted.

Canonical statuses: DRAFT, SUBMITTED, PENDING, APPROVED, PARTIALLY_APPROVED, REJECTED, EXPIRED, CANCELLED, FAILED. Explicit service transitions govern draft submission, technical retry and draft cancellation. EXPIRED is representable but no expiry deadline or automation is invented. Payer-side cancellation and pending-decision refresh await the live contract. Local cancellation is restricted to unsubmitted drafts.

Lines contain service ID/code snapshot, requested quantity, and optional returned approved quantity/amount and rejected quantity. Requested amounts and external rejection reasons are deferred until a confirmed contract requires/defines them. Amounts are authorization results only; no financial calculation or invoice/payment changes exist.

Creation and submission reuse Phase 4 verification (local coverage, usable SHA eligibility, authorization-required benefit); quantity and duplicate service validation use Zod. References and authenticated-user branch access are checked. Optional encounter support is currently OPD visits, not arbitrary encounter identifiers.

Default adapter is UNAVAILABLE and submit returns 503 SHA_PREAUTH_CONTRACT_UNAVAILABLE without sending HTTP. The mock adapter is dependency-injected only and deterministically supports APPROVED, PARTIALLY_APPROVED, REJECTED, PENDING and FAILED. There is no claimed external SHA status mapping or invented endpoint/authentication payload.

Unique fingerprint covers member, branch, encounter, date, service set and authorization context. Exact retries return the existing record; changed quantities/provider/document in the same context conflict. Version-conditional submission prevents duplicate sends. Explicit FAILED retry generates a new correlation with history retained. Terminal records remain deduplicated; correction/resubmission semantics beyond technical retry need an approved contract.

Authorization writes and corresponding AuditLog records commit together in MongoDB transactions. Creation, submission, decision, failure and cancellation are audited. History retains actor/time/from/to/correlation and cancellation reason. No raw external payload/error, credentials or headers are persisted or logged by the adapter/service. Unknown response properties are stripped at the normalized boundary; decision quantities and service identities are validated. List responses omit history, document reference and context.

## API and shared changes

- POST /api/insurance/authorizations — create draft (Manage).
- GET /api/insurance/authorizations — branch-scoped paginated list (View).
- GET /api/insurance/authorizations/:id — detail (View).
- POST /api/insurance/authorizations/:id/submit — version-checked submit (Submit).
- POST /api/insurance/authorizations/:id/cancel — version-checked draft cancellation with reason (Manage).

Shared changes: permission seed adds Insurance.Authorization View/Manage/Submit and administrator grants; service registry/type add the authorization service; insurance routes register endpoints; existing insurance tests add endpoint RBAC checks; phase execution plan links this verification. New files are authorization model, schemas, repository, service, tests and SHA preauthorization adapter. Existing Phase 4 working-tree changes were preserved. No UI changes or prototype changes.

## Validation

- Insurance tests: **107 passed**, three files; includes all previous 84 tests plus 19 authorization cases and four endpoint RBAC cases.
- API TypeScript typecheck: passed after implementation.
- New authorization files: focused ESLint passed with zero errors.
- Tests use a MongoDB memory replica set for persistence, transactions, history/audit and concurrent duplicate creation. Existing Phase 1–4 tests remain passing.
- Manual browser, deployed database, live SHA, permission seed deployment and production index rollout were not executed. Full lint/build reruns and unrelated baseline cleanup were intentionally excluded per the Phase 5 request.

## Remaining dependencies and stop gate

Confirmed SHA endpoint/authentication/request/response/status contract; external cancellation, expiry and pending-result retrieval semantics; encounter adapters beyond OPD; approved correction/resubmission rules. Production recovery of a process stopped after SUBMITTED must await confirmed SHA correlation lookup/idempotency semantics; no unsafe automatic resend is implemented.

Apply the existing permission seed and ensure authorization indexes are installed before deployment. Deployment requires transaction-capable MongoDB, as in existing HMS workflows.

Claims, payments, remittance, reconciliation and final patient financial liability were NOT implemented. Stop after Phase 5. Recommended next work is confirming the live SHA contract and completing authorization acceptance before authorizing Phase 6 scope.
