
import type { LaboratoryStatus } from '../../api/laboratory';
import { useAuth } from '../../auth/useAuth';
import { useLaboratoryOrderDetails, useUpdateLaboratoryStatus } from './useLaboratory';
import { useAppLocation } from '../../routing/navigation';

export function useLaboratoryWorkspaceFeature() {
  const { user } = useAuth();
  const location = useAppLocation();
  const id = new URLSearchParams(location.search).get('id') ?? '';

  const orderQuery = useLaboratoryOrderDetails(id || null);
  const order = orderQuery.data;

  const nextStatus: Record<string, string> = {
    SUBMITTED: 'RECEIVED',
    RECEIVED: 'SAMPLE_COLLECTED',
    SAMPLE_COLLECTED: 'IN_PROGRESS',
    RESULT_ENTERED: 'VERIFIED',
    VERIFIED: 'COMPLETED'
  };

  const next = order ? nextStatus[order.status] : undefined;

  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));

  const hasAction = (action: string) => superAdmin || Boolean(user?.permissions.some((permission) =>
    permission.module.toLowerCase() === 'laboratory' &&
    permission.screen.toLowerCase() === 'orders' &&
    permission.action.toLowerCase() === action.toLowerCase()
  ));

  const statusMutation = useUpdateLaboratoryStatus();

  return {
    id,
    order: order ?? null,
    nextStatus: next,
    isLoading: orderQuery.isLoading,
    isError: orderQuery.isError,
    isUpdating: statusMutation.isPending,
    permissions: {
      canVerify: hasAction('VerifyResult'),
      canEdit: hasAction('Edit'),
      canEnter: hasAction('EnterResult')
    },
    actions: {
      updateStatus: (status: string) => statusMutation.mutate({ id, status: status as Exclude<LaboratoryStatus, 'SUBMITTED' | 'RESULT_ENTERED'> })
    }
  };
}
