import { apiClient } from './client';

export type ApiOpdVisitStatus =
  | 'CHECKED_IN'
  | 'WAITING_FOR_VITALS'
  | 'READY_FOR_CONSULTATION'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type ApiOpdVisitType =
  | 'NEW_CONSULTATION'
  | 'FOLLOW_UP'
  | 'PROCEDURE'
  | 'EMERGENCY'
  | 'WALK_IN'
  | 'REVIEW';

export type ApiOpdVisitPriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

export type OpdVisitResponse = {
  id: string;
  visit_number: string;
  appointment_id: string | null;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization: string;
  branch_id: string;
  department_id: string;
  visit_date: string;
  check_in_time: string;
  visit_type: ApiOpdVisitType;
  priority: ApiOpdVisitPriority;
  status: ApiOpdVisitStatus;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OpdVisitListResponse = {
  data: OpdVisitResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type OpdVisitListParams = Partial<{
  search: string;
  status: ApiOpdVisitStatus;
  doctor_id: string;
  patient_id: string;
  branch_id: string;
  department_id: string;
  date_from: string;
  date_to: string;
  page: number;
  limit: number;
  sortBy: 'visit_number' | 'visit_date' | 'check_in_time' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}>;

export type CreateOpdVisitPayload = {
  appointment_id?: string | null;
  patient_id?: string;
  doctor_id?: string;
  visit_type?: ApiOpdVisitType;
  priority?: ApiOpdVisitPriority;
  reason?: string | null;
  notes?: string | null;
};

export type UpdateOpdVisitStatusPayload = {
  status: ApiOpdVisitStatus;
  notes?: string | null;
};

export type OpdVitalsResponse = {
  id: string;
  visit_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  recorded_at: string;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  blood_pressure: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number;
  temperature_c: number | null;
  pulse_bpm: number | null;
  respiratory_rate_per_min: number | null;
  oxygen_saturation_percent: number | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OpdVitalsListResponse = {
  data: OpdVitalsResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type OpdVitalsListParams = Partial<{
  page: number;
  limit: number;
  sortBy: 'recorded_at' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}>;

export type CreateOpdVitalsPayload = {
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  temperature_c?: number | null;
  pulse_bpm?: number | null;
  respiratory_rate_per_min?: number | null;
  oxygen_saturation_percent?: number | null;
  notes?: string | null;
};

export type ApiOpdConsultationStatus = 'DRAFT' | 'COMPLETED';

export type OpdConsultationResponse = {
  id: string;
  visit_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  status: ApiOpdConsultationStatus;
  chief_complaint: string | null;
  history_present_illness: string | null;
  past_history: string | null;
  family_history: string | null;
  allergies: string | null;
  physical_examination: string | null;
  assessment: string | null;
  treatment_plan: string | null;
  doctor_notes: string | null;
  completed_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOpdConsultationPayload = {
  chief_complaint?: string | null;
  history_present_illness?: string | null;
  past_history?: string | null;
  family_history?: string | null;
  allergies?: string | null;
  physical_examination?: string | null;
  assessment?: string | null;
  treatment_plan?: string | null;
  doctor_notes?: string | null;
};

export type ApiOpdPrescriptionStatus = 'DRAFT' | 'SUBMITTED' | 'DISPENSED';

export type OpdPrescriptionItemResponse = {
  id: string;
  medicine_name: string;
  strength: string | null;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  quantity: number | null;
  instructions: string | null;
};

export type OpdPrescriptionResponse = {
  id: string;
  visit_id: string;
  consultation_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  status: ApiOpdPrescriptionStatus;
  items: OpdPrescriptionItemResponse[];
  follow_up_date: string | null;
  doctor_instructions: string | null;
  patient_instructions: string | null;
  submitted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOpdPrescriptionItemPayload = Omit<OpdPrescriptionItemResponse, 'id'>;

export type SaveOpdPrescriptionPayload = {
  items: SaveOpdPrescriptionItemPayload[];
  follow_up_date?: string | null;
  doctor_instructions?: string | null;
  patient_instructions?: string | null;
};

export type ApiClinicalOrderType = 'LABORATORY' | 'IMAGING';
export type ApiClinicalOrderStatus = 'DRAFT' | 'SUBMITTED' | 'RECEIVED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'RESULT_ENTERED' | 'REPORT_ENTERED' | 'VERIFIED' | 'COMPLETED';
export type ApiClinicalOrderPriority = 'ROUTINE' | 'URGENT' | 'STAT';

export type OpdClinicalOrderItemResponse = {
  id: string;
  service_id: string;
  service_name: string;
  investigation_name: string;
  category: string;
};

export type OpdClinicalOrderResponse = {
  id: string;
  visit_id: string;
  consultation_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  branch_id: string;
  order_type: ApiClinicalOrderType;
  status: ApiClinicalOrderStatus;
  priority: ApiClinicalOrderPriority;
  destination: string | null;
  specimen_type: string | null;
  items: OpdClinicalOrderItemResponse[];
  clinical_notes: string | null;
  instructions: string | null;
  submitted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOpdClinicalOrderPayload = {
  priority: ApiClinicalOrderPriority;
  destination?: string | null;
  specimen_type?: string | null;
  items: Array<{ service_id: string; investigation_name: string; category: string }>;
  clinical_notes?: string | null;
  instructions?: string | null;
};

export type ApiOpdFollowUpStatus = 'DRAFT' | 'SCHEDULED';
export type ApiOpdFollowUpType =
  | 'CLINICAL_REVIEW'
  | 'MEDICATION_REVIEW'
  | 'LAB_REVIEW'
  | 'IMAGING_REVIEW'
  | 'REFERRAL_REVIEW';
export type ApiOpdFollowUpReminderType = 'SMS' | 'EMAIL' | 'NONE';

export type OpdFollowUpResponse = {
  id: string;
  visit_id: string;
  consultation_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  originating_doctor_id: string;
  originating_doctor_name: string;
  assigned_doctor_id: string | null;
  assigned_doctor_name: string | null;
  appointment_id: string | null;
  appointment_number: string | null;
  follow_up_type: ApiOpdFollowUpType | null;
  next_visit_date: string | null;
  start_time: string | null;
  duration_minutes: number | null;
  reason: string | null;
  reminder_type: ApiOpdFollowUpReminderType;
  notes: string | null;
  status: ApiOpdFollowUpStatus;
  scheduled_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOpdFollowUpPayload = {
  follow_up_type?: ApiOpdFollowUpType | null;
  next_visit_date?: string | null;
  start_time?: string | null;
  duration_minutes?: number | null;
  assigned_doctor_id?: string | null;
  reason?: string | null;
  reminder_type?: ApiOpdFollowUpReminderType;
  notes?: string | null;
};

export type ApiOpdReferralStatus = 'DRAFT' | 'SUBMITTED';
export type ApiOpdReferralType = 'INTERNAL' | 'EXTERNAL' | 'EMERGENCY';
export type ApiOpdReferralPriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

export type OpdReferralResponse = {
  id: string;
  visit_id: string;
  consultation_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  referring_doctor_id: string;
  referring_doctor_name: string;
  referral_type: ApiOpdReferralType | null;
  specialty: string | null;
  priority: ApiOpdReferralPriority;
  facility: string | null;
  referred_doctor_id: string | null;
  referred_doctor_name: string | null;
  reason: string | null;
  clinical_summary: string | null;
  appointment_id: string | null;
  appointment_number: string | null;
  appointment_date: string | null;
  appointment_start_time: string | null;
  appointment_duration_minutes: number | null;
  status: ApiOpdReferralStatus;
  submitted_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveOpdReferralPayload = {
  referral_type?: ApiOpdReferralType | null;
  specialty?: string | null;
  priority?: ApiOpdReferralPriority;
  facility?: string | null;
  referred_doctor_id?: string | null;
  referred_doctor_name?: string | null;
  reason?: string | null;
  clinical_summary?: string | null;
  appointment_date?: string | null;
  appointment_start_time?: string | null;
  appointment_duration_minutes?: number | null;
};

const toQueryString = (params: Record<string, unknown>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const opdApi = {
  listVisits(params: OpdVisitListParams = {}) {
    return apiClient.request<OpdVisitListResponse>(`/opd/visits${toQueryString(params)}`);
  },

  getVisitById(id: string) {
    return apiClient.request<OpdVisitResponse>(`/opd/visits/${encodeURIComponent(id)}`);
  },

  createVisit(payload: CreateOpdVisitPayload) {
    return apiClient.request<OpdVisitResponse>('/opd/visits', {
      body: payload,
      method: 'POST',
    });
  },

  updateVisitStatus(id: string, payload: UpdateOpdVisitStatusPayload) {
    return apiClient.request<OpdVisitResponse>(`/opd/visits/${encodeURIComponent(id)}/status`, {
      body: payload,
      method: 'PATCH',
    });
  },

  listVitals(visitId: string, params: OpdVitalsListParams = {}) {
    return apiClient.request<OpdVitalsListResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/vitals${toQueryString(params)}`,
    );
  },

  getLatestVitals(visitId: string) {
    return apiClient.request<OpdVitalsResponse | null>(`/opd/visits/${encodeURIComponent(visitId)}/vitals/latest`);
  },

  createVitals(visitId: string, payload: CreateOpdVitalsPayload) {
    return apiClient.request<OpdVitalsResponse>(`/opd/visits/${encodeURIComponent(visitId)}/vitals`, {
      body: payload,
      method: 'POST',
    });
  },

  getConsultation(visitId: string) {
    return apiClient.request<OpdConsultationResponse | null>(
      `/opd/visits/${encodeURIComponent(visitId)}/consultation`,
    );
  },

  saveConsultationDraft(visitId: string, payload: SaveOpdConsultationPayload) {
    return apiClient.request<OpdConsultationResponse>(`/opd/visits/${encodeURIComponent(visitId)}/consultation`, {
      body: payload,
      method: 'PUT',
    });
  },

  completeConsultation(visitId: string, payload: SaveOpdConsultationPayload) {
    return apiClient.request<OpdConsultationResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/consultation/complete`,
      {
        body: payload,
        method: 'POST',
      },
    );
  },

  listPrescriptions(params: Partial<{ status: ApiOpdPrescriptionStatus; limit: number; skip: number; search: string; sortBy: string; sortOrder: 'asc' | 'desc' }> = {}) {
    return apiClient.request<{ data: OpdPrescriptionResponse[]; total: number }>(`/opd/prescriptions${toQueryString(params)}`);
  },

  updatePrescriptionStatus(id: string, status: ApiOpdPrescriptionStatus) {
    return apiClient.request<OpdPrescriptionResponse>(`/opd/prescriptions/${encodeURIComponent(id)}/status`, {
      body: { status },
      method: 'PATCH',
    });
  },

  getPrescription(visitId: string) {
    return apiClient.request<OpdPrescriptionResponse | null>(
      `/opd/visits/${encodeURIComponent(visitId)}/prescription`,
    );
  },

  savePrescriptionDraft(visitId: string, payload: SaveOpdPrescriptionPayload) {
    return apiClient.request<OpdPrescriptionResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/prescription`,
      { body: payload, method: 'PUT' },
    );
  },

  submitPrescription(visitId: string, payload: SaveOpdPrescriptionPayload) {
    return apiClient.request<OpdPrescriptionResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/prescription/submit`,
      { body: payload, method: 'POST' },
    );
  },

  getClinicalOrder(visitId: string, orderType: ApiClinicalOrderType) {
    return apiClient.request<OpdClinicalOrderResponse | null>(
      `/opd/visits/${encodeURIComponent(visitId)}/clinical-orders/${orderType}`,
    );
  },

  saveClinicalOrderDraft(
    visitId: string,
    orderType: ApiClinicalOrderType,
    payload: SaveOpdClinicalOrderPayload,
  ) {
    return apiClient.request<OpdClinicalOrderResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/clinical-orders/${orderType}`,
      { body: payload, method: 'PUT' },
    );
  },

  submitClinicalOrder(
    visitId: string,
    orderType: ApiClinicalOrderType,
    payload: SaveOpdClinicalOrderPayload,
  ) {
    return apiClient.request<OpdClinicalOrderResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/clinical-orders/${orderType}/submit`,
      { body: payload, method: 'POST' },
    );
  },

  getFollowUp(visitId: string) {
    return apiClient.request<OpdFollowUpResponse | null>(`/opd/visits/${encodeURIComponent(visitId)}/follow-up`);
  },

  saveFollowUpDraft(visitId: string, payload: SaveOpdFollowUpPayload) {
    return apiClient.request<OpdFollowUpResponse>(`/opd/visits/${encodeURIComponent(visitId)}/follow-up`, {
      body: payload,
      method: 'PUT',
    });
  },

  scheduleFollowUp(visitId: string, payload: SaveOpdFollowUpPayload) {
    return apiClient.request<OpdFollowUpResponse>(
      `/opd/visits/${encodeURIComponent(visitId)}/follow-up/schedule`,
      { body: payload, method: 'POST' },
    );
  },

  getReferral(visitId: string) {
    return apiClient.request<OpdReferralResponse | null>(`/opd/visits/${encodeURIComponent(visitId)}/referral`);
  },

  saveReferralDraft(visitId: string, payload: SaveOpdReferralPayload) {
    return apiClient.request<OpdReferralResponse>(`/opd/visits/${encodeURIComponent(visitId)}/referral`, {
      body: payload,
      method: 'PUT',
    });
  },

  submitReferral(visitId: string, payload: SaveOpdReferralPayload) {
    return apiClient.request<OpdReferralResponse>(`/opd/visits/${encodeURIComponent(visitId)}/referral/submit`, {
      body: payload,
      method: 'POST',
    });
  },
};
