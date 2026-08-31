import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClinicalOrderType, SaveOpdClinicalOrderPayload, SaveOpdPrescriptionPayload } from '../../api/opd';
import type { CreateInpatientRoundNotePayload, CreateInpatientVitalPayload } from '../../api/inpatient-admissions';
import { inpatientAdmissionsService } from '../../services/inpatient-admissions.service';

export function useInpatientDownstream(admissionId: string | null, branchId: string, enabled: boolean) {
  const client = useQueryClient();
  const key = ['admissions', 'downstream', admissionId, branchId] as const;
  const active = enabled && Boolean(admissionId && branchId);
  const requireId = () => {
    if (!admissionId) throw new Error('Select an active admission');
    return admissionId;
  };
  const prescription = useQuery({ queryKey: [...key, 'prescription'], queryFn: () => inpatientAdmissionsService.prescription(requireId(), branchId), enabled: active });
  const laboratory = useQuery({ queryKey: [...key, 'LABORATORY'], queryFn: () => inpatientAdmissionsService.clinicalOrder(requireId(), branchId, 'LABORATORY'), enabled: active });
  const imaging = useQuery({ queryKey: [...key, 'IMAGING'], queryFn: () => inpatientAdmissionsService.clinicalOrder(requireId(), branchId, 'IMAGING'), enabled: active });
  const roundNotes = useQuery({ queryKey: [...key, 'roundNotes'], queryFn: () => inpatientAdmissionsService.roundNotes(requireId(), branchId), enabled: active });
  const vitals = useQuery({ queryKey: [...key, 'vitals'], queryFn: () => inpatientAdmissionsService.vitals(requireId(), branchId), enabled: active });
  const submitPrescription = useMutation({ mutationFn: (payload: SaveOpdPrescriptionPayload) => inpatientAdmissionsService.submitPrescription(requireId(), branchId, payload), onSuccess: () => client.invalidateQueries({ queryKey: [...key, 'prescription'] }) });
  const submitClinicalOrder = useMutation({ mutationFn: ({ type, payload }: { type: ApiClinicalOrderType; payload: SaveOpdClinicalOrderPayload }) => inpatientAdmissionsService.submitClinicalOrder(requireId(), branchId, type, payload), onSuccess: (_, variables) => client.invalidateQueries({ queryKey: [...key, variables.type] }) });
  const createRoundNote = useMutation({ mutationFn: (payload: CreateInpatientRoundNotePayload) => inpatientAdmissionsService.createRoundNote(requireId(), branchId, payload), onSuccess: () => client.invalidateQueries({ queryKey: [...key, 'roundNotes'] }) });
  const createVital = useMutation({ mutationFn: (payload: CreateInpatientVitalPayload) => inpatientAdmissionsService.createVital(requireId(), branchId, payload), onSuccess: () => client.invalidateQueries({ queryKey: [...key, 'vitals'] }) });
  return { prescription, laboratory, imaging, roundNotes, vitals, submitPrescription, submitClinicalOrder, createRoundNote, createVital };
}
