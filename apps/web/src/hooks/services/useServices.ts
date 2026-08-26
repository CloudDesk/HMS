import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const LOOKUP_STALE_TIME = 5 * 60 * 1000;
import { toast } from 'sonner';
import {
  servicesApi,
  type ServiceListParams,
  type CreateServicePayload,
  type UpdateServicePayload,
  type ApiServiceStatus
} from '../../api/services';

export const servicesKeys = {
  all: ['services'] as const,
  lists: () => [...servicesKeys.all, 'list'] as const,
  list: (params: ServiceListParams) => [...servicesKeys.lists(), params] as const,
  details: () => [...servicesKeys.all, 'detail'] as const,
  detail: (id: string) => [...servicesKeys.details(), id] as const,
  summaries: () => [...servicesKeys.all, 'summary'] as const,
  summary: () => [...servicesKeys.summaries()] as const,
};

export function useServicesList(params: ServiceListParams, enabled = true) {
  return useQuery({
    queryKey: servicesKeys.list(params),
    queryFn: () => servicesApi.list(params),
    enabled,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useServiceDetails(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? servicesKeys.detail(id) : servicesKeys.details(),
    queryFn: () => servicesApi.getById(id as string),
    enabled: enabled && Boolean(id),
  });
}

export function useServiceSummary(enabled = true) {
  return useQuery({
    queryKey: servicesKeys.summary(),
    queryFn: () => servicesApi.summary(),
    enabled,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateServicePayload) => servicesApi.create(payload),
    onSuccess: async () => {
      toast.success('Service created successfully');
      await queryClient.invalidateQueries({ queryKey: servicesKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: servicesKeys.summaries() });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create service');
    }
  });
}

export function useUpdateService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateServicePayload }) => servicesApi.update(id, payload),
    onSuccess: async (_, { id }) => {
      toast.success('Service updated successfully');
      await queryClient.invalidateQueries({ queryKey: servicesKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: servicesKeys.summaries() });
      await queryClient.invalidateQueries({ queryKey: servicesKeys.detail(id) });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update service');
    }
  });
}

export function useUpdateServiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApiServiceStatus }) => servicesApi.updateStatus(id, status),
    onSuccess: async (_, { id }) => {
      toast.success('Service status updated');
      await queryClient.invalidateQueries({ queryKey: servicesKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: servicesKeys.summaries() });
      await queryClient.invalidateQueries({ queryKey: servicesKeys.detail(id) });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update service status');
    }
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: async () => {
      toast.success('Service deleted successfully');
      await queryClient.invalidateQueries({ queryKey: servicesKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: servicesKeys.summaries() });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete service');
    }
  });
}
export function useExportServices() {
  return useMutation({
    mutationFn: (params: ServiceListParams = {}) => servicesApi.export(params),
  });
}
