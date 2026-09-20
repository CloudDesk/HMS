export type ProstheticType = 'CROWN' | 'BRIDGE' | 'OTHER';

export type DentalLabOrderStatus =
  | 'DRAFT'
  | 'ORDERED'
  | 'RECEIVED'
  | 'IN_PROGRESS'
  | 'QUALITY_CHECK'
  | 'READY'
  | 'CANCELLED';

export type DentalProstheticLabOrder = {
  id: string;
  order_number: string;
  patient_id: string;
  treatment_episode_id: string;
  treatment_stage_id: string;
  treatment_plan_item_id?: string | null;
  tooth_number?: number | null;
  prosthetic_type: ProstheticType;
  description: string;
  assigned_lab_id?: string | null;
  requested_by: string;
  requested_by_name?: string | null;
  requested_at: Date;
  status: DentalLabOrderStatus;
  received_at?: Date | null;
  in_progress_at?: Date | null;
  quality_check_at?: Date | null;
  ready_at?: Date | null;
  cancelled_at?: Date | null;
  status_remarks?: string | null;
  cancellation_reason?: string | null;
  branch_id: string;
  department_id: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: Date;
  updated_at: Date;
};

export type CreateDentalProstheticLabOrderDTO = {
  patient_id: string;
  treatment_episode_id: string;
  treatment_stage_id: string;
  treatment_plan_item_id?: string | null;
  tooth_number?: number | null;
  prosthetic_type: ProstheticType;
  description: string;
  assigned_lab_id?: string | null;
  status?: DentalLabOrderStatus;
};

export type UpdateDentalLabOrderStatusDTO = {
  status: DentalLabOrderStatus;
  remarks?: string | null;
  cancellation_reason?: string | null;
};
