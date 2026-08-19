import { useQuery } from '@tanstack/react-query';
import { authApi } from './auth-api';
import type { AuthPasswordPolicy } from './auth-types';

export function usePasswordPolicy(options?: { enabled?: boolean }) {
  return useQuery<AuthPasswordPolicy, Error>({
    queryKey: ['auth', 'passwordPolicy'],
    queryFn: () => authApi.passwordPolicy(),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}
