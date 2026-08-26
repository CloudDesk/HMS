export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CANCELLED'
  | 'RESCHEDULED'
  | 'NO_SHOW'
  | 'SKIPPED'
  | 'COMPLETED';

export type AppointmentVisitType =
  | 'NEW_CONSULTATION'
  | 'FOLLOW_UP'
  | 'PROCEDURE'
  | 'EMERGENCY';

export type AppointmentPriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';

export type Appointment = {
  id: string;
  appointment_number: string;
  patient_id: string;
  patient_number: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  doctor_specialization: string;
  branch_id: string;
  department_id: string;
  appointment_date: Date;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  visit_type: AppointmentVisitType;
  priority: AppointmentPriority;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  rescheduled_from_id: string | null;
  rescheduled_to_id: string | null;
  rescheduled_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type PortalRescheduleAppointmentDTO = {
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  duration_minutes: number;
};

export type AppointmentListQuery = {
  search?: string;
  status?: AppointmentStatus;
  doctor_id?: string;
  patient_id?: string;
  branch_id?: string;
  department_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sortBy?: 'appointment_number' | 'appointment_date' | 'start_time' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateAppointmentDTO = {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  duration_minutes: number;
  visit_type: AppointmentVisitType;
  priority?: AppointmentPriority;
  reason?: string | null;
  notes?: string | null;
};

export type UpdateAppointmentDTO = Partial<
  Pick<
    CreateAppointmentDTO,
    'doctor_id' | 'appointment_date' | 'start_time' | 'duration_minutes' | 'visit_type' | 'priority' | 'reason' | 'notes'
  >
>;

export type UpdateAppointmentStatusDTO = {
  status: AppointmentStatus;
  notes?: string | null;
};
