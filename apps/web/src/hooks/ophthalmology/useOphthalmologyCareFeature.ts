import { useLayoutEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { navigate, useAppLocation } from '../../routing/navigation';
import type { OpdVisitResponse } from '../../api/opd';
import { eyeSchema, ophthalmologyIdSchema as id, type OphthalmologyContext } from '../../api/ophthalmology';
import type { ClinicalReviewWrite, OpticalWrite, ResultReviewWrite } from '../../api/ophthalmology-care';
import { useOpdConsultation } from '../opd/useOpd';
import { useOphthalmologyClinicalConfiguration, useOphthalmologyResult, useOphthalmologyTasks } from './useOphthalmology';
import { useOphthalmologyQueueTask } from './useOphthalmologyQueue';
import { useOphthalmologyCareMutations, useOphthalmologyClinicalReview, useOphthalmologyOpticalPrescription } from './useOphthalmologyCare';
import { getOpdErrorMessage } from '../../pages/opd-utils';

export type CareWorkspace = { visitId: string; visit?: Pick<OpdVisitResponse, 'patient_id' | 'branch_id' | 'department_id' | 'status'>; context?: Pick<OphthalmologyContext, 'id' | 'configuration_version_id' | 'workflow_status'>; canView: boolean; scopeError: boolean; visitQuery: { isError: boolean }; contextQuery: { isError: boolean }; configurationPage: number; setQuery: (key: string, value: string) => void };
export const savedDiagnosisSchema = z.object({ code: z.string().min(1), display: z.string().min(1), codingSystem: z.string(), type: z.enum(['PRIMARY', 'SECONDARY']), laterality: eyeSchema.nullable().optional(), status: z.enum(['SUSPECTED', 'CONFIRMED', 'RULED_OUT']).nullable().optional(), severity: z.string().nullable().optional(), stage: z.string().nullable().optional(), differential: z.boolean().optional(), notes: z.string().nullable().optional() });
export function useOphthalmologyCareFeature(workspace: CareWorkspace) {
  const { search } = useAppLocation(); const params = new URLSearchParams(search); const { user } = useAuth();
  const can = (screen: string, action = 'View') => Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module: 'OPD', screen, action });
  const tab = params.get('care_tab') === 'optical' ? 'optical' : params.get('care_tab') === 'results' ? 'results' : params.get('care_tab') === 'treatment' ? 'treatment' : can('Ophthalmology Consultation') ? 'treatment' : 'optical';
  const enabled = workspace.canView && Boolean(workspace.context && workspace.visit) && !workspace.scopeError && !workspace.visitQuery.isError && !workspace.contextQuery.isError;
  const active = enabled && (params.get('section') === 'clinical' || params.get('area') === 'treatment');
  const canClinical = can('Ophthalmology Consultation'); const canOptical = can('Ophthalmology Optical Prescription'); const canQueue = can('Ophthalmology Test Queue');
  const editable = enabled && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(workspace.visit?.status ?? '') && workspace.context?.workflow_status !== 'CONSULTATION_COMPLETED';
  const clinicalQuery = useOphthalmologyClinicalReview(workspace.visitId, active && tab === 'treatment' && canClinical);
  const opticalQuery = useOphthalmologyOpticalPrescription(workspace.visitId, active && tab === 'optical' && canOptical);
  const consultationQuery = useOpdConsultation(workspace.visitId, active && tab === 'treatment' && canClinical && can('OPD Consultation'));
  const matches = (item: { context_id: string; visit_id: string; patient_id: string; branch_id: string; department_id: string }) => item.context_id === workspace.context?.id && item.visit_id === workspace.visitId && item.patient_id === workspace.visit?.patient_id && item.branch_id === workspace.visit.branch_id && item.department_id === workspace.visit.department_id;
  const clinical = active && tab === 'treatment' && canClinical && clinicalQuery.data && matches(clinicalQuery.data) ? clinicalQuery.data : null;
  const optical = active && tab === 'optical' && canOptical && opticalQuery.data && matches(opticalQuery.data) ? opticalQuery.data : null;
  const consultation = active && tab === 'treatment' && canClinical && can('OPD Consultation') && consultationQuery.data?.visit_id === workspace.visitId && consultationQuery.data.patient_id === workspace.visit?.patient_id ? consultationQuery.data : null;
  const parsedDiagnoses = z.array(savedDiagnosisSchema).safeParse(consultation?.diagnoses ?? []);
  const diagnoses = consultation && parsedDiagnoses.success ? parsedDiagnoses.data : [];
  const numberPage = Number(params.get('review_page') ?? 1); const page = Number.isSafeInteger(numberPage) && numberPage > 0 ? numberPage : 1;
  const taskId = id.safeParse(params.get('review_task_id')).success ? params.get('review_task_id') ?? '' : '';
  const tasksQuery = useOphthalmologyTasks(workspace.visitId, page, active && tab === 'results' && canClinical && canQueue);
  const taskQuery = useOphthalmologyQueueTask(taskId, active && tab === 'results' && canClinical && canQueue && Boolean(taskId));
  const task = active && tab === 'results' && canClinical && canQueue && taskQuery.data?.id === taskId && matches(taskQuery.data) ? taskQuery.data : undefined;
  const resultQuery = useOphthalmologyResult(taskId, active && tab === 'results' && Boolean(task) && !taskQuery.isError);
  const result = canClinical && canQueue && task && resultQuery.data?.task_id === taskId && resultQuery.data.current.laterality === task.laterality && matches(resultQuery.data) ? resultQuery.data : null;
  const scopeError = Boolean(clinicalQuery.data && active && tab === 'treatment' && canClinical && !clinical) || Boolean(opticalQuery.data && active && tab === 'optical' && canOptical && !optical) || Boolean(consultationQuery.data && active && tab === 'treatment' && can('OPD Consultation') && !consultation) || Boolean(active && tab === 'results' && canClinical && canQueue && (taskQuery.data && !task || resultQuery.data && !result));
  const configurationQuery = useOphthalmologyClinicalConfiguration(workspace.visitId, active && tab === 'optical' && canOptical);
  const bound = configurationQuery.data;
  const configuration = active && tab === 'optical' && canOptical && bound && bound.id === workspace.context?.configuration_version_id && bound.branch_id === workspace.visit?.branch_id && bound.status === 'ACTIVE' ? bound : undefined;
  const options = (key: string) => { const parsed = z.array(z.string()).safeParse(configuration?.values[key]); return parsed.success ? parsed.data : null; };
  const mutations = useOphthalmologyCareMutations(workspace.visitId, workspace.visit?.branch_id ?? '');
  const lifecycle = useMemo(() => ({ active: true, pending: false }), [workspace.visitId, workspace.context?.id, tab, taskId]);
  useLayoutEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false; }; }, [lifecycle]);
  const [failure, setFailure] = useState<{ scope: typeof lifecycle; message: string } | null>(null);
  async function perform<T>(operation: () => Promise<T>, message: string) {
    if (lifecycle.pending) return undefined; lifecycle.pending = true; setFailure(null);
    try { const saved = await operation(); if (!lifecycle.active) return undefined; toast.success(message); return saved; }
    catch (error) { if (lifecycle.active) { const message = getOpdErrorMessage(error); setFailure({ scope: lifecycle, message }); toast.error(message); } return undefined; }
    finally { lifecycle.pending = false; }
  }
  const writable = active && editable && !scopeError;
  const canSaveClinical = writable && tab === 'treatment' && canClinical && can('Ophthalmology Consultation', 'Diagnose') && clinicalQuery.isSuccess && !clinicalQuery.isError && !clinicalQuery.isFetching && clinical?.status !== 'COMPLETED' && Boolean(consultation && parsedDiagnoses.success) && !consultationQuery.isError && !consultationQuery.isFetching;
  const canSaveOptical = writable && tab === 'optical' && canOptical && (can('Ophthalmology Optical Prescription', 'Create') || can('Ophthalmology Optical Prescription', 'Edit')) && opticalQuery.isSuccess && !opticalQuery.isError && !opticalQuery.isFetching && optical?.status !== 'APPROVED' && Boolean(configuration) && !configurationQuery.isError;
  const canApproveOptical = writable && tab === 'optical' && canOptical && can('Ophthalmology Optical Prescription', 'Approve') && optical?.status === 'DRAFT' && !opticalQuery.isError && !opticalQuery.isFetching;
  const canReview = writable && tab === 'results' && canClinical && canQueue && can('Ophthalmology Test Review', 'Review') && Boolean(task && ['COMPLETED', 'SUBMITTED_FOR_REVIEW'].includes(task.status) && result?.status === 'COMPLETED') && !taskQuery.isError && !resultQuery.isError && !taskQuery.isFetching && !resultQuery.isFetching;
  const canRequestRepeat = writable && tab === 'results' && canClinical && canQueue && can('Ophthalmology Test Review', 'Request Repeat')
    && Boolean(task && ['COMPLETED', 'SUBMITTED_FOR_REVIEW'].includes(task.status) && !task.repeat_task_id && result?.status === 'COMPLETED')
    && !taskQuery.isError && !resultQuery.isError && !taskQuery.isFetching && !resultQuery.isFetching;
  function checked<T extends { context_id: string; visit_id: string; patient_id: string; branch_id: string; department_id: string }>(saved: T) { if (!matches(saved)) throw new Error('Saved response does not match this patient encounter. Reload before retrying.'); return saved; }
  return {
    workspace,
    showDiagnosisEditor: active && tab === 'treatment' && canClinical && can('Ophthalmology Consultation', 'Diagnose') && can('OPD Consultation', 'Edit') && Boolean(consultation && Number.isInteger(consultation.version)),
    canEditDiagnosis: writable && tab === 'treatment' && canClinical && can('Ophthalmology Consultation', 'Diagnose') && can('OPD Consultation', 'Edit') && Boolean(consultation?.status === 'DRAFT' && Number.isInteger(consultation.version)) && consultationQuery.isSuccess && !consultationQuery.isError && !consultationQuery.isFetching,
    invalidTaskId: Boolean(params.get('review_task_id') && !taskId), tab, active, canClinical, canOptical, canQueue, clinicalQuery, opticalQuery, consultationQuery, clinical, optical, consultation, diagnoses, scopeError, canSaveClinical, canSaveOptical, canApproveOptical, canReview,
    tasksQuery, taskQuery, task, resultQuery, result, taskId, page, tasks: active && tab === 'results' && canClinical && canQueue ? (tasksQuery.data?.data ?? []).filter(matches) : [],
    configuration, configurationQuery, lensTypes: options('lens_types'), materials: options('lens_materials'), coatings: options('coating_codes'), canConfigure: can('Ophthalmology Configuration'), canReadConfiguration: canOptical,
    busy: Object.values(mutations).some((mutation) => mutation.isPending), error: failure?.scope === lifecycle ? failure.message : null,
    saveClinical: (body: ClinicalReviewWrite) => canSaveClinical ? perform(async () => checked(await mutations.clinical.mutateAsync(body)), 'Treatment review draft saved.') : Promise.resolve(undefined),
    saveOptical: (body: OpticalWrite) => canSaveOptical ? perform(async () => { const allowed = (key: string, codes: string[]) => { const choices = options(key); return !choices || codes.every((code) => choices.some((choice) => choice.toUpperCase() === code.toUpperCase())); }; if (!allowed('lens_types', [body.lens_type]) || !allowed('lens_materials', [body.material]) || !allowed('coating_codes', body.coating_codes)) throw new Error('Select values from the bound active configuration.'); return checked(await mutations.optical.mutateAsync(body)); }, 'Optical prescription draft saved.') : Promise.resolve(undefined),
    approveOptical: (version: number) => canApproveOptical ? perform(async () => checked(await mutations.approve.mutateAsync(version)), 'Optical prescription approved.') : Promise.resolve(undefined),
    reviewResult: (body: ResultReviewWrite) => canReview && task ? perform(async () => { const saved = checked(await mutations.review.mutateAsync({ taskId: task.id, body })); if (saved.id !== task.id) throw new Error('The review response does not match the selected task. Reload before retrying.'); return saved; }, 'Selected clinical result version reviewed.') : Promise.resolve(undefined),
    openShared: (tab: string, screen: string) => { if (can(screen)) navigate(`/opd/visit?id=${workspace.visitId}&tab=${encodeURIComponent(tab)}&specialty=ophthalmology`); },
    openSourceResult: () => { if (task && canQueue) navigate(`/opd/ophthalmology/queue?branch_id=${task.branch_id}&visit_id=${task.visit_id}&task_id=${task.id}&section=tests`); },
    canRequestRepeat,
    requestRepeat: () => { if (canRequestRepeat && task) navigate(`/opd/ophthalmology/queue?branch_id=${task.branch_id}&visit_id=${task.visit_id}&task_id=${task.id}&action=request-repeat`); },
    canShared: (screen: string) => can(screen),
  };
}
export type OphthalmologyCareFeature = ReturnType<typeof useOphthalmologyCareFeature>;
