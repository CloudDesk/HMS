import { useMemo } from 'react';
import { ApiError } from '../../api/api-error';
import type {
  AppointmentResponse,
  ApiAppointmentVisitType,
} from '../../api/appointments';
import { hasPermission } from '../../auth/access-control';
import { useAuth } from '../../auth/useAuth';
import {
  getDateRangeForPeriod,
  groupAppointmentsByVisitType,
  toMonthLabel,
  uniquePatientCount,
} from '../../pages/doctor-workflow-utils';
import { useAppointmentsList } from '../appointments/useAppointments';
import { useCurrentDoctor, useDoctorsList } from './useDoctors';

export type DoctorPerformancePeriod =
  | 'Today'
  | 'This Week'
  | 'This Month'
  | 'Last Month'
  | 'Quarter'
  | 'Year';

export type DoctorPerformancePoint = {
  label: string;
  value: number;
};

export type DoctorPerformanceDistributionEntry = {
  type: ApiAppointmentVisitType;
  count: number;
};

export const doctorPerformancePeriods: readonly DoctorPerformancePeriod[] = [
  'Today',
  'This Week',
  'This Month',
  'Last Month',
  'Quarter',
  'Year',
];

const appointmentVisitTypes: readonly ApiAppointmentVisitType[] = [
  'NEW_CONSULTATION',
  'FOLLOW_UP',
  'PROCEDURE',
  'EMERGENCY',
];

export const parseDoctorPerformancePeriod = (
  value: string,
): DoctorPerformancePeriod =>
  doctorPerformancePeriods.find((period) => period === value) ?? 'This Month';

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const defaultMonthPoints = (): DoctorPerformancePoint[] => {
  const now = new Date();
  return Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return { label: toMonthLabel(toInputDate(date)), value: 0 };
  });
};

const buildMonthlyTrend = (
  appointments: AppointmentResponse[],
): DoctorPerformancePoint[] => {
  const grouped = appointments.reduce<Record<string, number>>(
    (result, appointment) => {
      const key = appointment.appointment_date.slice(0, 7);
      result[key] = (result[key] ?? 0) + 1;
      return result;
    },
    {},
  );

  if (Object.keys(grouped).length === 0) return defaultMonthPoints();

  return Object.entries(grouped)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, value]) => ({
      label: toMonthLabel(`${month}-01T00:00:00`),
      value,
    }));
};

const getPerformanceErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to view doctor performance.';
    if (error.status === 404) return 'The requested doctor could not be found.';
    if (error.status >= 500) return 'The performance data service is unavailable. Please try again shortly.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred while loading doctor performance.';
};

export function useDoctorPerformance(period: DoctorPerformancePeriod) {
  const { user } = useAuth();
  const isSuperAdministrator =
    user?.roles.some((role) => role.code === 'SUPER_ADMIN') ?? false;
  const isDoctorUser =
    user?.roles.some(
      (role) => role.code === 'DOCTOR' || role.name.toLowerCase() === 'doctor',
    ) ?? false;
  const can = (module: string, screen: string, action: string) =>
    isSuperAdministrator ||
    hasPermission(user?.permissions ?? [], { module, screen, action });
  const canViewDoctors = can('Doctors', 'Doctor Directory', 'View');
  const canViewAppointments = can('Appointments', 'Appointment Records', 'View');
  const currentDoctorQuery = useCurrentDoctor(canViewDoctors && isDoctorUser);
  const doctorsQuery = useDoctorsList(
    { status: 'ACTIVE', limit: 100, sortBy: 'display_name', sortOrder: 'asc' },
    canViewDoctors && !isDoctorUser,
  );
  const doctors = useMemo(
    () =>
      isDoctorUser
        ? currentDoctorQuery.data
          ? [currentDoctorQuery.data]
          : []
        : doctorsQuery.data?.data ?? [],
    [currentDoctorQuery.data, doctorsQuery.data?.data, isDoctorUser],
  );
  const selectedDoctorId = isDoctorUser
    ? currentDoctorQuery.data?.id ?? ''
    : doctors[0]?.id || '';
  const selectedDoctor =
    doctors.find((doctor) => doctor.id === selectedDoctorId) ?? null;
  const dateRange = useMemo(() => getDateRangeForPeriod(period), [period]);
  const appointmentsQuery = useAppointmentsList(
    {
      doctor_id: selectedDoctorId || undefined,
      date_from: dateRange.from,
      date_to: dateRange.to,
      limit: 100,
      sortBy: 'appointment_date',
      sortOrder: 'asc',
    },
    canViewAppointments && Boolean(selectedDoctorId),
  );
  const appointments = useMemo(
    () => appointmentsQuery.data?.data ?? [],
    [appointmentsQuery.data?.data],
  );
  const patientsSeen = uniquePatientCount(appointments);
  const noShows = appointments.filter(
    (appointment) => appointment.status === 'NO_SHOW',
  ).length;
  const noShowRate =
    appointments.length === 0
      ? 0
      : Math.round((noShows / appointments.length) * 1000) / 10;
  const checkedIn = appointments.filter(
    (appointment) => appointment.status === 'CHECKED_IN',
  ).length;
  const trend = useMemo(() => buildMonthlyTrend(appointments), [appointments]);
  const zeroTrend = useMemo(() => defaultMonthPoints(), []);
  const distribution = useMemo<DoctorPerformanceDistributionEntry[]>(() => {
    const grouped = groupAppointmentsByVisitType(appointments);
    return appointmentVisitTypes.map((type) => ({ type, count: grouped[type] }));
  }, [appointments]);
  const doctorSourceQuery = isDoctorUser ? currentDoctorQuery : doctorsQuery;
  const queryError = doctorSourceQuery.error ?? appointmentsQuery.error;

  return {
    appointments,
    checkedIn,
    distribution,
    error: !canViewDoctors
      ? 'Doctor Directory View permission is required to view doctor performance.'
      : !canViewAppointments
        ? 'Appointment Records View permission is required to load performance data.'
        : queryError
          ? getPerformanceErrorMessage(queryError)
          : '',
    isLoading:
      doctorSourceQuery.isLoading ||
      (Boolean(selectedDoctorId) && appointmentsQuery.isLoading),
    noShowRate,
    patientsSeen,
    selectedDoctor,
    trend,
    zeroTrend,
  };
}
