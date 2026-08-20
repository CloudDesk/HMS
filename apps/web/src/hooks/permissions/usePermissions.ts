import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '../../api/api-error';
import { permissionsApi } from '../../api/permissions';

export const getPermissionErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to manage roles and permissions.';
    if (error.status === 404) return 'The selected role or permission could not be found.';
    if (error.status === 409) return error.message;
    if (error.status >= 500) return 'The roles and permissions service is unavailable. Please try again shortly.';
    return error.message;
  }
  return 'Unable to complete the permissions request.';
};

export const permissionsKeys = {
  all: ['permissions'] as const,
  lists: () => [...permissionsKeys.all, 'list'] as const,
  listAll: () => [...permissionsKeys.lists(), 'all'] as const,
  byRole: (roleId: string) => [...permissionsKeys.all, 'role', roleId] as const,
};

export function useAllPermissions() {
  return useQuery({
    queryKey: permissionsKeys.listAll(),
    queryFn: () => permissionsApi.listAll(),
  });
}

export function useRolePermissions(roleId: string | null) {
  return useQuery({
    queryKey: roleId ? permissionsKeys.byRole(roleId) : ['permissions', 'role', 'none'],
    queryFn: () => permissionsApi.getByRole(roleId!),
    enabled: Boolean(roleId),
  });
}

export function useReplaceRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) =>
      permissionsApi.replaceForRole(roleId, permissionIds),
    onSuccess: async (data, { roleId }) => {
      // toast will be handled by the caller or we can do it here. 
      // The old page does: showToast('Role permissions saved successfully.')
      await queryClient.invalidateQueries({ queryKey: permissionsKeys.byRole(roleId) });
    },
    onError: (error) => toast.error(getPermissionErrorMessage(error)),
  });
}
