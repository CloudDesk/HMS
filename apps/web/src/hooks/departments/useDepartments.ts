import { useQuery } from '@tanstack/react-query';
import { departmentsApi, type DepartmentListParams } from '../../api/departments';

export const departmentKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentKeys.all, 'lists'] as const,
  list: (params: DepartmentListParams) => [...departmentKeys.lists(), params] as const,
};

export function useDepartmentsList(params: DepartmentListParams = {}, enabled = true) {
  return useQuery({
    queryKey: departmentKeys.list(params),
    queryFn: () => departmentsApi.list(params),
    enabled,
  });
}
