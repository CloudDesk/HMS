import { useMemo, useState } from 'react';
import { ApiError } from '../../api/api-error';
import type { AppointmentResponse } from '../../api/appointments';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { useAppointmentDashboardSummary, useAppointmentsList } from '../appointments/useAppointments';
import { useOpdDashboardSummary } from '../opd/useOpd';
import { useCurrentDoctor, useDoctorsList } from './useDoctors';

export type DoctorDashboardAppointment = AppointmentResponse;

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const getDashboardErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to access appointment records.';
    if (error.status === 404) return 'The requested doctor or appointment could not be found.';
    if (error.status >= 500) return 'The appointment service is unavailable. Please try again shortly.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred while loading the doctor dashboard.';
};

export function useDoctorDashboard() {
  const { user } = useAuth();
  const isSuperAdministrator =
    user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;
  const isDoctorUser =
    user?.roles.some(
      (role) => role.code === 'DOCTOR' || role.name.toLowerCase() === 'doctor',
    ) ?? false;
  const canViewAppointments =
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], {
      module: 'Appointments',
      screen: 'Appointment Records',
      action: 'View',
    });
  const canEditAppointments =
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], {
      module: 'Appointments',
      screen: 'Appointment Records',
      action: 'Edit',
    });
  const canViewOpdQueue =
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], {
      module: 'OPD',
      screen: 'OPD Visits',
      action: 'View',
    });
  const canSearchPatients =
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], {
      module: 'Patients',
      screen: 'Patient Records',
      action: 'View',
    });
  const [selectedDoctorIdState, setSelectedDoctorIdState] = useState('');

  const currentDoctorQuery = useCurrentDoctor(
    canViewAppointments && isDoctorUser,
  );
  const doctorsQuery = useDoctorsList(
    {
      status: 'ACTIVE',
      limit: 100,
      sortBy: 'display_name',
      sortOrder: 'asc',
    },
    canViewAppointments && !isDoctorUser,
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

  const dateRange = useMemo(() => {
    const today = new Date();
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    weekStart.setDate(weekStart.getDate() - 6);
    return { from: toInputDate(weekStart), today: toInputDate(today) };
  }, []);
  const appointmentsQuery = useAppointmentsList(
    {
      doctor_id: selectedDoctorId || undefined,
      date_from: dateRange.from,
      date_to: dateRange.today,
      limit: 100,
      sortBy: 'appointment_date',
      sortOrder: 'asc',
    },
    canViewAppointments && Boolean(selectedDoctorId),
  );
  const weekAppointments = useMemo(
    () => appointmentsQuery.data?.data ?? [],
    [appointmentsQuery.data?.data],
  );
  const appointmentSummaryQuery = useAppointmentDashboardSummary({
    doctor_id: selectedDoctorId || undefined,
    date_from: dateRange.today,
    date_to: dateRange.today,
  }, canViewAppointments && Boolean(selectedDoctorId));
  const opdSummaryQuery = useOpdDashboardSummary({
    doctor_id: selectedDoctorId || undefined,
    date_from: dateRange.today,
    date_to: dateRange.today,
  }, canViewOpdQueue && Boolean(selectedDoctorId));
  const hasCompleteAppointmentDataset = Boolean(
    appointmentsQuery.data &&
    appointmentsQuery.data.meta.total <= weekAppointments.length,
  );
  const todayAppointments = useMemo(
    () =>
      weekAppointments
        .filter(
          (appointment) =>
            appointment.appointment_date.slice(0, 10) === dateRange.today,
        )
        .slice()
        .sort((left, right) => left.start_time.localeCompare(right.start_time)),
    [dateRange.today, weekAppointments],
  );

  const sourceQuery = isDoctorUser ? currentDoctorQuery : doctorsQuery;
  const queryError = sourceQuery.error ?? appointmentsQuery.error;

  return {
    doctors,
    selectedDoctor,
    selectedDoctorId,
    setSelectedDoctorId: setSelectedDoctorIdState,
    todayAppointments,
    weekAppointments,
    hasCompleteAppointmentDataset,
    appointmentSummary: appointmentSummaryQuery.data,
    opdSummary: opdSummaryQuery.data,
    isDoctorUser,
    canViewAppointments,
    canEditAppointments,
    canViewOpdQueue,
    canSearchPatients,
    isLoading:
      sourceQuery.isLoading ||
      (Boolean(selectedDoctorId) && (appointmentsQuery.isLoading || appointmentSummaryQuery.isLoading || opdSummaryQuery.isLoading)),
    errorMessage: !canViewAppointments
      ? 'Appointment Records View permission is required to load doctor dashboard data.'
      : queryError
        ? getDashboardErrorMessage(queryError)
        : '',
  };
}
