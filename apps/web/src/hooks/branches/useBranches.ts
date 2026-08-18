import { useQuery } from '@tanstack/react-query';
import { branchesApi, type BranchListParams } from '../../api/branches';

export const branchesKeys = {
  all: ['branches'] as const,
  lists: () => [...branchesKeys.all, 'list'] as const,
  list: (params: BranchListParams) => [...branchesKeys.lists(), params] as const,
};

export function useBranchesList(params: BranchListParams, enabled = true) {
  return useQuery({
    queryKey: branchesKeys.list(params),
    queryFn: () => branchesApi.list(params),
    enabled,
  });
}
