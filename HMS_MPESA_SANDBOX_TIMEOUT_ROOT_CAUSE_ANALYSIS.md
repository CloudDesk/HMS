# M-PESA sandbox timeout: evidence-based analysis

Analysis date: 29 October 2026. Scope: investigation only. No application source,
database records, environment configuration or provider requests changed by this
investigation. Existing uncommitted changes were preserved.

## Confirmed conclusion

The corrected HMS attempt and the separate Daraja simulator transaction both
ended in provider ResultCode 1037, not success. The corrected HMS attempt received
a matched timeout callback; its later query confirmed the same terminal result.
The failure is recorded at Safaricom's transaction/customer-reachability stage.
The exact underlying sandbox/handset reason is not established by the API result.

This is distinct from the earlier malformed manual query password, initial wrong
PartyB settings, database connectivity failures and query throttling. Those were
real separate issues but are not evidence of the corrected attempt's cause.

## Evidence from the corrected HMS attempt

Attempt: 97093f0ca1419cdb81c6ced83d2b9df71ee816eefd1f4de675d14554ba76f779

- Environment sandbox; BusinessShortCode 174379; PartyB 174379;
  CustomerPayBillOnline. Saved payer matches portal test number 254708374149.
- Submission started at 2026-10-29T11:23:54.645Z.
- The supplied accepted-submission response was updated at 11:23:58.524Z and
  contained MerchantRequestID/CheckoutRequestID.
- One matching callback was received at 11:23:59.372Z. It is MATCHED and reports
  ResultCode 1037 / TIMEOUT. Both provider identifiers match the saved attempt.
- The callback arrived approximately 4.7 seconds after submission started, before
  manual verification, and approximately 0.85 seconds after the accepted-response
  timestamp. Delayed manual status polling did not cause this recorded timeout.
- At 11:31:58.700Z, the saved query confirmed ResultCode 1037 and the description
  "DS timeout user cannot be reached."
- Verification FAILED; queryOutcome TIMEOUT; recovery RESOLVED; no receipt or
  financial posting. The unpaid invoice and posting rejection were verified in
  the user's acceptance responses.
- Separate direct Daraja query for simulator CheckoutRequestID
  ws_CO_291020261548138708374149 returned HTTP 200, ResponseCode 0, ResultCode 1037.
  That result was produced outside HMS, so HMS cannot be the sole explanation
  for the simulator transaction's timeout.

## Timezone assessment

Both submission and status query generate the timestamp using:

    formatInTimeZone(new Date(), 'Africa/Nairobi', 'yyyyMMddHHmmss')

The same timestamp variable is placed in the request body and the Base64
shortcode/passkey/timestamp password. The machine's local timezone is not used.

For the recorded submission instant:
- UTC: 11:23:54.645
- Nairobi: 14:23:54.645 (+03:00)
- India: 16:53:54.645 (+05:30)

These are the same instant; India's 2.5-hour display difference from Kenya does
not itself explain this attempt's failure. A wrong clock or a mismatched manual
password/timestamp can cause request authentication errors, but there is no
evidence of that causing this terminal 1037. The user corrected their manual
password/timestamp and obtained a valid query response containing 1037.

## Why receiving an API response does not prove payment success

1. OAuth success establishes app-token authentication, not customer payment.
2. STK ResponseCode 0 acknowledges acceptance for asynchronous processing.
3. A callback/query ResultCode establishes the transaction outcome: 0 success,
   1037 timeout in the supplied evidence.
4. HTTP 200 on a query establishes successful status retrieval, which may return
   the status of an unsuccessful payment.

Invalid credentials also produce API responses. The user supplied an HTTP 500
JSON error with code 500.001.1001 and message Wrong credentials during an earlier
manual query. Therefore "an API response exists" does not rule out authentication
errors generally. The later valid query's terminal result is the relevant evidence.

## Separate confirmed HMS classification defect

At the time of this investigation, mpesa-daraja.client.ts returned PENDING when either the error message
contains "being processed" OR errorCode equals 500.001.1001. Safaricom documents
that code for multiple errors, and the user's direct query demonstrated it with
Wrong credentials. Code-only matching can thus mislabel errors as processing.

This explains why earlier PENDING statuses were not conclusive evidence of a
customer approving payment. It does not create or explain away the corrected
attempt's matched terminal 1037 callback and independently confirmed query.
No classification code was changed during this analysis.

Subsequent authorized correction: see HMS_MPESA_QUERY_FRONTEND_VERIFICATION.md.
The code-only PENDING classification is now removed and covered by regression
tests. This correction does not change the recorded provider 1037 evidence.

Also, submissionState PENDING retains the initial accepted-submission state;
it is not the final financial outcome. On the terminal attempt, reportedOutcome
TIMEOUT + verificationStatus FAILED + recoveryStatus RESOLVED are decisive.

## What is still unknown / how to establish the underlying cause

We do not have evidence that the payer handset received an STK prompt or that
the current sandbox provisions a successful completion path for the portal test
number. A supported test-number/simulator scenario, handset reachability or
downstream sandbox routing could explain the result. These are hypotheses,
not established diagnoses such as "SIM switched off" or "sandbox outage".

Determine whether the number is a controlled active Safaricom handset or only
the portal sample. If a controlled handset is involved, record whether a prompt
arrived and what happened when it was answered. If it is only portal sample
data, obtain the currently supported successful sandbox completion procedure
from Safaricom. Provide CheckoutRequestID and timestamp for provider-side trace.

Source: https://developer.safaricom.co.ke/apis/MpesaExpressSimulate
(asynchronous sequence, request/password definition, multiple error-code meanings
and support options). Exact carrier/sandbox internal root cause requires the
provider's trace; the existing evidence is insufficient to claim it.
