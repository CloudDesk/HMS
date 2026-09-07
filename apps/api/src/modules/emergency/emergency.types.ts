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
export type EmergencyDisposition = 'DISCHARGE' | 'ADMIT' | 'TRANSFER' | 'LEFT';
export type EmergencyOrderType = 'PHARMACY' | 'LABORATORY' | 'IMAGING';
export type EmergencyReferralPriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';
export type EmergencyMetadata = { ipAddress?: string; userAgent?: string };
export type EmergencyListQuery = {
  branch_id: string;
  department_id?: string;
  status?: EmergencyStatus;
  triage_level?: EmergencyTriageLevel;
  search?: string;
  page?: number;
  limit?: number;
};
export type CreateEmergencyDTO = {
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
export type EmergencyTriageDTO = {
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
export type EmergencyConsultationDTO = {
  doctor_id?: string;
  chief_complaint: string;
  history: string;
  examination: string;
  diagnosis: string;
  plan: string;
  treatment?: string | null;
  notes?: string | null;
  ready_for_disposition?: boolean;
};
export type EmergencyOrderDTO = {
  order_type: EmergencyOrderType;
  priority: 'ROUTINE' | 'URGENT' | 'STAT';
  items: Array<{
    service_id?: string;
    medicine_name?: string;
    name: string;
    category: string;
    dosage?: string;
    route?: string;
    frequency?: string;
    duration?: string;
    quantity?: number | null;
  }>;
  destination?: string | null;
  specimen_type?: string | null;
  clinical_notes?: string | null;
  instructions?: string | null;
};
export type EmergencyDispositionDTO = {
  decision: EmergencyDisposition;
  reason?: string | null;
  summary?: string | null;
  instructions?: string | null;
  transfer_destination?: string | null;
};
export type EmergencyReasonDTO = { reason: string };
export type EmergencyReferralDTO = {
  target_department_id: string;
  target_doctor_id?: string | null;
  priority: EmergencyReferralPriority;
  reason: string;
  clinical_notes?: string;
};
export type EmergencyReferralListQuery = {
  booked?: boolean;
  page?: number;
  limit?: number;
};
export type BookEmergencyReferralDTO = {
  appointment_date: string;
  start_time: string;
  utc_datetime: string;
  duration_minutes: number;
  visit_type: 'NEW_CONSULTATION' | 'FOLLOW_UP' | 'PROCEDURE';
  priority?: EmergencyReferralPriority;
  notes?: string | null;
};
