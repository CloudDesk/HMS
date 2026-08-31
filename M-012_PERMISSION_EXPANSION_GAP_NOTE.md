# M-012 Permission Expansion Gap Note

## Existing contract

- Permissions are stored separately from roles.
- Each role stores permission references in `permissionIds`.
- Expanded permission responses include `roleCount`, including zero for unassigned permissions.
- Repository list ordering and its existing `roleCount` page-local sorting behavior are part of the current contract.

## Confirmed gap

The multi-permission repository methods expanded every returned permission with a separate `RoleModel.countDocuments()` call. A page of N permissions therefore issued N additional role-count queries.

Affected multi-record paths are `list`, `findPermissionsByIds`, `getPermissionsByRole`, and `getAllActivePermissions`. Single-record operations issue only one count and are not N+1 paths.

## Intended change

Use one shared role aggregation for each multi-permission expansion. The aggregation filters roles once, unwinds matching permission references, deduplicates each role/permission pair, and groups counts by permission ID. Results are mapped back in the permission query's existing order, defaulting missing counts to zero.
