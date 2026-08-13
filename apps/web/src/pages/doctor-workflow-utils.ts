import type { AppointmentResponse, ApiAppointmentStatus, ApiAppointmentVisitType } from '../api/appointments';
import type { DoctorResponse } from '../api/doctors';
import { appointmentStatusLabels, appointmentVisitTypeLabels, todayInputValue } from './appointment-utils';

export const doctorInitials = (doctor: DoctorResponse) =>
  `${doctor.first_name.charAt(0)}${doctor.last_name.charAt(0)}`.toUpperCase();

export const patientInitialsFromName = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'PT';

export const toDisplayDate = (dateValue: string) => {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const toMonthLabel = (dateValue: string) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en', { month: 'short' }).format(date);
};

export const statusTone = (status: ApiAppointmentStatus) => {
  if (status === 'CONFIRMED') return 'confirmed';
  if (status === 'CHECKED_IN') return 'in-consultation';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'SKIPPED') return 'skipped';
  if (status === 'SCHEDULED') return 'waiting';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'NO_SHOW') return 'inactive';
  return 'blocked';
};

export const appointmentStatusText = (appointment: AppointmentResponse) => appointmentStatusLabels[appointment.status];

export const visitTypeText = (visitType: ApiAppointmentVisitType) => appointmentVisitTypeLabels[visitType];

export const buildTodayRange = () => {
  const today = todayInputValue();
  return { date_from: today, date_to: today };
};

export const getDateRangeForPeriod = (period: string) => {
  const now = new Date();
  const end = new Date(now);
  const start = new Date(now);

  if (period === 'Today') {
    return { from: todayInputValue(), to: todayInputValue() };
  }

  if (period === 'This Week') {
    start.setDate(now.getDate() - 6);
  } else if (period === 'Last Month') {
    start.setMonth(now.getMonth() - 1, 1);
    end.setDate(0);
  } else if (period === 'Quarter') {
    start.setMonth(now.getMonth() - 2, 1);
  } else if (period === 'Year') {
    start.setFullYear(now.getFullYear(), 0, 1);
  } else {
    start.setDate(now.getDate() - 29);
  }

  const toInput = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return { from: toInput(start), to: toInput(end) };
};

export const groupAppointmentsByVisitType = (appointments: AppointmentResponse[]) =>
  appointments.reduce<Record<ApiAppointmentVisitType, number>>(
    (result, appointment) => ({
      ...result,
      [appointment.visit_type]: result[appointment.visit_type] + 1,
    }),
    {
      NEW_CONSULTATION: 0,
      FOLLOW_UP: 0,
      PROCEDURE: 0,
      EMERGENCY: 0,
    },
  );

export const uniquePatientCount = (appointments: AppointmentResponse[]) =>
  new Set(appointments.map((appointment) => appointment.patient_id)).size;
