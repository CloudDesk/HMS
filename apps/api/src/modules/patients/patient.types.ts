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
  first_name: string | null;
  middle_name: string | null;
  last_name: string;
  date_of_birth: Date;
  gender: PatientGender;
  phone: string | null;
  email: string | null;
  address: PatientAddress;
  emergency_contact: PatientEmergencyContact;
  parent_guardian: string | null;
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
  first_name?: string | null;
  middle_name?: string | null;
  last_name: string;
  date_of_birth: string;
  gender: PatientGender;
  phone?: string | null;
  email?: string | null;
  address?: PatientAddress;
  emergency_contact?: PatientEmergencyContact;
  parent_guardian?: string | null;
  registration_branch_id?: string | null;
  blood_group?: string | null;
  status?: PatientStatus;
  notes?: string | null;
};

export type UpdatePatientDTO = Partial<Omit<CreatePatientDTO, 'status'>> & {
  status?: PatientStatus;
};

export type PatientDocumentType = 'IDENTITY' | 'INSURANCE' | 'CLINICAL' | 'CONSENT' | 'OTHER';
export type PatientConsentStatus = 'SIGNED' | 'PENDING' | 'EXPIRED' | 'REJECTED' | 'ATTACHED' | 'VERIFIED';
export type PatientConsentContextType = 'INPATIENT_ADMISSION' | 'PROCEDURE_BOOKING' | 'PATIENT' | 'PROCEDURE' | 'ADMISSION';

export type PatientDocument = {
  id: string;
  patient_id: string;
  visit_id: string | null;
  admission_id: string | null;
  procedure_id: string | null;
  context_type: PatientConsentContextType | null;
  context_id: string | null;
  consent_template_id: string | null;
  consent_category: string | null;
  consent_version: number | null;
  document_type: PatientDocumentType;
  title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_key: string;
  description: string | null;
  consent_status: PatientConsentStatus | null;
  consent_kind: string | null;
  signed_at: Date | null;
  valid_until: Date | null;
  signed_by_name: string | null;
  status: 'ACTIVE' | 'DELETED';
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  uploaded_at: Date;
  verified_by: string | null;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type CreatePatientDocumentDTO = {
  visit_id?: string | null;
  admission_id?: string | null;
  procedure_id?: string | null;
  context_type?: PatientConsentContextType | null;
  context_id?: string | null;
  consent_template_id?: string | null;
  consent_category?: string | null;
  consent_version?: number | null;
  document_type: PatientDocumentType;
  title: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  storage_key: string;
  description?: string | null;
  consent_status?: PatientConsentStatus | null;
  consent_kind?: string | null;
  signed_at?: string | null;
  valid_until?: string | null;
  signed_by_name?: string | null;
};

export type PatientDocumentListQuery = {
  document_type?: PatientDocumentType;
  visit_id?: string;
  admission_id?: string;
  procedure_id?: string;
  context_type?: PatientConsentContextType;
  page?: number;
  limit?: number;
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
  | 'CONSENT_VERIFIED'
  | 'OPD_VISIT_CREATED'
  | 'OPD_VISIT_STATUS_UPDATED'
  | 'VITALS_RECORDED'
  | 'OPD_CONSULTATION_COMPLETED'
  | 'OPD_PRESCRIPTION_SUBMITTED'
  | 'OPD_LAB_ORDER_SUBMITTED'
  | 'OPD_IMAGING_ORDER_SUBMITTED'
  | 'OPD_FOLLOW_UP_SCHEDULED'
  | 'OPD_REFERRAL_SUBMITTED'
  | 'OPD_REFERRAL_BOOKED'
  | 'INPATIENT_PRESCRIPTION_SUBMITTED'
  | 'INPATIENT_LAB_ORDER_SUBMITTED'
  | 'INPATIENT_IMAGING_ORDER_SUBMITTED'
  | 'ADMISSION_REQUEST_CREATED'
  | 'INPATIENT_ADMISSION_CONFIRMED'
  | 'ADMISSION_REQUEST_CANCEL'
  | 'ADMISSION_REQUEST_CANCELLED'
  | 'PROCEDURE_RECOMMENDATION_CREATED'
  | 'PROCEDURE_RECOMMENDATION_CANCELLED'
  | 'PROCEDURE_BOOKING_CREATED'
  | 'PROCEDURE_BOOKING_CONFIRMED'
  | 'PROCEDURE_BOOKING_RESCHEDULED'
  | 'PROCEDURE_BOOKING_CANCELLED'
  | 'PROCEDURE_BOOKING_COMPLETED'
  | 'PROCEDURE_PRESCRIPTION_SUBMITTED'
  | 'PROCEDURE_LAB_ORDER_SUBMITTED'
  | 'PROCEDURE_IMAGING_ORDER_SUBMITTED'
  | 'PROCEDURE_RECOMMENDATION_CREATED'
  | 'PROCEDURE_RECOMMENDATION_CANCELLED'
  | 'PROCEDURE_BOOKING_CREATED'
  | 'PROCEDURE_BOOKING_CONFIRMED'
  | 'PROCEDURE_BOOKING_RESCHEDULED'
  | 'PROCEDURE_BOOKING_CANCELLED'
  | 'PROCEDURE_BOOKING_COMPLETED'
  | 'EMERGENCY_ENCOUNTER_REGISTERED'
  | 'EMERGENCY_PATIENT_LINKED'
  | 'EMERGENCY_TRIAGE_COMPLETED'
  | 'EMERGENCY_CONSULTATION_UPDATED'
  | 'EMERGENCY_DISPOSITION_CONFIRMED'
  | 'EMERGENCY_CONVERTED_TO_IP';

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
  created_by_name: string | null;
  created_at: Date;
};

