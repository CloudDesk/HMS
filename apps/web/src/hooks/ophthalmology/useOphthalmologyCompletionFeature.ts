import { useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { navigate, useAppLocation } from '../../routing/navigation';
import type { OphthalmologyContext } from '../../api/ophthalmology';
import type { ClinicalCorrectionWrite, CompleteWrite, ConsultationCorrectionWrite, DeferralWrite, OpticalCorrectionWrite, OverrideWrite, CompletionCode, ReopenWrite } from '../../api/ophthalmology-completion';
import type { OpdVisitResponse } from '../../api/opd';
import { useDoctorsList } from '../doctors/useDoctors';
import { useOpdClinicalOrder } from '../opd/useOpd';
import { useOphthalmologyTasks } from './useOphthalmology';
import { useOphthalmologyCompletionHistory, useOphthalmologyCompletionMutations, useOphthalmologyCompletionSummary, useOphthalmologyReadiness } from './useOphthalmologyCompletion';
import { getOpdErrorMessage } from '../../pages/opd-utils';

export type CompletionWorkspace = {
  visitId: string; visit?: Pick<OpdVisitResponse, 'patient_id' | 'branch_id' | 'department_id' | 'status'>;
  context?: Pick<OphthalmologyContext, 'id' | 'version' | 'configuration_version_id' | 'workflow_status'>;
  canView: boolean; scopeError: boolean; visitQuery: { isError: boolean }; contextQuery: { isError: boolean; refetch: () => Promise<unknown> };
};
export function useOphthalmologyCompletionFeature(workspace: CompletionWorkspace) {
  const { user } = useAuth(); const { search } = useAppLocation(); const params = new URLSearchParams(search);
  const permitted = (module: string, screen: string, action = 'View') => Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module, screen, action });
  const can = (screen: string, action = 'View') => permitted('OPD', screen, action);
  const canView = can('Ophthalmology Consultation');
  const enabled = workspace.canView && canView && Boolean(workspace.context && workspace.visit) && !workspace.scopeError;
  const active = enabled && (params.get('section') === 'completion' || params.get('area') === 'summary');
  const canQuery = active && !workspace.visitQuery.isError && !workspace.contextQuery.isError;
  const readinessQuery = useOphthalmologyReadiness(workspace.visitId, canQuery);
  const historyQuery = useOphthalmologyCompletionHistory(workspace.visitId, canQuery);
  const summaryQuery = useOphthalmologyCompletionSummary(workspace.visitId, canQuery);
  const matches = (item: { context_id: string; visit_id: string; patient_id: string; branch_id: string; department_id: string }) => item.context_id === workspace.context?.id && item.visit_id === workspace.visitId && item.patient_id === workspace.visit?.patient_id && item.branch_id === workspace.visit.branch_id && item.department_id === workspace.visit.department_id;
  const history = active && historyQuery.data && matches(historyQuery.data) ? historyQuery.data : null;
  const summaryContextMatches = (item: { id: string; visit_id: string; patient_id: string; branch_id: string; department_id: string }) => item.id === workspace.context?.id
    && item.visit_id === workspace.visitId && item.patient_id === workspace.visit?.patient_id && item.branch_id === workspace.visit.branch_id
    && item.department_id === workspace.visit.department_id;
  const summaryResponse = active && summaryQuery.data && summaryContextMatches(summaryQuery.data.summary.context)
    && (!summaryQuery.data.finalization || matches(summaryQuery.data.finalization)) ? summaryQuery.data : undefined;
  const summary = summaryResponse?.summary;
  const readiness = active && readinessQuery.data?.configuration_version_id === workspace.context?.configuration_version_id ? readinessQuery.data : undefined;
  const scopeError = active && (Boolean(historyQuery.data && !history) || Boolean(readinessQuery.data && !readiness) || Boolean(summaryQuery.data && !summaryResponse));
  const staleContext = Boolean(readiness && readiness.context_version !== workspace.context?.version);
  const knownHead = active && historyQuery.isSuccess && !historyQuery.isError && !historyQuery.isFetching && (historyQuery.data === null || Boolean(history));
  const headsMatch = historyQuery.data === null ? summaryResponse?.finalization === null : Boolean(history && summaryResponse?.finalization
    && history.version === summaryResponse.finalization.version && history.status === summaryResponse.finalization.status);
  const writable = canQuery && !scopeError && !staleContext && knownHead && readinessQuery.isSuccess && !readinessQuery.isFetching && !readinessQuery.isError && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(workspace.visit?.status ?? '') && (history?.status ?? 'OPEN') === 'OPEN';
  const canOverride = can('Ophthalmology Consultation', 'Override');
  const requestedAction = params.get('completion_action');
  const action = requestedAction === 'defer' || requestedAction === 'override' || requestedAction === 'complete' || requestedAction === 'reopen'
    || requestedAction === 'correct_consultation' || requestedAction === 'correct_clinical' || requestedAction === 'correct_optical' ? requestedAction : null;
  const deferring = active && action === 'defer';
  const page = (key: string) => { const n = Number(params.get(key) ?? 1); return Number.isSafeInteger(n) && n > 0 ? n : 1; };
  const tasksQuery = useOphthalmologyTasks(workspace.visitId, page('deferral_page'), deferring && canQuery && can('Ophthalmology Test Queue'));
  const labQuery = useOpdClinicalOrder(workspace.visitId, 'LABORATORY', deferring && canQuery && can('OPD Clinical Orders'));
  const imagingQuery = useOpdClinicalOrder(workspace.visitId, 'IMAGING', deferring && canQuery && can('OPD Clinical Orders'));
  const doctorsQuery = useDoctorsList({ branch_id: workspace.visit?.branch_id, department_id: workspace.visit?.department_id, status: 'ACTIVE', page: page('responsible_page'), limit: 20 }, deferring && canQuery && permitted('Doctors', 'Doctor Directory'));
  const tasks = deferring && can('Ophthalmology Test Queue') ? (tasksQuery.data?.data ?? []).filter((task) => matches(task) && !['REVIEWED', 'CANCELLED', 'UNABLE_TO_PERFORM', 'REPEAT_REQUIRED'].includes(task.status) && !history?.deferrals.some((entry) => entry.source_type === 'TEST_TASK' && entry.source_id === task.id)) : [];
  const orders = deferring && can('OPD Clinical Orders') ? [labQuery.data, imagingQuery.data].flatMap((order) => order && order.visit_id === workspace.visitId && order.patient_id === workspace.visit?.patient_id && order.branch_id === workspace.visit.branch_id && !['DRAFT', 'VERIFIED', 'COMPLETED'].includes(order.status) && !history?.deferrals.some((entry) => entry.source_type === 'CLINICAL_ORDER' && entry.source_id === order.id) ? [order] : []) : [];
  const doctors = deferring && permitted('Doctors', 'Doctor Directory') ? (doctorsQuery.data?.data ?? []).filter((doctor) => doctor.status === 'ACTIVE' && doctor.branch_id === workspace.visit?.branch_id && doctor.department_id === workspace.visit.department_id) : [];
  const deferralLookupsUnavailable = deferring && (doctorsQuery.isError || doctorsQuery.isFetching || can('Ophthalmology Test Queue') && (tasksQuery.isError || tasksQuery.isFetching) || can('OPD Clinical Orders') && (labQuery.isError || labQuery.isFetching || imagingQuery.isError || imagingQuery.isFetching));
  const mutations = useOphthalmologyCompletionMutations(workspace.visitId);
  const lifecycle = useMemo(() => ({ active: true, pending: false }), [workspace.visitId, workspace.context?.id, action]);
  useLayoutEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false; }; }, [lifecycle]);
  const [failure, setFailure] = useState<{ scope: typeof lifecycle; message: string } | null>(null);
  async function perform<T extends { context_id: string; visit_id: string; patient_id: string; branch_id: string; department_id: string }>(operation: () => Promise<T>, message: string) {
    if (lifecycle.pending) return undefined; lifecycle.pending = true; setFailure(null);
    try { const saved = await operation(); if (!matches(saved)) throw new Error('Saved completion metadata does not match this encounter. Reload before retrying.'); if (!lifecycle.active) return undefined; toast.success(message); return saved; }
    catch (error) { if (lifecycle.active) setFailure({ scope: lifecycle, message: getOpdErrorMessage(error) }); return undefined; }
    finally { lifecycle.pending = false; }
  }
  const unmet = readiness?.requirements.filter((row) => !row.satisfied) ?? [];
  const latestOverride = history?.overrides.at(-1);
  const overrideMatches = Boolean(unmet.length && latestOverride && [...latestOverride.unmet_codes].sort().join() === unmet.map((row) => row.code).sort().join());
  const sourceVersionsMatch = Boolean(readiness && summary?.consultation && summary.clinical_review
    && readiness.consultation_version === summary.consultation.version && readiness.clinical_review_version === summary.clinical_review.version
    && readiness.optical_prescription_version === (summary.optical_prescription?.version ?? null));
  const stable = canQuery && !scopeError && !staleContext && knownHead && headsMatch && readinessQuery.isSuccess && summaryQuery.isSuccess
    && !readinessQuery.isFetching && !historyQuery.isFetching && !summaryQuery.isFetching;
  const canComplete = can('Ophthalmology Consultation', 'Complete');
  const canReopen = can('Ophthalmology Consultation', 'Reopen');
  const canAmend = can('Ophthalmology Consultation', 'Amend');
  const canApproveOptical = can('Ophthalmology Optical Prescription', 'Approve');
  const completionAllowed = stable && canComplete && sourceVersionsMatch && Boolean(readiness?.ready || overrideMatches)
    && ((history?.status ?? 'OPEN') === 'OPEN' && workspace.visit?.status === 'IN_CONSULTATION'
      || history?.status === 'AMENDMENT_OPEN' && workspace.visit?.status === 'COMPLETED');
  const reopenAllowed = stable && canReopen && history?.status === 'COMPLETED' && workspace.visit?.status === 'COMPLETED';
  const openEpisode = history?.amendment_episodes.find((episode) => episode.status === 'OPEN');
  const correctionAllowed = stable && canAmend && history?.status === 'AMENDMENT_OPEN' && workspace.visit?.status === 'COMPLETED' && Boolean(openEpisode && summary);
  const correctedOptical = summary?.optical_prescription;
  const setQuery = (updates: Record<string, string | null>) => { const next = new URLSearchParams(window.location.search); for (const [key, value] of Object.entries(updates)) { if (value === null) next.delete(key); else next.set(key, value); } navigate(`/opd/ophthalmology?${next}`); };
  const linkFor = (code: CompletionCode) => {
    if (code === 'INTAKE_COMPLETED' || code === 'ALERTS_ACKNOWLEDGED') return can('Ophthalmology Intake') ? { section: 'intake' } : null;
    if (code === 'MANDATORY_TESTS_REVIEWED' || code === 'ALL_RESULTS_RESOLVED') return can('Ophthalmology Test Queue') ? { section: 'clinical', care_tab: 'results' } : null;
    if (code === 'DIAGNOSIS_RECORDED') return can('OPD Consultation') ? { shared: 'Diagnosis' } : null;
    if (code === 'OPTICAL_APPROVED_IF_PRESENT') return can('Ophthalmology Optical Prescription') ? { section: 'clinical', care_tab: 'optical' } : null;
    return { section: 'clinical', care_tab: 'treatment' };
  };
  return {
    canView, active, readinessQuery, historyQuery, summaryQuery, history, summary, readiness, scopeError, staleContext, writable, deferralLookupsUnavailable, canOverride, canComplete, canReopen, canAmend, canApproveOptical, completionAllowed, reopenAllowed, correctionAllowed, openEpisode, action, page, unmet,
    finalizationVersion: active && !scopeError && (historyQuery.data === null || history) ? history?.version ?? 0 : undefined,
    tasksQuery, tasks, labQuery, imagingQuery, orders, doctorsQuery, doctors, canReadTasks: can('Ophthalmology Test Queue'), canReadOrders: can('OPD Clinical Orders'), canReadDoctors: permitted('Doctors', 'Doctor Directory'),
    busy: Object.values(mutations).some((mutation) => mutation.isPending), error: failure?.scope === lifecycle ? failure.message : null, setQuery, linkFor,
    refresh: async () => { if (active) await Promise.all([workspace.contextQuery.refetch(), readinessQuery.refetch(), historyQuery.refetch(), summaryQuery.refetch()]); },
    openRequirement: (code: CompletionCode) => { const link = linkFor(code); if (!link) return; if (link.shared) navigate(`/opd/visit?id=${workspace.visitId}&tab=${link.shared}&specialty=ophthalmology`); else setQuery({ area: null, completion_action: null, section: link.section ?? null, care_tab: link.care_tab ?? null }); },
    defer: (body: DeferralWrite) => writable && !deferralLookupsUnavailable && canOverride && action === 'defer' && doctors.some((doctor) => doctor.id === body.responsible_doctor_id) && (body.source_type === 'TEST_TASK' ? tasks.some((task) => task.id === body.source_id) : orders.some((order) => order.id === body.source_id)) ? perform(() => mutations.defer.mutateAsync(body), 'Result deferral recorded. This does not mark the result reviewed.') : Promise.resolve(undefined),
    override: (body: OverrideWrite) => writable && canOverride && action === 'override' && unmet.length > 0 && body.expected_unmet_codes.length === unmet.length && [...body.expected_unmet_codes].sort().join() === unmet.map((row) => row.code).sort().join() ? perform(() => mutations.override.mutateAsync(body), 'Authorized override recorded. Consultation completion remains separate.') : Promise.resolve(undefined),
    complete: (body: CompleteWrite, key: string) => completionAllowed && action === 'complete' && body.expected_version === (history?.version ?? 0)
      && body.expected_context_version === readiness?.context_version && body.expected_consultation_version === readiness.consultation_version
      && body.expected_clinical_review_version === readiness.clinical_review_version && body.expected_optical_prescription_version === readiness.optical_prescription_version
      ? perform(() => mutations.complete.mutateAsync({ body, key }), history?.status === 'AMENDMENT_OPEN' ? 'Corrected consultation reapproved.' : 'Ophthalmology consultation completed.') : Promise.resolve(undefined),
    reopen: (body: ReopenWrite) => reopenAllowed && action === 'reopen' && body.expected_version === history?.version
      ? perform(() => mutations.reopen.mutateAsync(body), 'Consultation reopened for controlled correction.') : Promise.resolve(undefined),
    correctConsultation: (body: ConsultationCorrectionWrite) => correctionAllowed && action === 'correct_consultation'
      && body.expected_version === history?.version && body.episode_id === openEpisode?.id && body.expected_source_version === summary?.consultation?.version
      ? perform(async () => (await mutations.consultation.mutateAsync(body)).finalization, 'Authoritative OPD consultation corrected.') : Promise.resolve(undefined),
    correctClinical: (body: ClinicalCorrectionWrite) => correctionAllowed && action === 'correct_clinical'
      && body.expected_version === history?.version && body.episode_id === openEpisode?.id && body.expected_source_version === summary?.clinical_review?.version
      ? perform(async () => (await mutations.clinical.mutateAsync(body)).finalization, 'Authoritative clinical review corrected.') : Promise.resolve(undefined),
    correctOptical: (body: OpticalCorrectionWrite) => correctionAllowed && action === 'correct_optical'
      && body.expected_version === history?.version && body.episode_id === openEpisode?.id && body.expected_source_version === summary?.optical_prescription?.version
      ? perform(async () => (await mutations.optical.mutateAsync(body)).finalization, 'Optical prescription corrected. Approve the new draft before reapproval.') : Promise.resolve(undefined),
    approveCorrectedOptical: () => stable && canApproveOptical && history?.status === 'AMENDMENT_OPEN' && correctedOptical?.status === 'DRAFT'
      ? perform(() => mutations.approveOptical.mutateAsync(correctedOptical.version), 'Corrected optical prescription approved. Review readiness before reapproval.') : Promise.resolve(undefined),
  };
}
export type OphthalmologyCompletionFeature = ReturnType<typeof useOphthalmologyCompletionFeature>;
