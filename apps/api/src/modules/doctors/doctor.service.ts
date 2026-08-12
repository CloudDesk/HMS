import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { BranchRepository } from '../branches/branch.repository.js';
import type { DepartmentRepository } from '../departments/department.repository.js';
import type { DoctorRepository } from './doctor.repository.js';
import type {
  CreateDoctorDTO,
  DoctorAvailabilityDay,
  DoctorListQuery,
  SaveDoctorAvailabilityDTO,
  UpdateDoctorDTO,
} from './doctor.types.js';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const createDoctorNumber = (sequence: number) => {
  const year = new Date().getFullYear();
  return `DR-${year}-${String(sequence + 1).padStart(5, '0')}`;
};

const toMinutes = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const defaultAvailability = (): SaveDoctorAvailabilityDTO => ({
  availability: [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ].map((day) => ({
    day_of_week: day as DoctorAvailabilityDay,
    is_available: !['SATURDAY', 'SUNDAY'].includes(day),
    start_time: '08:00',
    end_time: '17:00',
    break_start_time: '12:30',
    break_end_time: '13:30',
    slot_duration_minutes: 30,
  })),
});

const isObjectId = (value: string | null | undefined) => Boolean(value && Types.ObjectId.isValid(value));

export class DoctorService {
  constructor(
    private readonly repository: DoctorRepository,
    private readonly branchRepository: BranchRepository,
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  async list(query: DoctorListQuery) {
    this.validateListQuery(query);
    return this.repository.list(query);
  }

  async getById(id: string) {
    this.validateId(id, 'Doctor id is invalid');
    const doctor = await this.repository.getById(id);
    if (!doctor) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    return doctor;
  }

  async create(data: CreateDoctorDTO, userId: string) {
    await this.validateDoctorReferences(data.branch_id, data.department_id);
    await this.validateRegistrationNumber(data.registration_number);

    const sequence = await this.repository.nextDoctorSequence();
    const doctor = await this.repository.create(createDoctorNumber(sequence), data, userId);
    return this.repository.updateAvailability(doctor.id, defaultAvailability(), userId);
  }

  async update(id: string, data: UpdateDoctorDTO, userId: string) {
    const existing = await this.getById(id);
    const branchId = data.branch_id ?? existing.branch_id;
    const departmentId = data.department_id ?? existing.department_id;

    await this.validateDoctorReferences(branchId, departmentId);
    await this.validateRegistrationNumber(data.registration_number, id);

    const doctor = await this.repository.update(id, data, userId);
    if (!doctor) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    return doctor;
  }

  async updateAvailability(id: string, data: SaveDoctorAvailabilityDTO, userId: string) {
    await this.getById(id);
    this.validateAvailability(data);

    const doctor = await this.repository.updateAvailability(id, data, userId);
    if (!doctor) {
      throw new AppError('Doctor not found', 404, 'NOT_FOUND');
    }

    return doctor;
  }

  private validateListQuery(query: DoctorListQuery) {
    if (query.branch_id) {
      this.validateId(query.branch_id, 'Branch id is invalid');
    }

    if (query.department_id) {
      this.validateId(query.department_id, 'Department id is invalid');
    }
  }

  private validateId(id: string, message: string) {
    if (!isObjectId(id)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }

  private async validateDoctorReferences(branchId: string, departmentId: string) {
    this.validateId(branchId, 'Branch id is invalid');
    this.validateId(departmentId, 'Department id is invalid');

    const [branch, department] = await Promise.all([
      this.branchRepository.getById(branchId),
      this.departmentRepository.getById(departmentId),
    ]);

    if (!branch || branch.status !== 'ACTIVE') {
      throw new AppError('Active branch is required', 400, 'INVALID_BRANCH');
    }

    if (!department || department.status !== 'ACTIVE') {
      throw new AppError('Active department is required', 400, 'INVALID_DEPARTMENT');
    }

    if (department.branch_id !== branch.id) {
      throw new AppError('Department must belong to the selected branch', 400, 'DEPARTMENT_BRANCH_MISMATCH');
    }
  }

  private async validateRegistrationNumber(registrationNumber: string | null | undefined, doctorId?: string) {
    const normalized = registrationNumber?.trim();
    if (!normalized) {
      return;
    }

    const existing = await this.repository.getByRegistrationNumber(normalized);
    if (existing && existing.id !== doctorId) {
      throw new AppError('Doctor registration number already exists', 409, 'DUPLICATE_DOCTOR_REGISTRATION');
    }
  }

  private validateAvailability(data: SaveDoctorAvailabilityDTO) {
    const seenDays = new Set<DoctorAvailabilityDay>();

    for (const item of data.availability) {
      if (seenDays.has(item.day_of_week)) {
        throw new AppError('Doctor availability has duplicate days', 400, 'DUPLICATE_AVAILABILITY_DAY');
      }

      seenDays.add(item.day_of_week);
      this.validateTimeRange(item.start_time, item.end_time, 'Availability time range is invalid');

      if (item.break_start_time || item.break_end_time) {
        if (!item.break_start_time || !item.break_end_time) {
          throw new AppError('Both break start and break end time are required', 400, 'VALIDATION_ERROR');
        }

        this.validateTimeRange(item.break_start_time, item.break_end_time, 'Break time range is invalid');

        if (
          toMinutes(item.break_start_time) < toMinutes(item.start_time) ||
          toMinutes(item.break_end_time) > toMinutes(item.end_time)
        ) {
          throw new AppError('Break time must be within availability hours', 400, 'BREAK_OUTSIDE_AVAILABILITY');
        }
      }

      if (item.slot_duration_minutes < 5 || item.slot_duration_minutes > 240) {
        throw new AppError('Slot duration must be between 5 and 240 minutes', 400, 'VALIDATION_ERROR');
      }
    }
  }

  private validateTimeRange(startTime: string, endTime: string, message: string) {
    if (!timePattern.test(startTime) || !timePattern.test(endTime) || toMinutes(startTime) >= toMinutes(endTime)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }
}
