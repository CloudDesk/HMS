export type OpdVisitStatus =
  | 'CHECKED_IN'
  | 'WAITING_FOR_VITALS'
  | 'READY_FOR_CONSULTATION'
  | 'IN_CONSULTATION'
  | 'SKIPPED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type OpdVisitType =
  | 'NEW_CONSULTATION'
  | 'FOLLOW_UP'
  | 'PROCEDURE'
  | 'EMERGENCY'
  | 'WALK_IN'
  | 'REVIEW';

export type OpdVisitPriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

export type OpdVisit = {
  id: string;
  visit_number: string;
  queue_token_number: number | null;
  appointment_id: string | null;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization: string;
  branch_id: string;
  department_id: string;
  visit_date: Date;
  check_in_time: Date;
  visit_type: OpdVisitType;
  priority: OpdVisitPriority;
  status: OpdVisitStatus;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type OpdVisitListQuery = {
  search?: string;
  status?: OpdVisitStatus;
  doctor_id?: string;
  patient_id?: string;
  branch_id?: string;
  department_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sortBy?: 'visit_number' | 'visit_date' | 'check_in_time' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type OpdDashboardSummary = {
  total: number;
  by_status: Record<OpdVisitStatus, number>;
  follow_ups: number;
  walk_ins: number;
  urgent: number;
};

export type CreateOpdVisitDTO = {
  appointment_id?: string | null;
  patient_id?: string;
  doctor_id?: string;
  visit_type?: OpdVisitType;
  priority?: OpdVisitPriority;
  reason?: string | null;
  notes?: string | null;
};

export type UpdateOpdVisitStatusDTO = {
  status: OpdVisitStatus;
  notes?: string | null;
};
