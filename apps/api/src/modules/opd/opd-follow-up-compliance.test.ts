import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppointmentModel } from '../appointments/appointment.model.js';
import { OpdFollowUpModel } from './opd-follow-up.model.js';
import { OpdFollowUpRepository } from './opd-follow-up.repository.js';
import { OpdVisitModel } from './opd-visit.model.js';

describe('OPD follow-up compliance report', () => {
  let mongo: MongoMemoryServer;
  const repository = new OpdFollowUpRepository();
  beforeAll(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); });
  beforeEach(async () => { await mongoose.connection.db?.dropDatabase(); });
  afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });

  it('derives compliance from the authoritative follow-up appointment status and branch scope', async () => {
    const branchId = new Types.ObjectId(); const departmentId = new Types.ObjectId(); const patientId = new Types.ObjectId();
    const doctorId = new Types.ObjectId(); const now = new Date();
    const visit = await OpdVisitModel.create({ visitNumber: 'FU-001', patientId, patientNumber: 'P-1', patientName: 'Patient One',
      doctorId, doctorName: 'Doctor One', doctorSpecialization: 'Ophthalmology', branchId, departmentId, visitDate: now,
      checkInTime: now, visitType: 'NEW_CONSULTATION', priority: 'ROUTINE', status: 'COMPLETED' });
    const appointment = await AppointmentModel.create({ appointmentNumber: 'A-FU-1', patientId, patientNumber: 'P-1',
      patientName: 'Patient One', doctorId, doctorName: 'Doctor One', doctorSpecialization: 'Ophthalmology', branchId, departmentId,
      utcDateTime: now, appointmentDate: now, startTime: '10:00', durationMinutes: 15, visitType: 'FOLLOW_UP',
      priority: 'ROUTINE', status: 'COMPLETED' });
    await OpdFollowUpModel.create({ visitId: visit._id, consultationId: new Types.ObjectId(), patientId, patientNumber: 'P-1',
      patientName: 'Patient One', originatingDoctorId: doctorId, originatingDoctorName: 'Doctor One', assignedDoctorId: doctorId,
      assignedDoctorName: 'Doctor One', appointmentId: appointment._id, appointmentNumber: appointment.appointmentNumber,
      followUpType: 'CLINICAL_REVIEW', nextVisitDate: now, startTime: '10:00', durationMinutes: 15, reason: 'Review',
      reminderType: 'SMS', status: 'SCHEDULED', scheduledAt: now });
    const report = await repository.compliance({ branch_id: branchId.toString(), department_id: departmentId.toString(), page: 1, limit: 20 });
    expect(report.meta.total).toBe(1);
    expect(report.data[0]).toMatchObject({ appointment_status: 'COMPLETED', compliance_status: 'COMPLETED' });
    expect((await repository.compliance({ branch_id: new Types.ObjectId().toString() })).meta.total).toBe(0);
  });
});
