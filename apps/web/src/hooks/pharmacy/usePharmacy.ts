import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  pharmacyInventoryApi,
  type BatchListParams, 
  type InventoryListParams,
  type MovementListParams,
  type RegisterBatchPayload,
  type StockMovementPayload
} from '../../api/pharmacy-inventory';
import { toast } from 'sonner';

export const pharmacyKeys = {
  all: ['pharmacy'] as const,
  batches: () => [...pharmacyKeys.all, 'batches'] as const,
  batchList: (params: BatchListParams) => [...pharmacyKeys.batches(), params] as const,
  medicineBatches: (medicineId: string, params: BatchListParams) => [...pharmacyKeys.batches(), medicineId, params] as const,
  inventory: () => [...pharmacyKeys.all, 'inventory'] as const,
  inventoryList: (params: InventoryListParams) => [...pharmacyKeys.inventory(), params] as const,
  inventorySummary: (branchId: string) => [...pharmacyKeys.inventory(), 'summary', branchId] as const,
  inventoryDetail: (medicineId: string, branchId: string) => [...pharmacyKeys.inventory(), 'detail', medicineId, branchId] as const,
  movements: () => [...pharmacyKeys.all, 'movements'] as const,
  movementList: (params: MovementListParams) => [...pharmacyKeys.movements(), params] as const,
};

export function usePharmacyInventoryList(params: InventoryListParams, enabled = true) {
  return useQuery({
    queryKey: pharmacyKeys.inventoryList(params),
    queryFn: () => pharmacyInventoryApi.list(params),
    enabled,
  });
}

export function usePharmacyInventorySummary(branchId: string | null, enabled = true) {
  return useQuery({
    queryKey: pharmacyKeys.inventorySummary(branchId as string),
    queryFn: () => pharmacyInventoryApi.summary(branchId as string),
    enabled: enabled && Boolean(branchId),
  });
}

export function usePharmacyInventoryDetail(medicineId: string | null, branchId: string | null, enabled = true) {
  return useQuery({
    queryKey: pharmacyKeys.inventoryDetail(medicineId as string, branchId as string),
    queryFn: () => pharmacyInventoryApi.detail(medicineId as string, branchId as string),
    enabled: enabled && Boolean(medicineId) && Boolean(branchId),
  });
}

export function usePharmacyBatches(params: BatchListParams, enabled = true) {
  return useQuery({
    queryKey: pharmacyKeys.batchList(params),
    queryFn: () => pharmacyInventoryApi.allBatches(params),
    enabled,
  });
}

export function usePharmacyMedicineBatches(medicineId: string | null, params: BatchListParams, enabled = true) {
  return useQuery({
    queryKey: pharmacyKeys.medicineBatches(medicineId as string, params),
    queryFn: () => pharmacyInventoryApi.batches(medicineId as string, params),
    enabled: enabled && Boolean(medicineId),
  });
}

export function usePharmacyMovements(params: MovementListParams, enabled = true) {
  return useQuery({
    queryKey: pharmacyKeys.movementList(params),
    queryFn: () => pharmacyInventoryApi.movements(params),
    enabled,
  });
}

export function useAddPharmacyBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ medicineId, payload }: { medicineId: string; payload: RegisterBatchPayload }) =>
      pharmacyInventoryApi.registerBatch(medicineId, payload),
    onSuccess: async () => {
      toast.success('Batch registered successfully.');
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.inventory() });
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches() });
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.movements() });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to register batch.'),
  });
}

export function useEditPharmacyBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ batchId, payload }: { batchId: string; payload: { branch_id: string; expiry_date?: string; unit_price?: number; barcode?: string | null; reason: string } }) =>
      pharmacyInventoryApi.updateBatch(batchId, payload),
    onSuccess: async () => {
      toast.success('Batch updated successfully.');
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.inventory() });
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches() });
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.movements() });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update batch.'),
  });
}

export function useRecordStockMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: StockMovementPayload) => pharmacyInventoryApi.recordMovement(payload),
    onSuccess: async () => {
      toast.success('Stock movement recorded successfully.');
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.inventory() });
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.batches() });
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.movements() });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to record movement.'),
  });
}

export function useUpdateLowStockThreshold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ medicineId, payload }: { medicineId: string; payload: { branch_id: string; low_stock_threshold: number; reason: string } }) =>
      pharmacyInventoryApi.updateThreshold(medicineId, payload),
    onSuccess: async () => {
      toast.success('Threshold updated successfully.');
      await queryClient.invalidateQueries({ queryKey: pharmacyKeys.inventory() });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Failed to update threshold.'),
  });
}
