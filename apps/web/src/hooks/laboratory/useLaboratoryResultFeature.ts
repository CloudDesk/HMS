import { useAuth } from '../../auth/useAuth';
import {
  useEnterLaboratoryResult,
  useLaboratoryOrderDetails,
  useLaboratoryResult,
  useUpdateLaboratoryResult,
} from './useLaboratory';
import { navigate, useAppLocation } from '../../routing/navigation';
import type { LaboratoryResultPayload } from '../../api/laboratory';

export function useLaboratoryResultFeature() {
  const { user } = useAuth();
  const location = useAppLocation();
  const id = new URLSearchParams(location.search).get('id') ?? '';

  const orderQuery = useLaboratoryOrderDetails(id || null);
  const order = orderQuery.data;

  const hasStoredResult = ['RESULT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(order?.status ?? '');
  const resultQuery = useLaboratoryResult(id || null, hasStoredResult);
  const result = resultQuery.data;

  const enterResult = useEnterLaboratoryResult();
  const updateResult = useUpdateLaboratoryResult();

  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const canEnterResult = superAdmin || Boolean(user?.permissions.some((permission) =>
    permission.module.toLowerCase() === 'laboratory' &&
    permission.screen.toLowerCase() === 'orders' &&
    permission.action.toLowerCase() === 'enterresult'
  ));

  const readOnly = ['VERIFIED', 'COMPLETED'].includes(order?.status ?? '');
  const canEdit = ['IN_PROGRESS', 'RESULT_ENTERED'].includes(order?.status ?? '');

  const isLoading = orderQuery.isLoading || (hasStoredResult && resultQuery.isLoading);
  const isError = orderQuery.isError || !order || (hasStoredResult && resultQuery.isError);
  const isSaving = enterResult.isPending || updateResult.isPending;

  const saveResult = (payload: LaboratoryResultPayload) => {
    if (!id || !order) return;

    const options = { onSuccess: () => navigate(`/laboratory/workspace?id=${id}`) };

    if (order.status === 'IN_PROGRESS') {
      enterResult.mutate({ id, payload }, options);
    } else {
      updateResult.mutate({ id, payload }, options);
    }
  };

  return {
    id,
    order,
    result,
    isLoading,
    isError,
    isSaving,
    readOnly,
    canEdit,
    canEnterResult,
    actions: {
      saveResult
    }
  };
}
