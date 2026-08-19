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

export type DoctorWorkingBlockResponse = {
  id: string;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
};

export type DoctorAvailabilityResponse = {
  id: string;
  day_of_week: ApiDoctorAvailabilityDay;
  is_available: boolean;
  working_blocks: DoctorWorkingBlockResponse[];
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
  meta: { page: number; limit: number; total: number; totalPages: number };
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
    working_blocks: Array<{ start_time: string; end_time: string; slot_duration_minutes: number }>;
  }>;
};

export type DoctorAccountAccessPayload =
  | { create_login_account: false }
  | {
      create_login_account: true;
      employee_code: string;
      username: string;
      email: string;
      temporary_password: string;
    };

export type CreateDoctorPayload = SaveDoctorPayload &
  SaveDoctorAvailabilityPayload & {
    account_access: DoctorAccountAccessPayload;
  };

export type DoctorOnboardingResponse = {
  doctor: DoctorResponse;
  account: {
    created: boolean;
    user_id: string | null;
    username: string | null;
  };
};

export type DoctorLeaveResponse = {
  id: string;
  doctor_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'ACTIVE' | 'CANCELLED';
  created_by: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DoctorAvailabilityExceptionResponse = {
  id: string;
  doctor_id: string;
  date: string;
  is_available: boolean;
  working_blocks: DoctorWorkingBlockResponse[];
  reason: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DoctorUserOption = {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  mapped_doctor_id: string | null;
};

export type DoctorAvailableSlotsResponse = {
  doctor_id: string;
  date: string;
  is_available: boolean;
  unavailable_reason: string | null;
  slots: Array<{ start_time: string; end_time: string }>;
};

export type DoctorLeaveListParams = Partial<{
  status: 'ACTIVE' | 'CANCELLED';
  date_from: string;
  date_to: string;
  page: number;
  limit: number;
}>;

export type DoctorExceptionListParams = Partial<{
  date_from: string;
  date_to: string;
  page: number;
  limit: number;
}>;

type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

type QueryParams<Params> = {
  [Key in keyof Params]: string | number | undefined;
};

const toQueryString = <Params extends QueryParams<Params>>(params: Params) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]: [string, unknown]) => {
    if (typeof value === 'string' || typeof value === 'number') {
      if (String(value).length > 0) searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const doctorsApi = {
  list(params: DoctorListParams = {}) {
    return apiClient.request<DoctorListResponse>(
      `/doctors${toQueryString(params)}`,
    );
  },

  getById(id: string) {
    return apiClient.request<DoctorResponse>(`/doctors/${encodeURIComponent(id)}`);
  },

  getCurrent() {
    return apiClient.request<DoctorResponse>('/doctors/me');
  },

  userOptions() {
    return apiClient.request<DoctorUserOption[]>('/doctors/user-options');
  },

  async export(params: DoctorListParams = {}) {
    const response = await apiClient.download(
      `/doctors/export${toQueryString(params)}`,
    );
    return response.blob;
  },

  create(payload: CreateDoctorPayload) {
    return apiClient.request<DoctorOnboardingResponse>('/doctors', { body: payload, method: 'POST' });
  },

  update(id: string, payload: Partial<Omit<SaveDoctorPayload, 'status'>>) {
    return apiClient.request<DoctorResponse>(`/doctors/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  updateStatus(id: string, status: ApiDoctorStatus, reason: string) {
    return apiClient.request<DoctorResponse>(`/doctors/${encodeURIComponent(id)}/status`, {
      body: { status, reason },
      method: 'PATCH',
    });
  },

  mapUser(id: string, userId: string | null) {
    return apiClient.request<DoctorResponse>(`/doctors/${encodeURIComponent(id)}/user-mapping`, {
      body: { user_id: userId },
      method: 'PATCH',
    });
  },

  updateAvailability(id: string, payload: SaveDoctorAvailabilityPayload) {
    return apiClient.request<DoctorResponse>(`/doctors/${encodeURIComponent(id)}/availability`, {
      body: payload,
      method: 'PATCH',
    });
  },

  availableSlots(id: string, date: string) {
    return apiClient.request<DoctorAvailableSlotsResponse>(
      `/doctors/${encodeURIComponent(id)}/available-slots?date=${encodeURIComponent(date)}`,
    );
  },

  listLeaves(id: string, params: DoctorLeaveListParams = {}) {
    return apiClient.request<Paginated<DoctorLeaveResponse>>(
      `/doctors/${encodeURIComponent(id)}/leaves${toQueryString(params)}`,
    );
  },

  createLeave(id: string, payload: { start_date: string; end_date: string; reason: string }) {
    return apiClient.request<DoctorLeaveResponse>(`/doctors/${encodeURIComponent(id)}/leaves`, {
      body: payload,
      method: 'POST',
    });
  },

  cancelLeave(id: string, leaveId: string) {
    return apiClient.request<DoctorLeaveResponse>(
      `/doctors/${encodeURIComponent(id)}/leaves/${encodeURIComponent(leaveId)}/cancel`,
      { method: 'PATCH' },
    );
  },

  listExceptions(id: string, params: DoctorExceptionListParams = {}) {
    return apiClient.request<Paginated<DoctorAvailabilityExceptionResponse>>(
      `/doctors/${encodeURIComponent(id)}/availability-exceptions${toQueryString(params)}`,
    );
  },

  saveException(
    id: string,
    payload: {
      date: string;
      is_available: boolean;
      working_blocks: Array<{ start_time: string; end_time: string; slot_duration_minutes: number }>;
      reason: string;
    },
  ) {
    return apiClient.request<DoctorAvailabilityExceptionResponse>(
      `/doctors/${encodeURIComponent(id)}/availability-exceptions`,
      { body: payload, method: 'POST' },
    );
  },

  deleteException(id: string, exceptionId: string) {
    return apiClient.request<{ success: true }>(
      `/doctors/${encodeURIComponent(id)}/availability-exceptions/${encodeURIComponent(exceptionId)}`,
      { method: 'DELETE' },
    );
  },
};
