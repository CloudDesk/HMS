import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ophthalmologyService as service } from '../../services/ophthalmology.service';
import type { ClinicalCorrectionWrite, CompleteWrite, ConsultationCorrectionWrite, DeferralWrite, OpticalCorrectionWrite, OverrideWrite, ReopenWrite } from '../../api/ophthalmology-completion';
export function useOphthalmologyReadiness(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'visit', visitId, 'readiness'], queryFn: ({ signal }) => service.completion.readiness(visitId, signal), enabled, retry: false });
}
export function useOphthalmologyCompletionHistory(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'visit', visitId, 'completion-history'], queryFn: ({ signal }) => service.completion.history(visitId, signal), enabled, retry: false });
}
export function useOphthalmologyCompletionSummary(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'visit', visitId, 'completion-summary'], queryFn: ({ signal }) => service.completion.summary(visitId, signal), enabled, retry: false });
}
export function useOphthalmologyCompletionMutations(visitId: string) {
  const client = useQueryClient();
  const refresh = async () => { await Promise.all([
    client.invalidateQueries({ queryKey: ['ophthalmology', 'visit', visitId] }),
    client.invalidateQueries({ queryKey: ['opd', 'visits', visitId] }),
    client.invalidateQueries({ queryKey: ['opd', 'consultations', visitId] }),
  ]); };
  return {
    defer: useMutation({ mutationFn: (body: DeferralWrite) => service.completion.defer(visitId, body), onSuccess: refresh }),
    override: useMutation({ mutationFn: (body: OverrideWrite) => service.completion.override(visitId, body), onSuccess: refresh }),
    complete: useMutation({ mutationFn: ({ body, key }: { body: CompleteWrite; key: string }) => service.completion.complete(visitId, body, key), onSuccess: refresh }),
    reopen: useMutation({ mutationFn: (body: ReopenWrite) => service.completion.reopen(visitId, body), onSuccess: refresh }),
    consultation: useMutation({ mutationFn: (body: ConsultationCorrectionWrite) => service.completion.correctConsultation(visitId, body), onSuccess: refresh }),
    clinical: useMutation({ mutationFn: (body: ClinicalCorrectionWrite) => service.completion.correctClinical(visitId, body), onSuccess: refresh }),
    optical: useMutation({ mutationFn: (body: OpticalCorrectionWrite) => service.completion.correctOptical(visitId, body), onSuccess: refresh }),
    approveOptical: useMutation({ mutationFn: (expected_version: number) => service.care.approveOptical(visitId, { expected_version, expected_status: 'DRAFT' }), onSuccess: refresh }),
  };
}
