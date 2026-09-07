import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  CreateEmergencyPayload,
  EmergencyEncounter,
  EmergencyListParams,
  EmergencyTriageLevel,
  TriagePayload,
  ConsultationPayload,
  EmergencyOrderPayload,
  DispositionPayload,
  EmergencyReferralPayload,
  BookEmergencyReferralPayload,
} from '../../api/emergency';
import { emergencyService } from '../../services/emergency.service';
export const emergencyKeys = {
  all: ['emergency'] as const,
  list: (params: EmergencyListParams) => ['emergency', 'list', params] as const,
  summary: (branch: string) => ['emergency', 'summary', branch] as const,
  detail: (id: string, branch: string) => ['emergency', 'detail', id, branch] as const,
  referrals: () => ['emergency', 'referrals'] as const,
  referralList: (params: object) => ['emergency', 'referrals', params] as const,
  referral: (id: string, branch: string) => ['emergency', 'referral', id, branch] as const,
};
export function useEmergencyReferrals(
  params: { booked?: boolean; page?: number; limit?: number },
  enabled = true,
) {
  return useQuery({
    queryKey: emergencyKeys.referralList(params),
    queryFn: () => emergencyService.listReferrals(params),
    enabled,
  });
}
export function useEmergencyReferral(id: string, branchId: string, enabled = true) {
  return useQuery({
    queryKey: emergencyKeys.referral(id, branchId),
    queryFn: () => emergencyService.getReferral(id, branchId),
    enabled: enabled && Boolean(id && branchId),
  });
}
export function useBookEmergencyReferral() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, branchId, body }: { id: string; branchId: string; body: BookEmergencyReferralPayload }) =>
      emergencyService.bookReferral(id, branchId, body),
    onSuccess: async () => {
      toast.success('Emergency referral appointment booked.');
      await client.invalidateQueries({ queryKey: emergencyKeys.referrals() });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to book Emergency referral.'),
  });
}
export function useEmergencyEncountersList(params: EmergencyListParams, enabled = true) {
  return useQuery({
    queryKey: emergencyKeys.list(params),
    queryFn: () => emergencyService.list(params),
    enabled,
  });
}
export function useEmergency(
  params: EmergencyListParams,
  selectedId: string | null,
  enabled: boolean,
) {
  const client = useQueryClient();

  const updateEncounter = async (data: EmergencyEncounter) => {
    client.setQueryData(emergencyKeys.detail(data.id, params.branch_id), data);
    await Promise.all([
      client.invalidateQueries({ queryKey: ['emergency', 'list'] }),
      client.invalidateQueries({ queryKey: ['emergency', 'summary'] }),
    ]);
  };
  const list = useQuery({
    queryKey: emergencyKeys.list(params),
    queryFn: () => emergencyService.list(params),
    enabled,
  });
  const summary = useQuery({
    queryKey: emergencyKeys.summary(params.branch_id),
    queryFn: () => emergencyService.summary(params.branch_id),
    enabled,
  });
  const detail = useQuery({
    queryKey: emergencyKeys.detail(selectedId ?? '', params.branch_id),
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
      mutationFn: ({ id, branchId, body }: { id: string; branchId?: string; body: EmergencyOrderPayload }) =>
        emergencyService.order(id, branchId || params.branch_id, body),
      onSuccess: updateEncounter,
    }),
    referral: useMutation({
      mutationFn: ({ id, body }: { id: string; body: EmergencyReferralPayload }) =>
        emergencyService.submitReferral(id, params.branch_id, body),
      onSuccess: () => {
        client.invalidateQueries({ queryKey: emergencyKeys.referrals() });
        client.invalidateQueries({ queryKey: emergencyKeys.detail(selectedId ?? '', params.branch_id) });
      },
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
