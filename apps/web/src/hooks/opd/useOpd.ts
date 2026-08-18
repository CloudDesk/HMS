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
} from '../../api/opd';
import { getOpdErrorMessage } from '../../pages/opd-utils';

export const opdKeys = {
  all: ['opd'] as const,
  visits: () => [...opdKeys.all, 'visits'] as const,
  visitDetails: (visitId: string) => [...opdKeys.visits(), visitId] as const,
  vitals: () => [...opdKeys.all, 'vitals'] as const,
  latestVitals: (visitId: string) => [...opdKeys.vitals(), visitId] as const,
  visitList: (params: OpdVisitListParams) => [...opdKeys.visits(), params] as const,
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
};

export function useOpdVisit(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.visitDetails(visitId) : opdKeys.visits(),
    queryFn: () => opdApi.getVisitById(visitId!),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdLatestVitals(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.latestVitals(visitId) : opdKeys.vitals(),
    queryFn: () => opdApi.getLatestVitals(visitId!),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdVisits(params: OpdVisitListParams, enabled = true) {
  return useQuery({
    queryKey: opdKeys.visitList(params),
    queryFn: () => opdApi.listVisits(params),
    enabled,
  });
}

export function useOpdConsultation(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.consultation(visitId) : opdKeys.consultations(),
    queryFn: () => opdApi.getConsultation(visitId!),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdClinicalOrder(visitId: string | null, type: ApiClinicalOrderType, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.clinicalOrder(visitId, type) : opdKeys.clinicalOrders(),
    queryFn: () => opdApi.getClinicalOrder(visitId!, type),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdPrescription(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.prescription(visitId) : opdKeys.prescriptions(),
    queryFn: () => opdApi.getPrescription(visitId!),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdFollowUp(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.followUp(visitId) : opdKeys.followUps(),
    queryFn: () => opdApi.getFollowUp(visitId!),
    enabled: enabled && Boolean(visitId),
  });
}

export function useOpdReferral(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: visitId ? opdKeys.referral(visitId) : opdKeys.referrals(),
    queryFn: () => opdApi.getReferral(visitId!),
    enabled: enabled && Boolean(visitId),
  });
}

export function useCreateOpdVisit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateOpdVisitPayload) => opdApi.createVisit(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useUpdateOpdVisitStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateOpdVisitStatusPayload }) =>
      opdApi.updateVisitStatus(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useSaveOpdConsultationDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdConsultationPayload }) =>
      opdApi.saveConsultationDraft(visitId, payload),
    onSuccess: async (data, { visitId }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.consultation(visitId) });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useCompleteOpdConsultation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdConsultationPayload }) =>
      opdApi.completeConsultation(visitId, payload),
    onSuccess: async (data, { visitId }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.consultation(visitId) });
      await queryClient.invalidateQueries({ queryKey: opdKeys.visitDetails(visitId) });
      await queryClient.invalidateQueries({ queryKey: opdKeys.visits() });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useSubmitOpdPrescription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdPrescriptionPayload }) =>
      opdApi.submitPrescription(visitId, payload),
    onSuccess: async (data, { visitId }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.prescription(visitId) });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useSubmitOpdClinicalOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, type, payload }: { visitId: string; type: ApiClinicalOrderType; payload: SaveOpdClinicalOrderPayload }) =>
      opdApi.submitClinicalOrder(visitId, type, payload),
    onSuccess: async (data, { visitId, type }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.clinicalOrder(visitId, type) });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}

export function useCreateOpdVitals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: CreateOpdVitalsPayload }) =>
      opdApi.createVitals(visitId, payload),
    onSuccess: async (data, { visitId }) => {
      await queryClient.invalidateQueries({ queryKey: opdKeys.latestVitals(visitId) });
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
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

export function useSubmitOpdReferral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ visitId, payload }: { visitId: string; payload: SaveOpdReferralPayload }) =>
      opdApi.submitReferral(visitId, payload),
    onSuccess: async (_data, { visitId }) => {
      toast.success('Referral submitted.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: opdKeys.referral(visitId) }),
        queryClient.invalidateQueries({ queryKey: opdKeys.visitDetails(visitId) }),
      ]);
    },
    onError: (error) => toast.error(getOpdErrorMessage(error)),
  });
}
