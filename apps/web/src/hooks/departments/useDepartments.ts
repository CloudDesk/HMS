import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const LOOKUP_STALE_TIME = 5 * 60 * 1000;
import { toast } from 'sonner';
import {
  departmentsApi,
  type DepartmentListParams,
  type SaveDepartmentPayload,
  type ApiDepartmentStatus
} from '../../api/departments';

export const departmentsKeys = {
  all: ['departments'] as const,
  lists: () => [...departmentsKeys.all, 'list'] as const,
  list: (params: DepartmentListParams) => [...departmentsKeys.lists(), params] as const,
  details: () => [...departmentsKeys.all, 'detail'] as const,
  detail: (id: string) => [...departmentsKeys.details(), id] as const,
  summaries: () => [...departmentsKeys.all, 'summary'] as const,
  summary: () => [...departmentsKeys.summaries()] as const,
};

export function useDepartmentsList(params: DepartmentListParams, enabled = true) {
  return useQuery({
    queryKey: departmentsKeys.list(params),
    queryFn: () => departmentsApi.list(params),
    enabled,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useDepartmentDetails(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? departmentsKeys.detail(id) : departmentsKeys.details(),
    queryFn: () => departmentsApi.getById(id as string),
    enabled: enabled && Boolean(id),
  });
}

export function useDepartmentSummary(enabled = true) {
  return useQuery({
    queryKey: departmentsKeys.summary(),
    queryFn: () => departmentsApi.summary(),
    enabled,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveDepartmentPayload) => departmentsApi.create(payload),
    onSuccess: async () => {
      toast.success('Department created successfully');
      await queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: departmentsKeys.summaries() });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create department');
    }
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<SaveDepartmentPayload> }) => departmentsApi.update(id, payload),
    onSuccess: async (_, { id }) => {
      toast.success('Department updated successfully');
      await queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: departmentsKeys.summaries() });
      await queryClient.invalidateQueries({ queryKey: departmentsKeys.detail(id) });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update department');
    }
  });
}

export function useUpdateDepartmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApiDepartmentStatus }) => departmentsApi.updateStatus(id, status),
    onSuccess: async (_, { id }) => {
      toast.success('Department status updated');
      await queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: departmentsKeys.summaries() });
      await queryClient.invalidateQueries({ queryKey: departmentsKeys.detail(id) });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update department status');
    }
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => departmentsApi.delete(id),
    onSuccess: async () => {
      toast.success('Department deleted successfully');
      await queryClient.invalidateQueries({ queryKey: departmentsKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: departmentsKeys.summaries() });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete department');
    }
  });
}
export function useExportDepartments() {
  return useMutation({
    mutationFn: (params: DepartmentListParams = {}) => departmentsApi.export(params),
    onSuccess: () => {
      toast.success('Export started');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to export departments');
    }
  });
}
