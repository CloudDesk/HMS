import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '../../api/api-error';
import {
  rolesApi,
  type ApiRoleStatus,
  type RoleListParams,
  type SaveRolePayload,
} from '../../api/roles';

export const getRoleErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to manage roles and permissions.';
    if (error.status === 404) return 'The selected role or permission could not be found.';
    if (error.status === 409) return error.message;
    if (error.status >= 500) return 'The roles and permissions service is unavailable. Please try again shortly.';
    return error.message;
  }
  return 'Unable to complete the roles and permissions request.';
};

export const rolesKeys = {
  all: ['roles'] as const,
  lists: () => [...rolesKeys.all, 'list'] as const,
  list: (params: RoleListParams) => [...rolesKeys.lists(), params] as const,
  stats: () => [...rolesKeys.all, 'stats'] as const,
  details: () => [...rolesKeys.all, 'detail'] as const,
  detail: (id: string) => [...rolesKeys.details(), id] as const,
  audits: () => [...rolesKeys.all, 'audit'] as const,
  audit: (id: string) => [...rolesKeys.audits(), id] as const,
};

export function useRolesList(params: RoleListParams) {
  return useQuery({
    queryKey: rolesKeys.list(params),
    queryFn: () => rolesApi.list(params),
  });
}

export function useRoleStats() {
  return useQuery({
    queryKey: rolesKeys.stats(),
    queryFn: async () => {
      const [allRoles, activeRoles, systemRoles, customRoles] = await Promise.all([
        rolesApi.list({ limit: 1, page: 1 }),
        rolesApi.list({ limit: 1, page: 1, status: 'active' }),
        rolesApi.list({ limit: 1, page: 1, type: 'system' }),
        rolesApi.list({ limit: 1, page: 1, type: 'custom' }),
      ]);
      return {
        total: allRoles.meta.total,
        active: activeRoles.meta.total,
        system: systemRoles.meta.total,
        custom: customRoles.meta.total,
      };
    },
  });
}

export function useRoleDetails(id: string | null) {
  return useQuery({
    queryKey: id ? rolesKeys.detail(id) : rolesKeys.details(),
    queryFn: () => rolesApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useRoleAuditLogs(id: string | null) {
  return useQuery({
    queryKey: id ? rolesKeys.audit(id) : rolesKeys.audits(),
    queryFn: () => rolesApi.auditLogs(id!),
    enabled: Boolean(id),
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveRolePayload) => rolesApi.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
    onError: (error) => toast.error(getRoleErrorMessage(error)),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<SaveRolePayload, 'status'>> }) =>
      rolesApi.update(id, payload),
    onSuccess: async () => {
      toast.success('Role updated successfully.');
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
    onError: (error) => toast.error(getRoleErrorMessage(error)),
  });
}

export function useUpdateRoleStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApiRoleStatus }) =>
      rolesApi.updateStatus(id, status),
    onSuccess: async (role) => {
      toast.success(`Role ${role.status === 'active' ? 'activated' : 'deactivated'}.`);
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
    onError: (error) => toast.error(getRoleErrorMessage(error)),
  });
}

export function useAssignUserToRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      rolesApi.assignUser(id, userId),
    onSuccess: async () => {
      toast.success('User assigned to role successfully.');
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
    onError: (error) => toast.error(getRoleErrorMessage(error)),
  });
}

export function useRemoveUserFromRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      rolesApi.removeUser(id, userId),
    onSuccess: async () => {
      toast.success('User removed from role successfully.');
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
    onError: (error) => toast.error(getRoleErrorMessage(error)),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: async () => {
      toast.success('Role deleted successfully.');
      await queryClient.invalidateQueries({ queryKey: rolesKeys.all });
    },
    onError: (error) => toast.error(getRoleErrorMessage(error)),
  });
}
