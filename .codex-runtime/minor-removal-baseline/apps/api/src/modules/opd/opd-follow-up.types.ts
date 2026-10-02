export type OpdFollowUpStatus = 'DRAFT' | 'SCHEDULED';
export type OpdFollowUpType = 'CLINICAL_REVIEW' | 'MEDICATION_REVIEW' | 'LAB_REVIEW' | 'IMAGING_REVIEW' | 'REFERRAL_REVIEW';
export type OpdFollowUpReminderType = 'SMS' | 'EMAIL' | 'NONE';

export type OpdFollowUp = {
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
  follow_up_type: OpdFollowUpType | null;
  next_visit_date: Date | null;
  start_time: string | null;
  duration_minutes: number | null;
  reason: string | null;
  reminder_type: OpdFollowUpReminderType;
  notes: string | null;
  status: OpdFollowUpStatus;
  scheduled_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type SaveOpdFollowUpDTO = {
  follow_up_type?: OpdFollowUpType | null;
  next_visit_date?: string | null;
  start_time?: string | null;
  utc_datetime?: string | null;
  duration_minutes?: number | null;
  assigned_doctor_id?: string | null;
  reason?: string | null;
  reminder_type?: OpdFollowUpReminderType;
  notes?: string | null;
};
