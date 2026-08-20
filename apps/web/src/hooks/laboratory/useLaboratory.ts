import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  laboratoryApi,
  type DiagnosticListParams,
  type LaboratoryResultPayload,
  type LaboratoryStatus,
} from '../../api/laboratory';
import { getOpdErrorMessage } from '../../pages/opd-utils'; // Assume shared error message utility or create a new one

export const laboratoryKeys = {
  all: ['laboratory'] as const,
  lists: () => [...laboratoryKeys.all, 'list'] as const,
  list: (params: DiagnosticListParams) => [...laboratoryKeys.lists(), params] as const,
  summaries: () => [...laboratoryKeys.all, 'summary'] as const,
  summary: (branchId?: string) => [...laboratoryKeys.summaries(), branchId] as const,
  details: () => [...laboratoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...laboratoryKeys.details(), id] as const,
  results: () => [...laboratoryKeys.all, 'result'] as const,
  result: (id: string) => [...laboratoryKeys.results(), id] as const,
};

export function useLaboratoryOrders(params: DiagnosticListParams, enabled = true) {
  return useQuery({
    queryKey: laboratoryKeys.list(params),
    queryFn: () => laboratoryApi.list(params),
    enabled,
  });
}

export function useLaboratorySummary(branchId?: string, enabled = true) {
  return useQuery({
    queryKey: laboratoryKeys.summary(branchId),
    queryFn: () => laboratoryApi.summary(branchId),
    enabled,
  });
}

export function useLaboratoryOrderDetails(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? laboratoryKeys.detail(id) : laboratoryKeys.details(),
    queryFn: () => laboratoryApi.get(id as string),
    enabled: enabled && Boolean(id),
  });
}

export function useLaboratoryResult(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? laboratoryKeys.result(id) : laboratoryKeys.results(),
    queryFn: () => laboratoryApi.getResult(id as string),
    enabled: enabled && Boolean(id),
  });
}

export function useUpdateLaboratoryStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Exclude<LaboratoryStatus, 'SUBMITTED' | 'RESULT_ENTERED'> }) =>
      laboratoryApi.updateStatus(id, status),
    onSuccess: async (_, { id }) => {
      toast.success('Laboratory order status updated.');
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.summaries() });
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.result(id) });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)), // Adjust to a generic API error message if needed
  });
}

export function useEnterLaboratoryResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LaboratoryResultPayload }) =>
      laboratoryApi.enterResult(id, payload),
    onSuccess: async (_, { id }) => {
      toast.success('Laboratory results entered successfully.');
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.summaries() });
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.result(id) });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useUpdateLaboratoryResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: LaboratoryResultPayload }) =>
      laboratoryApi.updateResult(id, payload),
    onSuccess: async (_, { id }) => {
      toast.success('Laboratory results updated successfully.');
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.summaries() });
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: laboratoryKeys.result(id) });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}
