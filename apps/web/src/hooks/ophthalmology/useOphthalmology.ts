import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ophthalmologyService as service } from '../../services/ophthalmology.service';
import type { ConfigurationType, SaveOphthalmologyIntake, SaveOphthalmologyResult, CompleteOphthalmologyResult, AlertAction, AmendOphthalmologyResult, UploadOphthalmologyAttachment } from '../../api/ophthalmology';

export const ophthalmologyKeys = {
  visit: (id: string) => ['ophthalmology', 'visit', id] as const,
  context: (id: string) => [...ophthalmologyKeys.visit(id), 'context'] as const,
  intake: (id: string) => [...ophthalmologyKeys.visit(id), 'intake'] as const,
};
export function useOphthalmologyContext(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: ophthalmologyKeys.context(visitId), queryFn: ({ signal }) => service.context(visitId, signal), enabled, retry: false });
}
export function useOphthalmologyIntake(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: ophthalmologyKeys.intake(visitId), queryFn: ({ signal }) => service.intake(visitId, signal), enabled, retry: false });
}
export function useOphthalmologyConfigurations(branchId: string, type: ConfigurationType, page: number, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'configuration', branchId, type, page], queryFn: ({ signal }) => service.configurations(branchId, type, page, signal), enabled, retry: false });
}
export function useOphthalmologyWorkflows(branchId: string, subtype: Parameters<typeof service.workflows>[1], page: number, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'workflow', branchId, subtype, page], queryFn: ({ signal }) => service.workflows(branchId, subtype, page, signal), enabled, retry: false });
}
export function useOphthalmologyIntakeMutations(visitId: string) {
  const client = useQueryClient();
  const refresh = () => { void client.invalidateQueries({ queryKey: ophthalmologyKeys.visit(visitId) }); };
  const create = useMutation({ mutationFn: (body: Parameters<typeof service.createContext>[1]) => service.createContext(visitId, body), onSuccess: refresh });
  const update = useMutation({ mutationFn: (body: Parameters<typeof service.updateContext>[1]) => service.updateContext(visitId, body), onSuccess: refresh });
  const save = useMutation({ mutationFn: (body: SaveOphthalmologyIntake) => service.saveIntake(visitId, body), onSuccess: refresh });
  const complete = useMutation({ mutationFn: (body: Parameters<typeof service.completeIntake>[1]) => service.completeIntake(visitId, body), onSuccess: refresh });
  const alert = useMutation({ mutationFn: ({ id, action, body }: { id: string; action: 'route' | 'acknowledge'; body: AlertAction }) => service.alert(visitId, id, action, body), onSuccess: refresh });
  const escalate = useMutation({ mutationFn: (body: Parameters<typeof service.escalateAlert>[1]) => service.escalateAlert(visitId, body), onSuccess: refresh });
  const clear = useMutation({ mutationFn: ({ id, body }: { id: string; body: Parameters<typeof service.clearAlert>[2] }) => service.clearAlert(visitId, id, body), onSuccess: refresh });
  return { create, update, save, complete, alert, escalate, clear };
}
export function useOphthalmologyTasks(visitId: string, page: number, enabled: boolean) {
  return useQuery({ queryKey: [...ophthalmologyKeys.visit(visitId), 'tasks', page], queryFn: ({ signal }) => service.tasks(visitId, page, signal), enabled, retry: false });
}
export function useOphthalmologyComparisons(taskId: string, expectedVersion: number, page: number, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'comparisons', taskId, expectedVersion, page], queryFn: ({ signal }) => service.comparisons(taskId, expectedVersion, page, signal), enabled, retry: false });
}
export function useOphthalmologyResult(taskId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'result', taskId], queryFn: ({ signal }) => service.result(taskId, signal), enabled, retry: false });
}
export function useOphthalmologyTask(taskId: string, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'task', taskId], queryFn: ({ signal }) => service.task(taskId, signal), enabled, retry: false });
}
export function useOphthalmologyAttachments(branchId: string, taskId: string, page: number, enabled: boolean) {
  return useQuery({ queryKey: ['ophthalmology', 'attachments', branchId, taskId, page], queryFn: ({ signal }) => service.attachments(branchId, taskId, page, signal), enabled, retry: false });
}
export function useOphthalmologyResultMutations(visitId: string, taskId: string) {
  const client = useQueryClient();
  const refresh = (result: { branch_id: string }) => {
    void client.invalidateQueries({ queryKey: ['ophthalmology', 'queue-task', taskId] });
    void client.invalidateQueries({ queryKey: ['ophthalmology', 'queue'], predicate: (query) => query.queryKey.some((part) => Boolean(part && typeof part === 'object' && 'branch_id' in part && part.branch_id === result.branch_id)) });
    void client.invalidateQueries({ queryKey: ['ophthalmology', 'result', taskId] });
    void client.invalidateQueries({ queryKey: ['ophthalmology', 'task', taskId] });
    void client.invalidateQueries({ queryKey: ophthalmologyKeys.visit(visitId) });
  };
  return {
    save: useMutation({ mutationFn: (body: SaveOphthalmologyResult) => service.saveResult(taskId, body), onSuccess: refresh }),
    amend: useMutation({ mutationFn: (body: AmendOphthalmologyResult) => service.amendResult(taskId, body), onSuccess: refresh }),
    upload: useMutation({ mutationFn: (body: UploadOphthalmologyAttachment) => service.uploadAttachment(body), onSuccess: () => { void client.invalidateQueries({ queryKey: ['ophthalmology', 'attachments'] , predicate: (query) => query.queryKey[3] === taskId }); } }),
    complete: useMutation({ mutationFn: (body: CompleteOphthalmologyResult) => service.completeResult(taskId, body), onSuccess: refresh }),
  };
}

export function useOphthalmologyClinicalWorkspace(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: [...ophthalmologyKeys.visit(visitId), 'clinical-workspace'], queryFn: ({ signal }) => service.clinicalWorkspace(visitId, signal), enabled: enabled && Boolean(visitId), retry: false });
}
export function useOphthalmologyClinicalConfiguration(visitId: string, enabled: boolean) {
  return useQuery({ queryKey: [...ophthalmologyKeys.visit(visitId), 'clinical-configuration'], queryFn: ({ signal }) => service.clinicalConfiguration(visitId, signal), enabled: enabled && Boolean(visitId), retry: false });
}
