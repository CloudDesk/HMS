# M-PESA query classification and frontend recovery correction

29 October 2026. Authorized order: query classification, then frontend contracts.
This is a narrow correction, not a clinical release phase or a payment-policy change.

Sources inspected: PROJECT_RULES.md; phase execution plan; Developer 1 prompt
and release FSD (existing billing integration remains authoritative); current
M-PESA client, routes, services, repositories, frontend API/service/hooks/modals;
HMS Local billing workspace/module modal, alert and table patterns.

Reuse the existing Daraja transport, repository/service verification and posting
guards, API envelope, TanStack Query cache, billing modal/table and Sonner patterns.
Do not change the prototype, credentials, database records, ledger rules or deploy.

Confirmed gaps:
- Code 500.001.1001 alone incorrectly means PENDING. Require an explicit known
  processing response; other query errors remain UNKNOWN, never payment failure.
- Attempt/exception lists return items/total/page/limit; frontend expects
  data/pagination. Payment lookup also returns payment/invoice, not payment alone.
- Recovery/manual-review status must take priority over verified presentation.
  Unverified callback failures cannot authorize a new attempt. Bounded polling
  must stop for review states, and exhausted polling must allow explicit refresh.
- Existing attempts must be discoverable on reopening an invoice; list failures
  must not silently present a fresh payment form. No automatic resubmission.

Intended files: Daraja client/tests; web M-PESA API/service/hooks, payment and
exception modals/tests; this note, verification report and phase plan tracking.
Tests will use synthetic transport/HTTP responses and isolated test databases.
Provider success acceptance, refunds/dispute resolution, production setup and
unrelated baseline lint defects remain separate.
