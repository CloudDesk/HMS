import { useLayoutEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';
import { useActiveBranch } from '../../context/BranchContext';
import { navigate, useAppLocation } from '../../routing/navigation';
import { ophthalmologyIdSchema as id } from '../../api/ophthalmology';
import { queueQuerySchema, type CreateQueueTask, type QueueCommand, type QueueTask } from '../../api/ophthalmology-queue';
import type { OphthalmologyResultWorkspace } from './useOphthalmologyResultFeature';
import { adminConfigurationSchema } from '../../api/ophthalmology-admin';
import { useBranchesList } from '../branches/useBranches';
import { usePatientDetails } from '../patients/usePatients';
import { useOpdVisit, useOpdVisits, useOpdClinicalOrder } from '../opd/useOpd';
import { useOphthalmologyContext } from './useOphthalmology';
import { useOphthalmologyAdministrationList } from './useOphthalmologyAdministration';
import { useOphthalmologyTaskWorkspace, useOphthalmologyBoundWorkflow, useOphthalmologyQueue, useOphthalmologyQueueMutations, useOphthalmologyAssignmentStation, useOphthalmologyAssignmentStations, useOphthalmologyAssignmentMembers, useOphthalmologyQueueTask } from './useOphthalmologyQueue';
import { queueActionDefinitions } from './queue-actions';
import { getOpdErrorMessage } from '../../pages/opd-utils';

export function useOphthalmologyQueueFeature() {
  const { search } = useAppLocation(); const params = new URLSearchParams(search);
  const { user } = useAuth(); const { activeBranchId } = useActiveBranch();
  const permitted = (module: string, screen: string, action = 'View') => Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN')) || hasPermission(user?.permissions ?? [], { module, screen, action });
  const can = (screen: string, action = 'View') => permitted('OPD', screen, action);
  const canView = can('Ophthalmology Test Queue'); const canConfigure = can('Ophthalmology Configuration'); const canVisits = can('OPD Visits');
  const branchId = params.get('branch_id') ?? activeBranchId ?? '';
  const positive = (key: string) => { const n = Number(params.get(key) ?? 1); return Number.isSafeInteger(n) && n > 0 ? n : 1; };
  const queryInput: Record<string, unknown> = { branch_id: branchId, page: params.get('page') ?? 1, sort: params.get('sort') ?? 'updated_at', direction: params.get('direction') ?? 'desc' };
  for (const key of ['station_id', 'visit_id', 'patient_id', 'assigned_user_id', 'status', 'test_code', 'priority', 'source_type', 'search']) if (params.get(key)) queryInput[key] = params.get(key);
  if (params.get('mine') === '1') queryInput.assigned_user_id = user?.id;
  const parsed = queueQuerySchema.safeParse(queryInput); const query = parsed.success ? parsed.data : null;
  const taskIdRaw = params.get('task_id') ?? ''; const taskId = id.safeParse(taskIdRaw).success ? taskIdRaw : '';
  const invalidTaskId = Boolean(taskIdRaw && !taskId); const list = useOphthalmologyQueue(query, canView && !invalidTaskId);
  const detail = useOphthalmologyQueueTask(taskId, canView && Boolean(query && taskId));
  const task = canView && query && detail.data?.id === taskId && detail.data.branch_id === branchId && (!query.visit_id || detail.data.visit_id === query.visit_id) && (!query.patient_id || detail.data.patient_id === query.patient_id) ? detail.data : undefined;
  const scopeError = Boolean(detail.data && !task && taskId);
  const createOpen = params.get('create') === 'open' && canView && can('Ophthalmology Consultation', 'Edit');
  const visitId = task?.visit_id ?? (id.safeParse(params.get('visit_id')).success ? params.get('visit_id') ?? '' : '');
  const genericVisitQuery = useOpdVisit(visitId || null, canView && canVisits && Boolean(visitId) && (Boolean(task) || createOpen));
  const taskWorkspaceQuery = useOphthalmologyTaskWorkspace(taskId, canView && Boolean(task) && !canVisits && !scopeError);
  const visitQuery = canVisits ? genericVisitQuery : { ...taskWorkspaceQuery, data: task && taskWorkspaceQuery.data && taskWorkspaceQuery.data.context?.id === task.context_id ? taskWorkspaceQuery.data.visit : undefined };
  const visit = (canVisits || Boolean(task)) && visitQuery.data?.id === visitId && visitQuery.data.branch_id === branchId && (!task || (visitQuery.data.patient_id === task.patient_id && visitQuery.data.department_id === task.department_id)) ? visitQuery.data : undefined;
  const visitScopeError = Boolean(canView && canVisits && visitQuery.data && !visit && (task || createOpen));
  const patientId = task?.patient_id ?? visit?.patient_id ?? '';
  const patientQuery = usePatientDetails(patientId || null, canView && permitted('Patients', 'Patient Records') && Boolean(patientId) && !scopeError && !visitScopeError);
  const patient = permitted('Patients', 'Patient Records') && patientQuery.data?.id === patientId ? patientQuery.data : undefined;
  const contextQuery = useOphthalmologyContext(visitId, createOpen && can('Ophthalmology Intake') && Boolean(visit) && !visitQuery.isError);
  const context = createOpen && contextQuery.data && contextQuery.data.visit_id === visit?.id && contextQuery.data.patient_id === visit?.patient_id && contextQuery.data.branch_id === branchId && contextQuery.data.department_id === visit?.department_id ? contextQuery.data : undefined;
  const cataloguePage = positive('catalogue_page');
  const cataloguesQuery = useOphthalmologyAdministrationList('masters', { branch_id: branchId, type: 'TEST_CATALOGUE', status: 'ACTIVE', page: cataloguePage }, createOpen && canConfigure && Boolean(context));
  const workflowOpen = params.get('workflow') === 'open';
  const workflowId = createOpen ? context?.workflow_profile_version_id ?? '' : task?.workflow_profile_version_id ?? '';
  const workflowQuery = useOphthalmologyBoundWorkflow(workflowId, canView && canConfigure && Boolean(workflowId) && (createOpen || workflowOpen));
  const workflow = canConfigure && workflowQuery.data?.id === workflowId && workflowQuery.data.branch_id === branchId ? workflowQuery.data : undefined;
  const action = queueActionDefinitions.find((entry) => entry.action === params.get('action'));
  const allowedActions = task && !scopeError && !visitScopeError ? queueActionDefinitions.filter((entry) => can(entry.screen, entry.permission) && entry.statuses.includes(task.status) && (entry.action !== 'start' || task.assigned_user_id === user?.id) && (entry.action !== 'request-repeat' || !task.repeat_task_id)) : [];
  const actionOpen = Boolean(task && action && can(action.screen, action.permission));
  const routeNext = params.get('route_target') === 'NEXT_STATION';
  const needsAssignment = actionOpen && Boolean(action && (['assign', 'reassign', 'request-repeat'].includes(action.action) || action.action === 'route' && routeNext));
  const routeTaskId = id.safeParse(params.get('route_task_id')).success ? params.get('route_task_id') ?? '' : '';
  const nextTasksQuery = useOphthalmologyQueue(task && query ? { branch_id: branchId, visit_id: task.visit_id, status: 'ORDERED', sort: 'updated_at', direction: 'asc', page: positive('next_page'), limit: 20 } : null, needsAssignment && action?.action === 'route');
  const nextTaskQuery = useOphthalmologyQueueTask(routeTaskId, needsAssignment && action?.action === 'route' && Boolean(routeTaskId));
  const targetTask = nextTaskQuery.data?.id === routeTaskId && nextTaskQuery.data.context_id === task?.context_id && nextTaskQuery.data.branch_id === branchId && nextTaskQuery.data.status === 'ORDERED' ? nextTaskQuery.data : undefined;
  const rawStationId = params.get('action_station_id') ?? task?.station_id ?? ''; const stationId = id.safeParse(rawStationId).success ? rawStationId : '';
  const lookupTarget = action?.action === 'route' && routeNext ? targetTask?.id : undefined;
  const lookupReady = Boolean(task) && (action?.action !== 'route' || !routeNext || Boolean(targetTask));
  const lookupQuery = { ...(lookupTarget ? { target_task_id: lookupTarget } : {}), page: 1, limit: 20 };
  const stationQuery = useOphthalmologyAssignmentStation(taskId, stationId, lookupQuery, canView && actionOpen && lookupReady && Boolean(stationId) && (needsAssignment || action?.action === 'start'));
  const targetCode = action?.action === 'route' && routeNext ? targetTask?.test_code : task?.test_code;
  const compatibleStation = (item: { branch_id: string; department_id: string; status: string; supported_test_types: string[] }) => item.branch_id === branchId && item.department_id === task?.department_id && item.status === 'ACTIVE' && Boolean(targetCode && item.supported_test_types.includes(targetCode));
  const station = stationQuery.data?.id === stationId && compatibleStation(stationQuery.data) ? stationQuery.data : undefined;
  const stationsQuery = useOphthalmologyAssignmentStations(taskId, { ...lookupQuery, page: positive('station_page'), search: (params.get('station_search') ?? '').slice(0, 120) }, canView && needsAssignment && lookupReady);
  const stations = canView && needsAssignment ? (stationsQuery.data?.data ?? []).filter(compatibleStation) : [];
  const usersQuery = useOphthalmologyAssignmentMembers(taskId, { ...lookupQuery, station_id: stationId || undefined, page: positive('member_page'), search: (params.get('member_search') ?? '').slice(0, 120) }, canView && needsAssignment && lookupReady && Boolean(station) && !stationQuery.isError && !stationQuery.isFetching);
  const members = canView && needsAssignment && station && !stationQuery.isError ? usersQuery.data?.data ?? [] : [];
  const visitsQuery = useOpdVisits({ branch_id: branchId, page: positive('visit_page'), limit: 20, search: params.get('visit_search') ?? '', sortBy: 'created_at', sortOrder: 'desc' }, createOpen && canVisits && id.safeParse(branchId).success && !visitId);
  const fromOrder = createOpen && params.get('create_source') === 'CLINICAL_ORDER_ITEM';
  const labQuery = useOpdClinicalOrder(visitId || null, 'LABORATORY', fromOrder && can('OPD Clinical Orders') && Boolean(visit));
  const imagingQuery = useOpdClinicalOrder(visitId || null, 'IMAGING', fromOrder && can('OPD Clinical Orders') && Boolean(visit));
  const orders = fromOrder && can('OPD Clinical Orders') ? [labQuery.data, imagingQuery.data].flatMap((item) => item && item.status !== 'DRAFT' && item.visit_id === visitId && item.patient_id === visit?.patient_id && item.branch_id === branchId ? [item] : []) : [];
  const branchesQuery = useBranchesList({ status: 'ACTIVE', page: positive('branch_page'), limit: 20 }, canView && permitted('Administration', 'Branches') && !user?.branches.length);
  const mutations = useOphthalmologyQueueMutations();
  const scope = `${branchId}:${taskId}:${params.get('action') ?? ''}:${createOpen}:${visitId}:${JSON.stringify(query)}`;
  const lifecycle = useMemo(() => ({ active: true, pending: false }), [scope]);
  useLayoutEffect(() => { lifecycle.active = true; return () => { lifecycle.active = false; }; }, [lifecycle]);
  const [failure, setFailure] = useState<{ scope: string; message: string } | null>(null);
  const setQuery = (updates: Record<string, string | null>) => { setFailure(null); const next = new URLSearchParams(window.location.search); if ('task_id' in updates) { next.delete('amend'); next.delete('form_profile_id'); } for (const [key, value] of Object.entries(updates)) { if (value === null) next.delete(key); else next.set(key, value); } navigate(`/opd/ophthalmology/queue?${next}`); };
  const writable = canView && Boolean(query && task) && !scopeError && !visitScopeError && !detail.isError && !detail.isFetching && !visitQuery.isError && (Boolean(visit) && !visitQuery.isFetching) && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(visit?.status ?? '');
  async function perform<T>(operation: () => Promise<T>, message: string) {
    if (lifecycle.pending) return undefined; lifecycle.pending = true; setFailure(null);
    try { const response = await operation(); if (!lifecycle.active) return undefined; toast.success(message); return response; }
    catch (error) { if (lifecycle.active) setFailure({ scope, message: getOpdErrorMessage(error) }); return undefined; }
    finally { lifecycle.pending = false; }
  }
  const resultWorkspace: OphthalmologyResultWorkspace = { visitId, visit, context: task ? { id: task.context_id } : undefined, canView: canView && Boolean(visit && task), canConfigure, scopeError: scopeError || visitScopeError, configurationPage: positive('configuration_page'), visitQuery, contextQuery: detail, setQuery: (key, value) => setQuery({ [key]: value || null }), returnLabel: 'Return to task details' };
  const checkSavedScope = (saved: QueueTask, expected: { context_id?: string; branch_id: string; visit_id: string; patient_id: string; department_id: string }) => {
    if (saved.branch_id !== expected.branch_id || saved.visit_id !== expected.visit_id || saved.patient_id !== expected.patient_id || saved.department_id !== expected.department_id || expected.context_id && saved.context_id !== expected.context_id) throw new Error('The saved response does not match this encounter. Reload the queue before retrying.');
    return saved;
  };
  return {
    resultWorkspace, resultsOpen: params.get('section') === 'tests', canView, canConfigure, canVisits, canReadPatients: permitted('Patients', 'Patient Records'), canSearchBranches: permitted('Administration', 'Branches') && !user?.branches.length, canReadContext: can('Ophthalmology Intake'), canCreate: can('Ophthalmology Consultation', 'Edit'), canReadOrders: can('OPD Clinical Orders'),
    canEnterResults: resultWorkspace.canView, userId: user?.id ?? '', canStart: can('Ophthalmology Test Queue', 'Start'),
    branchId, query, invalidFilters: Boolean(branchId && !parsed.success) || invalidTaskId, list, detail, task, scopeError: scopeError || visitScopeError,
    rows: canView && query ? (list.data?.data ?? []).filter((item) => item.branch_id === branchId && (!query.visit_id || item.visit_id === query.visit_id) && (!query.patient_id || item.patient_id === query.patient_id)) : [],
    branches: user?.branches.length ? user.branches : canView && permitted('Administration', 'Branches') ? branchesQuery.data?.data ?? [] : [], branchesQuery,
    visit, visitQuery, patient, patientQuery, context, contextQuery, workflow, workflowQuery, workflowOpen, createOpen, cataloguePage, cataloguesQuery,
    catalogues: createOpen && canConfigure ? (cataloguesQuery.data?.data ?? []).flatMap((item) => { const parsed = adminConfigurationSchema.safeParse(item); return parsed.success && parsed.data.type === 'TEST_CATALOGUE' && parsed.data.branch_id === branchId && parsed.data.status === 'ACTIVE' ? [parsed.data] : []; }) : [],
    visits: createOpen && canVisits ? (visitsQuery.data?.data ?? []).filter((item) => item.branch_id === branchId) : [], visitsQuery, visitId, fromOrder, orders, labQuery, imagingQuery,
    action, actionOpen, allowedActions, writable, needsAssignment, routeNext, targetTask, nextTaskQuery, nextTasksQuery,
    nextTasks: needsAssignment ? (nextTasksQuery.data?.data ?? []).filter((item) => item.context_id === task?.context_id && item.branch_id === branchId && item.status === 'ORDERED' && item.id !== task?.id) : [],
    stationId, station, stationQuery, stations, stationsQuery, members, usersQuery, positive, setQuery,
    selfAssignable: Boolean(station?.actor_eligible && !stationQuery.isError && !stationQuery.isFetching && can('Ophthalmology Test Queue', 'Start')), canUsers: canView,
    error: failure?.scope === scope ? failure.message : null, busy: mutations.create.isPending || mutations.action.isPending,
    actionSubmit: (command: QueueCommand) => writable && command.task_id === task?.id && allowedActions.some((entry) => entry.action === command.action) ? perform(async () => checkSavedScope(await mutations.action.mutateAsync(command), task), 'Test task action saved.') : Promise.resolve(undefined),
    createSubmit: (body: CreateQueueTask, key: string) => createOpen && canVisits && canConfigure && context && !contextQuery.isError && !visitQuery.isError && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(visit?.status ?? '') ? perform(async () => checkSavedScope(await mutations.create.mutateAsync({ visitId, body, key }), { ...context, context_id: context.id }), 'Test task created.') : Promise.resolve(undefined),
    openResult: () => { if (resultWorkspace.canView) setQuery({ section: 'tests' }); },
    openEncounter: () => { if (visitId && canVisits && can('Ophthalmology Intake')) navigate(`/opd/ophthalmology?visit_id=${visitId}`); },
  };
}
export type OphthalmologyQueueFeature = ReturnType<typeof useOphthalmologyQueueFeature>;
