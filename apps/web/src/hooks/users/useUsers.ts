import { useQuery } from '@tanstack/react-query';
import { usersApi, type UserListParams } from '../../api/users';

export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (params: UserListParams) => [...usersKeys.lists(), params] as const,
};

export function useUsersList(params: UserListParams, enabled = true) {
  return useQuery({
    queryKey: usersKeys.list(params),
    queryFn: () => usersApi.list(params),
    enabled,
  });
}
