import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  opdApi,
  type ApiOpdPrescriptionStatus,
} from '../../api/opd';
import { pharmacyInventoryApi, type BatchListParams } from '../../api/pharmacy-inventory';

export type PrescriptionListParams = Partial<{
  status: ApiOpdPrescriptionStatus;
  limit: number;
  skip: number;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}>;

export const pharmacyKeys = {
  all: ['pharmacy'] as const,
  batches: () => [...pharmacyKeys.all, 'batches'] as const,
  batchList: (params: BatchListParams) => [...pharmacyKeys.batches(), params] as const,
  prescriptions: () => [...pharmacyKeys.all, 'prescriptions'] as const,
  prescriptionList: (params: PrescriptionListParams) => [...pharmacyKeys.prescriptions(), 'list', params] as const,
};

export function usePharmacyBatches(params: BatchListParams, enabled = true) {
  return useQuery({
    queryKey: pharmacyKeys.batchList(params),
    queryFn: () => pharmacyInventoryApi.allBatches(params),
    enabled,
  });
}

export function usePharmacyPrescriptions(params: PrescriptionListParams, enabled = true) {
  return useQuery({
    queryKey: pharmacyKeys.prescriptionList(params),
    queryFn: () => opdApi.listPrescriptions(params),
    enabled,
  });
}

export function useUpdatePharmacyPrescriptionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApiOpdPrescriptionStatus }) =>
      opdApi.updatePrescriptionStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.prescriptions() });
    },
  });
}
