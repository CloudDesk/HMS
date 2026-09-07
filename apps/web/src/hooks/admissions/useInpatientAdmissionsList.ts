import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { InpatientAdmission } from '../../api/inpatient-admissions';
import { inpatientAdmissionsService } from '../../services/inpatient-admissions.service';

export const inpatientAdmissionsKeys = {
  all: ['inpatient-admissions'] as const,
  lists: () => [...inpatientAdmissionsKeys.all, 'list'] as const,
  list: (params: { branch_id: string; status?: InpatientAdmission['status']; page?: number; limit?: number }) =>
    [...inpatientAdmissionsKeys.lists(), params] as const,
};

export const useInpatientAdmissionsList = (
  params: { branch_id: string; status?: InpatientAdmission['status']; page?: number; limit?: number },
  enabled = true,
) => useQuery({
  queryKey: inpatientAdmissionsKeys.list(params),
  queryFn: () => inpatientAdmissionsService.list(params),
  enabled: enabled && Boolean(params.branch_id),
});

export const useRefreshInpatientAdmissions = () => {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: inpatientAdmissionsKeys.all });
};
