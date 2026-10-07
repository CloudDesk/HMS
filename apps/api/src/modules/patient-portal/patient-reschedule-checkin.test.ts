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
import { OpdVisitModel } from '../opd/opd-visit.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';

describe('Patient Portal Reschedule & Check-In Workflow', () => {
  let mongodb: MongoMemoryServer;
  let app: Awaited<ReturnType<typeof buildApp>>['app'];
  let patientId: Types.ObjectId;
  let branchId: Types.ObjectId;
  let doctorId: Types.ObjectId;
  let departmentId: Types.ObjectId;
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
      code: 'GEN',
      name: 'General Medicine',
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
      specialization: 'Physician',
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
            slotDurationMinutes: 15,
            maxPatientsPerSlot: 1,
          },
        ],
      })),
    });
    doctorId = doc._id;
  });

  it('reschedules an appointment in-place without creating duplicate appointments', async () => {
    // 1. Create an initial appointment scheduled for 3 days from now
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const bookResponse = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/appointments',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        patient_id: patientId.toString(),
        doctor_id: doctorId.toString(),
        appointment_date: futureDateStr,
        start_time: '10:00',
        duration_minutes: 15,
        visit_type: 'NEW_CONSULTATION',
        reason: 'Initial consultation',
      },
    });

    expect(bookResponse.statusCode).toBe(201);
    const booked = bookResponse.json();
    const originalAppointmentId = booked.data.id;
    const originalAppointmentNumber = booked.data.appointment_number;
    expect(originalAppointmentId).toBeDefined();

    // Verify exactly 1 appointment exists
    expect(await AppointmentModel.countDocuments({ deletedAt: null })).toBe(1);

    // 2. Reschedule to 4 days from now at 11:00
    const newDate1 = new Date();
    newDate1.setDate(newDate1.getDate() + 4);
    const newDate1Str = newDate1.toISOString().split('T')[0];

    const reschedule1 = await app.inject({
      method: 'PATCH',
      url: `/api/patient-portal/appointments/${originalAppointmentId}/reschedule`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        doctor_id: doctorId.toString(),
        appointment_date: newDate1Str,
        start_time: '11:00',
        duration_minutes: 15,
      },
    });

    expect(reschedule1.statusCode).toBe(200);
    const res1Data = reschedule1.json().data;
    // Must preserve the same appointment ID and appointment number
    expect(res1Data.id).toBe(originalAppointmentId);
    expect(res1Data.appointment_number).toBe(originalAppointmentNumber);

    // Verify still exactly 1 appointment exists in database (NO duplicates!)
    const totalAppointmentsAfterFirst = await AppointmentModel.countDocuments({ deletedAt: null });
    expect(totalAppointmentsAfterFirst).toBe(1);

    const docAfterFirst = await AppointmentModel.findById(originalAppointmentId);
    expect(docAfterFirst?.startTime).toBe('11:00');
    expect(docAfterFirst?.status).toBe('SCHEDULED');

    // 3. Reschedule AGAIN to 5 days from now at 14:00
    const newDate2 = new Date();
    newDate2.setDate(newDate2.getDate() + 5);
    const newDate2Str = newDate2.toISOString().split('T')[0];

    const reschedule2 = await app.inject({
      method: 'PATCH',
      url: `/api/patient-portal/appointments/${originalAppointmentId}/reschedule`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        doctor_id: doctorId.toString(),
        appointment_date: newDate2Str,
        start_time: '14:00',
        duration_minutes: 15,
      },
    });

    expect(reschedule2.statusCode).toBe(200);
    const res2Data = reschedule2.json().data;
    // Must STILL be the exact same appointment ID and number
    expect(res2Data.id).toBe(originalAppointmentId);
    expect(res2Data.appointment_number).toBe(originalAppointmentNumber);

    // Verify still exactly 1 appointment exists in database (NO APT-B, APT-C clutter)
    const totalAppointmentsAfterSecond = await AppointmentModel.countDocuments({ deletedAt: null });
    expect(totalAppointmentsAfterSecond).toBe(1);

    const docAfterSecond = await AppointmentModel.findById(originalAppointmentId);
    expect(docAfterSecond?.startTime).toBe('14:00');
    expect(docAfterSecond?.status).toBe('SCHEDULED');
  });

  it('performs self check-in on the appointment date and prevents duplicate check-in', async () => {
    // 1. Create an appointment for TODAY
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const bookResponse = await app.inject({
      method: 'POST',
      url: '/api/patient-portal/appointments',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        patient_id: patientId.toString(),
        doctor_id: doctorId.toString(),
        appointment_date: todayStr,
        start_time: '16:00',
        duration_minutes: 15,
        visit_type: 'NEW_CONSULTATION',
        reason: 'Urgent checkup',
      },
    });

    expect(bookResponse.statusCode).toBe(201);
    const booked = bookResponse.json();
    const appointmentId = booked.data.id;

    // 2. Perform Check In via POST /api/patient-portal/appointments/:id/check-in
    const checkInResponse = await app.inject({
      method: 'POST',
      url: `/api/patient-portal/appointments/${appointmentId}/check-in`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(checkInResponse.statusCode).toBe(200);
    const checkInData = checkInResponse.json().data;
    expect(checkInData.status).toBe('CHECKED_IN');
    expect(checkInData.visit_number).toBeDefined();

    // Verify Appointment status in database is now CHECKED_IN
    const updatedAppointment = await AppointmentModel.findById(appointmentId);
    expect(updatedAppointment?.status).toBe('CHECKED_IN');

    // Verify OPD Visit record was created
    const opdVisit = await OpdVisitModel.findOne({ appointmentId });
    expect(opdVisit).not.toBeNull();
    expect(opdVisit?.status).toBe('CHECKED_IN');

    // 3. Attempt duplicate check-in on the same appointment
    const duplicateCheckInResponse = await app.inject({
      method: 'POST',
      url: `/api/patient-portal/appointments/${appointmentId}/check-in`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    // Should reject duplicate check in
    expect(duplicateCheckInResponse.statusCode).toBe(409);
  });
});
