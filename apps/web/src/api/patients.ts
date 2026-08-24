import { apiClient } from './client';

export type ApiPatientGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
export type ApiPatientStatus = 'ACTIVE' | 'INACTIVE' | 'DECEASED';
export type ApiPatientDocumentType = 'IDENTITY' | 'INSURANCE' | 'CLINICAL' | 'CONSENT' | 'OTHER';
export type ApiPatientConsentStatus = 'NOT_REQUIRED' | 'PENDING' | 'ATTACHED' | 'VERIFIED';
export type ApiPatientConsentContextType = 'PATIENT' | 'PROCEDURE' | 'ADMISSION';

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
  first_name: string | null;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string;
  gender: ApiPatientGender;
  parent_guardian: string | null;
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
  first_name?: string | null;
  middle_name?: string | null;
  last_name: string;
  date_of_birth: string;
  gender: ApiPatientGender;
  parent_guardian?: string | null;
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
  visit_id: string | null;
  admission_id: string | null;
  procedure_id: string | null;
  context_type: ApiPatientConsentContextType | null;
  context_id: string | null;
  consent_template_id: string | null;
  consent_category: string | null;
  consent_version: number | null;
  document_type: ApiPatientDocumentType;
  title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_key: string;
  description: string | null;
  consent_status: ApiPatientConsentStatus | null;
  signed_at: string | null;
  valid_until: string | null;
  signed_by_name: string | null;
  status: 'ACTIVE' | 'DELETED';
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_at: string;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UploadPatientDocumentPayload = {
  visit_id?: string;
  admission_id?: string;
  procedure_id?: string;
  context_type?: ApiPatientConsentContextType;
  context_id?: string;
  branch_id?: string;
  consent_template_id?: string;
  consent_category?: string;
  consent_version?: number;
  document_type: ApiPatientDocumentType;
  title: string;
  file: File;
  description?: string | null;
  consent_status?: ApiPatientConsentStatus;
  signed_at?: string;
  valid_until?: string;
  signed_by_name?: string;
};

export type PatientDocumentListResponse = {
  data: PatientDocumentResponse[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type PatientDocumentListParams = Partial<{
  document_type: ApiPatientDocumentType;
  visit_id: string;
  admission_id: string;
  procedure_id: string;
  context_type: ApiPatientConsentContextType;
  page: number;
  limit: number;
}>;

export type PatientTimelineEventResponse = {
  id: string;
  patient_id: string;
  event_type:
    | 'REGISTRATION'
    | 'PROFILE_UPDATED'
    | 'DOCUMENT_ADDED'
    | 'DOCUMENT_DELETED'
  | 'CONSENT_ADDED'
  | 'OPD_VISIT_CREATED'
  | 'OPD_VISIT_STATUS_UPDATED'
  | 'VITALS_RECORDED'
  | 'OPD_CONSULTATION_COMPLETED'
  | 'OPD_REFERRAL_BOOKED';
  title: string;
  description: string | null;
  occurred_at: string;
  created_by: string | null;
  created_at: string;
};

export type PatientTimelineEventType = PatientTimelineEventResponse['event_type'];

export type PatientTimelineListParams = Partial<{
  event_type: PatientTimelineEventType;
  from: string;
  to: string;
  page: number;
  limit: number;
}>;

export type PatientTimelineListResponse = {
  data: PatientTimelineEventResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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

  timeline(id: string, params: PatientTimelineListParams = {}) {
    return apiClient.request<PatientTimelineListResponse>(
      `/patients/${encodeURIComponent(id)}/timeline${toQueryString(params)}`,
    );
  },

  documents(id: string, params: PatientDocumentListParams = {}) {
    return apiClient.request<PatientDocumentListResponse>(
      `/patients/${encodeURIComponent(id)}/documents${toQueryString(params)}`,
    );
  },

  uploadDocument(id: string, payload: UploadPatientDocumentPayload) {
    const formData = new FormData();
    formData.set('document_type', payload.document_type);
    formData.set('title', payload.title);
    formData.set('file', payload.file);
    if (payload.visit_id) formData.set('visit_id', payload.visit_id);
    if (payload.admission_id) formData.set('admission_id', payload.admission_id);
    if (payload.procedure_id) formData.set('procedure_id', payload.procedure_id);
    if (payload.context_type) formData.set('context_type', payload.context_type);
    if (payload.context_id) formData.set('context_id', payload.context_id);
    if (payload.branch_id) formData.set('branch_id', payload.branch_id);
    if (payload.consent_template_id) formData.set('consent_template_id', payload.consent_template_id);
    if (payload.consent_category) formData.set('consent_category', payload.consent_category);
    if (payload.consent_version) formData.set('consent_version', String(payload.consent_version));

    if (payload.description) {
      formData.set('description', payload.description);
    }
    if (payload.consent_status) formData.set('consent_status', payload.consent_status);
    if (payload.signed_at) formData.set('signed_at', payload.signed_at);
    if (payload.valid_until) formData.set('valid_until', payload.valid_until);
    if (payload.signed_by_name) formData.set('signed_by_name', payload.signed_by_name);

    return apiClient.request<PatientDocumentResponse>(`/patients/${encodeURIComponent(id)}/documents/upload`, {
      body: formData,
      method: 'POST',
    });
  },

  replaceDocument(id: string, documentId: string, payload: UploadPatientDocumentPayload) {
    const formData = new FormData();
    formData.set('document_type', payload.document_type);
    formData.set('title', payload.title);
    formData.set('file', payload.file);
    if (payload.description) formData.set('description', payload.description);
    if (payload.consent_status) formData.set('consent_status', payload.consent_status);
    if (payload.signed_at) formData.set('signed_at', payload.signed_at);
    if (payload.valid_until) formData.set('valid_until', payload.valid_until);
    if (payload.signed_by_name) formData.set('signed_by_name', payload.signed_by_name);
    return apiClient.request<PatientDocumentResponse>(
      `/patients/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/upload`,
      { body: formData, method: 'PUT' },
    );
  },

  downloadDocument(patientId: string, documentId: string) {
    return apiClient.download(
      `/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/download`,
    );
  },

  deleteDocument(patientId: string, documentId: string) {
    return apiClient.request<PatientDocumentResponse>(
      `/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: 'DELETE',
      },
    );
  },

  verifyConsent(patientId: string, documentId: string) {
    return apiClient.request<PatientDocumentResponse>(
      `/patients/${encodeURIComponent(patientId)}/documents/${encodeURIComponent(documentId)}/consent/verify`,
      { method: 'PATCH' },
    );
  },
};

