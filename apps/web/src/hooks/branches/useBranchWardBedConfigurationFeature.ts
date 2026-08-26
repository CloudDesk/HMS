import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import type { BedPayload, WardPayload } from '../../api/admissions-configuration';
import { useAdmissionsConfiguration } from '../useAdmissionsConfiguration';

type BranchWardBedConfigurationParams = {
  branchId: string;
  enabled: boolean;
};

export function useBranchWardBedConfigurationFeature({
  branchId,
  enabled,
}: BranchWardBedConfigurationParams) {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;
  const can = (screen: string, action: string) => isSuperAdmin || hasPermission(
    user?.permissions ?? [],
    { module: 'Admissions', screen, action },
  );

  const permissions = {
    canViewWards: can('Wards', 'View'),
    canCreateWard: can('Wards', 'Create'),
    canViewBeds: can('Beds', 'View'),
    canCreateBed: can('Beds', 'Create'),
  };

  const configuration = useAdmissionsConfiguration({
    branchId,
    search: '',
    page: 1,
    limit: 100,
    canViewPolicy: false,
    enabled,
    canViewWards: permissions.canViewWards,
    canViewBeds: permissions.canViewBeds,
  });

  const createWard = (payload: Omit<WardPayload, 'branch_id'>) =>
    configuration.createWard.mutateAsync({ branch_id: branchId, ...payload });

  const createBed = (payload: Omit<BedPayload, 'branch_id'>) =>
    configuration.createBed.mutateAsync({ branch_id: branchId, ...payload });

  return {
    data: {
      wards: configuration.wardsQuery.data?.data ?? [],
      wardMeta: configuration.wardsQuery.data?.meta,
      beds: configuration.bedsQuery.data?.data ?? [],
      bedMeta: configuration.bedsQuery.data?.meta,
      summary: configuration.summaryQuery.data ?? {
        total: 0,
        available: 0,
        occupied: 0,
        reserved: 0,
        blocked: 0,
        under_maintenance: 0,
        inactive: 0,
      },
    },
    status: {
      loading: configuration.wardsQuery.isLoading || configuration.bedsQuery.isLoading || configuration.summaryQuery.isLoading,
      error: configuration.wardsQuery.error || configuration.bedsQuery.error || configuration.summaryQuery.error,
      creatingWard: configuration.createWard.isPending,
      creatingBed: configuration.createBed.isPending,
    },
    permissions,
    actions: { createWard, createBed },
  };
}
