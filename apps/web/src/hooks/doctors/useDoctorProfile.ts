import { ApiError } from '../../api/api-error';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { useBranchesList, useBranchDetails } from '../branches/useBranches';
import { useDepartmentsList, useDepartmentDetails } from '../departments/useDepartments';
import { useCurrentDoctor, useDoctorDetails } from './useDoctors';

const getProfileErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to view this doctor profile.';
    if (error.status === 404) return 'The requested doctor profile could not be found.';
    if (error.status >= 500) return 'The doctor service is unavailable. Please try again shortly.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred while loading the doctor profile.';
};

export function useDoctorProfile(requestedDoctorId: string | null) {
  const { user } = useAuth();
  const isSuperAdministrator =
    user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;
  const isDoctorUser =
    user?.roles.some(
      (role) => role.code === 'DOCTOR' || role.name.toLowerCase() === 'doctor',
    ) ?? false;
  const can = (module: string, screen: string, action: string) =>
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], {
      module,
      screen,
      action,
    });
  const canViewProfile = can('Doctors', 'Doctor Directory', 'View');
  const canViewAvailability = can('Doctors', 'Doctor Availability', 'View');
  const canViewSchedule =
    canViewAvailability &&
    can('Appointments', 'Appointment Records', 'View');
  const useMappedDoctor = isDoctorUser || !requestedDoctorId;

  const currentDoctorQuery = useCurrentDoctor(canViewProfile && useMappedDoctor);
  const doctorDetailsQuery = useDoctorDetails(
    requestedDoctorId,
    canViewProfile && !useMappedDoctor,
  );
  const activeQuery = useMappedDoctor ? currentDoctorQuery : doctorDetailsQuery;
  const canEdit =
    isSuperAdministrator ||
    can('Doctors', 'Doctor Directory', 'Edit') ||
    Boolean(user?.id && activeQuery.data?.user_id === user.id);

  const branchesQuery = useBranchesList({ limit: 100 }, canViewProfile);
  const departmentsQuery = useDepartmentsList({ limit: 100 }, canViewProfile);

  const doctorBranchId = activeQuery.data?.branch_id;
  const doctorDeptId = activeQuery.data?.department_id;

  const branchFromList = branchesQuery.data?.data.find((b) => b.id === doctorBranchId);
  const deptFromList = departmentsQuery.data?.data.find((d) => d.id === doctorDeptId);

  const singleBranchQuery = useBranchDetails(
    doctorBranchId ?? null,
    Boolean(doctorBranchId && !branchFromList && !branchesQuery.isLoading),
  );
  const singleDeptQuery = useDepartmentDetails(
    doctorDeptId ?? null,
    Boolean(doctorDeptId && !deptFromList && !departmentsQuery.isLoading),
  );

  const branchName =
    branchFromList?.name ??
    singleBranchQuery.data?.name ??
    (branchesQuery.isLoading ? 'Loading...' : doctorBranchId || 'Not assigned');

  const departmentName =
    deptFromList?.name ??
    singleDeptQuery.data?.name ??
    (departmentsQuery.isLoading ? 'Loading...' : doctorDeptId || 'Not assigned');

  return {
    canViewAvailability,
    canViewSchedule,
    canEdit,
    canRetry: canViewProfile,
    doctor: activeQuery.data ?? null,
    branchName,
    departmentName,
    error: !canViewProfile
      ? 'Doctor Directory View permission is required to view doctor profiles.'
      : activeQuery.error
        ? getProfileErrorMessage(activeQuery.error)
        : '',
    isLoading: activeQuery.isLoading,
    retry: activeQuery.refetch,
    userId: user?.id ?? null,
  };
}
