import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ophthalmologyService as service } from '../../services/ophthalmology.service';
import type { ClinicalReviewWrite, OpticalWrite, ResultReviewWrite } from '../../api/ophthalmology-care';

export function useOphthalmologyClinicalReview(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'visit', visitId, 'clinical-review'], queryFn: ({ signal }) => service.care.clinical(visitId, signal), enabled, retry: false });
}
export function useOphthalmologyOpticalPrescription(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'visit', visitId, 'optical'], queryFn: ({ signal }) => service.care.optical(visitId, signal), enabled, retry: false });
}
export function useOphthalmologyCareMutations(visitId: string, branchId: string) {
  const client = useQueryClient();
  const refresh = async () => { await client.invalidateQueries({ queryKey: ['ophthalmology', 'visit', visitId] }); };
  return {
    clinical: useMutation({ mutationFn: (body: ClinicalReviewWrite) => service.care.saveClinical(visitId, body), onSuccess: refresh }),
    optical: useMutation({ mutationFn: (body: OpticalWrite) => service.care.saveOptical(visitId, body), onSuccess: refresh }),
    approve: useMutation({ mutationFn: (expected_version: number) => service.care.approveOptical(visitId, { expected_version, expected_status: 'DRAFT' }), onSuccess: refresh }),
    review: useMutation({ mutationFn: (input: { taskId: string; body: ResultReviewWrite }) => service.care.reviewResult(input.taskId, input.body), onSuccess: async (_, input) => {
      await Promise.all([refresh(), ...['queue-task', 'task', 'result'].map((kind) => client.invalidateQueries({ queryKey: ['ophthalmology', kind, input.taskId] })), client.invalidateQueries({ queryKey: ['ophthalmology', 'queue'], predicate: (query) => query.queryKey.some((part) => Boolean(part && typeof part === 'object' && 'branch_id' in part && part.branch_id === branchId)) })]);
    } }),
  };
}
