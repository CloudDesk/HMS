# C1/H11 bounded security follow-up — 2026-10-13

Status: **partially remediated; C1 and H11 remain open**. No production reads/writes, migration, deployment, new queue or relationship policy were introduced.

## Confirmed causes and bounded changes

- Notification grant queries used VERIFIED without revokedAt; grant-derived users were not filtered for active/non-deleted accounts. Added revokedAt:null and active-account filtering to proactive recipients and lazy reconciliation. Recipient IDs remain deduplicated.
- Historical notification listing/counting and mark-read used recipient identity/role without current patient access. They now require current patient access for portal users and patient/guardian-directed notifications. Inactive accounts fail closed. Unrelated generic notifications and authorized staff broadcasts remain available.
- Role matching could expose a notification addressed to another individual sharing the same role. Role broadcast matching now requires recipientUserId:null.
- Targeted patient createNotification calls check current access, including dental quotation notifications. Proactive pushes recheck current access before dispatch. The existing push service uses generic non-PHI titles/bodies. Revocation racing an already dispatched request cannot retract that delivery; this is not an atomic revocation/delivery guarantee.
- Dental quotation list/detail and stage access now require revokedAt:null on grants. Quotation recipient grant enumeration also excludes revoked timestamps. Direct self-patient mappings remain independent authorization; revoking a dependent grant does not revoke self-access.
- Grant schema defaults to PENDING rather than implicitly VERIFIED. ensureAccessGrant only updates an existing VERIFIED/non-revoked matching relationship; pending/rejected/revoked rows collide with the existing unique user/patient key and return the existing relationship-conflict response instead of being promoted/reactivated. New grants created by existing explicit activation paths remain governed by those paths; this does not certify their relationship evidence.
- Bulk insert catches suppress only duplicate-only failures, rejecting mixed errors, non-duplicate top-level codes and explicit write-concern errors. Proactive insert attempts preallocate IDs and recover only successfully persisted rows from that attempt after duplicate-only failures; competing rows are not resent. Transaction-session errors propagate rather than querying an aborted transaction.
- Repository failures remain observable to callers. notifyPatient contains failures at the side-effect boundary and emits fixed text without IDs, payloads or error details; it explicitly does not claim a queued retry. Clinical/billing operations retain their non-blocking notification behavior.

## Grant lifecycle and unresolved legacy evidence

Consumers inspected: patient-portal repository context/listAccessiblePatients/resolveAccessiblePatientId/primary selection and provisioning checks; requestDependentAccess and ensureAccessGrant; explicit portal registration/guardian activation; notifications recipient/read/sync paths; dental quotation list/detail/send and dental stage list. Protected portal profile/document/photo/invoice services use current access resolution. Existing C1 endpoint tests exercise continued-token denial after status changes.

Schema statuses are PENDING, VERIFIED, REJECTED, REVOKED. There is no grant expiration field/status or approved expiration policy. No expiration policy was invented. Pending requests from identifier/DOB matching remain insert-only, generic-response and rate-limited. No approval endpoint, approved reviewer permission or durable relationship-evidence contract exists. Request rate limits, generic responses and audit calls were preserved.

Legacy VERIFIED/non-revoked grants still cannot be distinguished reliably from legitimately approved grants: verifiedBy/verifiedAt do not prove independently verified authority. **Legacy bypass is not resolved or tested as safe.** This pass did not mass-disable, silently reapprove or migrate them. Required follow-up: approved evidence/verification contract, restricted provenance audit, owner-approved per-record disposition and migration, and tests using that approved contract. See the existing C1 follow-up for the controlled audit procedure. Pending/rejected/revoked legacy rows now cannot be promoted by ensureAccessGrant.

Patient-linked legacy notifications with missing patientId cannot be reliably attributed to a patient for revocation filtering; generic notifications are preserved. Previously delivered content/browser caches and independent direct patient mappings remain separate risks. Full dental endpoint revocation/concurrent delivery tests remain outstanding.

## Invoice coverage

Inspected all createInvoice call sites and BillingService create/update/cancel/collectPayment paths:

- Ordinary invoice creation and accepted dental quotation creation already notify after awaited transaction completion.
- Added pending-invoice helper after dental treatment invoice transaction/duplicate-race recovery and after editable invoice update transaction. These use the existing positive-balance + PENDING/PARTIALLY_PAID guard; paid, cancelled, draft and zero-balance results are excluded.
- Procedure-booking invoice creation accepts a caller-owned session; pharmacy dispensing creates invoices through BillingRepository inside its own transaction. No unsafe pre-commit notification hook was added. Both require caller-owned post-commit integration and dedicated tests.
- Partial-payment/state changes and externally written invoices are not fully covered by proactive triggers. Lazy reconciliation remains a fallback, not durable delivery.
- No new hook was added inside a transaction. Invoice number/balance fields already present in messages were not expanded; no new PHI was added.

The existing proactive suite's invoice test calls notifyPatient directly. Passing that suite does **not** prove the new dental/update hooks' post-commit timing. Billing integration regression tests are separate from comprehensive notification-trigger/rollback tests. All-path notification coverage remains open.

## Delivery/retry limitations

No existing transactional outbox/durable notification retry mechanism was found. Notification rows deduplicate recipient/type/entity, but an insertion failure can lose an event; push failure after insertion is not retried because repeated triggers find an existing row. A mixed bulk failure may retain successful database rows while suppressing that attempt's push at the service boundary. Consent persistence/timeline/audit are not one atomic unit, so an intermediate failure can prevent dispatch after a document was saved.

Smallest follow-up needs an approved Mongo-backed delivery/event lifecycle using existing database infrastructure: transactionally persist an intent where the business operation has a transaction, dispatch after commit with current authorization checks, conditional claiming, bounded backoff, attempt/result state, deduplication and operational visibility. Define standalone guarantees explicitly. No new infrastructure or exactly-once guarantee was introduced here.

## Files changed

- notifications/notification.repository.ts and notification.service.ts
- patient-portal/patient-access-grant.model.ts and patient-portal.repository.ts
- opd/dental-quotation.service.ts and dental-stage.service.ts (revokedAt predicates only)
- billing/billing.service.ts (two post-transaction hooks)
- test/notification-revocation-security.test.ts (new)
- this report

## Validation

New repository-backed tests cover pending/rejected/revoked grants; VERIFIED plus revokedAt; historical list/count/mark-read and portal destination resolution; inactive accounts; targeted-role isolation; pending schema default and no activation of pending/revoked grants; duplicate-only/mixed/non-duplicate errors; repeated-trigger deduplication; and the non-blocking service boundary. All fixtures are synthetic and use disposable MongoDB.

Initial new-test run failed because the fixture omitted required user email; the fixture was corrected without weakening assertions. The other four focused suites passed 47 tests (dependent-link security, proactive notifications, synchronization performance and notification endpoint authorization). The corrected security suite plus billing-integration and patient-atomic-signup completed successfully: 3 files, 26 tests passed. Thus 73 distinct tests passed across seven files, with the initial fixture failure disclosed. API typecheck and git diff --check passed. No full suite, browser acceptance, production migration, or live delivery test was run.

## Guardrails

Branch remains Dev-F-Release-5-Clone. Prior modifications to four touched files were extended in place; all other pre-existing modified/untracked files were hash-checked against the initial snapshot. No commit, push, reset, stash, revert, clean, branch switch or production modification. H12/H13 and unrelated remediation were not started.
