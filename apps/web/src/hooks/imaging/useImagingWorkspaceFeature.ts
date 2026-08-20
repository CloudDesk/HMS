
import type { ImagingStatus } from '../../api/laboratory';
import { useAuth } from '../../auth/useAuth';
import { useImagingOrderDetails, useUpdateImagingStatus } from './useImaging';
import { useAppLocation } from '../../routing/navigation';

export function useImagingWorkspaceFeature() {
  const { user } = useAuth();
  const location = useAppLocation();
  const id = new URLSearchParams(location.search).get('id') ?? '';

  const orderQuery = useImagingOrderDetails(id || null);
  const order = orderQuery.data;

  const nextStatus: Record<string, string> = {
    SUBMITTED: 'RECEIVED',
    RECEIVED: 'IN_PROGRESS',
    REPORT_ENTERED: 'VERIFIED',
    VERIFIED: 'COMPLETED'
  };

  const next = order ? nextStatus[order.status] : undefined;

  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));

  const hasAction = (action: string) => superAdmin || Boolean(user?.permissions.some((permission) =>
    permission.module.toLowerCase() === 'imaging' &&
    permission.screen.toLowerCase() === 'orders' &&
    permission.action.toLowerCase() === action.toLowerCase()
  ));

  const statusMutation = useUpdateImagingStatus();

  return {
    id,
    order: order ?? null,
    nextStatus: next,
    isLoading: orderQuery.isLoading,
    isError: orderQuery.isError,
    isUpdating: statusMutation.isPending,
    permissions: {
      canVerify: hasAction('VerifyReport'),
      canEdit: hasAction('Edit'),
      canEnter: hasAction('EnterReport')
    },
    actions: {
      updateStatus: (status: string) => statusMutation.mutate({ id, status: status as Exclude<ImagingStatus, 'SUBMITTED' | 'REPORT_ENTERED'> })
    }
  };
}
