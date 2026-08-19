import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../api/api-error';
import type { SaveDoctorAvailabilityPayload } from '../../api/doctors';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { navigate } from '../../routing/navigation';
import {
  useCancelDoctorLeave,
  useCreateDoctorLeave,
  useCurrentDoctor,
  useDeleteDoctorException,
  useDoctorAvailability as useDoctorAvailabilityQuery,
  useDoctorExceptions,
  useDoctorLeaves,
  useDoctorsList,
  useSaveDoctorException,
  useUpdateDoctorAvailability,
  type CreateDoctorLeavePayload,
  type SaveDoctorExceptionPayload,
} from './useDoctors';

const getAvailabilityErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to perform this action.';
    if (error.status === 404) return 'The requested doctor availability could not be found.';
    if (error.status === 409) return error.message || 'An availability conflict occurred.';
    if (error.status >= 500) return 'The doctor service is unavailable. Please try again shortly.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred while processing doctor availability.';
};

export function useDoctorAvailability(initialDoctorId: string) {
  const { user } = useAuth();
  const isSuperAdministrator =
    user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;
  const isDoctorUser =
    user?.roles.some(
      (role) => role.code === 'DOCTOR' || role.name.toLowerCase() === 'doctor',
    ) ?? false;
  const canViewDirectory =
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], {
      module: 'Doctors',
      screen: 'Doctor Directory',
      action: 'View',
    });
  const canViewAvailability =
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], {
      module: 'Doctors',
      screen: 'Doctor Availability',
      action: 'View',
    });
  const canView = canViewDirectory && canViewAvailability;
  const canEdit =
    canView &&
    (isSuperAdministrator ||
      hasPermission(user?.permissions ?? [], {
        module: 'Doctors',
        screen: 'Doctor Availability',
        action: 'Edit',
      }));
  const [selectedDoctorIdState, setSelectedDoctorIdState] = useState(
    initialDoctorId,
  );

  const currentDoctorQuery = useCurrentDoctor(canView && isDoctorUser);
  const doctorsQuery = useDoctorsList(
    { limit: 100, sortBy: 'display_name', sortOrder: 'asc' },
    canView && !isDoctorUser,
  );
  const doctors = useMemo(
    () =>
      isDoctorUser
        ? currentDoctorQuery.data
          ? [currentDoctorQuery.data]
          : []
        : doctorsQuery.data?.data ?? [],
    [currentDoctorQuery.data, doctorsQuery.data, isDoctorUser],
  );
  const selectedDoctorId = isDoctorUser
    ? currentDoctorQuery.data?.id ?? ''
    : selectedDoctorIdState || doctors[0]?.id || '';
  const selectedDoctor =
    doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;

  const availabilityQuery = useDoctorAvailabilityQuery(
    selectedDoctorId || null,
    canView,
  );
  const leavesQuery = useDoctorLeaves(
    selectedDoctorId || null,
    { limit: 100 },
    canView,
  );
  const exceptionsQuery = useDoctorExceptions(
    selectedDoctorId || null,
    { limit: 100 },
    canView,
  );

  const updateAvailabilityMutation = useUpdateDoctorAvailability();
  const createLeaveMutation = useCreateDoctorLeave();
  const cancelLeaveMutation = useCancelDoctorLeave();
  const saveExceptionMutation = useSaveDoctorException();
  const deleteExceptionMutation = useDeleteDoctorException();

  useEffect(() => {
    if (!selectedDoctorId) return;
    const params = new URLSearchParams({ doctor_id: selectedDoctorId });
    const nextUrl = `/doctors/availability?${params.toString()}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [selectedDoctorId]);

  const resetMutationErrors = () => {
    updateAvailabilityMutation.reset();
    createLeaveMutation.reset();
    cancelLeaveMutation.reset();
    saveExceptionMutation.reset();
    deleteExceptionMutation.reset();
  };

  const requireEditableDoctor = () => {
    if (!canEdit) throw new Error('You do not have permission to edit doctor availability.');
    if (!selectedDoctorId) throw new Error('Select a doctor before changing availability.');
    return selectedDoctorId;
  };

  const updateAvailability = async (
    payload: SaveDoctorAvailabilityPayload,
  ): Promise<boolean> => {
    resetMutationErrors();
    try {
      const doctorId = requireEditableDoctor();
      await updateAvailabilityMutation.mutateAsync({ id: doctorId, payload });
      return true;
    } catch {
      return false;
    }
  };

  const createLeave = async (
    payload: CreateDoctorLeavePayload,
  ): Promise<boolean> => {
    resetMutationErrors();
    try {
      const doctorId = requireEditableDoctor();
      await createLeaveMutation.mutateAsync({ doctorId, payload });
      return true;
    } catch {
      return false;
    }
  };

  const cancelLeave = async (leaveId: string): Promise<boolean> => {
    resetMutationErrors();
    try {
      const doctorId = requireEditableDoctor();
      await cancelLeaveMutation.mutateAsync({ doctorId, leaveId });
      return true;
    } catch {
      return false;
    }
  };

  const saveException = async (
    payload: SaveDoctorExceptionPayload,
  ): Promise<boolean> => {
    resetMutationErrors();
    try {
      const doctorId = requireEditableDoctor();
      await saveExceptionMutation.mutateAsync({ doctorId, payload });
      return true;
    } catch {
      return false;
    }
  };

  const deleteException = async (exceptionId: string): Promise<boolean> => {
    resetMutationErrors();
    try {
      const doctorId = requireEditableDoctor();
      await deleteExceptionMutation.mutateAsync({ doctorId, exceptionId });
      return true;
    } catch {
      return false;
    }
  };

  const sourceQuery = isDoctorUser ? currentDoctorQuery : doctorsQuery;
  const queryError =
    sourceQuery.error ??
    availabilityQuery.error ??
    leavesQuery.error ??
    exceptionsQuery.error;
  const mutationError =
    updateAvailabilityMutation.error ??
    createLeaveMutation.error ??
    cancelLeaveMutation.error ??
    saveExceptionMutation.error ??
    deleteExceptionMutation.error;

  return {
    doctors,
    selectedDoctor,
    selectedDoctorId,
    setSelectedDoctorId: setSelectedDoctorIdState,
    availability: availabilityQuery.data,
    leaves: leavesQuery.data?.data ?? [],
    exceptions: exceptionsQuery.data?.data ?? [],
    isDoctorUser,
    canView,
    canEdit,
    isLoading:
      sourceQuery.isLoading ||
      (Boolean(selectedDoctorId) &&
        (availabilityQuery.isLoading || leavesQuery.isLoading || exceptionsQuery.isLoading)),
    isSaving:
      updateAvailabilityMutation.isPending ||
      createLeaveMutation.isPending ||
      cancelLeaveMutation.isPending ||
      saveExceptionMutation.isPending ||
      deleteExceptionMutation.isPending,
    errorMessage: !canViewDirectory
      ? 'You do not have permission to view the doctor directory.'
      : !canViewAvailability
        ? 'You do not have permission to view doctor availability.'
        : queryError
          ? getAvailabilityErrorMessage(queryError)
          : mutationError
            ? getAvailabilityErrorMessage(mutationError)
            : '',
    updateAvailability,
    createLeave,
    cancelLeave,
    saveException,
    deleteException,
  };
}
