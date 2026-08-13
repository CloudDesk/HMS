import { apiClient } from './client';

export type ApiAppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'NO_SHOW'
  | 'SKIPPED'
  | 'COMPLETED';

export type ApiAppointmentVisitType =
  | 'NEW_CONSULTATION'
  | 'FOLLOW_UP'
  | 'PROCEDURE'
  | 'EMERGENCY';

export type ApiAppointmentPriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

export type AppointmentResponse = {
  id: string;
  appointment_number: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization: string;
  branch_id: string;
  department_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  visit_type: ApiAppointmentVisitType;
  priority: ApiAppointmentPriority;
  status: ApiAppointmentStatus;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentListResponse = {
  data: AppointmentResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AppointmentListParams = Partial<{
  search: string;
  status: ApiAppointmentStatus;
  doctor_id: string;
  patient_id: string;
  branch_id: string;
  department_id: string;
  date_from: string;
  date_to: string;
  page: number;
  limit: number;
  sortBy: 'appointment_number' | 'appointment_date' | 'start_time' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}>;

export type SaveAppointmentPayload = {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  duration_minutes: number;
  visit_type: ApiAppointmentVisitType;
  priority?: ApiAppointmentPriority;
  reason?: string | null;
  notes?: string | null;
};

export type UpdateAppointmentStatusPayload = {
  status: ApiAppointmentStatus;
  notes?: string | null;
};

const toQueryString = (params: AppointmentListParams) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const appointmentsApi = {
  list(params: AppointmentListParams = {}) {
    return apiClient.request<AppointmentListResponse>(`/appointments${toQueryString(params)}`);
  },

  getById(id: string) {
    return apiClient.request<AppointmentResponse>(`/appointments/${encodeURIComponent(id)}`);
  },

  create(payload: SaveAppointmentPayload) {
    return apiClient.request<AppointmentResponse>('/appointments', {
      body: payload,
      method: 'POST',
    });
  },

  update(id: string, payload: Partial<SaveAppointmentPayload>) {
    return apiClient.request<AppointmentResponse>(`/appointments/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  updateStatus(id: string, payload: UpdateAppointmentStatusPayload) {
    return apiClient.request<AppointmentResponse>(`/appointments/${encodeURIComponent(id)}/status`, {
      body: payload,
      method: 'PATCH',
    });
  },
};
