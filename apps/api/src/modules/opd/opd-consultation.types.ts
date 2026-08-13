export type OpdConsultationStatus = 'DRAFT' | 'COMPLETED';

export type OpdConsultation = {
  id: string;
  visit_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  status: OpdConsultationStatus;
  chief_complaint: string | null;
  history_present_illness: string | null;
  past_history: string | null;
  family_history: string | null;
  allergies: string | null;
  physical_examination: string | null;
  assessment: string | null;
  treatment_plan: string | null;
  doctor_notes: string | null;
  completed_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type SaveOpdConsultationDTO = {
  chief_complaint?: string | null;
  history_present_illness?: string | null;
  past_history?: string | null;
  family_history?: string | null;
  allergies?: string | null;
  physical_examination?: string | null;
  assessment?: string | null;
  treatment_plan?: string | null;
  doctor_notes?: string | null;
};
