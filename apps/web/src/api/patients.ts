import { apiClient } from './client';

export type ApiPatientGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
export type ApiPatientStatus = 'ACTIVE' | 'INACTIVE' | 'DECEASED';
export type ApiPatientDocumentType = 'IDENTITY' | 'INSURANCE' | 'CLINICAL' | 'CONSENT' | 'OTHER';

export type PatientAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
};

export type PatientEmergencyContact = {
  name?: string | null;
  relationship?: string | null;
  phone?: string | null;
};

export type PatientResponse = {
  id: string;
  patient_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  gender: ApiPatientGender;
  phone: string | null;
  email: string | null;
  address: PatientAddress;
  emergency_contact: PatientEmergencyContact;
  registration_branch_id: string | null;
  blood_group: string | null;
  status: ApiPatientStatus;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PatientListResponse = {
  data: PatientResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PatientListParams = Partial<{
  search: string;
  status: ApiPatientStatus;
  gender: ApiPatientGender;
  page: number;
  limit: number;
  sortBy: 'patient_number' | 'first_name' | 'last_name' | 'created_at' | 'updated_at';
  sortOrder: 'asc' | 'desc';
}>;

export type SavePatientPayload = {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  date_of_birth: string;
  gender: ApiPatientGender;
  phone?: string | null;
  email?: string | null;
  address?: PatientAddress;
  emergency_contact?: PatientEmergencyContact;
  registration_branch_id?: string | null;
  blood_group?: string | null;
  status?: ApiPatientStatus;
  notes?: string | null;
};

export type PatientDocumentResponse = {
  id: string;
  patient_id: string;
  document_type: ApiPatientDocumentType;
  title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_key: string;
  description: string | null;
  status: 'ACTIVE' | 'DELETED';
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SavePatientDocumentPayload = {
  document_type: ApiPatientDocumentType;
  title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_key: string;
  description?: string | null;
};

export type PatientTimelineEventResponse = {
  id: string;
  patient_id: string;
  event_type: 'REGISTRATION' | 'PROFILE_UPDATED' | 'DOCUMENT_ADDED' | 'DOCUMENT_DELETED' | 'CONSENT_ADDED';
  title: string;
  description: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
};

export type PatientHistoryResponse = {
  patient: PatientResponse;
  timeline: PatientTimelineEventResponse[];
  documents: PatientDocumentResponse[];
  visits: [];
};

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const patientsApi = {
  list(params: PatientListParams = {}) {
    return apiClient.request<PatientListResponse>(`/patients${toQueryString(params)}`);
  },

  getById(id: string) {
    return apiClient.request<PatientResponse>(`/patients/${encodeURIComponent(id)}`);
  },

  create(payload: SavePatientPayload) {
    return apiClient.request<PatientResponse>('/patients', {
      body: payload,
      method: 'POST',
    });
  },

  update(id: string, payload: Partial<SavePatientPayload>) {
    return apiClient.request<PatientResponse>(`/patients/${encodeURIComponent(id)}`, {
      body: payload,
      method: 'PATCH',
    });
  },

  history(id: string) {
    return apiClient.request<PatientHistoryResponse>(`/patients/${encodeURIComponent(id)}/history`);
  },

  timeline(id: string) {
    return apiClient.request<PatientTimelineEventResponse[]>(`/patients/${encodeURIComponent(id)}/timeline`);
  },

  documents(id: string, documentType?: ApiPatientDocumentType) {
    return apiClient.request<PatientDocumentResponse[]>(
      `/patients/${encodeURIComponent(id)}/documents${toQueryString({ document_type: documentType })}`,
    );
  },

  createDocument(id: string, payload: SavePatientDocumentPayload) {
    return apiClient.request<PatientDocumentResponse>(`/patients/${encodeURIComponent(id)}/documents`, {
      body: payload,
      method: 'POST',
    });
  },

  deleteDocument(patientId: string, documentId: string) {
    return apiClient.request<PatientDocumentResponse>(
      `/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: 'DELETE',
      },
    );
  },
};

