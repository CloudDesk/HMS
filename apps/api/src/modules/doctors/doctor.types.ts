export type DoctorStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

export type DoctorAvailabilityDay =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type DoctorWorkingBlock = {
  id: string;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
};

export type DoctorAvailability = {
  id: string;
  day_of_week: DoctorAvailabilityDay;
  is_available: boolean;
  working_blocks: DoctorWorkingBlock[];
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

export type DoctorDetailsDTO = {
  first_name: string;
  last_name: string;
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

export type SaveDoctorAvailabilityDTO = {
  availability: Array<{
    day_of_week: DoctorAvailabilityDay;
    is_available: boolean;
    working_blocks: Array<{
      start_time: string;
      end_time: string;
      slot_duration_minutes: number;
    }>;
  }>;
};

export type DoctorAccountAccessDTO =
  | {
      create_login_account: false;
    }
  | {
      create_login_account: true;
      employee_code: string;
      username: string;
      email: string;
      temporary_password: string;
    };

export type CreateDoctorDTO = DoctorDetailsDTO &
  SaveDoctorAvailabilityDTO & {
    account_access: DoctorAccountAccessDTO;
  };

export type UpdateDoctorDTO = Partial<Omit<DoctorDetailsDTO, 'status'>>;

export type DoctorOnboardingResult = {
  doctor: Doctor;
  account: {
    created: boolean;
    user_id: string | null;
    username: string | null;
  };
};

export type UpdateDoctorStatusDTO = {
  status: DoctorStatus;
  reason: string;
};

export type MapDoctorUserDTO = {
  user_id: string | null;
};

export type DoctorLeaveStatus = 'ACTIVE' | 'CANCELLED';

export type DoctorLeave = {
  id: string;
  doctor_id: string;
  start_date: Date;
  end_date: Date;
  reason: string;
  status: DoctorLeaveStatus;
  created_by: string | null;
  cancelled_by: string | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type DoctorLeaveListQuery = {
  status?: DoctorLeaveStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
};

export type CreateDoctorLeaveDTO = {
  start_date: string;
  end_date: string;
  reason: string;
};

export type DoctorAvailabilityException = {
  id: string;
  doctor_id: string;
  date: Date;
  is_available: boolean;
  working_blocks: DoctorWorkingBlock[];
  reason: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type DoctorAvailabilityExceptionListQuery = {
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
};

export type SaveDoctorAvailabilityExceptionDTO = {
  date: string;
  is_available: boolean;
  working_blocks: Array<{
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
  }>;
  reason: string;
};

export type DoctorAvailableSlotsQuery = {
  date: string;
};

export type DoctorAvailableSlot = {
  start_time: string;
  end_time: string;
};

export type DoctorUserOption = {
  id: string;
  full_name: string;
  username: string;
  email: string | null;
  mapped_doctor_id: string | null;
};

export type DoctorRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};
