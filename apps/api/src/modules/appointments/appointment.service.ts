import { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { Doctor, DoctorAvailabilityDay } from '../doctors/doctor.types.js';
import type { DoctorRepository } from '../doctors/doctor.repository.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { Patient } from '../patients/patient.types.js';
import type { OpdVisitRepository } from '../opd/opd-visit.repository.js';
import type { AppointmentRepository } from './appointment.repository.js';
import type {
  Appointment,
  AppointmentListQuery,
  CreateAppointmentDTO,
  UpdateAppointmentDTO,
  UpdateAppointmentStatusDTO,
} from './appointment.types.js';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayNames: DoctorAvailabilityDay[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

const conflictStatuses = new Set(['SCHEDULED', 'CONFIRMED', 'CHECKED_IN']);

const allowedStatusTransitions: Record<Appointment['status'], Appointment['status'][]> = {
  SCHEDULED: ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'SKIPPED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW', 'SKIPPED'],
  CHECKED_IN: ['SKIPPED', 'NO_SHOW', 'COMPLETED'],
  SKIPPED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CANCELLED: [],
  RESCHEDULED: [],
  NO_SHOW: [],
  COMPLETED: [],
};

const isObjectId = (value: string | null | undefined) => Boolean(value && Types.ObjectId.isValid(value));

const toMinutes = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const parseDateOnly = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date;
};

const todayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const createAppointmentNumber = (sequence: number) => {
  const year = new Date().getFullYear();
  return `APT-${year}-${String(sequence + 1).padStart(6, '0')}`;
};

const patientName = (patient: Patient) =>
  [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' ');

export class AppointmentService {
  constructor(
    private readonly repository: AppointmentRepository,
    private readonly patientRepository: PatientRepository,
    private readonly doctorRepository: DoctorRepository,
    private readonly opdVisitRepository: OpdVisitRepository,
  ) {}

  async list(query: AppointmentListQuery, userId?: string) {
    this.validateListQuery(query);
    const scope = userId ? await this.repository.resolveBranchScope(userId, query.branch_id) : undefined;
    return this.repository.list(this.normalizeListDates(query), scope);
  }

  async getById(id: string, userId?: string) {
    this.validateId(id, 'Appointment id is invalid');
    const scope = userId ? await this.repository.resolveBranchScope(userId) : undefined;
    const appointment = await this.repository.getById(id, scope);
    if (!appointment) {
      throw new AppError('Appointment not found', 404, 'NOT_FOUND');
    }

    return appointment;
  }

  async create(data: CreateAppointmentDTO, userId: string) {
    const appointmentDate = this.validateAppointmentDate(data.appointment_date);
    const endTime = this.validateAppointmentWindow(data.start_time, data.duration_minutes);
    const [patient, doctor] = await Promise.all([
      this.getActivePatient(data.patient_id),
      this.getActiveDoctor(data.doctor_id),
    ]);
    await this.repository.resolveBranchScope(userId, doctor.branch_id);

    await this.validateDoctorAvailability(doctor, appointmentDate, data.start_time, endTime, data.duration_minutes);
    await this.validateDoctorConflict(doctor.id, appointmentDate, data.start_time, endTime);
    await this.validatePatientConflict(patient.id, appointmentDate, data.start_time, endTime);

    const sequence = await this.repository.nextAppointmentSequence();
    const appointment = await this.repository.create(
      {
        ...data,
        appointmentNumber: createAppointmentNumber(sequence),
        patientNumber: patient.patient_number,
        patientName: patientName(patient),
        doctorName: doctor.display_name,
        doctorSpecialization: doctor.specialization,
        branchId: doctor.branch_id,
        departmentId: doctor.department_id,
        appointmentDate,
        endTime,
        priority: data.priority ?? 'ROUTINE',
      },
      userId,
    );
    await this.repository.auditCreated(appointment, userId);
    return appointment;
  }

  async update(id: string, data: UpdateAppointmentDTO, userId: string) {
    const existing = await this.getById(id, userId);
    const doctor = await this.getActiveDoctor(data.doctor_id ?? existing.doctor_id);
    const scope = await this.repository.resolveBranchScope(userId, doctor.branch_id);
    const appointmentDate = data.appointment_date
      ? this.validateAppointmentDate(data.appointment_date)
      : existing.appointment_date;
    const startTime = data.start_time ?? existing.start_time;
    const durationMinutes = data.duration_minutes ?? existing.duration_minutes;
    const endTime = this.validateAppointmentWindow(startTime, durationMinutes);

    this.ensureCanChangeSchedule(existing);
    await this.validateDoctorAvailability(doctor, appointmentDate, startTime, endTime, durationMinutes);
    await this.validateDoctorConflict(doctor.id, appointmentDate, startTime, endTime, id);
    await this.validatePatientConflict(existing.patient_id, appointmentDate, startTime, endTime, id);

    const appointment = await this.repository.update(
      id,
      {
        ...data,
        doctor_id: doctor.id,
        doctorName: doctor.display_name,
        doctorSpecialization: doctor.specialization,
        branchId: doctor.branch_id,
        departmentId: doctor.department_id,
        appointmentDate,
        start_time: startTime,
        endTime,
        duration_minutes: durationMinutes,
      },
      userId,
      scope,
    );

    if (!appointment) {
      throw new AppError('Appointment not found', 404, 'NOT_FOUND');
    }

    return appointment;
  }

  async updateStatus(id: string, data: UpdateAppointmentStatusDTO, userId: string) {
    const existing = await this.getById(id, userId);
    const scope = await this.repository.resolveBranchScope(userId, existing.branch_id);

    if (!this.isStatusTransitionAllowed(existing.status, data.status)) {
      throw new AppError('Appointment status transition is not allowed', 400, 'INVALID_STATUS_TRANSITION');
    }

    if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(data.status) && !data.notes?.trim()) {
      throw new AppError('A reason is required for this appointment status', 400, 'STATUS_REASON_REQUIRED');
    }

    if (data.status === 'COMPLETED') {
      const visit = await this.opdVisitRepository.findByAppointmentId(existing.id);
      if (!visit) {
        throw new AppError('An OPD visit is required before completing the appointment', 400, 'OPD_VISIT_REQUIRED');
      }
      if (visit.status !== 'COMPLETED') {
        throw new AppError('Complete the linked OPD visit before completing the appointment', 400, 'OPD_VISIT_NOT_COMPLETED');
      }
    }

    const appointment = await this.repository.updateStatus(id, data, userId, scope);
    if (!appointment) {
      throw new AppError('Appointment not found', 404, 'NOT_FOUND');
    }

    if (existing.status !== appointment.status) {
      await this.repository.auditStatusTransition(appointment, existing.status, userId);
    }

    return appointment;
  }

  private validateListQuery(query: AppointmentListQuery) {
    const idFields: Array<[string, string | undefined]> = [
      ['Doctor id is invalid', query.doctor_id],
      ['Patient id is invalid', query.patient_id],
      ['Branch id is invalid', query.branch_id],
      ['Department id is invalid', query.department_id],
    ];

    for (const [message, value] of idFields) {
      if (value && !isObjectId(value)) {
        throw new AppError(message, 400, 'VALIDATION_ERROR');
      }
    }

    if (query.date_from && !parseDateOnly(query.date_from)) {
      throw new AppError('Appointment from date is invalid', 400, 'VALIDATION_ERROR');
    }

    if (query.date_to && !parseDateOnly(query.date_to)) {
      throw new AppError('Appointment to date is invalid', 400, 'VALIDATION_ERROR');
    }

    if (query.date_from && query.date_to) {
      const fromDate = parseDateOnly(query.date_from);
      const toDate = parseDateOnly(query.date_to);
      if (fromDate && toDate && fromDate > toDate) {
        throw new AppError('Appointment from date must be before to date', 400, 'VALIDATION_ERROR');
      }
    }
  }

  private normalizeListDates(query: AppointmentListQuery): AppointmentListQuery {
    return {
      ...query,
      ...(query.date_from ? { date_from: parseDateOnly(query.date_from)?.toISOString() } : {}),
      ...(query.date_to ? { date_to: parseDateOnly(query.date_to)?.toISOString() } : {}),
    };
  }

  private validateId(id: string, message: string) {
    if (!isObjectId(id)) {
      throw new AppError(message, 400, 'VALIDATION_ERROR');
    }
  }

  private async getActivePatient(id: string) {
    this.validateId(id, 'Patient id is invalid');
    const patient = await this.patientRepository.getById(id);

    if (!patient || patient.status !== 'ACTIVE') {
      throw new AppError('Active patient is required for appointment booking', 400, 'INVALID_PATIENT');
    }

    return patient;
  }

  private async getActiveDoctor(id: string) {
    this.validateId(id, 'Doctor id is invalid');
    const doctor = await this.doctorRepository.getById(id);

    if (!doctor || doctor.status !== 'ACTIVE') {
      throw new AppError('Active doctor is required for appointment booking', 400, 'INVALID_DOCTOR');
    }

    return doctor;
  }

  private validateAppointmentDate(value: string) {
    const appointmentDate = parseDateOnly(value);
    if (!appointmentDate) {
      throw new AppError('Appointment date is invalid', 400, 'VALIDATION_ERROR');
    }

    if (appointmentDate < todayUtc()) {
      throw new AppError('Appointment date cannot be in the past', 400, 'PAST_APPOINTMENT_DATE');
    }

    return appointmentDate;
  }

  private validateAppointmentWindow(startTime: string, durationMinutes: number) {
    if (!timePattern.test(startTime)) {
      throw new AppError('Appointment start time is invalid', 400, 'VALIDATION_ERROR');
    }

    if (durationMinutes < 5 || durationMinutes > 240) {
      throw new AppError('Appointment duration must be between 5 and 240 minutes', 400, 'VALIDATION_ERROR');
    }

    const endMinutes = toMinutes(startTime) + durationMinutes;
    if (endMinutes > 24 * 60) {
      throw new AppError('Appointment cannot end after midnight', 400, 'VALIDATION_ERROR');
    }

    return toTime(endMinutes);
  }

  private async validateDoctorAvailability(
    doctor: Doctor,
    appointmentDate: Date,
    startTime: string,
    endTime: string,
    durationMinutes: number,
  ) {
    if (await this.doctorRepository.hasActiveLeave(doctor.id, appointmentDate)) {
      throw new AppError('Doctor is on leave on the selected date', 400, 'DOCTOR_ON_LEAVE');
    }

    const exception = await this.doctorRepository.getExceptionByDate(doctor.id, appointmentDate);
    const dayName = dayNames[appointmentDate.getUTCDay()];
    const recurring = doctor.availability.find((item) => item.day_of_week === dayName);
    const availability = exception
      ? {
          is_available: exception.is_available,
          working_blocks: exception.working_blocks,
        }
      : recurring;

    if (!availability || !availability.is_available) {
      throw new AppError('Doctor is not available on the selected date', 400, 'DOCTOR_NOT_AVAILABLE');
    }

    const slotStart = toMinutes(startTime);
    const slotEnd = toMinutes(endTime);
    const matchingBlock = availability.working_blocks.find(
      (block) => slotStart >= toMinutes(block.start_time) && slotEnd <= toMinutes(block.end_time),
    );
    if (!matchingBlock) {
      throw new AppError('Appointment time is outside doctor availability', 400, 'OUTSIDE_DOCTOR_AVAILABILITY');
    }

    if (durationMinutes !== matchingBlock.slot_duration_minutes) {
      throw new AppError('Appointment duration must match the doctor slot duration', 400, 'INVALID_SLOT_DURATION');
    }
  }

  private async validateDoctorConflict(
    doctorId: string,
    appointmentDate: Date,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string,
  ) {
    const conflict = await this.repository.findDoctorConflict(
      doctorId,
      appointmentDate,
      startTime,
      endTime,
      excludeAppointmentId,
    );

    if (conflict) {
      throw new AppError('Doctor already has an appointment in this time slot', 409, 'APPOINTMENT_SLOT_CONFLICT', {
        appointment_number: conflict.appointment_number,
      });
    }
  }

  private async validatePatientConflict(
    patientId: string,
    appointmentDate: Date,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string,
  ) {
    const conflict = await this.repository.findPatientConflict(
      patientId,
      appointmentDate,
      startTime,
      endTime,
      excludeAppointmentId,
    );
    if (conflict) {
      throw new AppError('Patient already has an appointment in this time slot', 409, 'PATIENT_APPOINTMENT_CONFLICT', {
        appointment_number: conflict.appointment_number,
      });
    }
  }

  private ensureCanChangeSchedule(appointment: Appointment) {
    if (!conflictStatuses.has(appointment.status)) {
      throw new AppError('Only active appointments can be rescheduled', 400, 'APPOINTMENT_NOT_ACTIVE');
    }
  }

  private isStatusTransitionAllowed(current: Appointment['status'], next: Appointment['status']) {
    if (current === next) {
      return true;
    }

    return allowedStatusTransitions[current].includes(next);
  }
}
