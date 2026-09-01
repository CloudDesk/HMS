import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pharmacyDispensingService } from '../services/pharmacy-dispensing.service';
import { pharmacyInventoryService } from '../services/pharmacy-inventory.service';
import type { DispensingQueueStatus, SaveDispensingPayload } from '../api/pharmacy-dispensing';
import type { BatchListParams } from '../api/pharmacy-inventory';

type PharmacyDispensingQuery = {
  branchId: string;
  search: string;
  status?: DispensingQueueStatus;
  page: number;
  limit: number;
  enabled?: boolean;
};

const isValidObjectId = (id: string) => /^[a-f\d]{24}$/i.test(id);

export const usePharmacyDispensing = ({ branchId, search, status, page, limit, enabled = true }: PharmacyDispensingQuery) => {
  const queryClient = useQueryClient();
  const listQuery = useQuery({ queryKey: ['pharmacy', 'dispensings', branchId, search, status, page, limit], queryFn: () => pharmacyDispensingService.list({ branch_id: branchId, search: search || undefined, status, page, limit }), enabled: enabled && isValidObjectId(branchId) });
  const invalidate = (prescriptionId: string) => { void queryClient.invalidateQueries({ queryKey: ['pharmacy', 'dispensings'] }); void queryClient.invalidateQueries({ queryKey: ['pharmacy', 'dispensing', prescriptionId] }); void queryClient.invalidateQueries({ queryKey: ['pharmacy', 'dispensing', 'batches'] }); void queryClient.invalidateQueries({ queryKey: ['pharmacy', 'inventory'] }); void queryClient.invalidateQueries({ queryKey: ['billing'] }); };
  const save = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: SaveDispensingPayload }) => pharmacyDispensingService.save(id, payload), onSuccess: (_, variables) => invalidate(variables.id) });
  const confirm = useMutation({ mutationFn: ({ id, version }: { id: string; version: number }) => pharmacyDispensingService.confirm(id, { version, idempotency_key: `${id}-${Date.now()}-${Math.random().toString(36).slice(2)}` }), onSuccess: (_, variables) => invalidate(variables.id) });
  const cancel = useMutation({ mutationFn: ({ id, version, reason }: { id: string; version: number; reason: string }) => pharmacyDispensingService.cancel(id, { version, reason }), onSuccess: (_, variables) => invalidate(variables.id) });
  const reverse = useMutation({ mutationFn: ({ id, version, reason }: { id: string; version: number; reason: string }) => pharmacyDispensingService.reverse(id, { version, reason, idempotency_key: `${id}-reverse-${Date.now()}-${Math.random().toString(36).slice(2)}` }), onSuccess: (_, variables) => invalidate(variables.id) });
  return { listQuery, save, confirm, cancel, reverse };
};

export const usePharmacyDispensingDetail = (prescriptionId: string, enabled = true) => useQuery({ queryKey: ['pharmacy', 'dispensing', prescriptionId], queryFn: () => pharmacyDispensingService.get(prescriptionId), enabled: enabled && Boolean(prescriptionId), retry: false });

export const usePharmacyDispensingBatches = (params: BatchListParams, enabled = true) => useQuery({
  queryKey: ['pharmacy', 'dispensing', 'batches', params],
  queryFn: () => pharmacyInventoryService.allBatches(params),
  enabled,
});
