# M-PESA index diagnostic refinement — 29 October 2026

User supplied native index metadata contains both required unique constraints.
The repository readiness check also passed locally against the configured
HMS_GENERAL connection on Node 22.19.0 and Node 26.12.1 with autoCreate/autoIndex
disabled and createIndexes replaced by a throwing guard. No live index writes
occurred. This does not prove Render uses the identical URI/credentials.

Render still reports INDEX_INITIALIZATION / UNCLASSIFIED. The diagnostic currently
drops every numeric database code outside a short allowlist and omits most fixed
error classes, preventing diagnosis. Do not infer Node incompatibility, missing
indexes or an index repair from this evidence.

Refine server-only diagnostics: separate index inspection and build stages;
classify fixed Mongoose/driver/JavaScript names; preserve bounded numeric codes
only for actual MongoServerError instances; mark diagnostic schema version 2 in
logs. Continue excluding raw errors, messages, stacks, causes, URIs, tokens,
payloads and document/key values. Preserve public codes/envelopes, transaction
behavior, index constraints, scope and permissions.

Reuse existing AppError subclass, repository error boundary, route logger and
synthetic/ephemeral MongoDB tests. Intended files: attempt-error/helper tests,
attempt repository/integration tests, route logger, plan and verification note.
No clinical/FSD/UI/prototype, index-definition, credential or deployment changes.

Execution: diagnostic refinement implemented with 70 focused tests passing,
including 18 new cases. API/web typecheck/build, focused lint and whitespace
checks pass; full lint retains the 48 unchanged-file baseline errors. Details and
remaining Render evidence are in HMS_MPESA_INDEX_DIAGNOSTICS_VERIFICATION.md.
The deployed cause remains unresolved; no next feature phase started.
