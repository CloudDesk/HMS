import type { DentitionType, ToothMobility, ToothStatus, ToothSurface } from './opd-dental-examination.types.js';

export type DentalEpisodeStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export type DentalEpisodeVisitSummary = {
  visit_id: string;
  visit_number: string;
  doctor_id: string;
  doctor_name: string;
  visit_date: Date;
  status: string;
  notes?: string | null;
};

export type DentalTreatmentEpisode = {
  id: string;
  episode_number: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  originating_visit_id: string;
  originating_visit_number: string;
  primary_doctor_id: string;
  primary_doctor_name: string;
  branch_id: string;
  department_id: string;
  primary_tooth_number?: number | null;
  diagnosis_code?: string | null;
  diagnosis_name?: string | null;
  treatment_plan_summary?: string | null;
  status: DentalEpisodeStatus;
  visit_ids: string[];
  visits?: DentalEpisodeVisitSummary[];
  notes?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CreateDentalEpisodeDTO = {
  patient_id: string;
  originating_visit_id: string;
  primary_tooth_number?: number | null;
  diagnosis_code?: string | null;
  diagnosis_name?: string | null;
  treatment_plan_summary?: string | null;
  notes?: string | null;
};

export type UpdateDentalEpisodeStatusDTO = {
  status: DentalEpisodeStatus;
  notes?: string | null;
};

export type HistoricalToothFinding = {
  tooth_number: number;
  dentition: DentitionType;
  status: ToothStatus;
  surfaces: ToothSurface[];
  conditions: string[];
  mobility?: ToothMobility | null;
  pocket_depth_mm?: number | null;
  furcation_involvement?: string | null;
  notes?: string | null;
  visit_id: string;
  visit_number: string;
  doctor_id: string;
  doctor_name: string;
  recorded_at: Date;
};
