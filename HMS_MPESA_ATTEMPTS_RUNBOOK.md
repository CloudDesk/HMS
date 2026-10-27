# M-PESA invoice attempts: sandbox testing

## What is implemented

The backend can create an invoice-linked attempt, send an STK request, store its
provider identifiers and correlate callbacks. Callback success is a **reported**
outcome only. Verification always remains `UNVERIFIED`, posting `DISABLED`.
Invoices and billing payment records are not financially updated.

## Configure the backend

Use a test database with replica-set/Atlas transaction support and capacity for
the new `mpesa_payment_attempts` collection. Do not delete empty collections to
make room without reviewing their application dependencies. Ensure its unique
indexes exist before testing: active invoice/environment and checkout/environment.

Set these in the backend's environment/secret manager, never frontend VITE values
or a committed file. Outbound calls are disabled unless explicitly enabled.

```dotenv
MPESA_STK_ENABLED=true
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=<sandbox app consumer key>
MPESA_CONSUMER_SECRET=<sandbox app consumer secret>
MPESA_PASSKEY=<sandbox express passkey>
MPESA_BUSINESS_SHORT_CODE=<sandbox business shortcode>
MPESA_PARTY_B=<sandbox receiving shortcode>
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline
MPESA_CALLBACK_URL=https://<public-test-host>/api/payments/mpesa/callback
MPESA_BRANCH_IDS=<authorized HMS branch ObjectId>
```

Use matching Daraja sandbox merchant credentials. Multiple branch IDs are comma
separated and authorize those branches for this one merchant. Restart the API
after configuration changes. The callback URL must be HTTPS with the exact path
shown and no query parameters. Safaricom cannot reach localhost directly; route
the public test host to the local API or use an HTTPS test deployment.

## Postman sequence

Use the Desktop Agent for localhost, a valid **HMS staff access token** in Bearer
authorization, and `Content-Type: application/json`. This token is different from
the Daraja token: HMS obtains the Daraja token internally. Staff need existing
Billing / Invoices / CollectPayment permission; reading needs View permission.
Use an existing PENDING or PARTIALLY_PAID invoice in the authorized branch with
sufficient outstanding balance. This integration accepts whole KES amounts only.

1. **Create:** `POST http://localhost:4000/api/billing/invoices/<invoiceId>/mpesa-attempts`

   ```json
   {
     "amount": 1,
     "payerPhone": "254700000001",
     "idempotencyKey": "527a6e17-d79f-4c11-8f58-ea1092e81158"
   }
   ```

   Replace the phone with your configured sandbox test number. Generate a fresh
   UUID for a new logical attempt, and retain the same UUID/body on network retry.
   Save `data.id` and `data.version` (initially 0). Repeating the same request
   returns the same attempt; changing its amount/phone with the same key fails.
   Different keys cannot create another unresolved attempt for this invoice.

2. **Submit:** `POST http://localhost:4000/api/payments/mpesa/attempts/<attemptId>/submit`

   ```json
   { "expectedVersion": 0 }
   ```

   On acceptance, expect submissionState PENDING and saved merchantRequestId and
   checkoutRequestId. A callback may already have changed the reportedOutcome and
   version before this response arrives. Never reuse an old version to resend.

3. **Read:** `GET http://localhost:4000/api/payments/mpesa/attempts/<attemptId>`

   Follow the reportedOutcome; pending is not proof of payment. Sandbox behavior
   does not establish real-money collection. A manually posted synthetic callback
   tests correlation only: use the **saved exact IDs**, amount and phone. The old
   `synthetic-checkout-001` callback will remain unmatched for real attempts.

4. **Recover correlation if needed:**
   `POST http://localhost:4000/api/payments/mpesa/attempts/<attemptId>/correlate`
   with an empty body. This processes up to 100 saved unmatched events for that
   attempt. It does not submit another STK request or verify payment. Repeat only
   if more retained events need processing.

## Outcomes and operational handling

| State | Meaning / action |
| --- | --- |
| CREATED | Saved, not yet submitted. Submit once with current version. |
| SUBMITTING | Claimed for submission. If stuck after a crash, investigate; do not resend. |
| PENDING | Daraja accepted the request and IDs were stored. Await callback. |
| UNKNOWN | Acceptance is uncertain (timeout/ambiguous response). Keep locked for reconciliation. |
| REJECTED | Definite rejection or no-send failure. Fix the cause; a new key may create a fresh attempt. |

Reported outcomes are independently PENDING, SUCCESS, FAILED, CANCELLED or TIMEOUT.
Even a reported failure does not release the unresolved-attempt lock. Only trusted
verification/reconciliation in the next implementation should resolve it.
Callbacks are preserved as UNMATCHED, MATCHED or CONFLICT. A mismatch never
overwrites an established outcome. Merchant ID, amount, supplied payer details,
invoice state and later contradictory outcomes are checked. Environment is part
of matching, so do not switch sandbox/production on an instance with in-flight
callbacks; use separate environments/deployments and test data.

503 means inspect the persisted attempt before deciding what to do. Never
manually clear the active lock or assign guessed provider IDs after an ambiguous
submission. There is no automatic retry, query verification or reconciliation UI
in this scope. No credentials, actual STK calls or production deployment were
performed during automated testing.

## Manual acceptance still required

- Test using authorized and unauthorized staff in the actual test deployment.
- Create and submit against a real test invoice; verify the IDs persist after API
  restart and after logging out/in, without sending another STK request.
- Confirm the public callback reaches the application and the exact attempt.
- Confirm duplicate callbacks cause no duplicate audit/financial posting; use
  synthetic conflict cases only in isolated test data.
- Confirm invoice paid/balance totals and billing payment counts remain unchanged.
- Before production: implement and approve trusted verification/reconciliation
  and financial posting separately. This phase is not a production payment go-live.

Provider reference: [Daraja M-PESA Express](https://developer.safaricom.co.ke/apis/MpesaExpressSimulate).
