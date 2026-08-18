import { ApiError } from '../api/api-error';
import type { PatientResponse } from '../api/patients';

export const patientFullName = (patient: PatientResponse) =>
  [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ');

export const patientInitials = (patient: PatientResponse) =>
  `${patient.first_name?.charAt(0) ?? ''}${patient.last_name.charAt(0)}`.toUpperCase();

export const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const calculateAge = (dob: string | null | undefined) => {
  if (!dob) return '';
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return '';
  const ageDifMs = Date.now() - birthDate.getTime();
  const ageDate = new Date(ageDifMs);
  const years = Math.abs(ageDate.getUTCFullYear() - 1970);
  return `${years} years`;
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

export const getPatientErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message || 'Validation error. Please check the patient details.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 403) return 'You do not have permission to access patient records.';
    if (error.status === 404) return 'Patient record not found.';
    if (error.status === 409) return error.message || 'A possible duplicate patient record exists.';
    if (error.status >= 500) return 'The patient service is unavailable. Please try again shortly.';
    return error.message;
  }
  return 'Unable to complete the patient request.';
};

export const getPatientIdFromSearch = (search: string) => new URLSearchParams(search).get('id') ?? '';

