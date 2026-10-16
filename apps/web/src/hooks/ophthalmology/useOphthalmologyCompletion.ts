import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ophthalmologyService as service } from '../../services/ophthalmology.service';
import type { DeferralWrite, OverrideWrite } from '../../api/ophthalmology-completion';
export function useOphthalmologyReadiness(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'visit', visitId, 'readiness'], queryFn: ({ signal }) => service.completion.readiness(visitId, signal), enabled, retry: false });
}
export function useOphthalmologyCompletionHistory(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'visit', visitId, 'completion-history'], queryFn: ({ signal }) => service.completion.history(visitId, signal), enabled, retry: false });
}
export function useOphthalmologyCompletionMutations(visitId: string) {
  const client = useQueryClient();
  const refresh = async () => { await Promise.all(['readiness', 'completion-history'].map((kind) => client.invalidateQueries({ queryKey: ['ophthalmology', 'visit', visitId, kind] }))); };
  return {
    defer: useMutation({ mutationFn: (body: DeferralWrite) => service.completion.defer(visitId, body), onSuccess: refresh }),
    override: useMutation({ mutationFn: (body: OverrideWrite) => service.completion.override(visitId, body), onSuccess: refresh }),
  };
}
