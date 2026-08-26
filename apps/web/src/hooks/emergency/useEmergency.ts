import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateEmergencyPayload,
  EmergencyEncounter,
  EmergencyListParams,
  EmergencyTriageLevel,
  TriagePayload,
  ConsultationPayload,
  EmergencyOrderPayload,
  DispositionPayload,
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

  const updateEncounter = (data: EmergencyEncounter) => {
    client.setQueryData(keys.detail(data.id, params.branch_id), data);
    client.invalidateQueries({ queryKey: ['emergency', 'list'] });
    client.invalidateQueries({ queryKey: ['emergency', 'summary'] });
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
      onSuccess: () => {
        client.invalidateQueries({ queryKey: ['emergency', 'list'] });
        client.invalidateQueries({ queryKey: ['emergency', 'summary'] });
      },
    }),
    linkPatient: useMutation({
      mutationFn: ({ id, patientId, reason }: { id: string; patientId: string; reason?: string }) =>
        emergencyService.linkPatient(id, params.branch_id, patientId, reason),
      onSuccess: updateEncounter,
    }),
    triage: useMutation({
      mutationFn: ({ id, body }: { id: string; body: TriagePayload }) =>
        emergencyService.triage(id, params.branch_id, body),
      onSuccess: updateEncounter,
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
      onSuccess: updateEncounter,
    }),
    call: useMutation({
      mutationFn: (id: string) => emergencyService.call(id, params.branch_id),
      onSuccess: updateEncounter,
    }),
    consultation: useMutation({
      mutationFn: ({ id, body }: { id: string; body: ConsultationPayload }) =>
        emergencyService.consultation(id, params.branch_id, body),
      onSuccess: updateEncounter,
    }),
    order: useMutation({
      mutationFn: ({ id, body }: { id: string; body: EmergencyOrderPayload }) =>
        emergencyService.order(id, params.branch_id, body),
      onSuccess: updateEncounter,
    }),
    disposition: useMutation({
      mutationFn: ({ id, body }: { id: string; body: DispositionPayload }) =>
        emergencyService.disposition(id, params.branch_id, body),
      onSuccess: updateEncounter,
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
      onSuccess: updateEncounter,
    }),
  };
}
