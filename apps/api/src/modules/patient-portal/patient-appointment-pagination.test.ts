import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';
import { env } from '../../config/env.js';
import { signJwt } from '../../shared/security/jwt.js';
import { AppointmentModel } from '../appointments/appointment.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { PatientPortalRepository } from './patient-portal.repository.js';

const localDay = (daysFromToday: number, hour = 12) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromToday, hour, 0, 0, 0);
};

describe('M-007 patient appointment pagination', () => {
  let mongodb: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let repository: PatientPortalRepository;
  let patientAId: Types.ObjectId;
  let patientBId: Types.ObjectId;
  let branchId: Types.ObjectId;
  let doctorId: Types.ObjectId;
  let departmentId: Types.ObjectId;

  beforeAll(async () => {
    mongodb = await MongoMemoryServer.create();
    await mongoose.connect(mongodb.getUri());
    ({ app } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
    await mongoose.disconnect();
    await mongodb.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    repository = new PatientPortalRepository();
    patientAId = new Types.ObjectId();
    patientBId = new Types.ObjectId();
    doctorId = new Types.ObjectId();
    departmentId = new Types.ObjectId();
    const branch = await BranchModel.create({ code: 'M007', name: 'M-007 Branch', city: 'Test City' });
    branchId = branch._id;
  });

  const createAppointment = (input: {
    number: string;
    patientId?: Types.ObjectId;
    daysFromToday: number;
    status?: 'SCHEDULED' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED' | 'RESCHEDULED' | 'NO_SHOW' | 'SKIPPED' | 'COMPLETED';
  }) => AppointmentModel.create({
    appointmentNumber: input.number,
    patientId: input.patientId ?? patientAId,
    patientNumber: input.patientId?.equals(patientBId) ? 'PAT-B' : 'PAT-A',
    patientName: input.patientId?.equals(patientBId) ? 'Patient B' : 'Patient A',
    doctorId,
    doctorName: 'Dr Pagination',
    doctorSpecialization: 'General Medicine',
    branchId,
    departmentId,
    appointmentDate: localDay(input.daysFromToday),
    startTime: '09:00',
    endTime: '09:30',
    durationMinutes: 30,
    visitType: 'NEW_CONSULTATION',
    priority: 'ROUTINE',
    status: input.status ?? 'COMPLETED',
  });

  const createStandaloneVisit = (input: {
    number: string;
    patientId?: Types.ObjectId;
    daysFromToday: number;
    status?: 'CHECKED_IN' | 'WAITING_FOR_VITALS' | 'READY_FOR_CONSULTATION' | 'IN_CONSULTATION' | 'SKIPPED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  }) => OpdVisitModel.create({
    visitNumber: input.number,
    patientId: input.patientId ?? patientAId,
    patientNumber: input.patientId?.equals(patientBId) ? 'PAT-B' : 'PAT-A',
    patientName: input.patientId?.equals(patientBId) ? 'Patient B' : 'Patient A',
    doctorId,
    doctorName: 'Dr Pagination',
    doctorSpecialization: 'General Medicine',
    branchId,
    departmentId,
    visitDate: localDay(input.daysFromToday),
    checkInTime: localDay(input.daysFromToday, 10),
    visitType: 'WALK_IN',
    priority: 'ROUTINE',
    status: input.status ?? 'COMPLETED',
  });

  it('returns correctly ordered combined records across pages with the full total', async () => {
    await Promise.all([
      createAppointment({ number: 'APT-M007-1', daysFromToday: -1 }),
      createStandaloneVisit({ number: 'OPD-M007-2', daysFromToday: -2 }),
      createAppointment({ number: 'APT-M007-3', daysFromToday: -3 }),
      createStandaloneVisit({ number: 'OPD-M007-4', daysFromToday: -4 }),
      createAppointment({ number: 'APT-M007-5', daysFromToday: -5 }),
    ]);

    const page1 = await repository.listAppointments(patientAId.toString(), { scope: 'past', page: 1, limit: 2 });
    const page2 = await repository.listAppointments(patientAId.toString(), { scope: 'past', page: 2, limit: 2 });

    expect(page1.data.map((item) => item.appointment_number)).toEqual(['APT-M007-1', 'OPD-M007-2']);
    expect(page2.data.map((item) => item.appointment_number)).toEqual(['APT-M007-3', 'OPD-M007-4']);
    expect(page1.data).toHaveLength(2);
    expect(page2.data).toHaveLength(2);
    expect(page1.meta).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(page2.meta).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(page1.data.some((item) => item.is_opd_visit)).toBe(true);
    expect(page1.data.some((item) => !item.is_opd_visit)).toBe(true);
    expect(page1.data[0]?.appointment_date.getTime()).toBeGreaterThan(page1.data[1]?.appointment_date.getTime() ?? 0);
  });

  it('preserves status filters and does not duplicate an appointment-linked OPD visit', async () => {
    const linkedAppointment = await createAppointment({ number: 'APT-M007-LINKED', daysFromToday: -1, status: 'SCHEDULED' });
    await OpdVisitModel.create({
      visitNumber: 'OPD-M007-LINKED',
      appointmentId: linkedAppointment._id,
      patientId: patientAId,
      patientNumber: 'PAT-A',
      patientName: 'Patient A',
      doctorId,
      doctorName: 'Dr Pagination',
      doctorSpecialization: 'General Medicine',
      branchId,
      departmentId,
      visitDate: localDay(-1),
      checkInTime: localDay(-1, 10),
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'COMPLETED',
    });
    await createAppointment({ number: 'APT-M007-CANCELLED', daysFromToday: -2, status: 'CANCELLED' });

    const completed = await repository.listAppointments(patientAId.toString(), {
      scope: 'past', status: 'COMPLETED', page: 1, limit: 10,
    });
    const cancelled = await repository.listAppointments(patientAId.toString(), {
      scope: 'past', status: 'CANCELLED', page: 1, limit: 10,
    });

    expect(completed.meta.total).toBe(1);
    expect(completed.data[0]).toMatchObject({
      appointment_number: 'APT-M007-LINKED',
      status: 'COMPLETED',
      is_opd_visit: true,
      opd_visit_number: 'OPD-M007-LINKED',
    });
    expect(cancelled.data.map((item) => item.appointment_number)).toEqual(['APT-M007-CANCELLED']);
  });

  it('keeps the database query scoped to the requested patient', async () => {
    await Promise.all([
      createAppointment({ number: 'APT-M007-A', patientId: patientAId, daysFromToday: -1 }),
      createAppointment({ number: 'APT-M007-B', patientId: patientBId, daysFromToday: -1 }),
      createStandaloneVisit({ number: 'OPD-M007-B', patientId: patientBId, daysFromToday: -2 }),
    ]);

    const result = await repository.listAppointments(patientAId.toString(), { scope: 'past', page: 1, limit: 10 });

    expect(result.meta.total).toBe(1);
    expect(result.data.map((item) => item.appointment_number)).toEqual(['APT-M007-A']);
    expect(result.data.every((item) => item.patient_id === patientAId.toString())).toBe(true);
  });

  it('rejects an authenticated patient requesting another patient history', async () => {
    const role = await RoleModel.create({ code: 'PATIENT', name: 'Patient', permissionIds: [], status: 'active' });
    const [patientA, patientB] = await PatientModel.create([
      { patientNumber: 'HMS-2026-700001', firstName: 'Patient', lastName: 'A', dateOfBirth: localDay(-10_000), gender: 'UNKNOWN', status: 'ACTIVE' },
      { patientNumber: 'HMS-2026-700002', firstName: 'Patient', lastName: 'B', dateOfBirth: localDay(-10_000), gender: 'UNKNOWN', status: 'ACTIVE' },
    ]);
    const user = await UserModel.create({
      username: 'm007.patient.a',
      email: 'm007.patient.a@example.test',
      fullName: 'Patient A',
      passwordHash: 'unused',
      patientId: patientA._id,
      roleIds: [role._id],
      branchIds: [],
      departmentIds: [],
      status: 'active',
    });
    const token = signJwt({ sub: user._id.toString(), username: user.username }, env.auth.accessTokenSecret, 300);

    const response = await app.inject({
      method: 'GET',
      url: `/api/patient-portal/appointments?patient_id=${patientB._id.toString()}&scope=past&page=1&limit=10`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'PATIENT_ACCESS_DENIED' } });
  });

  it('uses aggregation instead of unbounded model find calls for history pagination', async () => {
    await createAppointment({ number: 'APT-M007-AGG', daysFromToday: -1 });
    const appointmentFind = vi.spyOn(AppointmentModel, 'find');
    const opdVisitFind = vi.spyOn(OpdVisitModel, 'find');

    try {
      const result = await repository.listAppointments(patientAId.toString(), { scope: 'past', page: 1, limit: 1 });
      expect(result.data).toHaveLength(1);
      expect(appointmentFind).not.toHaveBeenCalled();
      expect(opdVisitFind).not.toHaveBeenCalled();
    } finally {
      appointmentFind.mockRestore();
      opdVisitFind.mockRestore();
    }
  });
});
