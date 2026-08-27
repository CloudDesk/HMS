export type PharmacyDispensingStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED' | 'REVERSED';
export type PharmacyDispensingSourceType = 'OPD' | 'EMERGENCY' | 'IP_ADMISSION' | 'PROCEDURE' | 'SURGERY';

export type PharmacyDispensingItem = {
  id: string;
  prescription_item_id: string;
  prescribed_medicine_name: string;
  medicine_id: string | null;
  batch_id: string | null;
  medicine_name: string;
  batch_number: string;
  requested_quantity: number | null;
  confirmed_quantity: number | null;
  available_quantity: number;
  unit_price: number;
  line_total: number;
  pharmacist_instructions: string | null;
};

export type PharmacyDispensing = {
  id: string;
  prescription_id: string;
  patient_id: string;
  source_type: PharmacyDispensingSourceType;
  encounter_id: string | null;
  admission_id: string | null;
  procedure_id: string | null;
  patient_number: string;
  patient_name: string;
  doctor_name: string;
  visit_id: string;
  branch_id: string;
  status: PharmacyDispensingStatus;
  version: number;
  items: PharmacyDispensingItem[];
  invoice_id: string | null;
  invoice_number: string | null;
  submitted_at: Date | null;
  confirmed_at: Date | null;
  cancelled_at: Date | null;
  reversed_at: Date | null;
  reversal_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

export type PharmacyDispensingListQuery = {
  branch_id: string;
  status?: PharmacyDispensingStatus | 'PENDING';
  search?: string;
  page?: number;
  limit?: number;
};

export type SavePharmacyDispensingDTO = {
  version: number;
  items: Array<{
    prescription_item_id: string;
    medicine_id: string;
    batch_id: string;
    confirmed_quantity: number;
    pharmacist_instructions?: string | null;
  }>;
};

export type IdempotentActionDTO = { idempotency_key: string };
export type ReasonActionDTO = { reason: string; idempotency_key?: string };
export type PharmacyRequestMetadata = { ipAddress?: string; userAgent?: string };
