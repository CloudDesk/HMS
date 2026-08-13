import { ApiError } from '../api/api-error';
import type {
  ApiAppointmentPriority,
  ApiAppointmentStatus,
  ApiAppointmentVisitType,
  AppointmentResponse,
} from '../api/appointments';

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
  URGENT: 'Urgent',
  EMERGENCY: 'Emergency',
};

export const formatAppointmentDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const formatAppointmentTime = (appointment: AppointmentResponse) =>
  `${appointment.start_time} - ${appointment.end_time}`;

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
