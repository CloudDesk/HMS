# HMS Engineering Best-Practices Checklist

**Purpose:** A reusable engineering checklist for HMS development, code reviews, bug fixes, new features, integrations, and release verification.

**Applies to:** Backend APIs, staff web application, patient portal, mobile integrations where relevant, database workflows, file storage, authentication, dashboards, clinical workflows, and deployment configuration.

## How to Use This Checklist

- [ ] Review applicable items before implementation, during development, and before merging or releasing.
- [ ] Do not mark an item complete unless it was verified.
- [ ] Mark non-applicable items as **N/A** and briefly explain why.
- [ ] Record blocked items, unresolved dependencies, and the evidence needed to close them.
- [ ] Never claim a test, build, security check, or integration passed unless it was executed and its result checked.
- [ ] Preserve existing user changes and follow the repository's current architecture and ownership rules.
- [ ] For clinical, financial, identity, or access-control workflows, include negative, concurrency, and recovery tests where applicable.

---

## 1. General Coding and User Experience

- [ ] **Try/catch and error handling:** Handle expected failures at appropriate boundaries. Do not swallow errors or return false success.
- [ ] **User-friendly errors:** Display clear, actionable messages without exposing stack traces, secrets, internal database details, or sensitive information.
- [ ] **Route and API checks:** Verify frontend routes, backend endpoints, HTTP methods, request payloads, response shapes, authentication, and permissions.
- [ ] **Environment-aware API URLs:** Hosted deployments must not point to `localhost`. Use validated environment configuration. Local development may use a local URL through local configuration.
- [ ] **Storage provider selection:** If approved bucket/object storage or Azure credentials are configured, use that provider rather than silently falling back to local disk storage. Fail clearly if required production storage is unavailable.
- [ ] **Success and error feedback:** Show success/error toasts or equivalent accessible feedback for user-triggered operations. Do not show success before the server confirms it.
- [ ] **Global table styling:** Follow the shared table design system throughout the project.
- [ ] **Table behavior:** Use appropriate sorting, server-side pagination where needed, and scrolling inside the table view. Avoid forcing horizontal scrolling on the entire page when the table can manage its own layout.
- [ ] **No mock dashboard values:** Never use random, fabricated, or hardcoded operational metrics in dashboards. Show backend-derived values and appropriate loading, empty, unavailable, and error states.
- [ ] **Layered frontend architecture:** Follow `Page → Feature Hook → Domain Hook → Service → API Client`.
- [ ] **No TypeScript `any`:** Use explicit domain types, DTOs, generics, discriminated unions, and validated unknown values instead of `any`.
- [ ] **Component boundaries:** Keep pages and components focused. Split oversized components into domain components, hooks, and utilities where practical.
- [ ] **Accessible interaction:** Provide meaningful labels, keyboard operation, visible focus, and accessible error/status messages for relevant controls.
- [ ] **Existing behavior:** Avoid unrelated refactoring and verify affected existing workflows still work.

## 2. Data Accuracy, Identifiers, and Atomicity

- [ ] **Dashboard data accuracy:** Display only backend-calculated operational metrics. Distinguish loading, empty, unavailable, and failed states; never fall back to fabricated values.
- [ ] **Unique identifiers:** Generate patient, appointment, OPD, admission, surgery, and emergency identifiers using atomic sequences or collision-resistant identifiers, with database-enforced uniqueness.
- [ ] **Appointment double-booking:** Prevent concurrent reservation conflicts using database constraints, atomic operations, or an appropriate transaction/locking strategy.
- [ ] **Active OPD visit uniqueness:** Prevent multiple concurrent active OPD visits for the same patient or encounter using database-enforced invariants and atomic operations.
- [ ] **Patient creation atomicity:** Create the patient, timeline events, and related audit records atomically or use a documented, reliable recovery mechanism for partial failures.
- [ ] **OPD visit atomicity:** Create the OPD visit and update the linked appointment in the same transaction when supported and required.
- [ ] **Password change/session revocation:** Ensure password changes and resets cannot leave old sessions active when revocation fails. Use a consistent transactional or recoverable design.
- [ ] **Refresh-token rotation:** Implement atomic, single-use refresh-token rotation, replay detection, appropriate token-family revocation, and safe concurrent-refresh handling.
- [ ] **Document storage consistency:** Keep file operations and metadata consistent using transactions where possible, compensating actions, and orphan-file cleanup.
- [ ] **Password-reset delivery:** Connect reset-token generation to a secure delivery workflow. Give accurate confirmation and failure messages; do not imply an email/SMS was sent if delivery failed.
- [ ] **Registration recovery:** Make registration and linked account-creation workflows transactional, idempotent, or explicitly recoverable.
- [ ] **Patient identity deduplication:** Define a reviewed identity-matching strategy, appropriate database constraints, and safe concurrent-registration behavior.

## 3. Security, Secrets, and Access Control

- [ ] **Secret management:** Never commit database credentials, API keys, tokens, private keys, or secret-bearing environment files.
- [ ] **Exposed-secret response:** Rotate exposed credentials and follow the approved process for removing secrets from Git history and deployment environments.
- [ ] **Branch/department authorization:** Apply centralized scope enforcement to every applicable repository read, create, update, delete, and workflow transition.
- [ ] **Department-scoped clinical mutations:** Verify the record's authoritative department and enforce access on every clinical update, cancellation, completion, and status transition.
- [ ] **Resource-level authorization:** Validate patient, visit, branch, department, organization/tenant, assignment, and role scope as applicable. Frontend visibility is not authorization.
- [ ] **Authentication rate limiting:** Apply configurable rate limits, cooldowns, and abuse protection to login, OTP, refresh-token, and password-reset endpoints.
- [ ] **HTTP security headers:** Configure and verify appropriate production headers, including Content Security Policy, frame protection, MIME-sniffing protection, and referrer policy.
- [ ] **CORS:** Reject wildcard origins for credentialed production requests. Allow only explicitly approved origins.
- [ ] **Clinical API response schemas:** Define and test explicit response schemas for clinical, billing, authentication, patient, and administrative endpoints to prevent sensitive-field exposure.
- [ ] **Patient notification authorization:** Restrict global notification operations to explicitly authorized staff. Derive recipient ownership and access scope on the server.
- [ ] **Auditability:** Record relevant actor, time, action, and resource. For clinical amendments, retain required before/after version references and reason.
- [ ] **No sensitive logs:** Redact passwords, OTPs, access/refresh tokens, secrets, and sensitive patient details from logs.

## 4. Authentication, Sessions, OTP, and Patient Portal

- [ ] **Refresh-token storage:** Keep refresh tokens out of JavaScript-readable browser storage. Use the agreed Secure, HttpOnly, SameSite cookie-based session contract.
- [ ] **OTP verification:** Never bypass OTP verification unconditionally. Enforce single-use, unexpired challenges, attempt limits, and production-safe demo restrictions.
- [ ] **OTP storage:** Never persist raw OTPs in browser storage. Use short-lived, server-issued, single-purpose registration transaction identifiers.
- [ ] **OTP rate limiting:** Enforce per-IP and per-identity limits, resend cooldowns, challenge attempt limits, and abuse monitoring.
- [ ] **Refresh failure handling:** Stop protected requests when pre-emptive refresh fails and invoke the session-expiry handler without unnecessary retries.
- [ ] **Booking route context:** Preserve doctor, branch, department, and booking intent through authentication and redirects using validated, typed route builders.
- [ ] **Registration recovery:** Make signup and dependent account creation idempotent or explicitly recoverable. Do not report total failure when partial success occurred without checking/recovery.
- [ ] **Portal transactions:** Make signup, OTP authentication, portal grants, and dependent record creation transactional or explicitly recoverable.
- [ ] **Portal pagination:** Perform appointment and OPD history filtering, sorting, and pagination in MongoDB instead of loading complete histories into memory.
- [ ] **Portal query separation:** Separate shared overview/queue queries from workspace-only lookup queries to avoid unnecessary requests.
- [ ] **Portal routing:** Use the established React Router architecture, protected routes, validated redirects, and URL-backed navigation state.
- [ ] **Portal bundle optimization:** Lazy-load portal routes and share only intentionally reusable styles/components instead of importing the entire staff application's stylesheet.
- [ ] **Safe print rendering:** Avoid injecting unescaped patient-controlled or database-derived values through `document.write`. Use safe React rendering or context-aware encoding.
- [ ] **SMS delivery reliability:** Never report successful OTP delivery when the provider fails. Redact phone numbers, OTPs, tokens, and sensitive information from logs.
- [ ] **Patient switching:** Verify patient-context changes clear or isolate cached clinical data so one patient's information cannot appear in another patient's workspace.
- [ ] **Patient portal registration:** Confirm access grants and patient/user links are scoped to the correct patient and cannot be escalated by client-supplied identifiers.

## 5. Frontend Architecture, Types, and API Boundaries

- [ ] **Frontend layering:** Follow `Page → Feature Hook → Domain Hook → Service → API Client`; do not place API calls and business orchestration directly in pages.
- [ ] **Large component refactoring:** Split oversized pages/components into focused workflow components, hooks, and utilities. Aim for approximately 300–500 lines where practical; treat 800+ lines as a review threshold, not an automatic requirement to refactor.
- [ ] **Type safety:** Replace `any`, unsafe type assertions, and loosely typed mutation payloads with explicit domain types, DTOs, database query types, and validated API contracts.
- [ ] **Runtime request validation:** Validate important API request payloads at system boundaries with schemas such as Zod or the project's established equivalent.
- [ ] **Runtime response validation:** Validate critical API responses before consuming them in the frontend, especially authentication, patient context, appointment, billing, invoice, and upload responses.
- [ ] **Repository boundaries:** Keep database queries and persistence inside designated repositories rather than accessing models directly from services or frontend components.
- [ ] **Route/API contract verification:** Ensure endpoint paths, methods, payloads, response types, status codes, and error shapes match between frontend and backend.
- [ ] **Query-key consistency:** Include every parameter affecting results in query keys, including filters, pagination, limits, branch, patient, and resource variant as applicable.
- [ ] **Cache invalidation:** Invalidate only keys affected by a mutation and update detail caches directly when safe.
- [ ] **Lookup caching:** Configure suitable cache freshness periods for stable branch, department, doctor, and service lookups.
- [ ] **On-demand fetching:** Fetch modal-specific and tab-specific data only when needed. Remove duplicate and unused requests.
- [ ] **Public catalogue requests:** Reuse cached catalogue data, configure suitable freshness/retry limits, avoid duplicate requests, and fetch only required records.
- [ ] **Query error states:** Distinguish loading, successful empty results, request failures, and populated results. Provide accessible retry actions for recoverable errors.
- [ ] **Route-level code splitting:** Lazy-load independent pages and dashboard modules so users do not download all application features at initial load.
- [ ] **Frontend behavioral tests:** Cover authentication, session restoration, booking redirects, registration recovery, patient switching, document uploads, rescheduling, and form validation as applicable.

## 6. Tables, Lists, and Performance

- [ ] **Shared table styling:** Use shared table tokens/components rather than page-specific visual styles.
- [ ] **Sorting:** Implement predictable sorting and indicate the active sort field/direction.
- [ ] **Pagination:** Use server-side pagination for large datasets; keep page, page size, sort, and filters consistent with the API.
- [ ] **Internal table scrolling:** Keep scrolling within the table/container where appropriate and preserve usable headers and responsive layouts.
- [ ] **Replace arbitrary limits:** Review unnecessary `limit: 100` lookups, full-history in-memory pagination, and other fixed limits that can silently omit records.
- [ ] **N+1 query prevention:** Use suitable aggregation, batching, projections, and indexes to reduce repeated database queries.
- [ ] **Measured performance:** Test with realistic data volumes, MongoDB execution plans, browser network-call counts, and measured API p50/p95 response times.
- [ ] **Loading and empty states:** Avoid showing stale data as current or displaying zero when the actual result is unavailable.
- [ ] **No mock dashboard metrics:** Dashboard operational values must come from authoritative backend calculations.

## 7. Files and Object Storage

- [ ] **Configured storage provider:** Use the configured bucket/object-storage or Azure provider when credentials and deployment configuration are available.
- [ ] **No silent production local-storage fallback:** Do not silently store production uploads on local disk when configured remote storage is required or remote storage fails.
- [ ] **Local development behavior:** Local disk may be used only when explicitly configured and appropriate for the environment.
- [ ] **Storage errors:** Return an accurate user-facing failure when a required storage provider is unavailable.
- [ ] **Metadata/file consistency:** Coordinate metadata writes and file operations through transactions where possible, compensating actions, and orphan cleanup.
- [ ] **Document authorization:** Enforce ownership, patient/visit scope, permissions, content-type/size limits, and safe download behavior.
- [ ] **Document publication:** Do not equate an active uploaded document with an approved patient-portal publication.
- [ ] **Upload testing:** Test failed upload, failed metadata write, replacement, deletion, retries, duplicate requests, and unauthorized download as applicable.

## 8. Clinical Workflow, Scheduling, and Transactions

- [ ] **Appointment concurrency:** Prevent doctor/time/resource double-booking through database-safe reservations or equivalent locking/transaction strategy.
- [ ] **Active OPD uniqueness:** Enforce the approved active-visit invariant atomically and at the database level where possible.
- [ ] **OPD visit atomicity:** Keep visit creation and linked appointment updates consistent within a transaction.
- [ ] **Inpatient transaction enforcement:** Require a transaction-capable MongoDB deployment for multi-document admission workflows. Never silently retry a clinical operation without a transaction when atomicity is required.
- [ ] **Surgery scheduling concurrency:** Prevent concurrent doctor, theatre, and procedure-capacity double-booking through atomic reservations or equivalent database-safe mechanisms.
- [ ] **Surgery bed-hold lifecycle:** Release or replace bed holds idempotently during rescheduling, completion, cancellation, and expiry, including when a hold has already expired.
- [ ] **Expired bed cleanup:** Process all expired bed holds through a reliable scheduled/background cleanup mechanism using bounded batches.
- [ ] **Emergency discharge:** Determine discharge eligibility from authoritative billing and payment status. Do not reject discharge merely because clinical orders exist.
- [ ] **Branch timezone:** Evaluate doctor availability and scheduling rules in the configured branch timezone while storing timestamps consistently in UTC.
- [ ] **Clinical persistence:** Store clinical notes, vitals, and diagnostic orders in authenticated, audited, patient-scoped backend records rather than browser `localStorage`.
- [ ] **Department-scoped mutations:** Recheck authoritative department and scope on every clinical mutation and workflow transition.
- [ ] **Concurrency and idempotency:** Use appropriate unique constraints, atomic updates, optimistic concurrency/version checks, idempotency keys, or transactions where needed.
- [ ] **Failure recovery:** Define rollback or compensation behavior for multi-step patient, appointment, admission, consultation, billing, and document operations.
- [ ] **No silent partial success:** Report and recover partial failures accurately; retries must not duplicate records, charges, or stock movements.

## 9. Clinical and Administrative Data Integrity

- [ ] **Patient creation:** Make patient registration, portal access grants, timeline entries, audit records, and user linking transaction-safe and idempotent.
- [ ] **Patient identity matching:** Use an approved deduplication strategy with appropriate database constraints and safe concurrent-registration handling.
- [ ] **Identifier uniqueness:** Enforce database uniqueness for generated identifiers, not only application-level checks.
- [ ] **Response data minimization:** Return only fields needed by the caller; prevent sensitive fields from leaking through generic model serialization.
- [ ] **Authoritative status:** Validate state transitions and prerequisites on the backend; never trust client-supplied status as proof of authorization or completion.
- [ ] **Audit history:** Preserve required clinical and financial amendment history; metadata-only audit events are not a substitute for required before/after history.
- [ ] **Cross-record consistency:** Verify links between patient, appointment, visit, admission, surgery, emergency, order, result, prescription, invoice, and document records as applicable.
- [ ] **No duplicate source of truth:** Extend existing HMS domains instead of creating parallel patient, diagnosis, diagnostic, pharmacy, billing, or identity systems.

## 10. Testing, Dependencies, Documentation, and Release

- [ ] **Automated regression tests:** Add/run tests for core workflows, authorization, validation, errors, rollback, concurrency, idempotency, and affected existing behavior.
- [ ] **Clinical integration tests:** Test admission transitions, bed assignment, surgery scheduling, emergency disposition, concurrent operations, transaction rollback, and idempotent retries against a transaction-capable MongoDB test environment.
- [ ] **Authorization tests:** Include denied requests for wrong patient, visit, branch, department, organization, role, and assigned resource where applicable.
- [ ] **Runtime schema tests:** Verify important request and response schemas reject malformed data and do not expose sensitive fields.
- [ ] **Dependency installation:** Confirm dependencies install from the committed lockfile and test/lint/typecheck/build commands run in a clean environment.
- [ ] **Dependency security:** Run dependency audits, review reported vulnerabilities, apply compatible updates, and verify lockfile changes and builds.
- [ ] **MongoDB-only architecture:** Keep README, environment examples, deployment instructions, and database setup aligned with the actual MongoDB-only architecture.
- [ ] **Configuration accuracy:** Document required environment variables, storage provider settings, API URLs, CORS origins, session settings, and deployment prerequisites without exposing secrets.
- [ ] **Compilation verification:** Resolve syntax/compilation errors and run required API/frontend typecheck, lint, and build commands before declaring completion.
- [ ] **No false verification claims:** Clearly separate tests executed, tests inspected but not run, blocked tests, mocked tests, and real integration tests.
- [ ] **Performance evidence:** Record workload, dataset size, environment, query plans, network calls, and measured latency when performance is part of acceptance.
- [ ] **Release checklist:** Map approved acceptance criteria to test evidence or explicitly outstanding manual verification.
- [ ] **Documentation updates:** Update relevant README/API/contract documentation when behavior or configuration changes.
- [ ] **Working-tree protection:** Preserve pre-existing user changes; avoid broad formatting, unrelated refactoring, or destructive test operations.

## 11. Additional Authentication and Session Requirements

- [ ] **Password change/reset:** Ensure old sessions cannot remain active merely because revocation failed; define transactional or recoverable behavior.
- [ ] **Refresh-token rotation:** Use atomic single-use rotation, replay detection, token-family revocation where appropriate, and safe concurrent-refresh handling.
- [ ] **Refresh failure:** Stop protected requests when refresh fails; trigger the established session-expiry behavior without retry loops.
- [ ] **Session restoration:** Verify reload, logout, expiry, multi-device sessions, and revoked sessions behave consistently.
- [ ] **OTP delivery:** Return delivery success only when the provider confirms it; surface configuration/provider failures accurately.
- [ ] **Rate limiting:** Protect authentication, OTP, refresh, and password-reset endpoints against brute-force and abuse.
- [ ] **Secure storage:** Do not store refresh tokens or raw OTPs in JavaScript-readable browser storage.
- [ ] **Logging:** Redact authentication secrets and sensitive identity/contact details.

---

## 12. Suggested Pull Request / Task Sign-Off

Use this section for each feature, bug fix, or phase.

### Task information

- [ ] Task and phase identified.
- [ ] Current branch recorded.
- [ ] Initial working-tree state recorded.
- [ ] Existing architecture and ownership boundaries inspected.
- [ ] Dependencies and external contracts identified.
- [ ] Acceptance criteria defined.

### Implementation

- [ ] Error handling and user-friendly messages implemented.
- [ ] API routes, methods, permissions, and schemas verified.
- [ ] Type safety maintained; no new `any` introduced.
- [ ] Layering and repository boundaries followed.
- [ ] Database uniqueness, atomicity, concurrency, and recovery addressed where applicable.
- [ ] Storage and environment configuration verified.
- [ ] Loading, empty, success, unavailable, and error states handled.
- [ ] No fabricated dashboard data or production mock behavior introduced.
- [ ] Only owned/intended files changed.

### Verification

- [ ] Focused tests passed.
- [ ] Relevant regression tests passed.
- [ ] API and frontend typechecks passed.
- [ ] Lint passed.
- [ ] Required builds passed.
- [ ] Security/authorization cases tested where applicable.
- [ ] Failure, retry, concurrency, and rollback cases tested where applicable.
- [ ] Performance evidence collected where required.
- [ ] Tests not run or blocked are listed explicitly.
- [ ] Documentation updated.

### Handoff report

- **Task/phase:**
- **Developer/owner:**
- **Branch:**
- **Files changed:**
- **API/contract version:**
- **Tests executed and results:**
- **Tests not run / blocked:**
- **Dependencies satisfied:**
- **Outstanding decisions/risks:**
- **Regression evidence:**
- **Ready for integration:** READY / READY WITH BLOCKERS / NOT READY

Do not declare the task complete if a required acceptance criterion is unverified. Mark blocked or not applicable items explicitly and explain why.
