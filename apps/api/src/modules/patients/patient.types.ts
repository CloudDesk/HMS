export type PatientGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';

export type PatientStatus = 'ACTIVE' | 'INACTIVE' | 'DECEASED';

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

export type Patient = {
  id: string;
  patient_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: Date;
  gender: PatientGender;
  phone: string | null;
  email: string | null;
  address: PatientAddress;
  emergency_contact: PatientEmergencyContact;
  registration_branch_id: string | null;
  blood_group: string | null;
  status: PatientStatus;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type PatientListQuery = {
  search?: string;
  status?: PatientStatus;
  gender?: PatientGender;
  page?: number;
  limit?: number;
  sortBy?: 'patient_number' | 'first_name' | 'last_name' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreatePatientDTO = {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  date_of_birth: string;
  gender: PatientGender;
  phone?: string | null;
  email?: string | null;
  address?: PatientAddress;
  emergency_contact?: PatientEmergencyContact;
  registration_branch_id?: string | null;
  blood_group?: string | null;
  status?: PatientStatus;
  notes?: string | null;
};

export type UpdatePatientDTO = Partial<Omit<CreatePatientDTO, 'status'>> & {
  status?: PatientStatus;
};

export type PatientDocumentType = 'IDENTITY' | 'INSURANCE' | 'CLINICAL' | 'CONSENT' | 'OTHER';

export type PatientDocument = {
  id: string;
  patient_id: string;
  document_type: PatientDocumentType;
  title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_key: string;
  description: string | null;
  status: 'ACTIVE' | 'DELETED';
  uploaded_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CreatePatientDocumentDTO = {
  document_type: PatientDocumentType;
  title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_key: string;
  description?: string | null;
};

export type UploadPatientDocumentDTO = Omit<CreatePatientDocumentDTO, 'storage_key'> & {
  data: Buffer;
};

export type PatientTimelineEventType =
  | 'REGISTRATION'
  | 'PROFILE_UPDATED'
  | 'DOCUMENT_ADDED'
  | 'DOCUMENT_DELETED'
  | 'CONSENT_ADDED'
  | 'OPD_VISIT_CREATED'
  | 'OPD_VISIT_STATUS_UPDATED'
  | 'VITALS_RECORDED'
  | 'OPD_CONSULTATION_COMPLETED'
  | 'OPD_PRESCRIPTION_SUBMITTED'
  | 'OPD_LAB_ORDER_SUBMITTED'
  | 'OPD_IMAGING_ORDER_SUBMITTED'
  | 'OPD_FOLLOW_UP_SCHEDULED'
  | 'OPD_REFERRAL_SUBMITTED';

export type PatientTimelineListQuery = {
  event_type?: PatientTimelineEventType;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

export type PatientTimelineEvent = {
  id: string;
  patient_id: string;
  event_type: PatientTimelineEventType;
  title: string;
  description: string | null;
  occurred_at: Date;
  created_by: string | null;
  created_at: Date;
};

