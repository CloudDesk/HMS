export type ProcedureRecommendationStatus = 'ACTIVE' | 'BOOKED' | 'CANCELLED';
export type ProcedureBookingStatus = 'PENDING_CONFIRMATION' | 'BOOKED' | 'COMPLETED' | 'CANCELLED';

export type SurgeryListQuery = { branch_id: string; status?: string; patient_id?: string; doctor_id?: string; service_id?: string; from?: string; to?: string; search?: string; page?: number; limit?: number };
export type CreateProcedureRecommendationDTO = { patient_id: string; branch_id: string; department_id: string; recommending_doctor_id: string; service_id: string; encounter_type: 'OPD_VISIT'; encounter_id: string; clinical_reason: string; notes?: string | null };
export type CreateProcedureBookingDTO = { recommendation_id: string; branch_id: string; doctor_id: string; scheduled_start: string; hold_id?: string | null; consent_document_id?: string | null; deposit_invoice_id?: string | null; notes?: string | null };
export type ConfirmProcedureBookingDTO = { consent_document_id?: string | null; deposit_invoice_id?: string | null; hold_id?: string | null };
export type RescheduleProcedureBookingDTO = { scheduled_start: string; reason: string; doctor_id?: string; hold_id?: string | null; consent_document_id?: string | null; deposit_invoice_id?: string | null };
export type ReasonDTO = { reason: string };
export type SurgeryMetadata = { ipAddress?: string; userAgent?: string };
