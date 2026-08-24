import { apiClient } from './client';
export type EmergencyTriageLevel =
  'LEVEL_1_CRITICAL' | 'LEVEL_2_HIGH' | 'LEVEL_3_MEDIUM' | 'LEVEL_4_LOW' | 'LEVEL_5_NON_URGENT';
export type EmergencyStatus =
  | 'REGISTERED'
  | 'WAITING_FOR_TRIAGE'
  | 'TRIAGED'
  | 'WAITING_FOR_DOCTOR'
  | 'IN_CONSULTATION'
  | 'IN_TREATMENT'
  | 'READY_FOR_DISPOSITION'
  | 'DISCHARGED'
  | 'TRANSFERRED'
  | 'CONVERTED_TO_IP'
  | 'LEFT'
  | 'NO_SHOW'
  | 'CANCELLED';
export type EmergencyEncounter = {
  id: string;
  encounter_number: string;
  emergency_identifier: string;
  branch_id: string;
  department_id: string;
  patient_id: string | null;
  patient_number: string | null;
  patient_name: string;
  provisional_identity: {
    display_name: string;
    estimated_age: number | null;
    gender: string | null;
    contact: string | null;
    identity_notes: string | null;
  } | null;
  arrival_mode: string;
  arrival_at: string;
  chief_complaint: string;
  arrival_notes: string | null;
  status: EmergencyStatus;
  version: number;
  triage: {
    level: EmergencyTriageLevel;
    effective_level: EmergencyTriageLevel;
    area: string;
    nurse_user_id: string;
    assessed_at: string;
    pain_score: number | null;
    vitals: Record<string, number | null>;
    abcde: Record<string, string>;
    notes: string | null;
  } | null;
  priority_history: Array<{
    previous_level: EmergencyTriageLevel;
    new_level: EmergencyTriageLevel;
    reason: string;
    changed_by: string;
    changed_at: string;
  }>;
  queue_history: Array<{
    action: string;
    from_status: EmergencyStatus;
    to_status: EmergencyStatus;
    reason: string | null;
    actor_id: string;
    occurred_at: string;
  }>;
  assigned_doctor_id: string | null;
  assigned_doctor_name: string | null;
  consultation: {
    startedAt: string;
    updatedAt: string;
    chiefComplaint: string;
    history: string;
    examination: string;
    diagnosis: string;
    plan: string;
    treatment: string | null;
    notes: string | null;
  } | null;
  orders: Array<{
    order_type: 'PHARMACY' | 'LABORATORY' | 'IMAGING';
    downstream_id: string;
    source_type: 'EMERGENCY_ENCOUNTER';
    source_id: string;
    status: string;
    created_at: string;
    created_by: string;
  }>;
  disposition: {
    decision: string;
    reason?: string | null;
    summary?: string | null;
    instructions?: string | null;
    transferDestination?: string | null;
    billingStatus?: string | null;
    confirmedAt: string;
  } | null;
  inpatient_admission_id: string | null;
  converted_to_ip_at: string | null;
  converted_to_ip_by: string | null;
  created_at: string;
  updated_at: string;
};
export type EmergencyPage = {
  data: EmergencyEncounter[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};
export type EmergencyListParams = {
  branch_id: string;
  department_id?: string;
  status?: string;
  triage_level?: string;
  search?: string;
  page?: number;
  limit?: number;
};
export type CreateEmergencyPayload = {
  branch_id: string;
  department_id: string;
  patient_id?: string | null;
  provisional_identity?: {
    display_name: string;
    estimated_age?: number | null;
    gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' | null;
    contact?: string | null;
    identity_notes?: string | null;
  } | null;
  arrival_mode: string;
  arrival_at?: string;
  chief_complaint: string;
  arrival_notes?: string | null;
};
const qs = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return `?${query.toString()}`;
};
export const emergencyApi = {
  list: (params: EmergencyListParams) =>
    apiClient.request<EmergencyPage>(`/emergency/encounters${qs(params)}`),
  summary: (branchId: string) =>
    apiClient.request<Record<string, number>>(`/emergency/summary${qs({ branch_id: branchId })}`),
  get: (id: string, branchId: string) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}${qs({ branch_id: branchId })}`,
    ),
  create: (body: CreateEmergencyPayload) =>
    apiClient.request<EmergencyEncounter>('/emergency/encounters', { method: 'POST', body }),
  linkPatient: (id: string, branchId: string, patientId: string, reason?: string) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}/link-patient${qs({ branch_id: branchId })}`,
      { method: 'POST', body: { patient_id: patientId, reason } },
    ),
  triage: (id: string, branchId: string, body: unknown) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}/triage${qs({ branch_id: branchId })}`,
      { method: 'POST', body },
    ),
  overridePriority: (id: string, branchId: string, level: EmergencyTriageLevel, reason: string) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}/override-priority${qs({ branch_id: branchId })}`,
      { method: 'POST', body: { level, reason } },
    ),
  call: (id: string, branchId: string) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}/call${qs({ branch_id: branchId })}`,
      { method: 'POST' },
    ),
  skip: (id: string, branchId: string, reason: string) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}/skip${qs({ branch_id: branchId })}`,
      { method: 'POST', body: { reason } },
    ),
  consultation: (id: string, branchId: string, body: unknown) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}/consultation${qs({ branch_id: branchId })}`,
      { method: 'PUT', body },
    ),
  order: (id: string, branchId: string, body: unknown) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}/orders${qs({ branch_id: branchId })}`,
      { method: 'POST', body },
    ),
  disposition: (id: string, branchId: string, body: unknown) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}/disposition${qs({ branch_id: branchId })}`,
      { method: 'POST', body },
    ),
  reasonAction: (
    id: string,
    branchId: string,
    action: 'skip' | 'no-show' | 'left' | 'cancel',
    reason: string,
  ) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}/${action}${qs({ branch_id: branchId })}`,
      { method: 'POST', body: { reason } },
    ),
};
