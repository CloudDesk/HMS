import type { AssignmentLookup } from '../../api/ophthalmology-queue';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ophthalmologyService as service } from '../../services/ophthalmology.service';
import type { CreateQueueTask, QueueCommand, QueueQuery, QueueTask } from '../../api/ophthalmology-queue';

export function useOphthalmologyQueue(params: QueueQuery | null, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'queue', params], queryFn: ({ signal }) => { if (!params) throw new Error('Select valid queue filters.'); return service.queue.list(params, signal); }, enabled: enabled && Boolean(params), retry: false });
}
export function useOphthalmologyQueueTask(id: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'queue-task', id], queryFn: ({ signal }) => service.queue.detail(id, signal), enabled, retry: false });
}
export function useOphthalmologyQueueStation(id: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'queue-station', id], queryFn: ({ signal }) => service.queue.station(id, signal), enabled, retry: false });
}
export function useOphthalmologyBoundWorkflow(id: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'bound-workflow', id], queryFn: ({ signal }) => service.queue.workflow(id, signal), enabled, retry: false });
}
export function useOphthalmologyQueueMutations() {
  const client = useQueryClient();
  const refresh = async (task: QueueTask, ids: string[] = []) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['ophthalmology', 'queue'], predicate: (query) => query.queryKey.some((part) => Boolean(part && typeof part === 'object' && 'branch_id' in part && part.branch_id === task.branch_id)) }),
      client.invalidateQueries({ queryKey: ['ophthalmology', 'visit', task.visit_id] }),
      ...[...new Set([task.id, ...ids])].flatMap((id) => ['queue-task', 'task', 'result'].map((kind) => client.invalidateQueries({ queryKey: ['ophthalmology', kind, id] }))),
    ]);
  };
  return {
    create: useMutation({ mutationFn: (input: { visitId: string; body: CreateQueueTask; key: string }) => service.queue.create(input.visitId, input.body, input.key), onSuccess: (task) => refresh(task) }),
    action: useMutation({ mutationFn: (command: QueueCommand) => service.queue.action(command), onSuccess: (task, command) => refresh(task, [command.task_id, ...(command.action === 'route' && command.body.next_task_id ? [command.body.next_task_id] : [])]) }),
  };
}

export function useOphthalmologyAssignmentStations(taskId: string, query: AssignmentLookup, enabled: boolean) { return useQuery({ queryKey: ['ophthalmology', 'queue', 'task', taskId, 'stations', query], queryFn: ({ signal }) => service.queue.assignmentStations(taskId, query, signal), enabled: enabled && Boolean(taskId), retry: false }); }
export function useOphthalmologyAssignmentStation(taskId: string, stationId: string, query: AssignmentLookup, enabled: boolean) { return useQuery({ queryKey: ['ophthalmology', 'queue', 'task', taskId, 'station', stationId, query], queryFn: ({ signal }) => service.queue.assignmentStation(taskId, stationId, query, signal), enabled: enabled && Boolean(taskId && stationId), retry: false }); }
export function useOphthalmologyAssignmentMembers(taskId: string, query: AssignmentLookup, enabled: boolean) { return useQuery({ queryKey: ['ophthalmology', 'queue', 'task', taskId, 'assignees', query], queryFn: ({ signal }) => service.queue.assignmentMembers(taskId, query, signal), enabled: enabled && Boolean(taskId && query.station_id), retry: false }); }

export function useOphthalmologyTaskWorkspace(taskId: string, enabled: boolean) { return useQuery({ queryKey: ['ophthalmology', 'queue', 'task', taskId, 'workspace'], queryFn: ({ signal }) => service.queue.workspace(taskId, signal), enabled: enabled && Boolean(taskId), retry: false }); }
export function useOphthalmologyTaskClinicalConfigurations(taskId: string, type: 'FORM_PROFILE' | 'OPTICAL_PRODUCT' | 'DRUG_OPTION', page: number, enabled: boolean) { return useQuery({ queryKey: ['ophthalmology', 'queue', 'task', taskId, 'clinical-configurations', type, page], queryFn: ({ signal }) => service.queue.clinicalConfigurations(taskId, type, page, signal), enabled: enabled && Boolean(taskId), retry: false }); }
