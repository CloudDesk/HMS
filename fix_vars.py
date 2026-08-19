import re

with open('apps/web/src/hooks/admin/useRolesPermissionsFeature.ts', 'r', encoding='utf-8') as f:
    text = f.read()

if 'getRoleErrorMessage' not in text:
    text = text.replace("import {\n  useAllPermissions,", "import {\n  getPermissionErrorMessage,\n  useAllPermissions,")
    text = text.replace("useDeleteRole,\n} from '../roles/useRoles';", "useDeleteRole,\n  getRoleErrorMessage,\n} from '../roles/useRoles';")

if 'const loadError =' not in text:
    text = text.replace('  const forbidden =', '''  const loadError = rolesQuery.error ? getRoleErrorMessage(rolesQuery.error) : '';
  const permissionError = allPermissionsQuery.error ? getPermissionErrorMessage(allPermissionsQuery.error) : roleDetailsQuery.error ? getRoleErrorMessage(roleDetailsQuery.error) : '';
  const forbidden =''')

if 'loadError,' not in text.split('status: {')[1]:
    text = text.replace('isMutating,\n', 'isMutating,\n      loadError,\n      permissionError,\n')

with open('apps/web/src/hooks/admin/useRolesPermissionsFeature.ts', 'w', encoding='utf-8') as f:
    f.write(text)

with open('apps/web/src/pages/RolesPermissionsPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('  const rolesLoading = rolesQuery.isFetching;\n', '')
text = text.replace('  const statsLoading = roleStatsQuery.isFetching;\n', '')
text = text.replace('  const permissionsLoading = allPermissionsQuery.isFetching;\n', '')
text = text.replace('  const roleLoading = roleDetailsQuery.isFetching || rolePermissionsQuery.isFetching;\n', '')
text = text.replace("  const loadError = rolesQuery.error ? getRoleErrorMessage(rolesQuery.error) : '';\n", '')
text = text.replace("  const permissionError = allPermissionsQuery.error ? getPermissionErrorMessage(allPermissionsQuery.error) : roleDetailsQuery.error ? getRoleErrorMessage(roleDetailsQuery.error) : '';\n", '')

text = text.replace('usersListQuery.data?.items', 'usersList')
text = text.replace('const auditItems = roleAuditLogs ?? [];', 'const auditItems = roleAuditLogs;')
text = text.replace('  const auditLoading = auditLoading;\n', '')
text = text.replace('const submitting = isMutating || replacePermissionsMutation.isPending;', 'const submitting = isMutating;')
text = text.replace('replacePermissionsMutation.isPending', 'isMutating')
text = text.replace('roleLoading, auditLoading } = status;', 'roleLoading, auditLoading, loadError, permissionError } = status;')

# Remove unused vars from page
text = text.replace("  getPermissionErrorMessage,\n", "")
text = text.replace("  getRoleErrorMessage,\n", "")

with open('apps/web/src/pages/RolesPermissionsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("done")
