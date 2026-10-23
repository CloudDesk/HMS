import { useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { navigate, useAppLocation } from '../../routing/navigation';
import { ophthalmologyIdSchema, subtypeSchema, type OphthalmologyVisitSubtype, type OphthalmologyAlert, type SaveOphthalmologyIntake, type UpdateOphthalmologyContext, type createContextSchema } from '../../api/ophthalmology';
import type { z } from 'zod';
import { useOpdVisit } from '../opd/useOpd';
import { usePatientDocuments } from '../patients/usePatients';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import { useOphthalmologyClinicalWorkspace, useOphthalmologyConfigurations, useOphthalmologyContext, useOphthalmologyIntake, useOphthalmologyIntakeMutations, useOphthalmologyWorkflows } from './useOphthalmology';
import { compatibleSubtypes, consultationAreas } from './consultation-areas';

export function useOphthalmologyWorkspaceFeature() {
  const { search } = useAppLocation();
  const params = new URLSearchParams(search);
  const rawId = params.get('visit_id') ?? '';
  const visitId = ophthalmologyIdSchema.safeParse(rawId).success ? rawId : '';
  const parsedPage = Number(params.get('configuration_page') ?? 1);
  const configurationPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const parsedSubtype = subtypeSchema.safeParse(params.get('subtype'));
  const { user } = useAuth();
  const can = (screen: string, action = 'View') => Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module: 'OPD', screen, action });
  const canReadIntake = can('Ophthalmology Intake') && can('OPD Visits');
  const canView = canReadIntake || can('Ophthalmology Consultation') || can('Ophthalmology Optical Prescription');
  const canEdit = canReadIntake && can('Ophthalmology Intake', 'Edit');
  const canConfigure = can('Ophthalmology Configuration');
  const canEscalate = (canReadIntake && can('Ophthalmology Intake', 'Escalate')) || can('Ophthalmology Consultation', 'Edit') || can('Ophthalmology Consultation', 'Diagnose') || can('Ophthalmology Test Queue', 'Edit') || can('Ophthalmology Test Queue', 'Start');
  const areas = consultationAreas.filter((area) => can(area.screen));
  const selectedArea = areas.find((area) => area.id === params.get('area'));
  const sharedVisitQuery = useOpdVisit(visitId || null, canReadIntake);
  const clinicalWorkspaceQuery = useOphthalmologyClinicalWorkspace(visitId, canView && !canReadIntake);
  const visitQuery = canReadIntake ? sharedVisitQuery : { ...clinicalWorkspaceQuery, data: clinicalWorkspaceQuery.data?.visit };
  const visit = canView && visitQuery.data?.id === visitId ? visitQuery.data : undefined;
  const defaultSubtypeFromVisit = (visitType?: string): OphthalmologyVisitSubtype => {
    if (visitType === 'FOLLOW_UP') return 'FOLLOW_UP';
    if (visitType === 'EMERGENCY') return 'EMERGENCY';
    if (visitType === 'REVIEW' || visitType === 'POST_OPERATIVE') return 'POST_OPERATIVE';
    return 'NEW_CONSULTATION';
  };
  const availableSubtypes = compatibleSubtypes(visit?.visit_type);
  const selectedSubtype = parsedSubtype.success && availableSubtypes.includes(parsedSubtype.data)
    ? parsedSubtype.data
    : availableSubtypes.includes(defaultSubtypeFromVisit(visit?.visit_type))
      ? defaultSubtypeFromVisit(visit?.visit_type)
      : availableSubtypes[0] ?? 'NEW_CONSULTATION';
  const subtype = selectedSubtype;
  const intakeContextQuery = useOphthalmologyContext(visitId, Boolean(visit) && canReadIntake);
  const contextQuery = canReadIntake ? intakeContextQuery : { ...clinicalWorkspaceQuery, data: clinicalWorkspaceQuery.data?.context,
    refetch: () => clinicalWorkspaceQuery.refetch({ cancelRefetch: false }) };
  const candidate = canView ? contextQuery.data : undefined;
  const matchesScope = (value: { visit_id: string; patient_id: string; branch_id: string; department_id: string }) => Boolean(visit && value.visit_id === visit.id && value.patient_id === visit.patient_id && value.branch_id === visit.branch_id && value.department_id === visit.department_id);
  const context = candidate && matchesScope(candidate) ? candidate : undefined;
  const intakeQuery = useOphthalmologyIntake(visitId, Boolean(context) && !contextQuery.isError && canReadIntake);
  const intakeView = canReadIntake && context && intakeQuery.data && (!intakeQuery.data.intake || (matchesScope(intakeQuery.data.intake) && intakeQuery.data.intake.context_id === context.id)) && intakeQuery.data.alerts.every(matchesScope) ? intakeQuery.data : undefined;
  const scopeError = Boolean(candidate && !context) || Boolean(canReadIntake && context && intakeQuery.data && !intakeView);
  const branchId = visit?.branch_id ?? '';
  const editableVisit = Boolean(visit && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(visit.status));
  const contextEditOpen = params.get('edit_context') === 'open' && canEdit && Boolean(context);
  const lookupSubtype = contextEditOpen ? parsedSubtype.success && availableSubtypes.includes(parsedSubtype.data) ? parsedSubtype.data : context?.visit_subtype ?? subtype : subtype;
  const lookupEnabled = canView && canConfigure && editableVisit && Boolean(branchId) && !scopeError;
  const complaintsQuery = useOphthalmologyConfigurations(branchId, 'COMPLAINT', configurationPage, lookupEnabled && Boolean(context));
  const emergenciesQuery = useOphthalmologyConfigurations(branchId, 'CLINICAL_THRESHOLD', configurationPage, lookupEnabled && Boolean(context));
  const completionQuery = useOphthalmologyConfigurations(branchId, 'COMPLETION_PROFILE', configurationPage, lookupEnabled && contextQuery.data === null);
  const workflowsQuery = useOphthalmologyWorkflows(branchId, lookupSubtype, configurationPage, lookupEnabled && (contextQuery.data === null || contextEditOpen));
  const mutations = useOphthalmologyIntakeMutations(visitId);
  const reportsOpen = params.get('reports') === 'open';
  const reportPageRaw = Number(params.get('report_page') ?? 1);
  const reportPage = Number.isSafeInteger(reportPageRaw) && reportPageRaw > 0 ? reportPageRaw : 1;
  const canViewReports = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module: 'Patients', screen: 'Patient Documents', action: 'View' });
  const reportsQuery = usePatientDocuments(visit?.patient_id ?? null, { page: reportPage, limit: 20 }, canView && canViewReports && reportsOpen && Boolean(context));
  const [actionError, setActionError] = useState<{ visitId: string; message: string } | null>(null);
  const lifecycle = useMemo(() => ({ active: true }), [visitId]);
  useLayoutEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false; }; }, [lifecycle]);
  async function perform<T>(action: () => Promise<T>, success: string): Promise<T | undefined> {
    setActionError(null);
    try {
      const result = await action();
      if (lifecycle.active) toast.success(success);
      return lifecycle.active ? result : undefined;
    } catch (error) {
      if (lifecycle.active) setActionError({ visitId, message: getOpdErrorMessage(error) });
      return undefined;
    }
  }
  const lookupData = (query: typeof complaintsQuery) => lookupEnabled ? (query.data?.data ?? []).filter((item) => item.branch_id === branchId && item.status === 'ACTIVE') : [];
  return {
    canViewClinical: can('Ophthalmology Consultation'), canViewOptical: can('Ophthalmology Optical Prescription'),
    openClinical: (tab: string) => { const next = new URLSearchParams(search); next.delete('area'); next.set('section', 'clinical'); next.set('care_tab', tab); navigate(`/opd/ophthalmology?${next}`); },
    canViewQueue: can('Ophthalmology Test Queue'), openQueue: () => { if (visit) navigate(`/opd/ophthalmology/queue?branch_id=${visit.branch_id}&visit_id=${visitId}`); },
    visitId, visit, context, intakeView, scopeError, canView, canEdit: canEdit && editableVisit && !scopeError && !visitQuery.isError && !contextQuery.isError, canConfigure, canEscalate: canEscalate && editableVisit,
    encounterError: visitQuery.error ? getOpdErrorMessage(visitQuery.error) : contextQuery.error ? getOpdErrorMessage(contextQuery.error) : '',
    visitQuery, contextQuery, intakeQuery, complaintsQuery, emergenciesQuery, completionQuery, workflowsQuery,
    complaints: lookupData(complaintsQuery), emergencies: lookupData(emergenciesQuery), completions: lookupData(completionQuery),
    workflows: lookupEnabled ? (workflowsQuery.data?.data ?? []).filter((item) => item.branch_id === branchId && item.status === 'ACTIVE' && item.visit_subtype === lookupSubtype) : [],
    section: selectedArea?.section ?? (params.get('section') === 'completion' ? 'completion' : params.get('section') === 'clinical' ? 'clinical' : params.get('section') === 'tests' ? 'tests' : canReadIntake ? 'intake' : 'clinical'), areas, selectedArea,
    openArea: (id: string) => {
      const area = areas.find((item) => item.id === id);
      if (!area) return;
      const next = new URLSearchParams(search);
      next.set('area', area.id);
      next.delete('completion_action');
      if (area.id === 'prescriptions') {
        next.set('section', 'clinical');
        next.set('care_tab', 'prescription');
      } else if (area.id === 'investigations') {
        next.set('section', 'clinical');
        next.set('care_tab', 'lab-orders');
      } else if (area.id === 'continuing-care') {
        next.set('section', 'clinical');
        next.set('care_tab', 'referral');
      } else {
        next.set('section', area.section);
        if (area.id === 'treatment') next.set('care_tab', 'treatment');
      }
      next.delete('task_id');
      next.delete('amend');
      next.delete('form_profile_id');
      navigate(`/opd/ophthalmology?${next}`);
    },
    openShared: (tab: string) => {
      const tabMap: Record<string, string> = {
        'Prescription': 'prescription',
        'Lab Orders': 'lab-orders',
        'Imaging Orders': 'imaging-orders',
        'Referral': 'referral',
        'Follow-up': 'follow-up',
      };
      const nextCareTab = tabMap[tab] || tab.toLowerCase();
      const next = new URLSearchParams(search);
      next.set('section', 'clinical');
      next.set('care_tab', nextCareTab);
      navigate(`/opd/ophthalmology?${next}`);
    },
    configurationPage, subtype, contextEditOpen, subtypeSelected: Boolean(selectedSubtype), availableSubtypes, actionError: actionError?.visitId === visitId ? actionError.message : null, reportsOpen, reportPage, canViewReports, reportsQuery,
    reports: canView && canViewReports && reportsOpen ? (reportsQuery.data?.data ?? []).filter((item) => item.patient_id === visit?.patient_id) : [],
    busy: Object.values(mutations).some((mutation) => mutation.isPending),
    setQuery: (key: string, value: string) => { const next = new URLSearchParams(search); next.set(key, value); if (key === 'section') next.delete('area'); if (key === 'task_id') { next.delete('amend'); next.delete('form_profile_id'); } navigate(`/opd/ophthalmology?${next}`); },
    back: () => navigate('/opd/queue'),
    create: (body: z.infer<typeof createContextSchema>) => canEdit && !context && editableVisit && !contextQuery.isError && selectedSubtype === body.visit_subtype ? perform(() => mutations.create.mutateAsync(body), 'Ophthalmology context activated.') : Promise.resolve(undefined),
    updateContext: (body: UpdateOphthalmologyContext) => canEdit && editableVisit && context && !scopeError && !visitQuery.isError && !contextQuery.isError ? perform(() => mutations.update.mutateAsync(body), 'Ophthalmology context updated.') : Promise.resolve(undefined),
    save: (body: SaveOphthalmologyIntake) => canEdit && editableVisit && context && intakeView && !scopeError && !visitQuery.isError && !intakeQuery.isError && !contextQuery.isError ? perform(() => mutations.save.mutateAsync(body), 'Intake draft saved.') : Promise.resolve(undefined),
    complete: () => {
      const intake = intakeView?.intake;
      if (!canEdit || !editableVisit || !context || intake?.status !== 'DRAFT' || scopeError || visitQuery.isError || intakeQuery.isError || contextQuery.isError) return Promise.resolve(undefined);
      return perform(() => mutations.complete.mutateAsync({ expected_status: 'DRAFT', expected_version: intake.version, expected_context_version: context.version }), 'Intake completed. Emergency routing was processed by the server.');
    },
    alert: (alert: OphthalmologyAlert, action: 'route' | 'acknowledge', note: string | null) => canEscalate && editableVisit && matchesScope(alert) && alert.status === 'ACTIVE' && !scopeError ? perform(() => mutations.alert.mutateAsync({ id: alert.id, action, body: { expected_version: alert.version, expected_status: 'ACTIVE', ...(action === 'acknowledge' ? { note } : {}) } }), action === 'route' ? 'Emergency routing processed.' : 'Emergency alert acknowledged.') : Promise.resolve(undefined),
    escalate: (reason: string, triggerFindings?: string[], urgency?: 'ROUTINE' | 'URGENT' | 'EMERGENCY') => canEscalate && editableVisit && !scopeError ? perform(() => mutations.escalate.mutateAsync({ reason, trigger_findings: triggerFindings, urgency: urgency ?? 'EMERGENCY' }), 'Emergency escalation processed. On-duty ophthalmologists notified.') : Promise.resolve(undefined),
  };
}
export type OphthalmologyWorkspaceFeature = ReturnType<typeof useOphthalmologyWorkspaceFeature>;
