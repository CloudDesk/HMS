import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateEmergencyPayload,
  EmergencyListParams,
  EmergencyTriageLevel,
} from '../../api/emergency';
import { emergencyService } from '../../services/emergency.service';
const keys = {
  all: ['emergency'] as const,
  list: (params: EmergencyListParams) => ['emergency', 'list', params] as const,
  summary: (branch: string) => ['emergency', 'summary', branch] as const,
  detail: (id: string, branch: string) => ['emergency', 'detail', id, branch] as const,
};
export function useEmergency(
  params: EmergencyListParams,
  selectedId: string | null,
  enabled: boolean,
) {
  const client = useQueryClient();
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: keys.all });
  };
  const list = useQuery({
    queryKey: keys.list(params),
    queryFn: () => emergencyService.list(params),
    enabled,
  });
  const summary = useQuery({
    queryKey: keys.summary(params.branch_id),
    queryFn: () => emergencyService.summary(params.branch_id),
    enabled,
  });
  const detail = useQuery({
    queryKey: keys.detail(selectedId ?? '', params.branch_id),
    queryFn: () => emergencyService.get(selectedId!, params.branch_id),
    enabled: enabled && Boolean(selectedId),
  });
  return {
    list,
    summary,
    detail,
    create: useMutation({
      mutationFn: (body: CreateEmergencyPayload) => emergencyService.create(body),
      onSuccess: refresh,
    }),
    linkPatient: useMutation({
      mutationFn: ({ id, patientId, reason }: { id: string; patientId: string; reason?: string }) =>
        emergencyService.linkPatient(id, params.branch_id, patientId, reason),
      onSuccess: refresh,
    }),
    triage: useMutation({
      mutationFn: ({ id, body }: { id: string; body: unknown }) =>
        emergencyService.triage(id, params.branch_id, body),
      onSuccess: refresh,
    }),
    overridePriority: useMutation({
      mutationFn: ({
        id,
        level,
        reason,
      }: {
        id: string;
        level: EmergencyTriageLevel;
        reason: string;
      }) => emergencyService.overridePriority(id, params.branch_id, level, reason),
      onSuccess: refresh,
    }),
    call: useMutation({
      mutationFn: (id: string) => emergencyService.call(id, params.branch_id),
      onSuccess: refresh,
    }),
    consultation: useMutation({
      mutationFn: ({ id, body }: { id: string; body: unknown }) =>
        emergencyService.consultation(id, params.branch_id, body),
      onSuccess: refresh,
    }),
    order: useMutation({
      mutationFn: ({ id, body }: { id: string; body: unknown }) =>
        emergencyService.order(id, params.branch_id, body),
      onSuccess: refresh,
    }),
    disposition: useMutation({
      mutationFn: ({ id, body }: { id: string; body: unknown }) =>
        emergencyService.disposition(id, params.branch_id, body),
      onSuccess: refresh,
    }),
    reasonAction: useMutation({
      mutationFn: ({
        id,
        action,
        reason,
      }: {
        id: string;
        action: 'skip' | 'no-show' | 'left' | 'cancel';
        reason: string;
      }) => emergencyService.reasonAction(id, params.branch_id, action, reason),
      onSuccess: refresh,
    }),
  };
}
