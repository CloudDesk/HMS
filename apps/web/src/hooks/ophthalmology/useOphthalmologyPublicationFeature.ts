import { useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { navigate, useAppLocation } from '../../routing/navigation';
import { publicationQuerySchema, type PublicationSource, type PublicationWithdrawal, type OphthalmologyPublication } from '../../api/ophthalmology-publications';
import { useOphthalmologyPublications, useOphthalmologyPublicationMutations } from './useOphthalmologyPublications';
import { getOpdErrorMessage } from '../../pages/opd-utils';

export type PublicationScope = Pick<OphthalmologyPublication, 'context_id' | 'visit_id' | 'patient_id' | 'branch_id' | 'department_id'>;
export function useOphthalmologyPublicationFeature(scope: PublicationScope, source: PublicationSource, sourceApproved: boolean) {
  const { user } = useAuth(); const { search, pathname } = useAppLocation(); const params = new URLSearchParams(search);
  const can = (action: string) => Boolean(user?.roles.some((r) => r.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'Ophthalmology Portal Publication', action });
  const canView = can('View'); const open = canView && params.get('publication_source') === source.source_id;
  const selectedVersion = Number(params.get('publication_version'));
  const sourceChanged = open && selectedVersion !== source.source_version;
  const page = Number(params.get('publication_page') ?? 1);
  const parsed = publicationQuerySchema.safeParse({ branch_id: scope.branch_id, visit_id: scope.visit_id, source_id: source.source_id, source_type: source.source_type, source_version: selectedVersion, page, limit: 20 });
  const query = parsed.success ? parsed.data : null; const list = useOphthalmologyPublications(query, open && !sourceChanged);
  const matches = (row: OphthalmologyPublication) => row.context_id === scope.context_id && row.visit_id === scope.visit_id && row.patient_id === scope.patient_id && row.branch_id === scope.branch_id && row.department_id === scope.department_id && row.source_type === source.source_type && row.source_id === source.source_id && row.source_version === selectedVersion;
  const scopeError = open && Boolean(list.data?.data.some((row) => !matches(row))); const records = open && !scopeError ? list.data?.data ?? [] : [];
  const fresh = open && !sourceChanged && Boolean(query) && !scopeError && list.isSuccess && !list.isError && !list.isFetching;
  const current = page === 1 ? records[0] : undefined;
  const canPublish = fresh && page === 1 && sourceApproved && can('Publish') && current?.status !== 'APPROVED_FOR_PORTAL';
  const canWithdraw = fresh && can('Withdraw'); const selected = records.find((r) => r.id === params.get('withdraw_publication_id'));
  const mutations = useOphthalmologyPublicationMutations();
  const lifecycle = useMemo(() => ({ active: true, pending: false }), [scope.visit_id, scope.patient_id, source.source_id, source.source_version, selectedVersion, open, user?.id]);
  useLayoutEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false; }; }, [lifecycle]);
  const [failure, setFailure] = useState<{ scope: typeof lifecycle; message: string } | null>(null);
  const setQuery = (updates: Record<string, string | null>) => { const next = new URLSearchParams(window.location.search); for (const [key, value] of Object.entries(updates)) { if (value === null) next.delete(key); else next.set(key, value); } navigate(`${pathname}?${next}`); };
  async function perform(operation: () => Promise<OphthalmologyPublication>, message: string, expectedStatus: OphthalmologyPublication['status']) {
    if (lifecycle.pending) return undefined; lifecycle.pending = true; setFailure(null);
    try { const saved = await operation(); if (!matches(saved) || saved.status !== expectedStatus) throw new Error('Publication response does not match the selected source and encounter. Reload before retrying.'); if (!lifecycle.active) return undefined; toast.success(message); return saved; }
    catch (error) { if (lifecycle.active) setFailure({ scope: lifecycle, message: getOpdErrorMessage(error) }); return undefined; }
    finally { lifecycle.pending = false; }
  }
  return { canView, open, sourceChanged, page, list, records, scopeError, invalid: !parsed.success, fresh, current, canPublish, canWithdraw, selected, setQuery,
    busy: mutations.publish.isPending || mutations.withdraw.isPending, error: failure?.scope === lifecycle ? failure.message : null,
    refresh: () => { if (open && query) void list.refetch(); },
    publish: (candidate: PublicationSource, key: string) => canPublish && candidate.source_type === source.source_type && candidate.source_id === source.source_id && candidate.source_version === source.source_version ? perform(() => mutations.publish.mutateAsync({ source: candidate, key }), 'Exact clinical version approved for patient viewing.', 'APPROVED_FOR_PORTAL') : Promise.resolve(undefined),
    withdraw: (row: OphthalmologyPublication, body: PublicationWithdrawal) => canWithdraw && matches(row) && row.status === 'APPROVED_FOR_PORTAL' && row.version === body.expected_version && records.some((current) => current.id === row.id && current.version === row.version) ? perform(() => mutations.withdraw.mutateAsync({ id: row.id, body }), 'Publication withdrawn. The original clinical record is preserved.', 'WITHDRAWN') : Promise.resolve(undefined),
  };
}
export type OphthalmologyPublicationFeature = ReturnType<typeof useOphthalmologyPublicationFeature>;
