import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OphthalmologyDashboardQuery } from '../../api/ophthalmology-dashboard';
import { ophthalmologyService as service } from '../../services/ophthalmology.service';

export const ophthalmologyDashboardKeys = {
  all: ['ophthalmology', 'dashboard'] as const,
  snapshot: (branchId: string) => [...ophthalmologyDashboardKeys.all, branchId] as const,
};

export function useOphthalmologyDashboard(query: OphthalmologyDashboardQuery | null, enabled: boolean) {
  const queryClient = useQueryClient();
  const snapshot = useQuery({
    queryKey: ophthalmologyDashboardKeys.snapshot(query?.branch_id ?? 'invalid'),
    queryFn: ({ signal }) => {
      if (!query) throw new Error('Select a valid branch.');
      return service.dashboard.get(query, signal);
    },
    enabled: enabled && Boolean(query),
    retry: false,
  });
  const refresh = useMutation({
    mutationFn: async () => {
      if (!query) throw new Error('Select a valid branch.');
      return service.dashboard.refresh(query);
    },
    onSuccess: (data) => queryClient.setQueryData(ophthalmologyDashboardKeys.snapshot(data.branchId), data),
  });
  return { snapshot, refresh };
}
