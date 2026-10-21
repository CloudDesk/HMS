import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { EmergencyEncounterModel } from '../src/modules/emergency/emergency.model.js';
import { EmergencyRepository } from '../src/modules/emergency/emergency.repository.js';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import { AppointmentModel } from '../src/modules/appointments/appointment.model.js';
import { AppointmentRepository } from '../src/modules/appointments/appointment.repository.js';
import type { AppointmentService } from '../src/modules/appointments/appointment.service.js';
import type { CreateAppointmentDTO, UpdateAppointmentStatusDTO } from '../src/modules/appointments/appointment.types.js';
import { AuditLogModel } from '../src/modules/auth/auth.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';

describe('Emergency referral booking atomic link and retry', () => {
  const repository = new EmergencyRepository(new SequenceService());
  let sourceId: string; let actor: string; let branchId: string; let departmentId: string;
  const appointments = {
    create: vi.fn(async (data: CreateAppointmentDTO) => {
      const row = await AppointmentModel.create({ appointmentNumber: `TEST-${new Types.ObjectId()}`, patientId: data.patient_id,
        patientNumber: 'TEST-P', patientName: 'Test Patient', doctorId: data.doctor_id, doctorName: 'Test Doctor',
        doctorSpecialization: 'Ophthalmology', branchId, departmentId, durationMinutes: data.duration_minutes,
        visitType: data.visit_type, priority: 'URGENT', status: 'SCHEDULED' });
      const result = await new AppointmentRepository().getById(row.id); if (!result) throw new Error('Missing appointment fixture');
      return result;
    }),
    updateStatus: vi.fn(async (id: string, data: UpdateAppointmentStatusDTO) => {
      await AppointmentModel.updateOne({ _id: id }, { $set: { status: data.status } });
      return new AppointmentRepository().getById(id);
    }),
  };
  const service = new EmergencyService(repository,
    {} as ConstructorParameters<typeof EmergencyService>[1], {} as ConstructorParameters<typeof EmergencyService>[2],
    {} as ConstructorParameters<typeof EmergencyService>[3], {} as ConstructorParameters<typeof EmergencyService>[4],
    {} as ConstructorParameters<typeof EmergencyService>[5], appointments as unknown as AppointmentService);
  const body = { appointment_date: '2026-11-01', start_time: '09:00', utc_datetime: '2026-11-01T03:30:00Z',
    duration_minutes: 20, visit_type: 'NEW_CONSULTATION' as const };
  const metadata = { ipAddress: '127.0.0.1', userAgent: 'isolated-test' };

  beforeAll(setupTestDatabase, 120000);
  afterAll(teardownTestDatabase);
  afterEach(async () => { vi.restoreAllMocks(); await clearTestDatabase(); });
  beforeEach(async () => {
    appointments.create.mockClear(); appointments.updateStatus.mockClear();
    branchId = new Types.ObjectId().toString(); departmentId = new Types.ObjectId().toString();
    const user = await UserModel.create({ username: 'trace-test', email: 'trace@example.test', fullName: 'Trace Tester',
      passwordHash: 'unused', status: 'active', branchIds: [branchId], departmentIds: [departmentId], roleIds: [] }); actor = user.id;
    const source = await EmergencyEncounterModel.create({ encounterNumber: 'ER-TRACE', emergencyIdentifier: 'ER-TRACE-ID',
      branchId, departmentId, patientId: new Types.ObjectId(), patientName: 'Test Patient', arrivalMode: 'WALK_IN', arrivalAt: new Date(),
      chiefComplaint: 'Test', createdBy: actor, updatedBy: actor, referral: { sourceType: 'EMERGENCY_ENCOUNTER',
        targetDepartmentId: departmentId, targetDepartmentName: 'Ophthalmology', targetDoctorId: new Types.ObjectId(),
        targetDoctorName: 'Test Doctor', priority: 'URGENT', reason: 'Test referral', clinicalNotes: 'Test', status: 'SUBMITTED',
        submittedAt: new Date(), submittedBy: actor } }); sourceId = source.id;
  });

  it('rolls back an audit failure, cancels the unlinked appointment and reuses a successful retry', async () => {
    vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('Audit unavailable'));
    await expect(service.bookReferral(sourceId, branchId, body, actor, metadata)).rejects.toThrow('Audit unavailable');
    expect((await repository.getReferral(sourceId, branchId))?.appointment_id).toBeNull();
    expect(await AppointmentModel.countDocuments({ status: 'CANCELLED' })).toBe(1);
    const linked = await service.bookReferral(sourceId, branchId, body, actor, metadata);
    expect(linked.appointment_id).toBeTruthy();
    expect(await service.bookReferral(sourceId, branchId, body, actor, metadata)).toEqual(linked);
    expect(appointments.create).toHaveBeenCalledTimes(2);
    expect(await AppointmentModel.countDocuments({ status: 'SCHEDULED' })).toBe(1);
    expect(await AuditLogModel.countDocuments({ eventType: 'emergency.referral.booked' })).toBe(1);
  });

  it('returns an explicit reconciliation error if compensation fails and denies foreign-branch booking', async () => {
    vi.spyOn(repository, 'audit').mockRejectedValueOnce(new Error('Audit unavailable'));
    appointments.updateStatus.mockRejectedValueOnce(new Error('Appointment service unavailable'));
    await expect(service.bookReferral(sourceId, branchId, body, actor, metadata))
      .rejects.toMatchObject({ code: 'EMERGENCY_REFERRAL_BOOKING_RECONCILIATION_REQUIRED' });
    expect((await repository.getReferral(sourceId, branchId))?.appointment_id).toBeNull();
    await expect(service.bookReferral(sourceId, new Types.ObjectId().toString(), body, actor, metadata))
      .rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
    expect(appointments.create).toHaveBeenCalledOnce();
  });
});
