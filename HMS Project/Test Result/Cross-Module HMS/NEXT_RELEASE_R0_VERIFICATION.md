# HMS Next Release R0 Verification

## Result

**Phase:** R0 - Shared Contracts, Permissions, and State Design  
**Status:** Completed  
**Verified:** 18 August 2026

## Verification Performed

- Reviewed `PROJECT_RULES.md` before implementation.
- Verified existing model → repository → service → route architecture.
- Verified existing frontend feature/domain/API separation requirements.
- Verified the current `(module, screen, action)` RBAC convention and permission-code generation.
- Verified authenticated permission denial is audited by existing middleware.
- Verified existing branch-scope behavior for normal users and Super Administrator.
- Verified current OPD prescription, pharmacy inventory, stock movement, billing, and audit contracts.
- Verified existing use of Mongoose sessions and transactions for pharmacy inventory and billing.
- Inspected HMS Local pharmacy dispensing, bed management, and inpatient workspace prototypes without modifying them.
- Defined state maps, relationships, permissions, branch scope, audit events, APIs, errors, idempotency, and concurrency rules in `NEXT_RELEASE_R0_FOUNDATION_CONTRACT.md`.
- Removed an embedded database credential from the current migration utility and routed it through the existing environment-based database connection.
- Removed connection-string and migration-record console logging from that utility.

## Security Follow-up

The credential previously embedded in the migration utility must be rotated in the database provider. Removing it from the current source does not revoke the credential or erase it from Git history.

Do not rewrite repository history as part of R0 without explicit authorization. Credential rotation is the immediate containment action.

## R0 Manual Review Steps

1. Open `NEXT_RELEASE_R0_FOUNDATION_CONTRACT.md`.
2. Confirm the pharmacy prescription and dispensing state transitions.
3. Confirm cleaning uses `BLOCKED` with reason code `CLEANING`.
4. Confirm admission, transfer, and discharge use separate state machines.
5. Confirm the permission matrix follows the existing module/screen/action convention.
6. Confirm cross-branch transfer requires access to both branches and a dedicated permission.
7. Confirm confirmation/reversal and admission/transfer/discharge operations require transactions and idempotency.
8. Confirm paid or partially paid pharmacy dispensing cannot be reversed until a refund workflow is implemented.
9. Rotate the exposed database credential in the database provider and update the runtime secret/environment configuration.
10. Do not begin R1 until the R0 contract is accepted.

## Automated Checks Required

Because R0 changes one TypeScript migration utility, run:

```powershell
npm run typecheck --workspace=@hms/api
npm run lint --workspace=@hms/api
npm run build --workspace=@hms/api
```

No database migration should be executed as part of R0 verification.

## Automated Check Results

| Check | Result | Notes |
|---|---|---|
| R0 migration utility ESLint | Passed | `migrate-clinical-depts.ts` has no lint errors. |
| R0 migration utility isolated TypeScript compile | Passed | Compiles with the repository's Node/ESM settings. |
| Embedded MongoDB URI scan in application TS/TSX/JS | Passed | No embedded MongoDB URI remains in application source. |
| Markdown and changed-file diff check | Passed | No whitespace errors. |
| Full API typecheck | Blocked by unrelated worktree changes | Existing `department.repository.ts` references `branchId` while the modified department model exposes `branchIds`. |
| Full API build | Blocked by the same unrelated type errors | R0 does not alter the department domain. |
| Full API lint | Blocked by unrelated worktree changes | Twelve existing errors are present in scratch, billing, notifications, OPD, patient, and service files. |

The unrelated failures were not modified or reverted during R0. They must be resolved by the owning work before a release-wide green build can be claimed.
