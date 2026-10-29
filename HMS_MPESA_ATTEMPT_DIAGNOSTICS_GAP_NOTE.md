# M-PESA attempt creation diagnostics — 29 October 2026

The supplied Render request returned MPESA_ATTEMPT_UNAVAILABLE, while the invoice
GET succeeded with PENDING status and KES 1 balance. The deterministic sandbox
attempt GET returned MPESA_ATTEMPT_NOT_FOUND. Render logs contain only the generic
code, so the underlying create failure is not yet established. Do not claim an
index/configuration fix, change the UUID, bypass transactions or erase records.

Reuse the existing create service, AppError response, route logger, repository,
permissions and isolated integration fixture. Add fixed creation-stage and
allowlisted failure-category diagnostics to server logs only. Preserve MongoDB
transaction retries by classifying errors after withTransaction returns/throws.
Never log raw messages, stacks, causes, database URIs, index key values, payloads,
tokens or patient/payment data. Keep API codes and authorization behavior.

Intended files: domain diagnostic error/helper, creation service, attempt route,
focused unit/integration tests and verification note. No frontend, prototype,
database/index changes, live financial writes, deployment or next-phase work.
The clinical FSD/phase contracts are unaffected by this observability correction.
The next deployed retry and its sanitized log are still required to diagnose the
actual Render fault.

Execution: server-only diagnostic patch implemented. Full M-PESA/config suite
passes 239 tests (26 new diagnostic regressions); API/web typecheck and build,
focused lint and whitespace checks pass. Full project lint retains 48 unrelated
baseline errors. See HMS_MPESA_ATTEMPT_DIAGNOSTICS_VERIFICATION.md. The original
deployed failure is still unclassified; no live repair/deployment or next phase
has been performed.
