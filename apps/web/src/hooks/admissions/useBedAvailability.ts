import { useQuery } from '@tanstack/react-query';
import { admissionsConfigurationService } from '../../services/admissions-configuration.service';
export const useAvailableBeds = (branchId: string) => useQuery({
  queryKey: ['admissions', 'available-beds', branchId],
  queryFn: () => admissionsConfigurationService.beds({ branch_id: branchId, status: 'AVAILABLE', page: 1, limit: 100 }),
  enabled: Boolean(branchId),
});
export const useBedAvailabilitySummary = (branchId: string) => useQuery({
  queryKey: ['admissions', 'bed-summary', branchId], queryFn: () => admissionsConfigurationService.summary(branchId), enabled: Boolean(branchId),
});
