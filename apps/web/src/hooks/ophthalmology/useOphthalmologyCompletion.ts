import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ophthalmologyService as service } from '../../services/ophthalmology.service';
import type { DeferralWrite, OverrideWrite, CompleteWrite, ReopenWrite, AmendmentWrite } from '../../api/ophthalmology-completion';
export function useOphthalmologyReadiness(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'visit', visitId, 'readiness'], queryFn: ({ signal }) => service.completion.readiness(visitId, signal), enabled, retry: false });
}
export function useOphthalmologySummary(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'visit', visitId, 'summary'], queryFn: ({ signal }) => service.completion.summary(visitId, signal), enabled, retry: false });
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

export function useOphthalmologyFinalizationMutations(visitId: string) {
  const client = useQueryClient();
  const refresh = async () => { await Promise.all([
    client.invalidateQueries({ queryKey: ['ophthalmology', 'visit', visitId] }),
    client.invalidateQueries({ queryKey: ['opd', 'visits', visitId] }),
    client.invalidateQueries({ queryKey: ['opd', 'consultations', visitId] }),
    client.invalidateQueries({ queryKey: ['ophthalmology', 'publications'], predicate: (q) => q.queryKey.some((part) => Boolean(part && typeof part === 'object' && 'visit_id' in part && part.visit_id === visitId)) }),
  ]); };
  return {
    complete: useMutation({ mutationFn: (input: { body: CompleteWrite; key: string }) => service.completion.complete(visitId, input.body, input.key), onSuccess: refresh }),
    reopen: useMutation({ mutationFn: (body: ReopenWrite) => service.completion.reopen(visitId, body), onSuccess: refresh }),
    amend: useMutation({ mutationFn: (body: AmendmentWrite) => service.completion.amend(visitId, body), onSuccess: refresh }),
  };
}
