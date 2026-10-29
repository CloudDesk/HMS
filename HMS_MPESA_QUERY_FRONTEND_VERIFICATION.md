# M-PESA query classification and frontend recovery verification

29 October 2026. Branch DEV-GENERAL. Local changes only.

## Implemented

1. Daraja query classification now requires the known error code AND the explicit
   processing description, without a terminal ResultCode, on HTTP 200/500.
   Credential/merchant/lock errors, throttling and ambiguous transport responses
   stay UNKNOWN. Terminal 0/1032/1037 mapping is preserved; no automatic resend.
2. Frontend attempt and exception lists consume items/total/page/limit after
   runtime Zod validation. Malformed lists produce an error, not an empty queue.
   Payment lookup retains the backend payment/invoice pair.
3. The payment modal retrieves the latest invoice attempt before enabling new
   creation. Closing/reopening can resume a saved attempt. Exception links select
   the exact historical attempt, including for non-payable invoices. Returned
   invoice identity is checked before actions. Existing CREATED attempts require
   an explicit submit with their saved version; UNKNOWN/SUBMITTING never resend.
4. Review/abandoned/conflict states block new attempts and posting. A callback-only
   failure does not offer retry. Verified terminal failure or explicit submission
   rejection permits a new attempt through the existing backend. Partial posted
   payments may start a new attempt for the remaining balance.
5. Polling defaults to a 20-response bound, stops on errors/review/terminal states,
   and provides explicit saved-status refresh. Recovery and next reconciliation
   due are visible. Collection actions require the parent's billing capability;
   the backend continues enforcing authentication, permissions, branch scope,
   trusted evidence, versions, transactions and audit.
6. Exception pagination uses mpesaExceptionsPage in the URL and preserves other
   parameters. Posting invalidates every cached exception page and invoice-attempt
   history. Empty/error messages do not imply all payments succeeded.

## Existing functionality reused / files

Reused Daraja fetch client, backend DTOs/routes, billing capability evaluation,
API envelope, M-PESA services, TanStack Query/cache, billing Modal/alerts/tables,
date formatting, phone masking and Sonner. HMS Local billing modal/table patterns
were inspected; no new visual system or prototype edits.

Backend: mpesa-daraja.client.ts and its tests only for this correction.
Frontend: api/mpesa.ts; hooks/billing/useMpesa.ts and tests; the payment and
exception modals and tests; utils/mpesa-recovery.ts. Shared page edit:
BillingWorkspacePage.tsx passes capability and validated attempt context, opens
the requested review and clears its URL parameter on dismiss.
Documentation: gap note, this report, phase-plan tracking, historical timeout
analysis clarification. Earlier diagnostic changes already in the working tree
were preserved and are not attributed to this correction.

## Automated verification

- Backend M-PESA/config suites: 277 tests passed across 9 files, including 11
  query-classification regressions. Isolated MongoMemoryReplSet databases and
  synthetic Daraja transport; no application database or real provider requests.
- Frontend M-PESA suites: 41 tests passed across 4 files. Includes real frontend
  API-envelope parsing with synthetic fetch, exception pagination/navigation,
  historical selection/context mismatch, permission gating, explicit saved submit,
  uncertain no-resend, callback-only no-retry, polling bound/manual refresh and
  invalidation of cached exception pages. Earlier render-only assertions were
  replaced with actual status/action assertions.
- API and web typecheck/build pass; focused lint and git diff --check pass.
- Full lint retains unrelated baseline errors: API 42 in insurance.repository.ts,
  insurance.service.ts and insurance.test.ts; web 5 in PatientAvatar.test.tsx:8,
  AuthenticatedMediaImage.tsx:32, PatientCardModal.tsx:3,
  PatientProfileHeader.tsx:3 and PatientProfilePage.tsx:27. The old unused M-PESA
  test import and a newly unused hook import were removed; phase-owned files pass.

## Manual/deployment boundary

Live browser acceptance with authenticated staff, logout/login, responsive visual
inspection, and genuine provider success/posting were not exercised here. DOM
tests are not represented as live browser or Daraja acceptance. No credentials,
environment settings, application records, index definitions, financial posting
rules, deployments, commits or pushes were changed by this correction.

Safaricom's 1037 remains a separate provider test-scenario issue. Refunds/disputed
funds, historical repair and production readiness remain separate dependencies.
The authorized corrections are implemented and automatically verified; release
acceptance remains open. No next feature phase has started.
