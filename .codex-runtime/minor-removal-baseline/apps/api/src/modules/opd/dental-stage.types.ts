export type DentalStageStatus =
  | 'PLANNED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'CANCELLED';

export type DentalTreatmentStage = {
  id: string;
  episode_id: string;
  plan_item_id: string;
  tooth_number?: number | null;
  service_id?: string | null;
  stage_name: string;
  sequence: number;
  assigned_doctor_id: string;
  assigned_doctor_name: string;
  status: DentalStageStatus;
  planned_date?: Date | null;
  completed_at?: Date | null;
  completed_by_doctor_id?: string | null;
  completed_by_doctor_name?: string | null;
  appointment_id?: string | null;
  prosthetic_lab_order_id?: string | null;
  notes?: string | null;
  branch_id: string;
  department_id: string;
  patient_id: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CreateDentalStageDTO = {
  plan_item_id: string;
  stage_name: string;
  assigned_doctor_id: string;
  tooth_number?: number | null;
  service_id?: string | null;
  sequence?: number;
  planned_date?: Date | string | null;
  prosthetic_lab_order_id?: string | null;
  notes?: string | null;
};

export type UpdateDentalStageStatusDTO = {
  status: DentalStageStatus;
  notes?: string | null;
};

export type AssignDoctorStageDTO = {
  doctor_id: string;
  notes?: string | null;
};

export type ScheduleDentalStageDTO = {
  doctor_id?: string;
  appointment_date: string;
  start_time: string;
  utc_datetime?: string;
  duration_minutes?: number;
  priority?: 'ROUTINE' | 'URGENT';
  notes?: string | null;
};

export type RescheduleDentalStageDTO = {
  appointment_date: string;
  start_time: string;
  utc_datetime?: string;
  duration_minutes?: number;
  reschedule_reason?: string | null;
};
