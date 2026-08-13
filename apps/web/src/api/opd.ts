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
  blood_pressure_systolic: number;
  blood_pressure_diastolic: number;
  blood_pressure: string;
  weight_kg: number;
  height_cm: number;
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
  blood_pressure_systolic: number;
  blood_pressure_diastolic: number;
  weight_kg: number;
  height_cm: number;
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
};
