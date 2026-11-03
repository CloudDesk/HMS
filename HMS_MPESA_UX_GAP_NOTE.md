# M-PESA billing UX correction — 3 November 2026

Authorized scope: amount validation, clear payment outcome/actions, customer PIN
instructions, supervisor guidance, readable exception identifiers and responsive
layout, with regression tests. No change to verification/retry/posting eligibility,
provider requests, clinical contracts, credentials, records or deployment.

Sources: PROJECT_RULES.md; phase plan and prior approved billing/M-PESA contracts;
Developer 1/FSD integration intent already inspected in this chat; current billing
page, modal/hooks, DTOs, backend scoped repositories/services; HMS Local billing
workspace/module modal, alert, compact table and footer patterns (read only).

Reuse existing recovery eligibility, API/client/domain hooks, billing form/schema,
shared Modal, CSS and transactional backend. Preserve pre-existing modal and hook
edits (auto-submit handoff and manual refresh feedback/backoff).

Gaps: decimal values silently floored in both entry routes; competing raw status
fields; unclear refresh versus provider query; prompt delivery implied by request
acceptance; technical exception codes without action; shortened database IDs and
wide tables; fixed two-column transaction details and crowded footer.

Intended files: web M-PESA presentation helper/tests, payment and exception modals,
billing page/schema and CSS; optional invoiceNumber DTO on exceptions, backed by
one bounded branch-scoped invoice-number query in BillingRepository, without N+1
requests or a new financial operation. Extend existing integration and UI tests.
Document final checks and browser/manual limitations separately; no next phase.
