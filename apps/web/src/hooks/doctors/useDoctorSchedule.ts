import { useEffect, useMemo, useState } from 'react';
import type {
  AppointmentResponse,
  ApiAppointmentStatus,
  ApiAppointmentVisitType,
} from '../../api/appointments';
import { ApiError } from '../../api/api-error';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import { navigate } from '../../routing/navigation';
import { useAppointmentsList } from '../appointments/useAppointments';
import { useDepartmentsList } from '../departments/useDepartments';
import { useCurrentDoctor, useDoctorsList } from './useDoctors';

export type DoctorScheduleAppointment = AppointmentResponse;
export type DoctorScheduleAppointmentStatus = ApiAppointmentStatus;
export type DoctorScheduleAppointmentVisitType = ApiAppointmentVisitType;
export type DoctorScheduleViewMode = 'day' | 'week' | 'month';

interface UseDoctorScheduleOptions {
  initialDoctorId: string;
  departmentId: string;
  visitType: ApiAppointmentVisitType | '';
  status: ApiAppointmentStatus | '';
  scheduleDate: string;
  viewMode: DoctorScheduleViewMode;
  dateFrom: string;
  dateTo: string;
  today: string;
}

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
};

export function useDoctorSchedule({
  initialDoctorId,
  departmentId,
  visitType,
  status,
  scheduleDate,
  viewMode,
  dateFrom,
  dateTo,
  today,
}: UseDoctorScheduleOptions) {
  const { user } = useAuth();
  const isSuperAdministrator =
    user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;
  const isDoctor =
    user?.roles.some(
      (role) => role.code === 'DOCTOR' || role.name.toLowerCase() === 'doctor',
    ) ?? false;
  const can = (module: string, screen: string, action: string) =>
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], { module, screen, action });
  const canViewDoctors = can('Doctors', 'Doctor Directory', 'View');
  const canViewAvailability = can('Doctors', 'Doctor Availability', 'View');
  const canViewAppointments = can('Appointments', 'Appointment Records', 'View');
  const canViewSchedule = canViewDoctors && canViewAvailability && canViewAppointments;
  const canBookAppointments = can('Appointments', 'Appointment Booking', 'Create');
  const canViewDepartments = can('Administration', 'Departments', 'View');
  const [selectedDoctorId, setSelectedDoctorId] = useState(initialDoctorId);

  const currentDoctorQuery = useCurrentDoctor(canViewSchedule && isDoctor);
  const doctorsQuery = useDoctorsList(
    { status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' },
    canViewSchedule && !isDoctor,
  );
  const departmentsQuery = useDepartmentsList(
    { status: 'ACTIVE', limit: 100, sortBy: 'name', sortOrder: 'asc' },
    canViewSchedule && canViewDepartments,
  );

  const doctors = useMemo(() => {
    if (isDoctor) {
      return currentDoctorQuery.data ? [currentDoctorQuery.data] : [];
    }

    return doctorsQuery.data?.data ?? [];
  }, [currentDoctorQuery.data, doctorsQuery.data?.data, isDoctor]);

  const effectiveDoctorId = isDoctor
    ? currentDoctorQuery.data?.id ?? ''
    : selectedDoctorId || initialDoctorId || doctors[0]?.id || '';

  const appointmentsQuery = useAppointmentsList(
    {
      doctor_id: effectiveDoctorId,
      department_id: departmentId || undefined,
      status: status || undefined,
      date_from: dateFrom,
      date_to: dateTo,
      limit: 100,
      sortBy: 'start_time',
      sortOrder: 'asc',
    },
    canViewSchedule && Boolean(effectiveDoctorId),
  );

  const appointments = useMemo<AppointmentResponse[]>(() => {
    const records = appointmentsQuery.data?.data ?? [];
    if (!visitType) {
      return records;
    }

    return records.filter((appointment) => appointment.visit_type === visitType);
  }, [appointmentsQuery.data?.data, visitType]);

  useEffect(() => {
    if (!effectiveDoctorId) {
      return;
    }

    const params = new URLSearchParams();
    params.set('doctor_id', effectiveDoctorId);
    if (departmentId) params.set('department_id', departmentId);
    if (visitType) params.set('visit_type', visitType);
    if (status) params.set('status', status);
    if (scheduleDate !== today) params.set('date', scheduleDate);
    if (viewMode !== 'day') params.set('view', viewMode);
    const nextUrl = `/doctors/schedule?${params.toString()}`;
    if (window.location.pathname + window.location.search !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [
    departmentId,
    effectiveDoctorId,
    scheduleDate,
    status,
    today,
    viewMode,
    visitType,
  ]);

  const queryError = !canViewDoctors
    ? 'You do not have permission to view the doctor directory.'
    : !canViewAvailability
      ? 'You do not have permission to view doctor availability.'
      : !canViewAppointments
        ? 'You do not have permission to view appointment records.'
    : currentDoctorQuery.error
      ? errorMessage(currentDoctorQuery.error, 'Unable to load the mapped doctor.')
      : doctorsQuery.error
        ? errorMessage(doctorsQuery.error, 'Unable to load doctors.')
        : departmentsQuery.error
          ? errorMessage(departmentsQuery.error, 'Unable to load departments.')
          : appointmentsQuery.error
            ? errorMessage(appointmentsQuery.error, 'Unable to load the schedule.')
            : '';

  return {
    appointments,
    canBookAppointments,
    canViewAppointments,
    canViewSchedule,
    canViewDepartments,
    departments: departmentsQuery.data?.data ?? [],
    doctors,
    error: queryError,
    isDoctor,
    isLoading:
      currentDoctorQuery.isLoading ||
      doctorsQuery.isLoading ||
      departmentsQuery.isLoading ||
      appointmentsQuery.isLoading,
    selectedDoctorId: effectiveDoctorId,
    setSelectedDoctorId,
  };
}
