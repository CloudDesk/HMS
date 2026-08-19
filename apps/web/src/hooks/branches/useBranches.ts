import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  branchesApi,
  type BranchListParams,
  type SaveBranchPayload,
  type UpdateBranchPayload,
  type ApiBranchStatus
} from '../../api/branches';

export const branchesKeys = {
  all: ['branches'] as const,
  lists: () => [...branchesKeys.all, 'list'] as const,
  list: (params: BranchListParams) => [...branchesKeys.lists(), params] as const,
  details: () => [...branchesKeys.all, 'detail'] as const,
  detail: (id: string) => [...branchesKeys.details(), id] as const,
  summaries: () => [...branchesKeys.all, 'summary'] as const,
  summary: () => [...branchesKeys.summaries()] as const,
};

export function useBranchesList(params: BranchListParams, enabled = true) {
  return useQuery({
    queryKey: branchesKeys.list(params),
    queryFn: () => branchesApi.list(params),
    enabled,
  });
}

export function useBranchDetails(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? branchesKeys.detail(id) : branchesKeys.details(),
    queryFn: () => branchesApi.getById(id as string),
    enabled: enabled && Boolean(id),
  });
}

export function useBranchSummary(enabled = true) {
  return useQuery({
    queryKey: branchesKeys.summary(),
    queryFn: () => branchesApi.summary(),
    enabled,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveBranchPayload) => branchesApi.create(payload),
    onSuccess: async () => {
      toast.success('Branch created successfully');
      await queryClient.invalidateQueries({ queryKey: branchesKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: branchesKeys.summaries() });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create branch');
    }
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBranchPayload }) => branchesApi.update(id, payload),
    onSuccess: async (_, { id }) => {
      toast.success('Branch updated successfully');
      await queryClient.invalidateQueries({ queryKey: branchesKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: branchesKeys.summaries() });
      await queryClient.invalidateQueries({ queryKey: branchesKeys.detail(id) });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update branch');
    }
  });
}

export function useUpdateBranchStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApiBranchStatus }) => branchesApi.updateStatus(id, status),
    onSuccess: async (_, { id }) => {
      toast.success('Branch status updated');
      await queryClient.invalidateQueries({ queryKey: branchesKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: branchesKeys.summaries() });
      await queryClient.invalidateQueries({ queryKey: branchesKeys.detail(id) });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update branch status');
    }
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => branchesApi.delete(id),
    onSuccess: async () => {
      toast.success('Branch deleted');
      await queryClient.invalidateQueries({ queryKey: branchesKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: branchesKeys.summaries() });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete branch');
    }
  });
}

export function useExportBranches() {
  return useMutation({
    mutationFn: (params: BranchListParams = {}) => branchesApi.export(params),
    onSuccess: () => {
      toast.success('Export started');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to export branches');
    }
  });
}
