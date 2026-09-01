import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { BookOpdReferralPayload } from '../../api/opd';
import { receptionService } from '../../services/reception.service';
const keys = { all: ['reception', 'referrals'] as const, list: (params: object) => ['reception', 'referrals', params] as const,
  detail: (visitId: string) => ['reception', 'referral', visitId] as const };
export const useReceptionReferrals = (
  params: { booked?: boolean; page?: number; limit?: number },
  enabled = true,
) =>
  useQuery({ queryKey: keys.list(params), queryFn: () => receptionService.listReferrals(params), enabled });
export const useReceptionReferral = (visitId: string, enabled = true) =>
  useQuery({ queryKey: keys.detail(visitId), queryFn: () => receptionService.getReferral(visitId), enabled: enabled && Boolean(visitId) });
export const useBookReceptionReferral = () => { const client = useQueryClient(); return useMutation({
  mutationFn: ({ referralId, payload }: { referralId: string; payload: BookOpdReferralPayload }) => receptionService.bookReferral(referralId, payload),
  onSuccess: async () => { toast.success('Referral appointment booked.'); await client.invalidateQueries({ queryKey: keys.all }); },
  onError: (error) => toast.error(error instanceof Error ? error.message : 'Unable to book referral.'),
}); };
