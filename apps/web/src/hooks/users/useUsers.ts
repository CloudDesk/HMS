import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  usersApi,
  type UserListParams,
  type SaveUserPayload,
  type ApiUserStatus
} from '../../api/users';

export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (params: UserListParams) => [...usersKeys.lists(), params] as const,
  details: () => [...usersKeys.all, 'detail'] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
  summaries: () => [...usersKeys.all, 'summary'] as const,
  summary: () => [...usersKeys.summaries()] as const,
};

export function useUsersList(params: UserListParams, enabled = true) {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: () => usersApi.list(params),
    enabled,
  });
}

export function useUserDetails(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? usersKeys.detail(id) : usersKeys.details(),
    queryFn: () => usersApi.getById(id as string),
    enabled: enabled && Boolean(id),
  });
}

export function useUserSummary(enabled = true) {
  return useQuery({
    queryKey: usersKeys.summary(),
    queryFn: () => usersApi.summary(),
    enabled,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveUserPayload & { password: string }) => usersApi.create(payload),
    onSuccess: async () => {
      toast.success('User created successfully');
      await queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: usersKeys.summaries() });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    }
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SaveUserPayload }) => usersApi.update(id, payload),
    onSuccess: async (_, { id }) => {
      toast.success('User updated successfully');
      await queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: usersKeys.summaries() });
      await queryClient.invalidateQueries({ queryKey: usersKeys.detail(id) });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    }
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApiUserStatus }) => usersApi.updateStatus(id, status),
    onSuccess: async (_, { id }) => {
      toast.success('User status updated');
      await queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: usersKeys.summaries() });
      await queryClient.invalidateQueries({ queryKey: usersKeys.detail(id) });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update user status');
    }
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) => usersApi.resetPassword(id, newPassword),
    onSuccess: () => {
      toast.success('Password reset successfully');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to reset password');
    }
  });
}
