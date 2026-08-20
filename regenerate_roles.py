import re

with open('apps/web/src/pages/RolesPermissionsPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

import_feature = "import { useRolesPermissionsFeature } from '../hooks/admin/useRolesPermissionsFeature';\n"
text = text.replace("import { useEffect, useMemo, useState } from 'react';", "import { useEffect, useMemo, useState } from 'react';\n" + import_feature)
text = re.sub(r"import \{\n  useRolesList,[\s\S]*?\} from '\.\./hooks/roles/useRoles';\n", "", text)
text = re.sub(r"import \{\n  useAllPermissions,[\s\S]*?\} from '\.\./hooks/permissions/usePermissions';\n", "", text)
text = text.replace("import { useUsersList } from '../hooks/users/useUsers';\n", "")
text = text.replace("import { hasPermission } from '../auth/access-control';\n", "")

start_str = "export function RolesPermissionsPage() {"
end_str = "  const closeModal = () => {"
start_idx = text.find(start_str)
end_idx = text.find(end_str)

new_body = """export function RolesPermissionsPage() {
  const { refreshCurrentUser } = useAuth();
  const { search: locationSearch } = useAppLocation();

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const feature = useRolesPermissionsFeature(modalMode);
  
  const { state, data, status, rbac, actions, mutations } = feature;
  const { search, typeFilter, statusFilter, rolePage, selectedRoleId, setSearch, setTypeFilter, setStatusFilter, setRolePage, setSelectedRoleId } = state;
  const { roles, roleMeta, roleStats, permissions, selectedRole, rolePermissions, roleAuditLogs, usersList, permissionActions, permissionRows } = data;
  const { isFetching, isMutating, forbidden, rolesLoading, statsLoading, permissionsLoading, roleLoading, auditLoading } = status;
  const { canCreateRole, canEditRole, canAssignRole, canDeleteRole, canEditPermissions } = rbac;
  const { refreshRolesAndPermissions } = actions;

  const roleForm = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: { name: '', color: '#2563eb', type: 'custom', status: 'active', description: '' }
  });

  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: { userId: '' }
  });
  const [formError, setFormError] = useState('');
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(() => new Set());

  // Track draft permissions
  const [assignedPermissionIds, setAssignedPermissionIds] = useState<Set<string>>(() => new Set());
  const [draftPermissionIds, setDraftPermissionIds] = useState<Set<string>>(() => new Set());
  
  useEffect(() => {
    if (rolePermissions) {
      const ids = new Set(rolePermissions.map(p => p.id));
      setAssignedPermissionIds(ids);
      setDraftPermissionIds(new Set(ids));
    }
  }, [rolePermissions]);

  // Set selected role ID to first item if current is invalid
  useEffect(() => {
    if (roles.length > 0 && (!selectedRoleId || !roles.find(r => r.id === selectedRoleId))) {
      setSelectedRoleId(roles[0]?.id ?? null);
    } else if (roles.length === 0 && selectedRoleId) {
      setSelectedRoleId(null);
    }
  }, [roles, selectedRoleId, setSelectedRoleId]);

  const toggleModule = (module: string) => {
    setCollapsedModules((current) => {
      const next = new Set(current);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    });
  };

  const dirty = useMemo(() => {
    if (assignedPermissionIds.size !== draftPermissionIds.size) return true;
    return [...assignedPermissionIds].some((id) => !draftPermissionIds.has(id));
  }, [assignedPermissionIds, draftPermissionIds]);

  const totalRolePages = Math.max(roleMeta.totalPages, 1);
  const safeRolePage = Math.min(rolePage, totalRolePages);

  const updatePermission = (permission: PermissionResponse, checked: boolean) => {
    if (!canEditPermissions || permission.status !== 'active') return;

    setDraftPermissionIds((current) => {
      const next = new Set(current);
      if (checked) next.add(permission.id);
      else next.delete(permission.id);
      return next;
    });
  };

  const setAllPermissions = (checked: boolean) => {
    if (!canEditPermissions) return;
    setDraftPermissionIds(
      checked
        ? new Set(permissions.filter((permission) => permission.status === 'active').map((permission) => permission.id))
        : new Set(),
    );
  };

  const savePermissions = () => {
    if (!selectedRole || !canEditPermissions || !dirty) return;

    const activePermissionIds = new Set(
      permissions.filter((permission) => permission.status === 'active').map((permission) => permission.id),
    );
    const validIds = [...draftPermissionIds].filter((id) => activePermissionIds.has(id));
    
    mutations.replacePermissions.mutate({ roleId: selectedRole.id, permissionIds: validIds }, {
      onSuccess: async () => {
        await refreshCurrentUser();
        toast.success('Role permissions saved successfully.');
      }
    });
  };

"""

text = text[:start_idx] + new_body + text[end_idx:]

text = text.replace("createRoleMutation.mutate", "mutations.createRole.mutate")
text = text.replace("updateRoleMutation.mutate", "mutations.updateRole.mutate")
text = text.replace("updateRoleStatusMutation.mutate", "mutations.updateRoleStatus.mutate")
text = text.replace("assignUserMutation.mutate", "mutations.assignUser.mutate")
text = text.replace("removeUserMutation.mutate", "mutations.removeUser.mutate")
text = text.replace("deleteRoleMutation.mutate", "mutations.deleteRole.mutate")
text = text.replace("replacePermissionsMutation.mutate", "mutations.replacePermissions.mutate")
text = text.replace("roleAuditLogsQuery.data?.items", "roleAuditLogs")
text = text.replace("roleAuditLogsQuery.isFetching", "auditLoading")

# Now handle the missing vars from removed unused domain hooks in RolesPermissionsPage:
text = text.replace("import { type PermissionResponse } from '../api/permissions';", "import { type PermissionResponse } from '../api/permissions';\nimport { type ApiRoleStatus, type ApiRoleType, type RoleListResponse } from '../api/roles';")
text = re.sub(r"import \{\n  type ApiRoleStatus,\n  type ApiRoleType,\n  type RoleListResponse,\n\} from '\.\./api/roles';\n", "", text)

with open('apps/web/src/pages/RolesPermissionsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("done")
