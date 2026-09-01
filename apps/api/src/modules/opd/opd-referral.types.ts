export type OpdReferralStatus = 'DRAFT' | 'SUBMITTED';
export type OpdReferralType = 'INTERNAL' | 'EXTERNAL' | 'EMERGENCY';
export type OpdReferralPriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

export type OpdReferral = {
  id: string;
  visit_id: string;
  branch_id: string;
  consultation_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  referring_doctor_id: string;
  referring_doctor_name: string;
  referral_type: OpdReferralType | null;
  specialty: string | null;
  priority: OpdReferralPriority;
  facility: string | null;
  referred_doctor_id: string | null;
  referred_doctor_name: string | null;
  reason: string | null;
  clinical_summary: string | null;
  appointment_id: string | null;
  appointment_number: string | null;
  appointment_date: Date | null;
  appointment_start_time: string | null;
  appointment_duration_minutes: number | null;
  status: OpdReferralStatus;
  submitted_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type SaveOpdReferralDTO = {
  referral_type?: OpdReferralType | null;
  specialty?: string | null;
  priority?: OpdReferralPriority;
  facility?: string | null;
  referred_doctor_id?: string | null;
  referred_doctor_name?: string | null;
  reason?: string | null;
  clinical_summary?: string | null;
  appointment_date?: string | null;
  appointment_start_time?: string | null;
  appointment_duration_minutes?: number | null;
};

export type OpdReferralListQuery = { booked?: boolean; page?: number; limit?: number };
export type BookOpdReferralDTO = {
  appointment_date: string;
  start_time: string;
  duration_minutes: number;
  visit_type: 'NEW_CONSULTATION' | 'FOLLOW_UP' | 'PROCEDURE';
  priority?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  notes?: string | null;
};
