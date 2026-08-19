import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/api-error';
import {
  medicinesApi,
  type MedicineListParams,
  type MedicineResponse,
  type SaveMedicinePayload,
} from '../../api/medicines';

export const getMedicineErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'You do not have permission to manage medicines.';
    if (error.status === 409) return error.message;
    if (error.status === 400) return error.message || 'Check the medicine details and try again.';
    return error.message;
  }
  return 'Unable to complete the medicine request.';
};

export function useMedicinesList(params: MedicineListParams, enabled = true) {
  return useQuery({
    queryKey: ['medicines', 'list', params],
    queryFn: () => medicinesApi.list(params),
    enabled,
  });
}

export function useMedicinesSummary() {
  return useQuery({
    queryKey: ['medicines', 'summary'],
    queryFn: () => medicinesApi.summary(),
  });
}

export function useSaveMedicine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: SaveMedicinePayload }) => {
      return id
        ? medicinesApi.update(id, payload)
        : medicinesApi.create(payload);
    },
    onSuccess: async (medicine, { id }) => {
      toast.success(`${medicine.name} ${id ? 'updated' : 'created'} successfully.`);
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
    },
    onError: (error) => toast.error(getMedicineErrorMessage(error)),
  });
}

export function useUpdateMedicineStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (medicine: MedicineResponse) =>
      medicinesApi.updateStatus(
        medicine.id,
        medicine.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      ),
    onSuccess: async (medicine) => {
      toast.success(`${medicine.name} ${medicine.status === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
    },
    onError: (error) => toast.error(getMedicineErrorMessage(error)),
  });
}

export function useDeleteMedicine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (medicine: MedicineResponse) => medicinesApi.delete(medicine.id),
    onSuccess: async () => {
      toast.success('Medicine deleted successfully.');
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
    },
    onError: (error) => toast.error(getMedicineErrorMessage(error)),
  });
}

export function useExportMedicines() {
  const [isExporting, setIsExporting] = useState(false);

  const exportMedicines = async (params: MedicineListParams, downloadBlob: (blob: Blob, filename: string) => void) => {
    setIsExporting(true);
    try {
      const blob = await medicinesApi.export(params);
      downloadBlob(blob, 'hms-medicines.csv');
      toast.success('Filtered medicines exported.');
    } catch (error) {
      toast.error(getMedicineErrorMessage(error));
    } finally {
      setIsExporting(false);
    }
  };

  return { exportMedicines, isExporting };
}
