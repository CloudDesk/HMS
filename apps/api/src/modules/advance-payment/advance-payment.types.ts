export type AdvanceRequirementStatus = 'NOT_REQUIRED' | 'REQUIRED';
export type AdvancePaymentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
export type AdvanceSourceType = 'ADMISSION_REQUEST' | 'PROCEDURE_BOOKING';

export type AdvancePaymentFields = {
  patient_id: string;
  source_type: AdvanceSourceType;
  source_id: string;
  branch_id: string;
  required_amount: number;
  paid_amount: number;
  balance_amount: number;
  requirement_status: AdvanceRequirementStatus;
  payment_status: AdvancePaymentStatus;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type AdvancePaymentRecord = AdvancePaymentFields & {
  id: string;
};

export type SyncAdvancePaymentDTO = {
  patient_id: string;
  source_type: AdvanceSourceType;
  source_id: string;
  branch_id: string;
  required_amount: number;
  requirement_status: AdvanceRequirementStatus;
};

export type ProcessAdvancePaymentPaymentDTO = {
  source_type: AdvanceSourceType;
  source_id: string;
  amount_paid: number;
};
