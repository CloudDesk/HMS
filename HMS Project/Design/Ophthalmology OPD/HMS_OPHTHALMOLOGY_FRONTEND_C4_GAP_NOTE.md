# Ophthalmology C4 Completion Frontend Gap Note

## Scope

C4 implements the staff completion UI against backend contract v1.12.0 and stops before C5. It does not change backend behavior or begin publication work.

## Reusable implementation

- Existing Ophthalmology workspace completion area, readiness/history API, TanStack Query hooks, exception dialogs, permission helpers, URL state, Sonner feedback and draft guard.
- Existing clinical-review and optical Zod schemas and live source projections.
- HMS Local OPD consultation patterns: patient header, compact cards/tables, explicit status text, sticky/compact action hierarchy and confirmation dialogs.

## Missing C4 contract usage

- The frontend does not read the v1.12.0 safe summary projection.
- It has no complete, reopen, source-correction or reapproval clients/mutations.
- Its finalization parser still expects legacy arbitrary before/after amendment values.
- Mandatory missing-code resources are rejected because readiness currently treats every resource ID as a MongoDB ObjectId.
- The completion page still displays the pre-C3 message that final approval and correction are unavailable.

## Intended changes

- Update the completion API schemas for safe summary/history and typed correction commands.
- Add gated summary/history/readiness queries and targeted mutation invalidation.
- Add completion, reopen, consultation correction, clinical-review correction and optical-prescription correction dialogs using React Hook Form and Zod.
- Preserve exact versions and one stable idempotency key per completion attempt.
- Show safe current summary, explicit lifecycle/history, loading/empty/error/conflict states, confirmation prompts and permission-gated actions.
- Add focused API, feature-hook and component verification.

## Stop gate

Run C4-focused tests plus required web/API checks, update contract/reconciliation/prompt status and add the C4 verification note. Stop before C5.
