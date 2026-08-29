# M-012 Permission Expansion Verification

## Implemented behavior

- Multi-permission expansions now execute one grouped role aggregation per result set.
- Counts include active and inactive non-deleted roles, matching the previous `countDocuments({ permissionIds, deletedAt: null })` behavior.
- Soft-deleted roles remain excluded.
- Duplicate references within one role count that role once for a permission.
- Unassigned permissions receive a zero count.
- Permission mapping, ordering, pagination, authorization, and API response contracts are unchanged.

## Changed expansion paths

- `PermissionRepository.list`
- `PermissionRepository.findPermissionsByIds`
- `PermissionRepository.getPermissionsByRole`
- `PermissionRepository.getAllActivePermissions`

Single-permission operations retain their single role count query because they do not create an N+1 pattern.

## Validation

- `npm test --workspace=@hms/api -- permission-expansion.test.ts`
  - Passed: 1 file, 3 tests.
- No pre-existing focused permission tests were present in the repository.
- `npm run typecheck --workspace=@hms/api`
  - Passed.
- `npm run build --workspace=@hms/api`
  - Passed.
- `npx eslint apps/api/src/modules/permissions/permission.repository.ts apps/api/src/modules/permissions/permission-expansion.test.ts`
  - Passed.

Known unrelated full-API lint findings were not changed or reworked in this iteration.
