export type DentitionType = 'PERMANENT' | 'PRIMARY';

export type ToothStatus =
  | 'PRESENT'
  | 'MISSING'
  | 'IMPACTED'
  | 'EXTRACTED'
  | 'UNERUPTED';

export type ToothSurface =
  | 'MESIAL'
  | 'DISTAL'
  | 'OCCLUSAL'
  | 'BUCCAL'
  | 'LINGUAL';

export type ToothMobility = 'NONE' | 'GRADE_I' | 'GRADE_II' | 'GRADE_III';

export type DentalExaminationStatus = 'DRAFT' | 'COMPLETED';

export type DentalHistory = {
  chief_complaint?: string | null;
  pain_scale?: number | null; // 0-10
  bleeding_gums?: boolean | null;
  sensitivity_hot_cold_sweet?: boolean | null;
  bruxism?: boolean | null;
  habits?: string[];
  medical_alerts?: string[];
};

export type SoftTissueExamination = {
  gingiva_condition?: string | null;
  calculus_plaque?: string | null;
  oral_mucosa?: string | null;
  tongue_palate_floor?: string | null;
  tmj_evaluation?: string | null;
  occlusion_class?: string | null;
};

export type ToothFinding = {
  tooth_number: number;
  dentition: DentitionType;
  status: ToothStatus;
  surfaces: ToothSurface[];
  conditions: string[];
  mobility?: ToothMobility | null;
  pocket_depth_mm?: number | null;
  furcation_involvement?: string | null;
  notes?: string | null;
};

export type DentalTreatmentPriority =
  | 'ROUTINE'
  | 'URGENT'
  | 'ELECTIVE'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW';

export type DentalTreatmentStatus =
  | 'PROPOSED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DECLINED'
  | 'CANCELLED';

export type DentalTreatmentPlanItem = {
  id?: string;
  service_id?: string | null;
  tooth_number?: number | null;
  procedure_name: string;
  surfaces?: ToothSurface[];
  priority?: DentalTreatmentPriority;
  estimated_cost?: number | null;
  notes?: string | null;
  status?: DentalTreatmentStatus;
};

export type OpdDentalExamination = {
  id: string;
  visit_id: string;
  consultation_id?: string | null;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  branch_id: string;
  department_id: string;
  status: DentalExaminationStatus;
  dental_history?: DentalHistory | null;
  soft_tissue?: SoftTissueExamination | null;
  teeth: ToothFinding[];
  treatment_plan_items: DentalTreatmentPlanItem[];
  completed_at?: Date | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: Date;
  updated_at: Date;
};

export type SaveOpdDentalExaminationDTO = {
  expected_updated_at?: string;
  dental_history?: DentalHistory | null;
  soft_tissue?: SoftTissueExamination | null;
  teeth?: ToothFinding[];
  treatment_plan_items?: DentalTreatmentPlanItem[];
};
