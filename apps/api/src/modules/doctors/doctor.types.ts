export type DoctorStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

export type DoctorAvailabilityDay = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type DoctorAvailability = {
  id: string;
  day_of_week: DoctorAvailabilityDay;
  is_available: boolean;
  start_time: string;
  end_time: string;
  break_start_time: string | null;
  break_end_time: string | null;
  slot_duration_minutes: number;
};

export type Doctor = {
  id: string;
  doctor_number: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  display_name: string;
  specialization: string;
  qualification: string | null;
  registration_number: string | null;
  experience_years: number | null;
  branch_id: string;
  department_id: string;
  consultation_room: string | null;
  phone: string | null;
  email: string | null;
  status: DoctorStatus;
  notes: string | null;
  availability: DoctorAvailability[];
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type DoctorListQuery = {
  search?: string;
  status?: DoctorStatus;
  branch_id?: string;
  department_id?: string;
  specialization?: string;
  page?: number;
  limit?: number;
  sortBy?: 'doctor_number' | 'display_name' | 'specialization' | 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type CreateDoctorDTO = {
  first_name: string;
  last_name: string;
  user_id?: string | null;
  specialization: string;
  qualification?: string | null;
  registration_number?: string | null;
  experience_years?: number | null;
  branch_id: string;
  department_id: string;
  consultation_room?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: DoctorStatus;
  notes?: string | null;
};

export type UpdateDoctorDTO = Partial<CreateDoctorDTO>;

export type SaveDoctorAvailabilityDTO = {
  availability: Array<{
    day_of_week: DoctorAvailabilityDay;
    is_available: boolean;
    start_time: string;
    end_time: string;
    break_start_time?: string | null;
    break_end_time?: string | null;
    slot_duration_minutes: number;
  }>;
};
