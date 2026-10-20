import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ophthalmologyService as service } from '../../services/ophthalmology.service';
import type { PublicationQuery, PublicationSource, PublicationWithdrawal } from '../../api/ophthalmology-publications';
export function useOphthalmologyPublications(query: PublicationQuery | null, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'publications', query], queryFn: ({ signal }) => { if (!query) throw new Error('Select valid publication scope.'); return service.publications.list(query, signal); }, enabled: enabled && Boolean(query), retry: false });
}
export function useOphthalmologyPublicationMutations() {
  const client = useQueryClient();
  const refresh = async (row: { branch_id: string }) => { await Promise.all([client.invalidateQueries({ queryKey: ['ophthalmology', 'attachments', row.branch_id] }), client.invalidateQueries({ queryKey: ['ophthalmology', 'publications'], predicate: (q) => q.queryKey.some((part) => Boolean(part && typeof part === 'object' && 'branch_id' in part && part.branch_id === row.branch_id)) })]); };
  return { publish: useMutation({ mutationFn: (input: { source: PublicationSource; key: string }) => service.publications.publish(input.source, input.key), onSuccess: refresh }),
    withdraw: useMutation({ mutationFn: (input: { id: string; body: PublicationWithdrawal }) => service.publications.withdraw(input.id, input.body), onSuccess: refresh }) };
}
