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
  referral: {
    source_type: 'EMERGENCY_ENCOUNTER';
    target_department_id: string;
    target_department_name: string;
    target_doctor_id: string | null;
    target_doctor_name: string | null;
    priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
    reason: string;
    clinical_notes: string;
    status: 'SUBMITTED';
    submitted_at: string;
    appointment_id: string | null;
    appointment_number: string | null;
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
export type TriagePayload = {
  level: EmergencyTriageLevel;
  area: string;
  pain_score?: number | null;
  vitals: {
    systolic_bp?: number | null;
    diastolic_bp?: number | null;
    pulse?: number | null;
    temperature_c?: number | null;
    spo2?: number | null;
    respiratory_rate?: number | null;
    gcs?: number | null;
  };
  abcde: {
    airway: string;
    breathing: string;
    circulation: string;
    disability: string;
    exposure: string;
  };
  notes?: string | null;
};
export type ConsultationPayload = {
  doctor_id: string;
  chief_complaint: string;
  history: string;
  examination: string;
  diagnosis: string;
  plan: string;
  treatment?: string | null;
  notes?: string | null;
  ready_for_disposition?: boolean;
};
export type EmergencyOrderItem = {
  service_id?: string;
  medicine_name?: string;
  name: string;
  category: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity?: number | null;
};
export type EmergencyOrderPayload = {
  order_type: 'PHARMACY' | 'LABORATORY' | 'IMAGING';
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  items: EmergencyOrderItem[];
  destination?: string | null;
  specimen_type?: string | null;
  clinical_notes?: string | null;
  instructions?: string | null;
};
export type DispositionPayload = {
  decision: 'DISCHARGE' | 'ADMIT' | 'TRANSFER' | 'LEFT';
  reason?: string | null;
  summary?: string | null;
  instructions?: string | null;
  transfer_destination?: string | null;
};
export type EmergencyReferralPayload = {
  target_department_id: string;
  target_doctor_id?: string | null;
  priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  reason: string;
  clinical_notes: string;
};
export type EmergencyReferralResponse = {
  id: string;
  source_type: 'EMERGENCY_ENCOUNTER';
  source_id: string;
  encounter_number: string;
  emergency_identifier: string;
  branch_id: string;
  patient_id: string | null;
  patient_number: string;
  patient_name: string;
  referring_doctor_id: string | null;
  referring_doctor_name: string;
  target_department_id: string;
  target_department_name: string;
  referred_doctor_id: string | null;
  referred_doctor_name: string | null;
  priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  reason: string;
  clinical_summary: string;
  status: 'SUBMITTED';
  submitted_at: string;
  appointment_id: string | null;
  appointment_number: string | null;
  appointment_date: string | null;
  appointment_start_time: string | null;
  appointment_duration_minutes: number | null;
};
export type EmergencyReferralPage = {
  data: EmergencyReferralResponse[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};
export type BookEmergencyReferralPayload = {
  appointment_date: string;
  start_time: string;
  utc_datetime: string;
  duration_minutes: number;
  visit_type: 'NEW_CONSULTATION' | 'FOLLOW_UP' | 'PROCEDURE';
  priority?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  notes?: string | null;
};
const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return `?${query.toString()}`;
};
export const emergencyApi = {
  listReferrals: (params: { booked?: boolean; page?: number; limit?: number }) =>
    apiClient.request<EmergencyReferralPage>(`/emergency/referrals${qs(params)}`),
  getReferral: (id: string, branchId: string) =>
    apiClient.request<EmergencyReferralResponse>(
      `/emergency/encounters/${id}/referral${qs({ branch_id: branchId })}`,
    ),
  submitReferral: (id: string, branchId: string, body: EmergencyReferralPayload) =>
    apiClient.request<EmergencyReferralResponse>(
      `/emergency/encounters/${id}/referral${qs({ branch_id: branchId })}`,
      { method: 'POST', body },
    ),
  bookReferral: (id: string, branchId: string, body: BookEmergencyReferralPayload) =>
    apiClient.request<EmergencyReferralResponse>(
      `/emergency/encounters/${id}/referral/book${qs({ branch_id: branchId })}`,
      { method: 'POST', body },
    ),
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
  triage: (id: string, branchId: string, body: TriagePayload) =>
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
  consultation: (id: string, branchId: string, body: ConsultationPayload) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}/consultation${qs({ branch_id: branchId })}`,
      { method: 'PUT', body },
    ),
  order: (id: string, branchId: string, body: EmergencyOrderPayload) =>
    apiClient.request<EmergencyEncounter>(
      `/emergency/encounters/${id}/orders${qs({ branch_id: branchId })}`,
      { method: 'POST', body },
    ),
  disposition: (id: string, branchId: string, body: DispositionPayload) =>
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
