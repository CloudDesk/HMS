import { useMemo } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/api-error';
import {
  type ApiDoctorStatus,
  type CreateDoctorPayload,
  type DoctorListParams,
  type DoctorOnboardingResponse,
  type DoctorResponse,
  type DoctorUserOption,
} from '../../api/doctors';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { downloadBlob } from '../../utils/download';
import { useBranchesList } from '../branches/useBranches';
import { useDepartmentsList } from '../departments/useDepartments';
import { useUsersList } from '../users/useUsers';
import {
  useCreateDoctor,
  useCurrentDoctor,
  useDoctorUserOptions,
  useDoctorsList,
  useExportDoctors,
  useMapDoctorUser,
  useUpdateDoctor,
  useUpdateDoctorStatus,
  type UpdateDoctorPayload,
} from './useDoctors';

export type DoctorDirectorySortColumn =
  | 'doctor_number'
  | 'display_name'
  | 'specialization'
  | 'created_at';
export type DoctorDirectorySortDirection = 'asc' | 'desc';

export type DoctorDirectoryFilters = {
  search: string;
  status: ApiDoctorStatus | '';
  branchId: string;
  departmentId: string;
  page: number;
  sortColumn: DoctorDirectorySortColumn | null;
  sortDirection: DoctorDirectorySortDirection;
};

export type SaveDoctorDirectoryInput =
  | { mode: 'create'; payload: CreateDoctorPayload }
  | {
      mode: 'edit';
      doctor: DoctorResponse;
      payload: UpdateDoctorPayload;
      status: ApiDoctorStatus;
      statusReason: string;
      userId: string | null;
    };

const getDirectoryErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to perform this action.';
    if (error.status === 404) return 'The requested doctor record could not be found.';
    if (error.status === 409) return error.message || 'A doctor record conflict occurred.';
    if (error.status >= 500) return 'The doctor service is unavailable. Please try again shortly.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred while processing the doctor record.';
};

const permissionRequirement = (action: string) => ({
  module: 'Doctors',
  screen: 'Doctor Directory',
  action,
});

export function useDoctorDirectory(
  filters: DoctorDirectoryFilters,
  editingDoctorId: string | null,
) {
  const { user } = useAuth();
  const isSuperAdministrator =
    user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;
  const isDoctorUser =
    user?.roles.some(
      (role) => role.code === 'DOCTOR' || role.name.toLowerCase() === 'doctor',
    ) ?? false;
  const can = (action: string) =>
    isSuperAdministrator || hasPermission(user?.permissions ?? [], permissionRequirement(action));

  const canViewDirectory = can('View');
  const canCreate = can('Create');
  const canEdit = can('Edit');
  const canExport = can('Export') && !isDoctorUser;
  const canProvisionLogin = can('Provision Login');
  const canViewBranches =
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], {
      module: 'Administration',
      screen: 'Branches',
      action: 'View',
    });
  const canViewDepartments =
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], {
      module: 'Administration',
      screen: 'Departments',
      action: 'View',
    });
  const canViewAvailability =
    canViewDirectory &&
    (isSuperAdministrator ||
      hasPermission(user?.permissions ?? [], {
        module: 'Doctors',
        screen: 'Doctor Availability',
        action: 'View',
      }));
  const canViewSchedule =
    canViewAvailability &&
    (isSuperAdministrator ||
      hasPermission(user?.permissions ?? [], {
        module: 'Appointments',
        screen: 'Appointment Records',
        action: 'View',
      }));
  const canViewUsers =
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], {
      module: 'Administration',
      screen: 'Users',
      action: 'View',
    });

  const listParams = useMemo<DoctorListParams>(
    () => ({
      search: filters.search.trim() || undefined,
      status: filters.status || undefined,
      branch_id: canViewBranches ? filters.branchId || undefined : undefined,
      department_id: canViewDepartments ? filters.departmentId || undefined : undefined,
      page: filters.page,
      limit: 10,
      sortBy: filters.sortColumn || undefined,
      sortOrder: filters.sortColumn ? filters.sortDirection : undefined,
    }),
    [canViewBranches, canViewDepartments, filters],
  );

  const exportParams = useMemo<DoctorListParams>(
    () => ({
      search: filters.search.trim() || undefined,
      status: filters.status || undefined,
      branch_id: canViewBranches ? filters.branchId || undefined : undefined,
      department_id: canViewDepartments ? filters.departmentId || undefined : undefined,
      sortBy: filters.sortColumn || undefined,
      sortOrder: filters.sortColumn ? filters.sortDirection : undefined,
    }),
    [canViewBranches, canViewDepartments, filters],
  );

  const doctorsQuery = useDoctorsList(listParams, canViewDirectory && !isDoctorUser);
  const currentDoctorQuery = useCurrentDoctor(canViewDirectory && isDoctorUser);
  const branchesQuery = useBranchesList(
    { status: 'ACTIVE', limit: 100 },
    canViewBranches,
  );
  const departmentsQuery = useDepartmentsList(
    { status: 'ACTIVE', limit: 100 },
    canViewDepartments,
  );
  const mappingEnabled = canProvisionLogin && Boolean(editingDoctorId);
  const userOptionsQuery = useDoctorUserOptions(mappingEnabled);
  const usersQuery = useUsersList(
    { status: 'active', limit: 100, sortBy: 'fullName', sortOrder: 'asc' },
    mappingEnabled && canViewUsers,
  );

  const createDoctor = useCreateDoctor();
  const updateDoctor = useUpdateDoctor();
  const updateDoctorStatus = useUpdateDoctorStatus();
  const mapDoctorUser = useMapDoctorUser();
  const exportDoctorRecords = useExportDoctors();

  const mappedDoctorRecords = useMemo(() => {
    const doctor = currentDoctorQuery.data;
    if (!doctor) return [];

    const search = filters.search.trim().toLowerCase();
    const matchesSearch =
      !search ||
      [
        doctor.display_name,
        doctor.doctor_number,
        doctor.specialization,
        doctor.registration_number,
        doctor.phone,
        doctor.email,
      ].some((value) => value?.toLowerCase().includes(search));
    const matchesFilters =
      (!filters.status || doctor.status === filters.status) &&
      (!canViewBranches || !filters.branchId || doctor.branch_id === filters.branchId) &&
      (!canViewDepartments ||
        !filters.departmentId ||
        doctor.department_id === filters.departmentId);

    return matchesSearch && matchesFilters ? [doctor] : [];
  }, [canViewBranches, canViewDepartments, currentDoctorQuery.data, filters]);

  const userOptions = useMemo<DoctorUserOption[]>(() => {
    const usersById = new Map((usersQuery.data?.items ?? []).map((option) => [option.id, option]));
    return (userOptionsQuery.data ?? []).map((option) => {
      const userOption = usersById.get(option.id);
      return {
        ...option,
        full_name: userOption?.fullName ?? option.full_name,
        username: userOption?.username ?? option.username,
        email: userOption?.email ?? option.email,
      };
    });
  }, [userOptionsQuery.data, usersQuery.data]);

  const saveDoctor = async (
    input: SaveDoctorDirectoryInput,
  ): Promise<DoctorOnboardingResponse | undefined> => {
    try {
      if (input.mode === 'create') {
        if (!canCreate) throw new Error('You do not have permission to create doctors.');
        if (input.payload.account_access.create_login_account && !canProvisionLogin) {
          throw new Error('You do not have permission to provision doctor login accounts.');
        }
        return await createDoctor.mutateAsync(input.payload);
      }

      if (!canEdit) throw new Error('You do not have permission to edit doctors.');
      await updateDoctor.mutateAsync({ id: input.doctor.id, payload: input.payload });
      if (input.status !== input.doctor.status) {
        await updateDoctorStatus.mutateAsync({
          id: input.doctor.id,
          status: input.status,
          reason: input.statusReason,
        });
      }
      if (input.userId !== input.doctor.user_id) {
        if (!canProvisionLogin) {
          throw new Error('You do not have permission to change doctor user mappings.');
        }
        await mapDoctorUser.mutateAsync({ id: input.doctor.id, userId: input.userId });
      }
      return undefined;
    } catch (error) {
      throw new Error(getDirectoryErrorMessage(error), { cause: error });
    }
  };

  const exportDoctors = async (): Promise<void> => {
    if (!canExport) return;

    try {
      const blob = await exportDoctorRecords.mutateAsync(exportParams);
      downloadBlob(blob, 'hms-doctors.csv');
      toast.success('Doctor export downloaded.');
    } catch (error) {
      toast.error(getDirectoryErrorMessage(error));
    }
  };

  const retry = async () => {
    const requests: Promise<unknown>[] = [
      isDoctorUser ? currentDoctorQuery.refetch() : doctorsQuery.refetch(),
    ];
    if (canViewBranches) requests.push(branchesQuery.refetch());
    if (canViewDepartments) requests.push(departmentsQuery.refetch());
    await Promise.all(requests);
  };

  const sourceQuery = isDoctorUser ? currentDoctorQuery : doctorsQuery;
  const doctors = isDoctorUser ? mappedDoctorRecords : doctorsQuery.data?.data ?? [];

  return {
    doctors,
    meta: isDoctorUser
      ? {
          limit: 10,
          page: 1,
          total: doctors.length,
          totalPages: 1,
        }
      : doctorsQuery.data?.meta ?? {
      limit: 10,
      page: filters.page,
      total: 0,
      totalPages: 1,
        },
    branches: branchesQuery.data?.data ?? [],
    departments: departmentsQuery.data?.data ?? [],
    userOptions,
    isLoading: sourceQuery.isLoading,
    isMappingOptionsLoading:
      mappingEnabled && (userOptionsQuery.isLoading || (canViewUsers && usersQuery.isLoading)),
    isSaving:
      createDoctor.isPending ||
      updateDoctor.isPending ||
      updateDoctorStatus.isPending ||
      mapDoctorUser.isPending,
    isExporting: exportDoctorRecords.isPending,
    loadError: sourceQuery.error ? getDirectoryErrorMessage(sourceQuery.error) : '',
    mappingOptionsError: userOptionsQuery.error
      ? getDirectoryErrorMessage(userOptionsQuery.error)
      : '',
    canCreate,
    canEdit,
    canExport,
    canProvisionLogin,
    canViewAvailability,
    canViewBranches,
    canViewDepartments,
    canViewSchedule,
    saveDoctor,
    exportDoctors,
    retry,
  };
}
