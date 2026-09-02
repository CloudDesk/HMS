import mongoose, { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { createCsvStream } from '../../shared/http/csv.js';
import type { AppointmentRepository } from '../appointments/appointment.repository.js';
import type { BranchRepository } from '../branches/branch.repository.js';
import type { DepartmentRepository } from '../departments/department.repository.js';
import type { UserRepository } from '../users/user.repository.js';
import type { UserService } from '../users/user.service.js';
import type { DoctorRepository } from './doctor.repository.js';
import type {
  CreateDoctorDTO,
  CreateDoctorLeaveDTO,
  Doctor,
  DoctorAvailabilityDay,
  DoctorAvailabilityExceptionListQuery,
  DoctorAvailableSlotsQuery,
  DoctorLeaveListQuery,
  DoctorListQuery,
  DoctorRequestMetadata,
  MapDoctorUserDTO,
  SaveDoctorAvailabilityDTO,
  SaveDoctorAvailabilityExceptionDTO,
  UpdateDoctorDTO,
  UpdateDoctorStatusDTO,
} from './doctor.types.js';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s().-]{7,20}$/;
const dayNames: DoctorAvailabilityDay[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

const toMinutes = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

const isObjectId = (value: string | null | undefined) => Boolean(value && Types.ObjectId.isValid(value));

const isDuplicateKeyError = (error: unknown): error is { code: number; keyPattern?: Record<string, unknown> } =>
  typeof error === 'object' && error !== null && 'code' in error && Number(error.code) === 11000;

const parseDateOnly = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
};

const allowedStatusTransitions: Record<Doctor['status'], Doctor['status'][]> = {
  ACTIVE: ['INACTIVE', 'ON_LEAVE'],
  INACTIVE: ['ACTIVE'],
  ON_LEAVE: ['ACTIVE', 'INACTIVE'],
};

export class DoctorService {
  constructor(
    private readonly repository: DoctorRepository,
    private readonly branchRepository: BranchRepository,
    private readonly departmentRepository: DepartmentRepository,
    private readonly userRepository: UserRepository,
    private readonly userService: UserService,
    private readonly appointmentRepository: AppointmentRepository,
  ) {}

  async list(query: DoctorListQuery, userId?: string) {
    this.validateListQuery(query);
    const scope = userId ? await this.repository.resolveBranchScope(userId, query.branch_id) : undefined;
    return this.repository.list(query, scope);
  }

  async getById(id: string, userId?: string) {
    this.validateId(id, 'Doctor id is invalid');
    const scope = userId ? await this.repository.resolveBranchScope(userId) : undefined;
    const doctor = await this.repository.getById(id, scope);
    if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    return doctor;
  }

  async getCurrentDoctor(userId: string) {
    this.validateId(userId, 'Current user id is invalid');
    const doctor = await this.repository.getByUserId(userId);
    if (!doctor) {
      throw new AppError('The logged-in user is not mapped to a doctor profile', 404, 'DOCTOR_USER_MAPPING_NOT_FOUND');
    }
    return doctor;
  }

  listUserOptions() {
    return this.repository.listUserOptions();
  }

  async create(data: CreateDoctorDTO, userId: string, metadata: DoctorRequestMetadata) {
    await this.repository.resolveBranchScope(userId, data.branch_id);
    await this.validateDoctorReferences(data.branch_id, data.department_id);
    await this.validateRegistrationNumber(data.registration_number);
    this.validateContact(data.email, data.phone);
    this.validateAvailability(data);
    await this.repository.ensureDoctorNumberSequence();

    const session = await mongoose.startSession();
    try {
      let onboardingResult: Awaited<ReturnType<DoctorService['createOnboardingRecords']>> | undefined;
      await session.withTransaction(async () => {
        onboardingResult = await this.createOnboardingRecords(data, userId, metadata, session);
      });

      if (!onboardingResult) {
        throw new AppError('Doctor onboarding transaction did not complete', 500, 'DOCTOR_ONBOARDING_FAILED');
      }
      return onboardingResult;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        if (error.keyPattern?.username) throw new AppError('Username already exists', 409, 'DUPLICATE_USERNAME');
        if (error.keyPattern?.email) throw new AppError('Email already exists', 409, 'DUPLICATE_EMAIL');
        if (error.keyPattern?.employeeCode) {
          throw new AppError('Employee code already exists', 409, 'DUPLICATE_EMPLOYEE_CODE');
        }
        if (error.keyPattern?.registrationNumber) {
          throw new AppError('Doctor registration number already exists', 409, 'DUPLICATE_DOCTOR_REGISTRATION');
        }
        if (error.keyPattern?.doctorNumber) {
          throw new AppError('Doctor number allocation conflicted; retry onboarding', 409, 'DOCTOR_NUMBER_CONFLICT');
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async createOnboardingRecords(
    data: CreateDoctorDTO,
    actorUserId: string,
    metadata: DoctorRequestMetadata,
    session: ClientSession,
  ) {
    await this.validateRegistrationNumber(data.registration_number, undefined, session);

    const account = data.account_access.create_login_account
      ? await this.userService.provisionDoctorAccount(
          {
            employeeCode: data.account_access.employee_code,
            username: data.account_access.username,
            email: data.account_access.email,
            password: data.account_access.temporary_password,
            fullName: `${data.first_name.trim()} ${data.last_name.trim()}`,
            phone: data.phone,
            branchId: data.branch_id,
            departmentId: data.department_id,
          },
          actorUserId,
          metadata,
          session,
        )
      : null;

    const doctorNumber = await this.repository.nextDoctorNumber(session);
    const doctor = await this.repository.create(doctorNumber, data, actorUserId, account?.id ?? null, session);
    await this.repository.audit('doctor.created', actorUserId, metadata, {
      doctorId: doctor.id,
      doctorNumber: doctor.doctor_number,
      userId: doctor.user_id,
      loginAccountCreated: Boolean(account),
    }, session);
    await this.repository.audit('doctor.availability.initialized', actorUserId, metadata, {
      doctorId: doctor.id,
      configuredDays: data.availability.filter((item) => item.is_available).map((item) => item.day_of_week),
    }, session);
    if (account) {
      await this.repository.audit('doctor.user.mapped', actorUserId, metadata, {
        doctorId: doctor.id,
        doctorNumber: doctor.doctor_number,
        userId: account.id,
        source: 'doctor.onboarding',
      }, session);
    }

    return {
      doctor,
      account: {
        created: Boolean(account),
        user_id: account?.id ?? null,
        username: account?.username ?? null,
      },
    };
  }

  async update(id: string, data: UpdateDoctorDTO, userId: string, metadata: DoctorRequestMetadata) {
    const existing = await this.getById(id, userId);
    const branchId = data.branch_id ?? existing.branch_id;
    const departmentId = data.department_id ?? existing.department_id;
    await this.repository.resolveBranchScope(userId, branchId);
    await this.validateDoctorReferences(branchId, departmentId);
    await this.validateRegistrationNumber(data.registration_number, id);
    this.validateContact(data.email, data.phone);

    const doctor = await this.repository.update(id, data, userId);
    if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    await this.repository.audit('doctor.updated', userId, metadata, {
      doctorId: id,
      doctorNumber: doctor.doctor_number,
      changedFields: Object.keys(data),
    });
    return doctor;
  }

  async updateStatus(id: string, data: UpdateDoctorStatusDTO, userId: string, metadata: DoctorRequestMetadata) {
    const existing = await this.getById(id, userId);
    if (existing.status === data.status) return existing;
    if (!allowedStatusTransitions[existing.status].includes(data.status)) {
      throw new AppError(
        `Doctor status cannot move from ${existing.status} to ${data.status}`,
        400,
        'INVALID_DOCTOR_STATUS_TRANSITION',
      );
    }
    const doctor = await this.repository.updateStatus(id, data.status, userId);
    if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    await this.repository.audit(`doctor.status.${data.status.toLowerCase()}`, userId, metadata, {
      doctorId: id,
      doctorNumber: doctor.doctor_number,
      previousStatus: existing.status,
      status: doctor.status,
      reason: data.reason.trim(),
    });
    return doctor;
  }

  async mapUser(id: string, data: MapDoctorUserDTO, userId: string, metadata: DoctorRequestMetadata) {
    const existing = await this.getById(id, userId);
    if (data.user_id) await this.validateUserMapping(data.user_id, id);
    const doctor = await this.repository.mapUser(id, data.user_id, userId);
    if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    await this.repository.audit(data.user_id ? 'doctor.user.mapped' : 'doctor.user.unmapped', userId, metadata, {
      doctorId: id,
      doctorNumber: doctor.doctor_number,
      previousUserId: existing.user_id,
      userId: data.user_id,
    });
    return doctor;
  }

  async updateAvailability(
    id: string,
    data: SaveDoctorAvailabilityDTO,
    userId: string,
    metadata: DoctorRequestMetadata,
  ) {
    await this.getById(id, userId);
    this.validateAvailability(data);
    const doctor = await this.repository.updateAvailability(id, data, userId);
    if (!doctor) throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    await this.repository.audit('doctor.availability.updated', userId, metadata, {
      doctorId: id,
      configuredDays: data.availability.filter((item) => item.is_available).map((item) => item.day_of_week),
    });
    return doctor;
  }

  async listLeaves(id: string, query: DoctorLeaveListQuery, userId?: string) {
    await this.getById(id, userId);
    this.validateDateRange(query.date_from, query.date_to);
    return this.repository.listLeaves(id, query);
  }

  async createLeave(
    id: string,
    data: CreateDoctorLeaveDTO,
    userId: string,
    metadata: DoctorRequestMetadata,
  ) {
    await this.getById(id, userId);
    const startDate = this.requireDate(data.start_date, 'Leave start date is invalid');
    const endDate = this.requireDate(data.end_date, 'Leave end date is invalid');
    if (startDate > endDate) throw new AppError('Leave start date must be on or before end date', 400, 'INVALID_LEAVE_RANGE');
    const overlap = await this.repository.findOverlappingLeave(id, startDate, endDate);
    if (overlap) {
      throw new AppError('Doctor already has active leave in the selected date range', 409, 'DOCTOR_LEAVE_OVERLAP', {
        leave_id: overlap.id,
      });
    }
    const leave = await this.repository.createLeave(id, data, userId);
    await this.repository.audit('doctor.leave.created', userId, metadata, {
      doctorId: id,
      leaveId: leave.id,
      startDate: data.start_date,
      endDate: data.end_date,
      reason: data.reason.trim(),
    });
    return leave;
  }

  async cancelLeave(id: string, leaveId: string, userId: string, metadata: DoctorRequestMetadata) {
    await this.getById(id, userId);
    this.validateId(leaveId, 'Doctor leave id is invalid');
    const leave = await this.repository.cancelLeave(id, leaveId, userId);
    if (!leave) throw new AppError('Active doctor leave not found', 404, 'NOT_FOUND');
    await this.repository.audit('doctor.leave.cancelled', userId, metadata, { doctorId: id, leaveId });
    return leave;
  }

  async listExceptions(id: string, query: DoctorAvailabilityExceptionListQuery, userId?: string) {
    await this.getById(id, userId);
    this.validateDateRange(query.date_from, query.date_to);
    return this.repository.listExceptions(id, query);
  }

  async saveException(
    id: string,
    data: SaveDoctorAvailabilityExceptionDTO,
    userId: string,
    metadata: DoctorRequestMetadata,
  ) {
    await this.getById(id, userId);
    this.requireDate(data.date, 'Availability exception date is invalid');
    this.validateBlocks(data.working_blocks, data.is_available);
    const exception = await this.repository.saveException(id, data, userId);
    await this.repository.audit('doctor.availability_exception.saved', userId, metadata, {
      doctorId: id,
      exceptionId: exception.id,
      date: data.date,
      isAvailable: data.is_available,
      reason: data.reason.trim(),
    });
    return exception;
  }

  async deleteException(id: string, exceptionId: string, userId: string, metadata: DoctorRequestMetadata) {
    await this.getById(id, userId);
    this.validateId(exceptionId, 'Availability exception id is invalid');
    const deleted = await this.repository.deleteException(id, exceptionId);
    if (!deleted) throw new AppError('Availability exception not found', 404, 'NOT_FOUND');
    await this.repository.audit('doctor.availability_exception.deleted', userId, metadata, {
      doctorId: id,
      exceptionId,
    });
  }

  async availableSlots(id: string, query: DoctorAvailableSlotsQuery, userId?: string) {
    const doctor = await this.getById(id, userId);
    const date = this.requireDate(query.date, 'Available slots date is invalid');
    const result = {
      doctor_id: doctor.id,
      date: query.date,
      is_available: false,
      unavailable_reason: null as string | null,
      slots: [] as Array<{ start_time: string; end_time: string; max_patients_per_slot?: number }>,
    };
    if (doctor.status !== 'ACTIVE') {
      result.unavailable_reason = doctor.status === 'ON_LEAVE' ? 'Doctor is on leave' : 'Doctor is inactive';
      return result;
    }
    if (await this.repository.hasActiveLeave(id, date)) {
      result.unavailable_reason = 'Doctor is on approved leave';
      return result;
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const isToday = query.date === todayStr;
    const isPastDate = query.date < todayStr;

    if (isPastDate) {
      result.unavailable_reason = 'Cannot book appointments for past dates';
      return result;
    }

    const currentMinutesNow = now.getHours() * 60 + now.getMinutes();

    const exception = await this.repository.getExceptionByDate(id, date);
    const recurring = doctor.availability.find((item) => item.day_of_week === dayNames[date.getUTCDay()]);
    const schedule = exception
      ? {
          is_available: exception.is_available,
          working_blocks: exception.working_blocks,
        }
      : recurring;
    if (!schedule?.is_available || schedule.working_blocks.length === 0) {
      result.unavailable_reason = exception?.reason ?? 'Doctor is not scheduled on this date';
      return result;
    }

    const appointments = await this.appointmentRepository.listActiveWindows(id, date);
    const slots = schedule.working_blocks.flatMap((block) => {
      const duration = block.slot_duration_minutes;
      const blockSlots: Array<{
        start_time: string;
        end_time: string;
        max_patients_per_slot: number;
        available: boolean;
        is_available: boolean;
        reason?: string;
      }> = [];
      for (let current = toMinutes(block.start_time); current + duration <= toMinutes(block.end_time); current += duration) {
        const isPast = isToday && current <= currentMinutesNow;
        const startTime = toTime(current);
        const endTime = toTime(current + duration);
        const conflict = appointments.some(
          (appointment) => startTime < appointment.end_time && endTime > appointment.start_time,
        );
        const available = !isPast && !conflict;
        const reason = conflict ? 'Booked' : isPast ? 'Time passed' : undefined;
        blockSlots.push({
          start_time: startTime,
          end_time: endTime,
          max_patients_per_slot: block.max_patients_per_slot ?? 1,
          available,
          is_available: available,
          reason,
        });
      }
      return blockSlots;
    });
    result.is_available = true;
    result.slots = slots;
    if (slots.length === 0 && isToday) {
      result.unavailable_reason = 'No remaining appointment times for today';
    }
    return result;
  }

  async export(query: DoctorListQuery, userId: string, metadata: DoctorRequestMetadata) {
    this.validateListQuery(query);
    const scope = await this.repository.resolveBranchScope(userId, query.branch_id);
    await this.repository.audit('doctor.exported', userId, metadata, { filters: query });
    const repository = this.repository;
    async function* rows() {
      let page = 1;
      while (true) {
        const result = await repository.list({ ...query, page, limit: 100 }, scope);
        for (const doctor of result.data) {
          yield [
            doctor.doctor_number,
            doctor.display_name,
            doctor.specialization,
            doctor.qualification,
            doctor.registration_number,
            doctor.experience_years,
            doctor.branch_id,
            doctor.department_id,
            doctor.consultation_room,
            doctor.phone,
            doctor.email,
            doctor.status,
            doctor.user_id,
            doctor.created_at,
          ];
        }
        if (page >= result.meta.totalPages) break;
        page += 1;
      }
    }
    return createCsvStream(
      [
        'Doctor Number',
        'Doctor Name',
        'Specialization',
        'Qualification',
        'Registration Number',
        'Experience Years',
        'Branch ID',
        'Department ID',
        'Consultation Room',
        'Phone',
        'Email',
        'Status',
        'Mapped User ID',
        'Created Date',
      ],
      rows(),
    );
  }

  private validateListQuery(query: DoctorListQuery) {
    if (query.branch_id) this.validateId(query.branch_id, 'Branch id is invalid');
    if (query.department_id) this.validateId(query.department_id, 'Department id is invalid');
  }

  private validateId(id: string, message: string) {
    if (!isObjectId(id)) throw new AppError(message, 400, 'VALIDATION_ERROR');
  }

  private requireDate(value: string, message: string) {
    const date = parseDateOnly(value);
    if (!date) throw new AppError(message, 400, 'VALIDATION_ERROR');
    return date;
  }

  private validateDateRange(dateFrom?: string, dateTo?: string) {
    const from = dateFrom ? this.requireDate(dateFrom, 'From date is invalid') : null;
    const to = dateTo ? this.requireDate(dateTo, 'To date is invalid') : null;
    if (from && to && from > to) throw new AppError('From date must be on or before to date', 400, 'VALIDATION_ERROR');
  }

  private async validateDoctorReferences(branchId: string, departmentId: string) {
    this.validateId(branchId, 'Branch id is invalid');
    this.validateId(departmentId, 'Department id is invalid');
    const [branch, department] = await Promise.all([
      this.branchRepository.getById(branchId),
      this.departmentRepository.getById(departmentId),
    ]);
    if (!branch || branch.status !== 'ACTIVE') throw new AppError('Active branch is required', 400, 'INVALID_BRANCH');
    if (!department || department.status !== 'ACTIVE') {
      throw new AppError('Active department is required', 400, 'INVALID_DEPARTMENT');
    }
    if (!department.branch_ids.includes(branch.id)) {
      throw new AppError('Department must belong to the selected branch', 400, 'DEPARTMENT_BRANCH_MISMATCH');
    }
    if (!department.isClinical) {
      throw new AppError('Doctors can only be assigned to clinical departments', 400, 'DEPARTMENT_NOT_CLINICAL');
    }
  }

  private async validateRegistrationNumber(
    registrationNumber: string | null | undefined,
    doctorId?: string,
    session?: ClientSession,
  ) {
    const normalized = registrationNumber?.trim();
    if (!normalized) return;
    const existing = await this.repository.getByRegistrationNumber(normalized, session);
    if (existing && existing.id !== doctorId) {
      throw new AppError('Doctor registration number already exists', 409, 'DUPLICATE_DOCTOR_REGISTRATION');
    }
  }

  private validateContact(email?: string | null, phone?: string | null) {
    if (email?.trim() && !emailPattern.test(email.trim())) {
      throw new AppError('Doctor email is invalid', 400, 'INVALID_DOCTOR_EMAIL');
    }
    if (phone?.trim() && !phonePattern.test(phone.trim())) {
      throw new AppError('Doctor phone is invalid', 400, 'INVALID_DOCTOR_PHONE');
    }
  }

  private async validateUserMapping(userId: string, doctorId?: string) {
    this.validateId(userId, 'User id is invalid');
    const user = await this.userRepository.findById(userId);
    if (!user || user.status !== 'active') throw new AppError('Active user is required', 400, 'INVALID_DOCTOR_USER');
    const mappedDoctor = await this.repository.getByUserId(userId);
    if (mappedDoctor && mappedDoctor.id !== doctorId) {
      throw new AppError('User is already mapped to another doctor', 409, 'DOCTOR_USER_ALREADY_MAPPED', {
        doctor_id: mappedDoctor.id,
      });
    }
  }

  private validateAvailability(data: SaveDoctorAvailabilityDTO) {
    const seenDays = new Set<DoctorAvailabilityDay>();
    for (const item of data.availability) {
      if (seenDays.has(item.day_of_week)) {
        throw new AppError('Doctor availability has duplicate days', 400, 'DUPLICATE_AVAILABILITY_DAY');
      }
      seenDays.add(item.day_of_week);
      this.validateBlocks(item.working_blocks, item.is_available);
    }
  }

  private validateBlocks(
    blocks: Array<{ start_time: string; end_time: string; slot_duration_minutes: number }>,
    isAvailable: boolean,
  ) {
    if (isAvailable && blocks.length === 0) {
      throw new AppError('At least one working block is required for an available day', 400, 'WORKING_BLOCK_REQUIRED');
    }
    if (!isAvailable && blocks.length > 0) {
      throw new AppError('Unavailable days cannot contain working blocks', 400, 'UNAVAILABLE_DAY_HAS_BLOCKS');
    }
    const ordered = [...blocks].sort((left, right) => left.start_time.localeCompare(right.start_time));
    ordered.forEach((block, index) => {
      if (block.slot_duration_minutes < 5 || block.slot_duration_minutes > 240) {
        throw new AppError('Slot duration must be between 5 and 240 minutes', 400, 'VALIDATION_ERROR');
      }
      this.validateTimeRange(block.start_time, block.end_time, 'Working block time range is invalid');
      const previous = ordered[index - 1];
      if (previous && toMinutes(block.start_time) < toMinutes(previous.end_time)) {
        throw new AppError('Doctor working blocks cannot overlap', 400, 'WORKING_BLOCK_OVERLAP');
      }
      if (toMinutes(block.end_time) - toMinutes(block.start_time) < block.slot_duration_minutes) {
        throw new AppError('Working block must fit at least one appointment slot', 400, 'WORKING_BLOCK_TOO_SHORT');
      }
    });
  }

  private validateTimeRange(startTime: string, endTime: string, message: string) {
    if (!timePattern.test(startTime) || !timePattern.test(endTime) || toMinutes(startTime) >= toMinutes(endTime)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }
}
