import { useAuth } from '../../auth/useAuth';
import {
  useEnterImagingReport,
  useImagingOrderDetails,
  useImagingReport,
  useUpdateImagingReport,
} from './useImaging';
import { navigate, useAppLocation } from '../../routing/navigation';
import type { ImagingReportPayload } from '../../api/imaging';

export function useImagingReportFeature() {
  const { user } = useAuth();
  const location = useAppLocation();
  const id = new URLSearchParams(location.search).get('id') ?? '';

  const orderQuery = useImagingOrderDetails(id || null);
  const order = orderQuery.data;

  const hasReport = ['REPORT_ENTERED', 'VERIFIED', 'COMPLETED'].includes(order?.status ?? '');
  const reportQuery = useImagingReport(id || null, hasReport);
  const report = reportQuery.data;

  const enterReport = useEnterImagingReport();
  const updateReport = useUpdateImagingReport();

  const superAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const canEnterReport = superAdmin || Boolean(user?.permissions.some((permission) =>
    permission.module.toLowerCase() === 'imaging' &&
    permission.screen.toLowerCase() === 'orders' &&
    permission.action.toLowerCase() === 'enterreport'
  ));

  const readOnly = ['VERIFIED', 'COMPLETED'].includes(order?.status ?? '');
  const canEdit = ['IN_PROGRESS', 'REPORT_ENTERED'].includes(order?.status ?? '');

  const isLoading = orderQuery.isLoading || (hasReport && reportQuery.isLoading);
  const isError = orderQuery.isError || !order || (hasReport && reportQuery.isError);
  const isSaving = enterReport.isPending || updateReport.isPending;

  const saveReport = (payload: ImagingReportPayload) => {
    if (!id || !order) return;

    const options = { onSuccess: () => navigate(`/imaging/workspace?id=${id}`) };

    if (order.status === 'IN_PROGRESS') {
      enterReport.mutate({ id, payload }, options);
    } else {
      updateReport.mutate({ id, payload }, options);
    }
  };

  return {
    id,
    order,
    report,
    isLoading,
    isError,
    isSaving,
    readOnly,
    canEdit,
    canEnterReport,
    actions: {
      saveReport
    }
  };
}
