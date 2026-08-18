import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  imagingApi,
  type ImagingReportPayload,
} from '../../api/imaging';
import { type DiagnosticListParams, type ImagingStatus } from '../../api/laboratory';
import { getOpdErrorMessage } from '../../pages/opd-utils'; // Shared error handler

export const imagingKeys = {
  all: ['imaging'] as const,
  lists: () => [...imagingKeys.all, 'list'] as const,
  list: (params: DiagnosticListParams) => [...imagingKeys.lists(), params] as const,
  summaries: () => [...imagingKeys.all, 'summary'] as const,
  summary: (branchId?: string) => [...imagingKeys.summaries(), branchId] as const,
  details: () => [...imagingKeys.all, 'detail'] as const,
  detail: (id: string) => [...imagingKeys.details(), id] as const,
  reports: () => [...imagingKeys.all, 'report'] as const,
  report: (id: string) => [...imagingKeys.reports(), id] as const,
};

export function useImagingOrders(params: DiagnosticListParams, enabled = true) {
  return useQuery({
    queryKey: imagingKeys.list(params),
    queryFn: () => imagingApi.list(params),
    enabled,
  });
}

export function useImagingSummary(branchId?: string, enabled = true) {
  return useQuery({
    queryKey: imagingKeys.summary(branchId),
    queryFn: () => imagingApi.summary(branchId),
    enabled,
  });
}

export function useImagingOrderDetails(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? imagingKeys.detail(id) : imagingKeys.details(),
    queryFn: () => imagingApi.get(id!),
    enabled: enabled && Boolean(id),
  });
}

export function useImagingReport(id: string | null, enabled = true) {
  return useQuery({
    queryKey: id ? imagingKeys.report(id) : imagingKeys.reports(),
    queryFn: () => imagingApi.getReport(id!),
    enabled: enabled && Boolean(id),
  });
}

export function useUpdateImagingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Exclude<ImagingStatus, 'SUBMITTED' | 'REPORT_ENTERED'> }) =>
      imagingApi.updateStatus(id, status),
    onSuccess: async () => {
      toast.success('Imaging order status updated.');
      await queryClient.invalidateQueries({ queryKey: imagingKeys.all });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useEnterImagingReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ImagingReportPayload }) =>
      imagingApi.enterReport(id, payload),
    onSuccess: async () => {
      toast.success('Imaging report entered successfully.');
      await queryClient.invalidateQueries({ queryKey: imagingKeys.all });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useUpdateImagingReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ImagingReportPayload }) =>
      imagingApi.updateReport(id, payload),
    onSuccess: async () => {
      toast.success('Imaging report updated successfully.');
      await queryClient.invalidateQueries({ queryKey: imagingKeys.all });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}
