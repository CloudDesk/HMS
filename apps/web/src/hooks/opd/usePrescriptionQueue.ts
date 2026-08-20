import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  type ApiOpdPrescriptionStatus,
  type OpdPrescriptionResponse,
} from '../../api/opd';
import { getOpdErrorMessage } from '../../pages/opd-utils';
import {
  usePharmacyPrescriptions,
  useUpdatePharmacyPrescriptionStatus,
} from '../pharmacy/usePharmacy';
import { useAuth } from '../../auth/useAuth';
import { hasPermission } from '../../auth/access-control';

export type PrescriptionQueueFilters = {
  search: string;
  status: ApiOpdPrescriptionStatus | '';
};

export type { ApiOpdPrescriptionStatus, OpdPrescriptionResponse };

export function usePrescriptionQueue(filters: PrescriptionQueueFilters, enabled = true) {
  const { user } = useAuth();
  const isSuperAdmin = Boolean(user?.roles?.some((role) => role.code === 'SUPER_ADMIN'));
  const canDispense = isSuperAdmin || hasPermission(user?.permissions ?? [], {
    module: 'Pharmacy',
    screen: 'Dispensing',
    action: 'Dispense',
  });

  const params = useMemo(() => ({
    search: filters.search.trim() || undefined,
    status: filters.status || undefined,
    limit: 100,
    sortBy: 'submitted_at',
    sortOrder: 'desc' as const,
  }), [filters.search, filters.status]);

  const prescriptionsQuery = usePharmacyPrescriptions(params, enabled);
  const statusMutation = useUpdatePharmacyPrescriptionStatus();
  const prescriptions = prescriptionsQuery.data?.data ?? [];

  useEffect(() => {
    if (prescriptionsQuery.error) {
      toast.error(getOpdErrorMessage(prescriptionsQuery.error));
    }
  }, [prescriptionsQuery.error]);

  const markAsDispensed = async (prescription: OpdPrescriptionResponse) => {
    try {
      await statusMutation.mutateAsync({ id: prescription.id, status: 'DISPENSED' });
      toast.success(`Prescription for ${prescription.patient_name} marked as dispensed.`);
      return true;
    } catch (error) {
      toast.error(getOpdErrorMessage(error));
      return false;
    }
  };

  return {
    prescriptions,
    pendingCount: prescriptions.filter((prescription) => prescription.status === 'SUBMITTED').length,
    dispensedCount: prescriptions.filter((prescription) => prescription.status === 'DISPENSED').length,
    isLoading: prescriptionsQuery.isLoading,
    error: prescriptionsQuery.error,
    errorMessage: prescriptionsQuery.error ? getOpdErrorMessage(prescriptionsQuery.error) : '',
    refetch: prescriptionsQuery.refetch,
    isUpdating: statusMutation.isPending,
    markAsDispensed,
    // Capability flags
    canDispense,
  };
}
