import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClinicalOrderType, SaveOpdClinicalOrderPayload, SaveOpdPrescriptionPayload } from '../../api/opd';
import { surgeryService } from '../../services/surgery.service';

export function useSurgeryDownstream(bookingId: string | null, branchId: string, enabled: boolean, prescriptionEnabled = enabled) {
  const client = useQueryClient(); const key = ['surgery', 'downstream', bookingId, branchId] as const;
  const active = enabled && Boolean(bookingId && branchId); const requireId = () => { if (!bookingId) throw new Error('Select an active procedure booking'); return bookingId; };
  const prescription = useQuery({ queryKey: [...key, 'prescription'], queryFn: () => surgeryService.prescription(requireId(), branchId), enabled: active && prescriptionEnabled });
  const laboratory = useQuery({ queryKey: [...key, 'LABORATORY'], queryFn: () => surgeryService.clinicalOrder(requireId(), branchId, 'LABORATORY'), enabled: active });
  const imaging = useQuery({ queryKey: [...key, 'IMAGING'], queryFn: () => surgeryService.clinicalOrder(requireId(), branchId, 'IMAGING'), enabled: active });
  const submitPrescription = useMutation({ mutationFn: (payload: SaveOpdPrescriptionPayload) => surgeryService.submitPrescription(requireId(), branchId, payload), onSuccess: () => client.invalidateQueries({ queryKey: [...key, 'prescription'] }) });
  const submitClinicalOrder = useMutation({ mutationFn: ({ type, payload }: { type: ApiClinicalOrderType; payload: SaveOpdClinicalOrderPayload }) => surgeryService.submitClinicalOrder(requireId(), branchId, type, payload), onSuccess: (_, variables) => client.invalidateQueries({ queryKey: [...key, variables.type] }) });
  return { prescription, laboratory, imaging, submitPrescription, submitClinicalOrder };
}
