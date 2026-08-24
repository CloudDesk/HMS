import { useEffect, useState } from 'react';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import type { BedStatus } from '../../api/admissions-configuration';
import { useBranchesList } from '../branches/useBranches';
import { usePatientsList } from '../patients/usePatients';
import {
  useAdmissionsConfiguration,
  useBedTransferOptions,
} from '../useAdmissionsConfiguration';

type BedManagementFeatureParams = {
  branchId: string;
  search: string;
  status?: BedStatus;
  wardId?: string;
  page: number;
  limit: number;
  patientSearch: string;
  patientLookupEnabled: boolean;
  transferLookupEnabled: boolean;
  transferDestinationBranchId: string;
};

export function useBedManagementFeature(
  params: BedManagementFeatureParams,
) {
  const { user } = useAuth();

  const isSuperAdmin =
    user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;

  const can = (screen: string, action: string) =>
    isSuperAdmin ||
    hasPermission(user?.permissions ?? [], {
      module: 'Admissions',
      screen,
      action,
    });

  const canViewPatients =
    isSuperAdmin ||
    hasPermission(user?.permissions ?? [], {
      module: 'Patients',
      screen: 'Patient Records',
      action: 'View',
    });

  const permissions = {
    canCreateWard: can('Wards', 'Create'),
    canChangeWardStatus: can('Wards', 'ChangeStatus'),
    canCreateBed: can('Beds', 'Create'),
    canChangeBedStatus: can('Beds', 'ChangeStatus'),

    canViewPolicy: can('Admission Policy', 'View'),
    canEditPolicy: can('Admission Policy', 'Edit'),

    canCreateHold:
      can('Bed Holds', 'Create') && canViewPatients,
    canReleaseHold: can('Bed Holds', 'Release'),
    canCancelHold: can('Bed Holds', 'Cancel'),

    canTransfer:
      can('Bed Transfers', 'Create') &&
      can('Bed Transfers', 'Complete'),
    canCrossBranchTransfer: can('Bed Transfers', 'CrossBranch'),

    canCreateAdmission: can('Inpatient Admissions', 'Create'),
  };

  const branchQuery = useBranchesList(
    {
      status: 'ACTIVE',
      page: 1,
      limit: 100,
      sortBy: 'name',
      sortOrder: 'asc',
    },
    isSuperAdmin,
  );

  const branches = isSuperAdmin
    ? (branchQuery.data?.data ?? [])
    : (user?.branches ?? []);

  const branchId =
    params.branchId || branches[0]?.id || '';

  const [debouncedPatientSearch, setDebouncedPatientSearch] =
    useState(params.patientSearch);

  const [debouncedBedSearch, setDebouncedBedSearch] =
    useState(params.search);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedPatientSearch(params.patientSearch.trim()),
      300,
    );

    return () => window.clearTimeout(timer);
  }, [params.patientSearch]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedBedSearch(params.search.trim()),
      300,
    );

    return () => window.clearTimeout(timer);
  }, [params.search]);

  const patientsQuery = usePatientsList(
    {
      search: debouncedPatientSearch,
      status: 'ACTIVE',
      page: 1,
      limit: 20,
    },
    params.patientLookupEnabled &&
      permissions.canCreateHold &&
      debouncedPatientSearch.length >= 2,
  );

  const configuration = useAdmissionsConfiguration({
    branchId,
    search: debouncedBedSearch,
    bedStatus: params.status,
    wardId: params.wardId,
    page: params.page,
    limit: params.limit,
    canViewPolicy: permissions.canViewPolicy,
  });

  const transferOptions = useBedTransferOptions(
    params.transferDestinationBranchId || branchId,
    params.transferLookupEnabled && permissions.canTransfer,
  );

  return {
    user,
    isSuperAdmin,
    branches,
    branchId,
    branchQuery,
    patientsQuery,
    permissions,
    configuration,
    transferOptions,
  };
}

