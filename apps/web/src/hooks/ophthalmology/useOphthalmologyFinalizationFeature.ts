import { useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { useAppLocation } from '../../routing/navigation';
import type { AmendmentWrite, CompleteWrite, Finalization, ReopenWrite, CompletionReadiness } from '../../api/ophthalmology-completion';
import type { CompletionWorkspace } from './useOphthalmologyCompletionFeature';
import { useOphthalmologyFinalizationMutations } from './useOphthalmologyCompletion';
import { useOphthalmologyClinicalReview } from './useOphthalmologyCare';
import { getOpdErrorMessage } from '../../pages/opd-utils';

export type FinalizationCompletion = {
  active: boolean; scopeError: boolean; staleContext: boolean; readiness?: CompletionReadiness; history: Finalization | null;
  readinessQuery: { isSuccess: boolean; isError: boolean; isFetching: boolean }; historyQuery: { isSuccess: boolean; isError: boolean; isFetching: boolean };
  finalizationVersion?: number; unmet: CompletionReadiness['requirements']; writable: boolean;
};
export function useOphthalmologyFinalizationFeature(workspace: CompletionWorkspace, completion: FinalizationCompletion) {
  const { user } = useAuth(); const { search } = useAppLocation(); const raw = new URLSearchParams(search).get('finalization_action');
  const can = (action: string) => Boolean(user?.roles.some((r) => r.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'Ophthalmology Consultation', action });
  const action = raw === 'complete' && (can('Complete') || can('Override')) || raw === 'reopen' && can('Reopen') || raw === 'amend' && can('Amend') ? raw : null;
  const r = completion.readiness; const head = completion.history;
  const fresh = completion.active && !completion.scopeError && !completion.staleContext && !workspace.visitQuery.isError && !workspace.contextQuery.isError
    && completion.readinessQuery.isSuccess && !completion.readinessQuery.isError && !completion.readinessQuery.isFetching
    && completion.historyQuery.isSuccess && !completion.historyQuery.isError && !completion.historyQuery.isFetching && completion.finalizationVersion !== undefined;
  const snapshot = (rows: { code: string; details: string; resource_ids: string[] }[]) => JSON.stringify(rows.map((row) => ({ code: row.code, details: row.details, resource_ids: [...row.resource_ids].sort() })).sort((a, b) => a.code.localeCompare(b.code)));
  const recordedOverride = head?.overrides.at(-1); const exceptionMatches = Boolean(recordedOverride && snapshot(recordedOverride.unmet_snapshot) === snapshot(completion.unmet));
  const canComplete = fresh && can('Complete') && r?.clinical_review_version != null && (r.ready || exceptionMatches)
    && (head?.status === 'AMENDMENT_OPEN' ? workspace.visit?.status === 'COMPLETED' : completion.writable);
  const canReopen = fresh && can('Reopen') && head?.status === 'COMPLETED' && workspace.visit?.status === 'COMPLETED';
  const canAmend = fresh && can('Amend') && head?.status === 'AMENDMENT_OPEN';
  const sourceQuery = useOphthalmologyClinicalReview(workspace.visitId, Boolean(action === 'amend' && canAmend));
  const candidate = sourceQuery.data;
  const source = action === 'amend' && can('Amend') && completion.active && candidate?.visit_id === workspace.visitId && candidate.context_id === workspace.context?.id
    && candidate.patient_id === workspace.visit?.patient_id && candidate.branch_id === workspace.visit.branch_id && candidate.department_id === workspace.visit.department_id ? candidate : null;
  const sourceReady = Boolean(source && source.version === r?.clinical_review_version && sourceQuery.isSuccess && !sourceQuery.isError && !sourceQuery.isFetching);
  const mutations = useOphthalmologyFinalizationMutations(workspace.visitId);
  const scope = useMemo(() => ({ active: true, pending: false }), [workspace.visitId, workspace.context?.id, action, user?.id]);
  useLayoutEffect(() => { scope.active = true; return () => { scope.active = false; }; }, [scope]);
  const [failure, setFailure] = useState<{ scope: typeof scope; message: string } | null>(null);
  async function perform(operation: () => Promise<Finalization>, message: string) {
    if (scope.pending) return undefined; scope.pending = true; setFailure(null);
    try { const saved = await operation(); if (saved.visit_id !== workspace.visitId || saved.context_id !== workspace.context?.id || saved.patient_id !== workspace.visit?.patient_id || saved.branch_id !== workspace.visit.branch_id || saved.department_id !== workspace.visit.department_id) throw new Error('Finalization response does not match this patient encounter. Reload before retrying.'); if (!scope.active) return undefined; toast.success(message); return saved; }
    catch (error) { if (scope.active) setFailure({ scope, message: getOpdErrorMessage(error) }); return undefined; }
    finally { scope.pending = false; }
  }
  return { action, fresh, canComplete, canReopen, canAmend, exceptionMatches, source, sourceQuery, sourceReady,
    busy: Object.values(mutations).some((m) => m.isPending), error: failure?.scope === scope ? failure.message : null,
    complete: (body: CompleteWrite, key: string) => canComplete && action === 'complete' && body.expected_version === completion.finalizationVersion && body.expected_context_version === r?.context_version
      && body.expected_consultation_version === r.consultation_version && body.expected_clinical_review_version === r.clinical_review_version
      && (body.expected_optical_prescription_version ?? null) === r.optical_prescription_version ? perform(() => mutations.complete.mutateAsync({ body, key }), 'Consultation approval recorded.') : Promise.resolve(undefined),
    reopen: (body: ReopenWrite) => canReopen && action === 'reopen' && body.expected_version === completion.finalizationVersion ? perform(() => mutations.reopen.mutateAsync(body), 'Amendment episode opened; active publication snapshots withdrawn.') : Promise.resolve(undefined),
    amend: (body: AmendmentWrite) => canAmend && action === 'amend' && sourceReady && body.expected_version === completion.finalizationVersion && head?.amendment_episodes.some((e) => e.id === body.episode_id && e.status === 'OPEN')
      && JSON.stringify(body.before_value) === JSON.stringify(source?.current[body.section])
      ? perform(() => mutations.amend.mutateAsync(body), 'Correction saved as a new clinical source version. Reapproval is required.') : Promise.resolve(undefined),
  };
}
export type OphthalmologyFinalizationFeature = ReturnType<typeof useOphthalmologyFinalizationFeature>;
