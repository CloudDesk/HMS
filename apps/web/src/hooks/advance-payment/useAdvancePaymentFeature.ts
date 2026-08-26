import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { advancePaymentApi, type AdvanceSourceType, type SyncAdvancePaymentPayload } from '../../api/advance-payments';

export const useAdvancePaymentFeature = (sourceType: AdvanceSourceType, sourceId: string | null) => {
  const queryClient = useQueryClient();
  const queryKey = ['advance-payment', sourceType, sourceId];

  const { data: advancePayment, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => {
      if (!sourceId) return null;
      return advancePaymentApi.get(sourceType, sourceId);
    },
    enabled: !!sourceId,
    retry: false, // Do not retry on 404
  });

  const syncMutation = useMutation({
    mutationFn: (payload: SyncAdvancePaymentPayload) => advancePaymentApi.sync(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(['advance-payment', data.source_type, data.source_id], data);
    },
  });

  return {
    advancePayment,
    isLoading,
    error,
    syncAdvancePayment: syncMutation.mutateAsync,
    isSyncing: syncMutation.isPending,
  };
};
