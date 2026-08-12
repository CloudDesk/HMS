import { apiClient } from './client';

export type ApiDoctorStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type ApiDoctorAvailabilityDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type DoctorAvailabilityResponse = {
  id: string;
  day_of_week: ApiDoctorAvailabilityDay;
  is_available: boolean;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
  slot_duration_minutes: number;
};

export type DoctorResponse = {
  id: string;
  doctor_number: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  display_name: string;
  specialization: string;
  qualification: string | null;
  registration_number: string | null;
  experience_years: number | null;
  branch_id: string;
  department_id: string;
  consultation_room: string | null;
  phone: string | null;
  email: string | null;
  status: ApiDoctorStatus;
  notes: string | null;
  availability: DoctorAvailabilityResponse[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DoctorListResponse = {
  data: DoctorResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type DoctorListParams = Partial<{
  search: string;
  status: ApiDoctorStatus;
  branch_id: string;
  department_id: string;
  specialization: string;
  page: number;
  limit: number;
  sortBy: 'doctor_number' | 'display_name' | 'specialization' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}>;

export type SaveDoctorPayload = {
  first_name: string;
  last_name: string;
  user_id?: string | null;
  specialization: string;
  qualification?: string | null;
  registration_number?: string | null;
  experience_years?: number | null;
  branch_id: string;
  department_id: string;
  consultation_room?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: ApiDoctorStatus;
  notes?: string | null;
};

export type SaveDoctorAvailabilityPayload = {
  availability: Array<{
    day_of_week: ApiDoctorAvailabilityDay;
    is_available: boolean;
    start_time: string;
    end_time: string;
    break_start_time?: string | null;
    break_end_time?: string | null;
    slot_duration_minutes: number;
  }>;
};

const toQueryString = (params: DoctorListParams) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const doctorsApi = {
  list(params: DoctorListParams = {}) {
    return apiClient.request<DoctorListResponse>(`/doctors${toQueryString(params)}`);
  },

  getById(id: string) {
    return apiClient.request<DoctorResponse>(`/doctors/${encodeURIComponent(id)}`);
  },

  create(payload: SaveDoctorPayload) {
    return apiClient.request<DoctorResponse>('/doctors', {
      body: payload,
      method: 'POST',
    });
  },

  update(id: string, payload: Partial<SaveDoctorPayload>) {
    return apiClient.request<DoctorResponse>(`/doctors/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  updateAvailability(id: string, payload: SaveDoctorAvailabilityPayload) {
    return apiClient.request<DoctorResponse>(`/doctors/${encodeURIComponent(id)}/availability`, {
      body: payload,
      method: 'PATCH',
    });
  },
};
