import { useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useOphthalmologyAttachmentDownload } from './useOphthalmologyAttachmentDownload';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { useAppLocation } from '../../routing/navigation';
import { ophthalmologyIdSchema, type SaveOphthalmologyResult, type AmendOphthalmologyResult, type UploadOphthalmologyAttachment } from '../../api/ophthalmology';
import { useOphthalmologyAttachments, useOphthalmologyConfigurations, useOphthalmologyResult, useOphthalmologyResultMutations, useOphthalmologyTask, useOphthalmologyTasks } from './useOphthalmology';
import type { OpdVisitResponse } from '../../api/opd';

export type OphthalmologyResultWorkspace = {
  visitId: string; visit?: Pick<OpdVisitResponse, 'patient_id' | 'branch_id' | 'department_id' | 'status'>; context?: { id: string };
  canView: boolean; canConfigure: boolean; scopeError: boolean; configurationPage: number;
  visitQuery: { isError: boolean }; contextQuery: { isError: boolean };
  setQuery: (key: string, value: string) => void; returnLabel?: string;
};
import { getOpdErrorMessage } from '../../pages/opd-utils';

export function useOphthalmologyResultFeature(workspace: OphthalmologyResultWorkspace) {
  const { user } = useAuth();
  const { search } = useAppLocation();
  const params = new URLSearchParams(search);
  const section = params.get('section') === 'tests' ? 'tests' : 'intake';
  const rawPage = Number(params.get('task_page') ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const rawId = params.get('task_id') ?? '';
  const taskId = ophthalmologyIdSchema.safeParse(rawId).success ? rawId : '';
  const can = (action: string) => Boolean(user?.roles?.some((role) => role.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'Ophthalmology Test Queue', action });
  const enabled = workspace.canView && can('View') && section === 'tests' && Boolean(workspace.context) && !workspace.scopeError;
  const canQuery = enabled && !workspace.contextQuery.isError && !workspace.visitQuery.isError;
  const tasksQuery = useOphthalmologyTasks(workspace.visitId, page, canQuery);
  const taskQuery = useOphthalmologyTask(taskId, canQuery && Boolean(taskId));
  const matchesScope = (item: { visit_id: string; patient_id: string; branch_id: string; department_id: string; context_id: string }) => item.visit_id === workspace.visitId && item.patient_id === workspace.visit?.patient_id && item.branch_id === workspace.visit.branch_id && item.department_id === workspace.visit.department_id && item.context_id === workspace.context?.id;
  const task = enabled && taskQuery.data?.id === taskId && matchesScope(taskQuery.data) ? taskQuery.data : undefined;
  const resultQuery = useOphthalmologyResult(taskId, canQuery && Boolean(task) && !taskQuery.isError);
  const result = enabled && resultQuery.data?.task_id === taskId && matchesScope(resultQuery.data) ? resultQuery.data : null;
  const scopeError = enabled && (Boolean(taskQuery.data && !task) || Boolean(resultQuery.data && !result));
  const profilesQuery = useOphthalmologyConfigurations(workspace.visit?.branch_id ?? '', 'FORM_PROFILE', workspace.configurationPage, canQuery && workspace.canConfigure && Boolean(task) && can('Edit'));
  const mutations = useOphthalmologyResultMutations(workspace.visitId, taskId);
  const canAmend = Boolean(user?.roles?.some((role) => role.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module: 'OPD', screen: 'Ophthalmology Test Review', action: 'Amend' });
  const amending = params.get('amend') === '1' && canAmend && task?.status === 'COMPLETED' && result?.status === 'COMPLETED';
  const attachmentsOpen = params.get('attachments') === 'open';
  const rawAttachmentPage = Number(params.get('attachment_page') ?? 1);
  const attachmentPage = Number.isSafeInteger(rawAttachmentPage) && rawAttachmentPage > 0 ? rawAttachmentPage : 1;
  const attachmentsQuery = useOphthalmologyAttachments(workspace.visit?.branch_id ?? '', taskId, attachmentPage, canQuery && attachmentsOpen && Boolean(task));
  const lookupsOpen = params.get('clinical_lookups') === 'open';
  const formType = result?.current.form_type ?? profilesQuery.data?.data.find((profile) => profile.id === params.get('form_profile_id'))?.values.form_type;
  const productsQuery = useOphthalmologyConfigurations(workspace.visit?.branch_id ?? '', 'OPTICAL_PRODUCT', workspace.configurationPage, canQuery && workspace.canConfigure && lookupsOpen && formType === 'CONTACT_LENS');
  const drugsQuery = useOphthalmologyConfigurations(workspace.visit?.branch_id ?? '', 'DRUG_OPTION', workspace.configurationPage, canQuery && workspace.canConfigure && lookupsOpen && formType === 'PAEDIATRIC_VISION');
  const [error, setError] = useState<{ visitId: string; taskId: string; message: string } | null>(null);
  const lifecycle = useMemo(() => ({ active: true }), [workspace.visitId, taskId]);
  useLayoutEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false; }; }, [lifecycle]);
  const writable = canQuery && Boolean(workspace.visit && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(workspace.visit.status)) && !scopeError && !taskQuery.isError && !resultQuery.isError && resultQuery.isSuccess;
  const canEdit = writable && (amending || (can('Edit') && Boolean(task && ['IN_PROGRESS', 'DRAFT'].includes(task.status))));
  const attachments = enabled && attachmentsOpen ? (attachmentsQuery.data?.data ?? []).filter((item) => matchesScope(item) && item.task_id === taskId) : [];
  const downloads = useOphthalmologyAttachmentDownload(workspace, taskId, attachments, canQuery && !scopeError && Boolean(task) && !taskQuery.isError && attachmentsOpen && attachmentsQuery.isSuccess && !attachmentsQuery.isError && !attachmentsQuery.isFetching);
  return {
    ...downloads,
    section, canView: can('View'), page, taskId, tasksQuery, taskQuery, resultQuery, resultLoaded: resultQuery.isSuccess || resultQuery.data !== undefined, profilesQuery, task, result, scopeError, error: error?.visitId === workspace.visitId && error.taskId === taskId ? error.message : null,
    tasks: enabled ? (tasksQuery.data?.data ?? []).filter(matchesScope) : [],
    profiles: enabled && workspace.canConfigure ? (profilesQuery.data?.data ?? []).filter((profile) => profile.branch_id === workspace.visit?.branch_id && profile.status === 'ACTIVE') : [],
    canEdit, canAmend: writable && canAmend && task?.status === 'COMPLETED' && result?.status === 'COMPLETED', amending,
    attachmentsOpen, attachmentPage, attachmentsQuery, attachments,
    lookupsOpen, productsQuery, drugsQuery,
    products: canQuery && workspace.canConfigure && lookupsOpen ? (productsQuery.data?.data ?? []).filter((item) => item.branch_id === workspace.visit?.branch_id && item.status === 'ACTIVE') : [],
    drugs: canQuery && workspace.canConfigure && lookupsOpen ? (drugsQuery.data?.data ?? []).filter((item) => item.branch_id === workspace.visit?.branch_id && item.status === 'ACTIVE') : [],
    canAttach: writable && can('Edit') && Boolean(task && ['IN_PROGRESS', 'DRAFT', 'COMPLETED', 'SUBMITTED_FOR_REVIEW', 'REVIEWED', 'REPEAT_REQUIRED'].includes(task.status)),
    busy: mutations.save.isPending || mutations.complete.isPending || mutations.amend.isPending || mutations.upload.isPending,
    reload: async () => {
      if (!enabled || !taskId) return undefined;
      const [freshTask, freshResult] = await Promise.all([taskQuery.refetch(), resultQuery.refetch()]);
      if (!lifecycle.active || freshTask.isError || freshResult.isError || !freshTask.data || !matchesScope(freshTask.data) || freshTask.data.id !== taskId || freshResult.data === undefined) return undefined;
      if (freshResult.data && (!matchesScope(freshResult.data) || freshResult.data.task_id !== taskId)) return undefined;
      return { task: freshTask.data, result: freshResult.data };
    },
    save: async (body: SaveOphthalmologyResult) => {
      if (!canEdit || amending) return undefined;
      setError(null);
      try { const saved = await mutations.save.mutateAsync(body); if (lifecycle.active) toast.success('Test result draft saved.'); return lifecycle.active ? saved : undefined; }
      catch (cause) { if (lifecycle.active) setError({ visitId: workspace.visitId, taskId, message: getOpdErrorMessage(cause) }); return undefined; }
    },
    amend: async (body: AmendOphthalmologyResult) => {
      if (!canEdit || !amending) return undefined;
      setError(null);
      try { const saved = await mutations.amend.mutateAsync(body); if (lifecycle.active) toast.success('Correction saved as a new clinical version.'); return lifecycle.active ? saved : undefined; }
      catch (cause) { if (lifecycle.active) setError({ visitId: workspace.visitId, taskId, message: getOpdErrorMessage(cause) }); return undefined; }
    },
    upload: async (input: UploadOphthalmologyAttachment) => {
      if (!writable || !can('Edit') || !task || !['IN_PROGRESS', 'DRAFT', 'COMPLETED', 'SUBMITTED_FOR_REVIEW', 'REVIEWED', 'REPEAT_REQUIRED'].includes(task.status) || input.task_id !== taskId || (input.result_id && input.result_id !== result?.id)) return undefined;
      setError(null);
      try { const saved = await mutations.upload.mutateAsync(input); if (!matchesScope(saved) || saved.task_id !== taskId) throw new Error('The upload response does not match this encounter. Do not retry with a new key; reload attachments and contact support.'); if (lifecycle.active) toast.success('Attachment uploaded for internal use. Review and publication remain separate.'); return lifecycle.active ? saved : undefined; }
      catch (cause) { if (lifecycle.active) setError({ visitId: workspace.visitId, taskId, message: getOpdErrorMessage(cause) }); return undefined; }
    },
    complete: async () => {
      if (!canEdit || !can('Complete') || task?.status !== 'DRAFT' || !result) return undefined;
      setError(null);
      try { const completed = await mutations.complete.mutateAsync({ expected_task_status: 'DRAFT', expected_task_version: task.version, expected_result_version: result.version }); if (lifecycle.active) toast.success('Test result completed. Doctor review remains separate.'); return lifecycle.active ? completed : undefined; }
      catch (cause) { if (lifecycle.active) setError({ visitId: workspace.visitId, taskId, message: getOpdErrorMessage(cause) }); return undefined; }
    },
    canComplete: canEdit && can('Complete') && task?.status === 'DRAFT' && result?.status === 'DRAFT',
  };
}
export type OphthalmologyResultFeature = ReturnType<typeof useOphthalmologyResultFeature>;
