export type OpdConsultationStatus = 'DRAFT' | 'COMPLETED';

export type OpdDiagnosisType = 'PRIMARY' | 'SECONDARY';
export type OpdDiagnosisLaterality = 'OD' | 'OS' | 'OU' | 'NOT_APPLICABLE';
export type OpdDiagnosisStatus = 'SUSPECTED' | 'CONFIRMED' | 'RULED_OUT';

export type OpdStructuredDiagnosis = {
  code: string;
  display: string;
  codingSystem: string;
  type: OpdDiagnosisType;
  laterality?: OpdDiagnosisLaterality | null;
  status?: OpdDiagnosisStatus | null;
  severity?: string | null;
  stage?: string | null;
  differential?: boolean;
  notes?: string | null;
};

export type OpdConsultationClinicalHistoryEntry = {
  consultation_version: number;
  diagnoses: OpdStructuredDiagnosis[];
  treatment_plan: string | null;
  changed_by: string;
  changed_at: Date;
};

export type OpdConsultation = {
  id: string;
  visit_id: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  status: OpdConsultationStatus;
  version: number;
  chief_complaint: string | null;
  history_present_illness: string | null;
  past_history: string | null;
  family_history: string | null;
  allergies: string | null;
  physical_examination: string | null;
  assessment: string | null;
  diagnoses: OpdStructuredDiagnosis[];
  clinical_history: OpdConsultationClinicalHistoryEntry[];
  treatment_plan: string | null;
  doctor_notes: string | null;
  completed_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type SaveOpdConsultationDTO = {
  expected_version?: number;
  expected_status?: OpdConsultationStatus;
  chief_complaint?: string | null;
  history_present_illness?: string | null;
  past_history?: string | null;
  family_history?: string | null;
  allergies?: string | null;
  physical_examination?: string | null;
  assessment?: string | null;
  diagnoses?: OpdStructuredDiagnosis[];
  treatment_plan?: string | null;
  doctor_notes?: string | null;
};

