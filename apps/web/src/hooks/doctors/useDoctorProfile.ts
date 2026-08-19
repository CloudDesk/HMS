import { ApiError } from '../../api/api-error';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
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

  return {
    canViewAvailability,
    canViewSchedule,
    canRetry: canViewProfile,
    doctor: activeQuery.data ?? null,
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
