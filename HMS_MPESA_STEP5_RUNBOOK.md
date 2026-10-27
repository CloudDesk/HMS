# HMS M-PESA Step 5 callback runbook

## What this implements

`POST /api/payments/mpesa/callback` accepts a reported provider result, validates
it, and durably records it in `mpesa_callback_events`. It does not initiate STK
requests, query Safaricom, verify payment authenticity, or post invoice payments.
All accepted events remain `UNMATCHED` and `UNVERIFIED` because HMS currently has
no originating M-PESA attempt model. A successful HTTP acknowledgment means
receipt/storage only, not financial success.

No existing billing, patient, advance-payment, insurance, frontend, or permission
contracts were changed. The shared MongoDB rate limiter has a narrow concurrent
bucket-creation retry, tested alongside existing authentication behavior.

## Configuration (phase 7)

API development configuration is `apps/api/.env.dev`; its current PORT is 4000.
Do not copy production database credentials into a test environment.

Optional settings (defaults shown):

```dotenv
MPESA_ENVIRONMENT=sandbox
MPESA_CALLBACK_PER_IP_LIMIT=120
MPESA_CALLBACK_GLOBAL_LIMIT=600
```

Limits are requests per fixed 60-second window, distributed through existing
MongoDB rate-limit buckets. Invalid settings fail startup. Choose higher limits
only after measuring expected provider traffic. Incoming requests do not choose
the environment; it is a deployment label, not evidence of provider authenticity.

No new secret is required. Existing MongoDB and application configuration remain
required. `MPESA_CALLBACK_URL` is deliberately not added: the receiver does not
consume it. Enter the URL in the outgoing Postman STK request's `CallBackURL`.
Future outbound integration will need securely configured names such as
`MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`,
`MPESA_BUSINESS_SHORT_CODE`, and `MPESA_CALLBACK_URL`. These are not used here.

The route is registered in production too, but remains intake-only. Do not
interpret `MPESA_ENVIRONMENT=production` as enabling financial posting.

## Start locally (phase 9)

1. Use a development MongoDB database and existing application settings.
2. From the repository root run `npm run dev:api`.
3. Confirm the existing server startup reports a database connection and listener.
   The existing server also seeds/configures data and refreshes dashboard data;
   use only your approved development database for this command.
4. In Postman choose POST, No Auth, `Content-Type: application/json`, raw JSON.
5. Send to `http://localhost:4000/api/payments/mpesa/callback` (replace port if changed).

Synthetic success claim:

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "synthetic-merchant-001",
      "CheckoutRequestID": "synthetic-checkout-001",
      "ResultCode": 0,
      "ResultDesc": "Synthetic local test only",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 1 },
          { "Name": "MpesaReceiptNumber", "Value": "TESTONLY001" },
          { "Name": "TransactionDate", "Value": 20261026150000 },
          { "Name": "PhoneNumber", "Value": 254700000001 }
        ]
      }
    }
  }
}
```

Expected HTTP 200, after durable storage:

```json
{ "data": { "received": true } }
```

Synthetic cancellation (same acknowledgment; no metadata required):

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "synthetic-merchant-002",
      "CheckoutRequestID": "synthetic-checkout-002",
      "ResultCode": 1032,
      "ResultDesc": "Synthetic cancellation test"
    }
  }
}
```

Use 1037 to test reported TIMEOUT, or another nonzero code to test FAILED.
Missing metadata, even on success, is accepted as incomplete unverified evidence.
Known metadata with invalid types, duplicate metadata names, unknown envelope
properties, missing identifiers/result fields, and malformed JSON are rejected.
Unknown bounded metadata names are accepted but not stored. Metadata order does
not matter. Provider transaction dates are retained as 14-digit local strings;
they are not incorrectly converted using the server timezone.

Error responses use the existing HMS envelope, for example:

```json
{
  "error": {
    "code": "MPESA_CALLBACK_INVALID",
    "message": "Invalid M-PESA callback payload",
    "requestId": "req-example"
  }
}
```

| HTTP | Meaning |
|---|---|
| 200 | Event stored (or identical event already stored) |
| 400 | Invalid payload / malformed JSON |
| 413 | Body exceeds 16 KiB |
| 415 | Unsupported content type |
| 429 | Rate limit; Retry-After: 60 |
| 503 | Persistence/limiter unavailable; Retry-After: 60 |

Do not assume Safaricom automatically retries every non-200 response. Capture
tracking IDs from Postman and use provider status tools when a callback is missing.

## Verify persistence

Using MongoDB Compass against the development database, open
`mpesa_callback_events`. Filter with:

```json
{ "environment": "sandbox", "checkoutRequestId": "synthetic-checkout-001" }
```

Confirm reportedOutcome=SUCCESS, processingStatus=UNMATCHED,
verificationStatus=UNVERIFIED and financialPostingEnabled=false. Re-send the
identical payload (including with reversed metadata order): there remains one
event and its receivedAt is unchanged. Change the reported outcome or amount:
there is a distinct immutable event; the original is preserved. This avoids
unverified first-arrival claims suppressing later evidence.

Check invoice balance/status and existing payments are unchanged. A manually
entered billing reference matching CheckoutRequestID must not establish a match.

The `_id` is a canonical payload SHA-256 fingerprint, including environment,
merchant/checkout IDs, result and sorted metadata. MongoDB's built-in unique
`_id` index protects concurrency independently of secondary index creation.
Indexes support environment+checkout+receivedAt, environment+status+receivedAt,
and environment+receipt. Receipt claims are deliberately not unique.

Database writes request majority acknowledgment and journaling with a bounded
write-concern timeout. Exact repeats are atomic upserts that do not modify the
original document. There are no multi-document financial mutations.

## Public HTTPS sandbox check (phase 10)

1. Keep the API running against your development database.
2. Use an approved deployed development host, or start an installed/configured
   tunnel: `ngrok http 4000`.
3. Set the outgoing STK request's `CallBackURL` to
   `https://<public-development-host>/api/payments/mpesa/callback`.
4. Send the synthetic test through the HTTPS address first. Confirm HTTP 200
   and a stored event. A reachable frontend is not proof the callback route works.
5. In your existing Postman sandbox collection, generate a valid token and send
   a fresh STK request with the new URL. Do not use an old checkout expecting its
   callback destination to change. Keep the CheckoutRequestID and MerchantRequestID.
6. Observe safe API request/status logs. No body, phone or raw database errors
   should be logged. Compare the checkout ID in Compass to Postman privately.
7. Confirm the received event remains UNMATCHED/UNVERIFIED and no invoice changes.
8. If missing, check tunnel availability, actual path/method, TLS, reverse-proxy
   routing and firewall/WAF responses; use your tested provider status query.
9. Stop the tunnel after testing. Its URL may change on restart.

Do not change TRUST_PROXY to unrestricted true. If a proxy is used, configure
only its trusted addresses using the existing HMS setting. Apply upstream body
and rate limits too. HTTPS tunnels expose a port, not just this route; restrict
the public ingress to the callback path wherever your deployment permits it.

## Privacy, audit and remaining controls

- No public event-list API. Operator inspection requires existing restricted DB
  administration access. No branch is inferred from untrusted callback data.
- The persisted event is receipt evidence, not a verified financial audit event.
- Phone is excluded from default Mongoose selections. DB administrators can
  still read it; this is not field encryption. Use existing encrypted transport,
  deployment encryption-at-rest, restricted credentials and backup controls.
- No full raw payload is retained. ResultDesc is untrusted bounded text; never
  render it as HTML in a future admin UI.
- No new retention period is invented. Finance/security must approve retention
  and cleanup before production-volume intake; events do not auto-expire.
- Correlation is not authentication. This implementation assumes no signature.
  Step 6 must add the approved originating-attempt contract, exact provider ID
  matching, merchant/environment/amount checks, trusted server-to-server
  verification, conflict review and authorized transactional billing posting.
- PENDING/UNKNOWN are attempt states, not new states for the existing billing
  ledger. This receiver records only the reported outcomes supplied by callbacks.
- No refund, reversal, manual matching mutation or successful-payment posting is
  exposed by this slice.

## Automated verification

```powershell
npm run test --workspace=@hms/api -- src/modules/mpesa/mpesa-callback.test.ts src/modules/mpesa/mpesa-callback.integration.test.ts
npm run typecheck --workspace=@hms/api
npm run lint --workspace=@hms/api
npm run build --workspace=@hms/api
npm run typecheck --workspace=@hms/web
npm run lint --workspace=@hms/web
npm run build --workspace=@hms/web
```

Integration tests use isolated MongoDB via mongodb-memory-server, synthetic
records and a real local HTTP listener. They never call Safaricom. Actual
Postman/tunnel/provider verification is a separate acceptance step and must not
be claimed from these automated tests.
