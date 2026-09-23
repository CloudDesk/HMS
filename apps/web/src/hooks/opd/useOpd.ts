import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  opdApi,
  type ApiClinicalOrderType,
  type CreateOpdVisitPayload,
  type OpdVisitListParams,
  type UpdateOpdVisitStatusPayload,
  type SaveOpdConsultationPayload,
  type SaveOpdPrescriptionPayload,
  type SaveOpdClinicalOrderPayload,
  type CreateOpdVitalsPayload,
  type SaveOpdFollowUpPayload,
  type SaveOpdReferralPayload,
  type SaveOpdDentalExaminationPayload,
  type CreateDentalEpisodePayload,
  type UpdateDentalEpisodeStatusPayload,
  type CreateDentalStagePayload,
  type UpdateDentalStageStatusPayload,
  type AssignDoctorStagePayload,
  type ScheduleDentalStagePayload,
  type RescheduleDentalStagePayload,
  type AppointmentForStage,
  type CreateDentalProstheticLabOrderDTO,
  type DentalProstheticLabOrderResponse,
  type UpdateDentalLabOrderStatusPayload,
  type CreateDentalQuotationDTO,
  type UpdateDentalQuotationDraftDTO,
  type AcceptDentalQuotationDTO,
  type RejectDentalQuotationDTO,
  type PostponeDentalQuotationDTO,
  type DentalTreatmentQuotationResponse,
} from '../../api/opd';
import { getOpdErrorMessage } from '../../pages/opd-utils';

type OpdMutationNotificationOptions = {
  notifyOnError?: boolean;
  notifyOnSuccess?: boolean;
};

export const opdKeys = {
  all: ['opd'] as const,
  visits: () => [...opdKeys.all, 'visits'] as const,
  visitDetails: (visitId: string) => [...opdKeys.visits(), visitId] as const,
  vitals: () => [...opdKeys.all, 'vitals'] as const,
  latestVitals: (visitId: string) => [...opdKeys.vitals(), visitId] as const,
  visitList: (params: OpdVisitListParams) => [...opdKeys.visits(), params] as const,
  dashboardSummaries: () => [...opdKeys.all, 'dashboard-summaries'] as const,
  dashboardSummary: (params: OpdVisitListParams) => [...opdKeys.dashboardSummaries(), params] as const,
  consultations: () => [...opdKeys.all, 'consultations'] as const,
  consultation: (visitId: string) => [...opdKeys.consultations(), visitId] as const,
  clinicalOrders: () => [...opdKeys.all, 'clinicalOrders'] as const,
  clinicalOrder: (visitId: string, type: ApiClinicalOrderType) => [...opdKeys.clinicalOrders(), visitId, type] as const,
  prescriptions: () => [...opdKeys.all, 'prescriptions'] as const,
  prescription: (visitId: string) => [...opdKeys.prescriptions(), visitId] as const,
  followUps: () => [...opdKeys.all, 'follow-ups'] as const,
  followUp: (visitId: string) => [...opdKeys.followUps(), visitId] as const,
  referrals: () => [...opdKeys.all, 'referrals'] as const,
  referral: (visitId: string) => [...opdKeys.referrals(), visitId] as const,
  dentalExaminations: () => [...opdKeys.all, 'dental-examinations'] as const,
  dentalExamination: (visitId: string) => [...opdKeys.dentalExaminations(), visitId] as const,
  dentalEpisodes: () => [...opdKeys.all, 'dental-episodes'] as const,
  patientDentalEpisodes: (patientId: string) => [...opdKeys.dentalEpisodes(), 'patient', patientId] as const,
  dentalEpisode: (episodeId: string) => [...opdKeys.dentalEpisodes(), episodeId] as const,
  patientToothHistory: (patientId: string, excludeVisitId?: string) =>
    [...opdKeys.all, 'tooth-history', patientId, excludeVisitId ?? 'all'] as const,
  dentalStages: (episodeId: string, planItemId?: string) =>
    [...opdKeys.all, 'dental-stages', episodeId, planItemId ?? 'all'] as const,
  dentalStage: (stageId: string) => [...opdKeys.all, 'dental-stage', stageId] as const,
  dentalLabOrders: () => [...opdKeys.all, 'dental-lab-orders'] as const,
  dentalLabOrder: (orderId: string) => [...opdKeys.all, 'dental-lab-order', orderId] as const,
  episodeDentalLabOrders: (episodeId: string) => [...opdKeys.all, 'dental-episode-lab-orders', episodeId] as const,
  dentalQuotations: (episodeId: string) => [...opdKeys.all, 'dental-quotations', episodeId] as const,
  dentalQuotation: (quotationId: string) => [...opdKeys.all, 'dental-quotation', quotationId] as const,
  patientDentalQuotations: (patientId: string) => [...opdKeys.all, 'patient-dental-quotations', patientId] as const,
};

export function useOpdDashboardSummary(params: OpdVisitListParams, enabled = true) {
  return useQuery({ queryKey: opdKeys.dashboardSummary(params), queryFn: () => opdApi.dashboardSummary(params), enabled });
}

export function useOpdVisit(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.visitDetails(visitId) : opdKeys.visits(),
    queryFn: () => opdApi.getVisitById(visitId as string),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdLatestVitals(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.latestVitals(visitId) : opdKeys.vitals(),
    queryFn: () => opdApi.getLatestVitals(visitId as string),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdVisits(params: OpdVisitListParams, enabled = true, refetchInterval?: number) {
  return useQuery({
    queryKey: opdKeys.visitList(params),
    queryFn: () => opdApi.listVisits(params),
    enabled,
    refetchInterval,
  });
}

export function useOpdConsultation(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.consultation(visitId) : opdKeys.consultations(),
    queryFn: () => opdApi.getConsultation(visitId as string),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdClinicalOrder(visitId: string | null, type: ApiClinicalOrderType, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.clinicalOrder(visitId, type) : opdKeys.clinicalOrders(),
    queryFn: () => opdApi.getClinicalOrder(visitId as string, type),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdPrescription(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.prescription(visitId) : opdKeys.prescriptions(),
    queryFn: () => opdApi.getPrescription(visitId as string),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdFollowUp(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.followUp(visitId) : opdKeys.followUps(),
    queryFn: () => opdApi.getFollowUp(visitId as string),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdReferral(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.referral(visitId) : opdKeys.referrals(),
    queryFn: () => opdApi.getReferral(visitId as string),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdDentalExamination(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.dentalExamination(visitId) : opdKeys.dentalExaminations(),
    queryFn: () => opdApi.getDentalExamination(visitId as string),
    enabled: enabled && Boolean(visitId),
  });
}

export function useCreateOpdVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateOpdVisitPayload) => opdApi.createVisit(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
      await queryClient.invalidateQueries({ queryKey: opdKeys.dashboardSummaries() });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useUpdateOpdVisitStatus(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateOpdVisitStatusPayload }) =>
      opdApi.updateVisitStatus(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
      await queryClient.invalidateQueries({ queryKey: opdKeys.dashboardSummaries() });
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function useCallNextOpdPatient(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (visitId: string) => opdApi.callNextPatient(visitId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
      await queryClient.invalidateQueries({ queryKey: opdKeys.dashboardSummaries() });
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function useSaveOpdConsultationDraft(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdConsultationPayload }) =>
      opdApi.saveConsultationDraft(visitId, payload),
    onSuccess: async (data, { visitId }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.consultation(visitId) });
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function useCompleteOpdConsultation(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdConsultationPayload }) =>
      opdApi.completeConsultation(visitId, payload),
    onSuccess: async (data, { visitId }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.consultation(visitId) });
      await queryClient.invalidateQueries({ queryKey: opdKeys.visitDetails(visitId) });
      await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function useSubmitOpdPrescription(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdPrescriptionPayload }) =>
      opdApi.submitPrescription(visitId, payload),
    onSuccess: async (data, { visitId }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.prescription(visitId) });
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function useSaveOpdPrescriptionDraft(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdPrescriptionPayload }) =>
      opdApi.savePrescriptionDraft(visitId, payload),
    onSuccess: async (_data, { visitId }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.prescription(visitId) });
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function useSubmitOpdClinicalOrder(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, type, payload }: { visitId: string; type: ApiClinicalOrderType; payload: SaveOpdClinicalOrderPayload }) =>
      opdApi.submitClinicalOrder(visitId, type, payload),
    onSuccess: async (data, { visitId, type }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.clinicalOrder(visitId, type) });
      await queryClient.invalidateQueries({ queryKey: opdKeys.consultation(visitId) });
      await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function useSaveOpdClinicalOrderDraft(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, type, payload }: { visitId: string; type: ApiClinicalOrderType; payload: SaveOpdClinicalOrderPayload }) =>
      opdApi.saveClinicalOrderDraft(visitId, type, payload),
    onSuccess: async (_data, { visitId, type }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.clinicalOrder(visitId, type) });
      await queryClient.invalidateQueries({ queryKey: opdKeys.consultation(visitId) });
      await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function useCreateOpdVitals(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: CreateOpdVitalsPayload }) =>
      opdApi.createVitals(visitId, payload),
    onSuccess: async (data, { visitId }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.latestVitals(visitId) });
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function useSaveOpdFollowUpDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdFollowUpPayload }) =>
      opdApi.saveFollowUpDraft(visitId, payload),
    onSuccess: async (_data, { visitId }) => {
      toast.success('Follow-up draft saved.');
      await queryClient.invalidateQueries({ queryKey: opdKeys.followUp(visitId) });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useScheduleOpdFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdFollowUpPayload }) =>
      opdApi.scheduleFollowUp(visitId, payload),
    onSuccess: async (_data, { visitId }) => {
      toast.success('Follow-up scheduled.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.followUp(visitId) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.visitDetails(visitId) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useSaveOpdReferralDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdReferralPayload }) =>
      opdApi.saveReferralDraft(visitId, payload),
    onSuccess: async (_data, { visitId }) => {
      toast.success('Referral draft saved.');
      await queryClient.invalidateQueries({ queryKey: opdKeys.referral(visitId) });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useSubmitOpdReferral(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdReferralPayload }) =>
      opdApi.submitReferral(visitId, payload),
    onSuccess: async (_data, { visitId }) => {
      if (options.notifyOnSuccess !== false) toast.success('Referral submitted.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.referral(visitId) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.visitDetails(visitId) }),
      ]);
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function useSaveOpdDentalExaminationDraft(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdDentalExaminationPayload }) =>
      opdApi.saveDentalExaminationDraft(visitId, payload),
    onSuccess: async (data, { visitId }) => {
      if (options.notifyOnSuccess !== false) toast.success('Dental examination draft saved.');
      queryClient.setQueryData(opdKeys.dentalExamination(visitId), data);
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function useCompleteOpdDentalExamination(options: OpdMutationNotificationOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdDentalExaminationPayload }) =>
      opdApi.completeDentalExamination(visitId, payload),
    onSuccess: async (data, { visitId }) => {
      queryClient.setQueryData(opdKeys.dentalExamination(visitId), data);
      if (options.notifyOnSuccess !== false) toast.success('Dental examination completed.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.visitDetails(visitId) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.visits() }),
      ]);
    },
    onError: (error) => {
      if (options.notifyOnError !== false) toast.error(getOpdErrorMessage(error));
    },
  });
}

export function usePatientDentalEpisodes(patientId?: string, enabled = true) {
  return useQuery({
    queryKey: opdKeys.patientDentalEpisodes(patientId ?? ''),
    queryFn: () => (patientId ? opdApi.listPatientDentalEpisodes(patientId) : Promise.resolve([])),
    enabled: Boolean(patientId) && enabled,
  });
}

export function useDentalEpisode(episodeId?: string, enabled = true) {
  return useQuery({
    queryKey: opdKeys.dentalEpisode(episodeId ?? ''),
    queryFn: () => (episodeId ? opdApi.getDentalEpisode(episodeId) : Promise.resolve(null)),
    enabled: Boolean(episodeId) && enabled,
  });
}

export function usePatientToothHistory(patientId?: string, excludeVisitId?: string, enabled = true) {
  return useQuery({
    queryKey: opdKeys.patientToothHistory(patientId ?? '', excludeVisitId),
    queryFn: () =>
      patientId
        ? opdApi.getPatientToothHistory(patientId, excludeVisitId)
        : Promise.resolve([]),
    enabled: Boolean(patientId) && enabled,
  });
}

export function useCreateDentalEpisode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDentalEpisodePayload) => opdApi.createDentalEpisode(payload),
    onSuccess: async (data) => {
      toast.success(`Dental Treatment Episode #${data.episode_number} created.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.patientDentalEpisodes(data.patient_id) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalEpisode(data.id) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useLinkVisitToDentalEpisode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ episodeId, visitId }: { episodeId: string; visitId: string }) =>
      opdApi.linkVisitToDentalEpisode(episodeId, visitId),
    onSuccess: async (data) => {
      toast.success(`Visit linked to Dental Episode #${data.episode_number}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.patientDentalEpisodes(data.patient_id) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalEpisode(data.id) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useUpdateDentalEpisodeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      episodeId,
      payload,
    }: {
      episodeId: string;
      payload: UpdateDentalEpisodeStatusPayload;
    }) => opdApi.updateDentalEpisodeStatus(episodeId, payload),
    onSuccess: async (data) => {
      toast.success(`Dental Episode #${data.episode_number} status updated to ${data.status}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.patientDentalEpisodes(data.patient_id) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalEpisode(data.id) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useDentalStages(episodeId: string | null | undefined, planItemId?: string, enabled = true) {
  return useQuery({
    queryKey: episodeId ? opdKeys.dentalStages(episodeId, planItemId) : [...opdKeys.all, 'dental-stages', 'none'],
    queryFn: () => opdApi.listDentalStages(episodeId as string, planItemId),
    enabled: enabled && Boolean(episodeId),
  });
}

export function useCreateDentalStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ episodeId, payload }: { episodeId: string; payload: CreateDentalStagePayload }) =>
      opdApi.createDentalStage(episodeId, payload),
    onSuccess: async (data) => {
      toast.success(`Stage "${data.stage_name}" added.`);
      await queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stages', data.episode_id] });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useAssignDoctorToDentalStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, payload }: { stageId: string; payload: AssignDoctorStagePayload }) =>
      opdApi.assignDoctorToDentalStage(stageId, payload),
    onSuccess: async (data) => {
      toast.success(`Assigned to Dr. ${data.assigned_doctor_name}.`);
      await queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stages', data.episode_id] });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useUpdateDentalStageStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, payload }: { stageId: string; payload: UpdateDentalStageStatusPayload }) =>
      opdApi.updateDentalStageStatus(stageId, payload),
    onSuccess: async (data) => {
      toast.success(`Stage "${data.stage_name}" status updated to ${data.status}.`);
      await queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stages', data.episode_id] });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useDeleteDentalStage(episodeId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stageId: string) => opdApi.deleteDentalStage(stageId),
    onSuccess: async () => {
      toast.success('Treatment stage deleted.');
      if (episodeId) {
        await queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stages', episodeId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stages'] });
      }
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useScheduleDentalStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, payload }: { stageId: string; payload: ScheduleDentalStagePayload }) =>
      opdApi.scheduleDentalStage(stageId, payload),
    onSuccess: async (data) => {
      toast.success(`Stage "${data.stage_name}" scheduled successfully.`);
      await queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stages', data.episode_id] });
      await queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stage-appt', data.id] });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useRescheduleDentalStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, payload }: { stageId: string; payload: RescheduleDentalStagePayload }) =>
      opdApi.rescheduleDentalStage(stageId, payload),
    onSuccess: async (data) => {
      toast.success(`Stage "${data.stage_name}" rescheduled.`);
      await queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stages', data.episode_id] });
      await queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stage-appt', data.id] });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useCancelDentalStageAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stageId, reason }: { stageId: string; reason?: string }) =>
      opdApi.cancelDentalStageAppointment(stageId, reason),
    onSuccess: async (data) => {
      toast.success(`Appointment for stage "${data.stage_name}" cancelled. Stage reverted to Planned.`);
      await queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stages', data.episode_id] });
      await queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stage-appt', data.id] });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useDentalStageAppointment(stageId: string | null | undefined, enabled = true) {
  return useQuery<AppointmentForStage | null>({
    queryKey: stageId ? [...opdKeys.all, 'dental-stage-appt', stageId] : [...opdKeys.all, 'dental-stage-appt', 'none'],
    queryFn: () => (stageId ? opdApi.getDentalStageAppointment(stageId) : Promise.resolve(null)),
    enabled: enabled && Boolean(stageId),
  });
}

export function useDentalLabOrder(orderId?: string | null, enabled = true) {
  return useQuery<DentalProstheticLabOrderResponse | null>({
    queryKey: orderId ? opdKeys.dentalLabOrder(orderId) : [...opdKeys.all, 'dental-lab-order', 'none'],
    queryFn: () => (orderId ? opdApi.getDentalLabOrder(orderId) : Promise.resolve(null)),
    enabled: Boolean(orderId) && enabled,
  });
}

export function useEpisodeDentalLabOrders(episodeId?: string | null, enabled = true) {
  return useQuery<DentalProstheticLabOrderResponse[]>({
    queryKey: episodeId ? opdKeys.episodeDentalLabOrders(episodeId) : [...opdKeys.all, 'dental-episode-lab-orders', 'none'],
    queryFn: () => (episodeId ? opdApi.getEpisodeDentalLabOrders(episodeId) : Promise.resolve([])),
    enabled: Boolean(episodeId) && enabled,
  });
}

export function useCreateDentalLabOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDentalProstheticLabOrderDTO) => opdApi.createDentalLabOrder(payload),
    onSuccess: async (data) => {
      toast.success(`Dental Lab Order ${data.order_number} created successfully.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-episode-lab-orders'] }),
        queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stages'] }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalLabOrder(data.id) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useUpdateDentalLabOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: UpdateDentalLabOrderStatusPayload;
    }) => opdApi.updateDentalLabOrderStatus(orderId, payload),
    onSuccess: async (data) => {
      toast.success(`Dental Lab Order status updated to ${data.status}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalLabOrder(data.id) }),
        queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-episode-lab-orders'] }),
        queryClient.invalidateQueries({ queryKey: [...opdKeys.all, 'dental-stages'] }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useEpisodeDentalQuotations(episodeId?: string | null, enabled = true) {
  return useQuery<DentalTreatmentQuotationResponse[]>({
    queryKey: episodeId ? opdKeys.dentalQuotations(episodeId) : [...opdKeys.all, 'dental-quotations', 'none'],
    queryFn: () => (episodeId ? opdApi.getEpisodeDentalQuotations(episodeId) : Promise.resolve([])),
    enabled: Boolean(episodeId) && enabled,
  });
}

export function useDentalQuotation(quotationId?: string | null, enabled = true) {
  return useQuery<DentalTreatmentQuotationResponse | null>({
    queryKey: quotationId ? opdKeys.dentalQuotation(quotationId) : [...opdKeys.all, 'dental-quotation', 'none'],
    queryFn: () => (quotationId ? opdApi.getDentalQuotation(quotationId) : Promise.resolve(null)),
    enabled: Boolean(quotationId) && enabled,
  });
}

export function useCreateDentalQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ episodeId, payload }: { episodeId: string; payload: CreateDentalQuotationDTO }) =>
      opdApi.createDentalQuotation(episodeId, payload),
    onSuccess: async (data) => {
      toast.success(`Dental Treatment Quotation ${data.quotation_number} created.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotations(data.treatment_episode_id) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotation(data.id) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useUpdateDentalQuotationDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quotationId, payload }: { quotationId: string; payload: UpdateDentalQuotationDraftDTO }) =>
      opdApi.updateDentalQuotationDraft(quotationId, payload),
    onSuccess: async (data) => {
      toast.success(`Dental Treatment Quotation ${data.quotation_number} updated.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotations(data.treatment_episode_id) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotation(data.id) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useSendDentalQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quotationId: string) => opdApi.sendDentalQuotation(quotationId),
    onSuccess: async (data) => {
      toast.success(`Dental Treatment Quotation ${data.quotation_number} sent to patient.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotations(data.treatment_episode_id) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotation(data.id) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useAcceptDentalQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quotationId, payload }: { quotationId: string; payload: AcceptDentalQuotationDTO }) =>
      opdApi.acceptDentalQuotation(quotationId, payload),
    onSuccess: async (data) => {
      toast.success(`Dental Treatment Quotation ${data.quotation_number} accepted.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotations(data.treatment_episode_id) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotation(data.id) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalEpisodes() }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalExaminations() }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalStages(data.treatment_episode_id) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useRejectDentalQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quotationId, payload }: { quotationId: string; payload: RejectDentalQuotationDTO }) =>
      opdApi.rejectDentalQuotation(quotationId, payload),
    onSuccess: async (data) => {
      toast.success(`Dental Treatment Quotation ${data.quotation_number} rejected.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotations(data.treatment_episode_id) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotation(data.id) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function usePostponeDentalQuotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quotationId, payload }: { quotationId: string; payload: PostponeDentalQuotationDTO }) =>
      opdApi.postponeDentalQuotation(quotationId, payload),
    onSuccess: async (data) => {
      toast.success(`Dental Treatment Quotation ${data.quotation_number} marked as postponed.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotations(data.treatment_episode_id) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.dentalQuotation(data.id) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function usePatientDentalQuotations(patientId?: string | null, enabled = true) {
  return useQuery<DentalTreatmentQuotationResponse[]>({
    queryKey: patientId ? opdKeys.patientDentalQuotations(patientId) : [...opdKeys.all, 'patient-dental-quotations', 'none'],
    queryFn: () => (patientId ? opdApi.getPatientDentalQuotations(patientId) : Promise.resolve([])),
    enabled: Boolean(patientId) && enabled,
  });
}




