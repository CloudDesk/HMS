import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import { env } from '../../config/env.js';
import { signJwt } from '../../shared/security/jwt.js';
import { AppointmentModel } from '../appointments/appointment.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { DepartmentModel } from '../departments/department.model.js';
import { DoctorModel } from '../doctors/doctor.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';

describe('Patient Portal Appointment Booking endpoint', () => {
  let mongodb: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let patientId: Types.ObjectId;
  let branchId: Types.ObjectId;
  let doctorId: Types.ObjectId;
  let departmentId: Types.ObjectId;
  let userId: Types.ObjectId;
  let authToken: string;

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

    const branch = await BranchModel.create({ code: 'B01', name: 'Main Branch', city: 'City' });
    branchId = branch._id;

    const dept = await DepartmentModel.create({
      code: 'DENT',
      name: 'Dental',
      branchId,
      status: 'ACTIVE',
    });
    departmentId = dept._id;

    const patient = await PatientModel.create({
      firstName: 'Alice',
      lastName: 'Smith',
      patientNumber: 'PAT-001',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'FEMALE',
      phone: '+1234567890',
      registrationBranchId: branchId,
      status: 'ACTIVE',
    });
    patientId = patient._id;

    const patientRole = await RoleModel.create({
      name: 'Patient',
      code: 'PATIENT',
      permissionIds: [],
      status: 'active',
    });

    const user = await UserModel.create({
      username: 'alice.smith',
      email: 'alice@example.com',
      fullName: 'Alice Smith',
      passwordHash: 'hash',
      roleIds: [patientRole._id],
      branchIds: [branchId],
      departmentIds: [departmentId],
      status: 'active',
      patientId: patient._id,
    });
    userId = user._id;

    authToken = signJwt(
      { sub: user._id.toString(), username: user.username },
      env.auth.accessTokenSecret,
      300,
    );

    const doc = await DoctorModel.create({
      doctorNumber: 'DOC-001',
      firstName: 'Bob',
      lastName: 'Johnson',
      displayName: 'Dr. Bob Johnson',
      specialization: 'Dentist',
      departmentId,
      branchId,
      status: 'ACTIVE',
      experienceYears: 5,
      availability: [
        'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY',
      ].map((dayOfWeek) => ({
        dayOfWeek,
        isAvailable: true,
        workingBlocks: [
          {
            startTime: '08:00',
            endTime: '18:00',
            slotDurationMinutes: 30,
            maxPatientsPerSlot: 1,
          },
        ],
      })),
    });
    doctorId = doc._id;
  });

  it('successfully books an appointment with appointment_date and start_time without utc_datetime', async () => {
    // Tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const response = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/appointments',
      headers: {
        authorization: `Bearer ${authToken}`,
      },
      payload: {
        patient_id: patientId.toString(),
        doctor_id: doctorId.toString(),
        appointment_date: dateStr,
        start_time: '10:00',
        duration_minutes: 30,
        visit_type: 'NEW_CONSULTATION',
        reason: 'Tooth pain',
        consultation_intake: {
          chief_complaint: 'Tooth pain',
          history_present_illness: 'Started yesterday',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.id).toBeDefined();
    expect(body.data.appointment_number).toBeDefined();

    // Verify appointment in database has proper UTC times
    const saved = await AppointmentModel.findById(body.data.id);
    expect(saved).not.toBeNull();
    expect(saved?.utcDateTime).toBeInstanceOf(Date);
    expect(saved?.startTime).toBe('10:00');
    expect(saved?.status).toBe('SCHEDULED');
  });
});
