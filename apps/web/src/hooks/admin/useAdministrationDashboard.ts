import { useQuery } from '@tanstack/react-query';
import { administrationDashboardApi } from '../../api/administration-dashboard';

export const administrationDashboardKeys = {
  all: ['administrationDashboard'] as const,
  details: () => [...administrationDashboardKeys.all, 'detail'] as const,
};

export function useAdministrationDashboard(enabled = true) {
  return useQuery({
    queryKey: administrationDashboardKeys.details(),
    queryFn: () => administrationDashboardApi.get(),
    enabled,
  });
}
