import { ApiError } from '../api/api-error';
import { getGlobalDateFormat } from '../api/useSettings';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type {
  ApiAppointmentPriority,
  ApiAppointmentStatus,
  ApiAppointmentVisitType,
  AppointmentResponse,
} from '../api/appointments';
import { toDateFnsFormat } from '../utils/localization-utils';

export const appointmentStatusLabels: Record<ApiAppointmentStatus, string> = {
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked in',
  CANCELLED: 'Cancelled',
  RESCHEDULED: 'Rescheduled',
  NO_SHOW: 'No show',
  SKIPPED: 'Skipped',
  COMPLETED: 'Completed',
};

export const appointmentVisitTypeLabels: Record<ApiAppointmentVisitType, string> = {
  NEW_CONSULTATION: 'New Consultation',
  FOLLOW_UP: 'Follow-up',
  PROCEDURE: 'Procedure',
  EMERGENCY: 'Emergency',
};

export const appointmentPriorityLabels: Record<ApiAppointmentPriority, string> = {
  ROUTINE: 'Routine',
  EMERGENCY: 'Emergency',
  URGENT: 'Urgent',
};

export const formatAppointmentDate = (value: string | null | undefined, timezone?: string) => {
  if (!value) return '-';
  const cleanValue = value.slice(0, 10);
  const date = parseInputDate(cleanValue);
  if (Number.isNaN(date.getTime())) return '-';
  const fmt = toDateFnsFormat(getGlobalDateFormat());
  return format(date, fmt);
};

export const formatAppointmentTime = (appointment: AppointmentResponse) => {
  // If backend starts returning real start timestamps we could convert. For now it's often string times.
  return `${appointment.start_time} - ${appointment.end_time}`;
};

export const appointmentStatusClass = (status: ApiAppointmentStatus) => {
  if (status === 'CONFIRMED' || status === 'CHECKED_IN' || status === 'COMPLETED') return 'status-active';
  if (status === 'SCHEDULED' || status === 'RESCHEDULED' || status === 'SKIPPED') return 'status-warning';
  return 'status-inactive';
};

export const appointmentPriorityClass = (priority: ApiAppointmentPriority) => {
  if (priority === 'EMERGENCY') return 'status-inactive';
  if (priority === 'URGENT') return 'status-warning';
  return 'status-active';
};

export const getAppointmentErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message || 'Validation error. Please check the appointment details.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to access appointments.';
    if (error.status === 404) return 'Appointment record not found.';
    if (error.status === 409) return error.message || 'The selected appointment slot is no longer available.';
    if (error.status >= 500) return 'The appointment service is unavailable. Please try again shortly.';
    return error.message;
  }

  return 'Unable to complete the appointment request.';
};

export const todayInputValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const parseInputDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date(`${todayInputValue()}T00:00:00`) : date;
};

export const startOfWeek = (value: string, firstDayOfWeek: 'Monday' | 'Sunday' = 'Sunday') => {
  const date = parseInputDate(value);
  const day = date.getDay();
  let diff = day;
  if (firstDayOfWeek === 'Monday') {
    diff = day === 0 ? 6 : day - 1;
  }
  date.setDate(date.getDate() - diff);
  return date;
};

export const endOfWeek = (value: string, firstDayOfWeek: 'Monday' | 'Sunday' = 'Sunday') => {
  const date = startOfWeek(value, firstDayOfWeek);
  date.setDate(date.getDate() + 6);
  return date;
};

export const startOfMonth = (value: string) => {
  const date = parseInputDate(value);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

export const endOfMonth = (value: string) => {
  const date = parseInputDate(value);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};
