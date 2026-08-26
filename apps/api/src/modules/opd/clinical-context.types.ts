export type ClinicalContextSourceType =
  | 'OPD_VISIT'
  | 'EMERGENCY_ENCOUNTER'
  | 'INPATIENT_ADMISSION'
  | 'PROCEDURE_BOOKING';

export type ClinicalSourceContext = {
  source_type: ClinicalContextSourceType;
  source_id: string;
  encounter_id: string | null;
  admission_id: string | null;
  procedure_id: string | null;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  branch_id: string;
};
