# M-PESA Step 5: callback intake — gap note and execution plan

Date: 26 October 2026

## Scope and authority

The supplied Step 5 implementation prompt authorizes a backend-only callback
receiver and explicitly requires implementation after analysis. Its ten phases
are executed sequentially within this callback slice. Step 6 (trusted provider
verification, reconciliation and billing posting) is not authorized here.
The existing Scope 2 Phase 3 plan remains unchanged; this is separate work.

## Phase 1 findings

- Fastify bootstrap: `apps/api/src/app.ts`; routes: `modules/index.ts`;
  dependency construction and typing: `shared/services/service-registry.ts`
  and `shared/types/service-registry.ts`.
- Authentication is attached per route; a dedicated public route needs no
  change to existing authentication or permissions.
- Billing stores completed payments, not provider payment attempts. No
  M-PESA integration, CheckoutRequestID or MerchantRequestID contract exists.
  A manually entered billing reference is not a trustworthy correlation key.
- Billing collection already transactionally updates invoice, payment,
  advance payment and audit. This receiver must never call that operation.
- Reuse Mongoose's existing connection, AppError, `ok`, Zod, Vitest,
  mongodb-memory-server and AuthRateLimitRepository's shared MongoDB buckets.
- API default and local development PORT are 4000. Only `.env.dev` is present
  in apps/api; it is private and will not be modified.
- Reviewed billing API client, service, domain/feature hooks and Local billing
  workspace prototype. No UI changes are needed for a provider callback.
- Reviewed PROJECT_RULES, Scope 2 plan and Developer 1 prompt. The referenced
  release FSD remains absent. No new clinical or financial lifecycle is inferred.

## Design and gaps

- Dedicated integration event collection, not a second payment ledger. Events
  are unverified provider claims, initially UNMATCHED. Do not invent invoices,
  branches, patients or payment attempts for Postman requests.
- Preserve conflicting notifications as distinct immutable events. Deduplicate
  canonical payloads with a deterministic SHA-256 MongoDB `_id`, including
  deployment environment; metadata order does not affect identity.
- Majority/journaled atomic persistence before acknowledgment. No multi-document
  financial writes, so no transaction is necessary for this slice.
- No public reads or reconciliation mutations. Indexed checkout IDs, receipt
  references and processing status support later authorized reconciliation.
- Strict bounded payloads and metadata validation; no original raw payload,
  credentials, provider-controlled errors or phone numbers in normal logs.
- Reuse distributed MongoDB rate limiting before parsing, using trusted
  request IP plus a global bucket. Fail closed when storage is unavailable.
- No assumed provider signature. Financial posting remains disabled. The
  missing originating-attempt contract blocks genuine Phase 4 matching, not
  safe intake of unmatched events. Document this explicitly in verification.

## Phase order and intended files

1. Analysis: this note.
2. Route/schema/service: `modules/mpesa/mpesa-callback.*`.
3. Persistence: dedicated event model/repository.
4. Correlation: UNMATCHED handling only; originating-attempt integration deferred.
5. Outcome recording: reported SUCCESS/CANCELLED/TIMEOUT/FAILED, never verified.
6. Security: bounded input, sanitization, existing MongoDB limiter, no billing access.
7. Configuration: environment and rate limits in existing env configuration;
   no OAuth credentials required for intake.
8. Tests: route/service tests plus real isolated MongoDB integration tests.
9. Local manual instructions and request examples in runbook.
10. Public HTTPS sandbox instructions; actual provider callback needs client setup.

Shared edits: only module registration, service construction/type registry and
environment configuration. No dependency changes, billing enums, permissions,
frontend, private environment files, or prototypes are changed.

Verification found a shared limiter race: concurrent first-bucket upserts could
return false throttles on duplicate-key errors. A narrow non-upsert conditional
retry was added to `auth-rate-limit.repository.ts`, with a focused concurrency
regression in `auth-rate-limit.test.ts` and existing auth tests retained.

Verification evidence and final phase status: `HMS_MPESA_STEP5_VERIFICATION.md`.

Execution update: phases 2–3 and 5–8 implemented and locally verified. Phase 4
implements only unmatched intake; real matching awaits an originating-attempt
contract. Phases 9–10 have runnable instructions, with public provider acceptance
still pending. Required full lint has documented unrelated baseline failures.
Step 6 has not started.
