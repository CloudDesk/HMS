import { ApiError } from '../api/api-error';
import type { ApiOpdVisitPriority, ApiOpdVisitStatus, ApiOpdVisitType, OpdVisitResponse } from '../api/opd';

export const opdVisitStatusLabels: Record<ApiOpdVisitStatus, string> = {
  CHECKED_IN: 'Checked in',
  WAITING_FOR_VITALS: 'Waiting for vitals',
  READY_FOR_CONSULTATION: 'Ready for consultation',
  IN_CONSULTATION: 'In consultation',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

export const opdVisitTypeLabels: Record<ApiOpdVisitType, string> = {
  NEW_CONSULTATION: 'New Consultation',
  FOLLOW_UP: 'Follow-up',
  PROCEDURE: 'Procedure',
  EMERGENCY: 'Emergency',
  WALK_IN: 'Walk-in',
  REVIEW: 'Review',
};

export const opdVisitPriorityLabels: Record<ApiOpdVisitPriority, string> = {
  ROUTINE: 'Routine',
  URGENT: 'Urgent',
  EMERGENCY: 'Emergency',
};

export const todayInputValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const formatVisitDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
};

export const visitStatusClass = (status: ApiOpdVisitStatus) => {
  if (status === 'COMPLETED') return 'completed';
  if (status === 'IN_CONSULTATION') return 'in-consultation';
  if (status === 'READY_FOR_CONSULTATION') return 'submitted';
  if (status === 'WAITING_FOR_VITALS' || status === 'CHECKED_IN') return 'scheduled';
  if (status === 'NO_SHOW' || status === 'CANCELLED') return 'cancelled';
  return 'draft';
};

export const visitPriorityClass = (priority: ApiOpdVisitPriority) => {
  if (priority === 'EMERGENCY') return 'emergency';
  if (priority === 'URGENT') return 'urgent';
  return 'routine';
};

export const patientInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'PT';

export const activeVisitStatuses: ApiOpdVisitStatus[] = [
  'CHECKED_IN',
  'WAITING_FOR_VITALS',
  'READY_FOR_CONSULTATION',
  'IN_CONSULTATION',
];

export const isActiveVisit = (visit: OpdVisitResponse) => activeVisitStatuses.includes(visit.status);

export const getOpdErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message || 'Validation error. Please check the OPD visit details.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to access OPD visits.';
    if (error.status === 404) return 'OPD visit not found.';
    if (error.status === 409) return error.message || 'An active OPD visit already exists.';
    if (error.status >= 500) return 'The OPD service is unavailable. Please try again shortly.';
    return error.message;
  }

  return 'Unable to complete the OPD request.';
};
