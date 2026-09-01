import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { expect, it } from 'vitest';
import { AppointmentModel } from '../src/modules/appointments/appointment.model.js';
import { AppointmentRepository } from '../src/modules/appointments/appointment.repository.js';
import { EmergencyEncounterModel } from '../src/modules/emergency/emergency.model.js';
import { EmergencyRepository } from '../src/modules/emergency/emergency.repository.js';
import { EmergencyService } from '../src/modules/emergency/emergency.service.js';
import { OpdFollowUpModel } from '../src/modules/opd/opd-follow-up.model.js';
import { OpdFollowUpService } from '../src/modules/opd/opd-follow-up.service.js';
import { OpdReferralModel } from '../src/modules/opd/opd-referral.model.js';
import { OpdReferralRepository } from '../src/modules/opd/opd-referral.repository.js';
import { OpdReferralService } from '../src/modules/opd/opd-referral.service.js';
import { OpdVisitModel } from '../src/modules/opd/opd-visit.model.js';

const id = () => new Types.ObjectId().toString();

it('completed OPD consultation submits one durable referral on retry', async () => {
  const visitId = id();
  const patientId = id();
  const doctorId = id();
  const actor = id();
  const visit = {
    id: visitId,
    status: 'COMPLETED',
    patient_id: patientId,
    patient_number: 'HMS-2026-000001',
    patient_name: 'Patient One',
    doctor_id: id(),
    doctor_name: 'Dr Referrer',
  };
  const consultation = { id: id(), status: 'COMPLETED' };
  let saved: Record<string, unknown> | null = null;
  let saves = 0;
  const repository = {
    getByVisit: async () => saved,
    saveForVisit: async (data: Record<string, unknown>) => {
      saves += 1;
      saved = {
        id: id(),
        visit_id: visitId,
        patient_id: patientId,
        status: 'SUBMITTED',
        ...data,
      };
      return saved;
    },
  };
  const service = new OpdReferralService(
    repository as unknown as ConstructorParameters<typeof OpdReferralService>[0],
    { resolveBranchScope: async () => undefined, getById: async () => visit } as unknown as ConstructorParameters<typeof OpdReferralService>[1],
    { getByVisit: async () => consultation } as unknown as ConstructorParameters<typeof OpdReferralService>[2],
    { getById: async () => ({ id: doctorId, status: 'ACTIVE', display_name: 'Dr Specialist', user_id: null }) } as unknown as ConstructorParameters<typeof OpdReferralService>[3],
    {} as ConstructorParameters<typeof OpdReferralService>[4],
    { getById: async () => ({ first_name: 'Patient', last_name: 'One' }), addTimelineEvent: async () => undefined, auditClinicalEvent: async () => undefined } as unknown as ConstructorParameters<typeof OpdReferralService>[5],
    { createNotification: async () => undefined } as unknown as ConstructorParameters<typeof OpdReferralService>[6],
    {} as ConstructorParameters<typeof OpdReferralService>[7],
  );
  const payload = {
    referral_type: 'INTERNAL' as const,
    specialty: 'Cardiology',
    referred_doctor_id: doctorId,
    reason: 'Specialist assessment',
    clinical_summary: 'Persistent symptoms require specialist review.',
  };

  const first = await service.submit(visitId, payload, actor);
  const second = await service.submit(visitId, payload, actor);

  expect(first.status).toBe('SUBMITTED');
  expect(second).toBe(first);
  expect(saves).toBe(1);
});

it('completed OPD consultation schedules one follow-up Appointment on retry', async () => {
  const visitId = id();
  const patientId = id();
  const doctorId = id();
  const actor = id();
  const visit = {
    id: visitId,
    status: 'COMPLETED',
    visit_number: 'OPD-2026-000001',
    patient_id: patientId,
    patient_number: 'HMS-2026-000001',
    patient_name: 'Patient One',
    doctor_id: id(),
    doctor_name: 'Dr Referrer',
  };
  let current: Record<string, unknown> | null = null;
  let appointments = 0;
  const service = new OpdFollowUpService(
    {
      getByVisit: async () => current,
      saveForVisit: async (data: Record<string, unknown>) => {
        current = { id: id(), visit_id: visitId, patient_id: patientId, status: 'SCHEDULED', ...data };
        return current;
      },
    } as unknown as ConstructorParameters<typeof OpdFollowUpService>[0],
    { resolveBranchScope: async () => undefined, getById: async () => visit } as unknown as ConstructorParameters<typeof OpdFollowUpService>[1],
    { getByVisit: async () => ({ id: id(), status: 'COMPLETED' }) } as unknown as ConstructorParameters<typeof OpdFollowUpService>[2],
    {
      create: async () => {
        appointments += 1;
        return { id: id(), appointment_number: 'APT-1', doctor_name: 'Dr Follow-up' };
      },
    } as unknown as ConstructorParameters<typeof OpdFollowUpService>[3],
    { addTimelineEvent: async () => undefined, auditClinicalEvent: async () => undefined } as unknown as ConstructorParameters<typeof OpdFollowUpService>[4],
  );
  const payload = {
    follow_up_type: 'CLINICAL_REVIEW' as const,
    next_visit_date: '2026-09-03',
    start_time: '09:00',
    utc_datetime: '2026-09-03T06:00:00.000Z',
    duration_minutes: 30,
    assigned_doctor_id: doctorId,
    reason: 'Clinical follow-up review',
    reminder_type: 'SMS' as const,
  };

  const first = await service.schedule(visitId, payload, actor);
  const second = await service.schedule(visitId, payload, actor);

  expect(first.status).toBe('SCHEDULED');
  expect(second).toBe(first);
  expect(appointments).toBe(1);
});

it('Emergency referral is encounter-owned, idempotent, and books through Appointment', async () => {
  const encounterId = id();
  const branchId = id();
  const sourceDepartmentId = id();
  const targetDepartmentId = id();
  const referringDoctorId = id();
  const targetDoctorId = id();
  const patientId = id();
  const actor = id();
  const current = {
    _id: new Types.ObjectId(encounterId),
    encounterNumber: 'ER-20260901-0001',
    emergencyIdentifier: 'EID-20260901-0001',
    branchId: new Types.ObjectId(branchId),
    departmentId: new Types.ObjectId(sourceDepartmentId),
    patientId: new Types.ObjectId(patientId),
    patientNumber: 'HMS-2026-000002',
    patientName: 'Emergency Patient',
    assignedDoctorId: new Types.ObjectId(referringDoctorId),
    assignedDoctorName: 'Dr Emergency',
    status: 'IN_TREATMENT',
    referral: null as null | Record<string, unknown>,
  };
  let saves = 0;
  let appointmentCreates = 0;
  let linkedReferral: Record<string, unknown> | null = null;
  const referralResponse = () => ({
    id: encounterId,
    source_type: 'EMERGENCY_ENCOUNTER' as const,
    source_id: encounterId,
    encounter_number: current.encounterNumber,
    emergency_identifier: current.emergencyIdentifier,
    branch_id: branchId,
    patient_id: patientId,
    patient_number: current.patientNumber,
    patient_name: current.patientName,
    referring_doctor_id: referringDoctorId,
    referring_doctor_name: current.assignedDoctorName,
    target_department_id: targetDepartmentId,
    target_department_name: 'Cardiology',
    referred_doctor_id: targetDoctorId,
    referred_doctor_name: 'Dr Specialist',
    priority: 'EMERGENCY' as const,
    reason: 'Specialist emergency consultation',
    clinical_summary: 'Immediate bedside specialist review required.',
    status: 'SUBMITTED' as const,
    submitted_at: new Date(),
    appointment_id: linkedReferral ? 'appointment-1' : null,
    appointment_number: linkedReferral ? 'APT-1' : null,
    appointment_date: null,
    appointment_start_time: null,
    appointment_duration_minutes: null,
  });
  const repository = {
    hasBranchAccess: async () => true,
    departmentScope: async () => undefined,
    branchScope: async () => undefined,
    session: async () => ({ withTransaction: async (callback: () => Promise<void>) => callback(), endSession: async () => undefined }),
    getRecord: async () => current,
    department: async () => ({ name: 'Cardiology' }),
    doctor: async () => ({ displayName: 'Dr Specialist' }),
    saveReferral: async () => {
      saves += 1;
      current.referral = {
        sourceType: 'EMERGENCY_ENCOUNTER',
        targetDepartmentId: new Types.ObjectId(targetDepartmentId),
        targetDepartmentName: 'Cardiology',
        targetDoctorId: new Types.ObjectId(targetDoctorId),
        targetDoctorName: 'Dr Specialist',
        priority: 'EMERGENCY',
        reason: 'Specialist emergency consultation',
        clinicalNotes: 'Immediate bedside specialist review required.',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        submittedBy: new Types.ObjectId(actor),
      };
      return referralResponse();
    },
    audit: async () => undefined,
    getReferral: async () => referralResponse(),
    linkReferralAppointment: async () => {
      linkedReferral = { appointmentId: 'appointment-1' };
      return referralResponse();
    },
  };
  const service = new EmergencyService(
    repository as unknown as ConstructorParameters<typeof EmergencyService>[0],
    {} as ConstructorParameters<typeof EmergencyService>[1],
    {} as ConstructorParameters<typeof EmergencyService>[2],
    {} as ConstructorParameters<typeof EmergencyService>[3],
    {} as ConstructorParameters<typeof EmergencyService>[4],
    {} as ConstructorParameters<typeof EmergencyService>[5],
    {
      create: async () => {
        appointmentCreates += 1;
        return { id: 'appointment-1', appointment_number: 'APT-1' };
      },
    } as unknown as ConstructorParameters<typeof EmergencyService>[6],
  );
  const payload = {
    target_department_id: targetDepartmentId,
    target_doctor_id: targetDoctorId,
    priority: 'EMERGENCY' as const,
    reason: 'Specialist emergency consultation',
    clinical_notes: 'Immediate bedside specialist review required.',
  };

  await service.submitReferral(encounterId, branchId, payload, actor, {});
  await service.submitReferral(encounterId, branchId, payload, actor, {});
  const booked = await service.bookReferral(encounterId, branchId, {
    appointment_date: '2026-09-03',
    start_time: '10:00',
    utc_datetime: '2026-09-03T07:00:00.000Z',
    duration_minutes: 30,
    visit_type: 'NEW_CONSULTATION',
  }, actor, {});
  const retried = await service.bookReferral(encounterId, branchId, {
    appointment_date: '2026-09-03',
    start_time: '10:00',
    utc_datetime: '2026-09-03T07:00:00.000Z',
    duration_minutes: 30,
    visit_type: 'NEW_CONSULTATION',
  }, actor, {});

  expect(saves).toBe(1);
  expect(appointmentCreates).toBe(1);
  expect(booked.appointment_id).toBe('appointment-1');
  expect(retried.appointment_id).toBe('appointment-1');
});

it('persists OPD referral, follow-up Appointment, and Emergency referral across a database reconnect', async () => {
  const database = await MongoMemoryServer.create();
  const branchId = new Types.ObjectId();
  const departmentId = new Types.ObjectId();
  const visitId = new Types.ObjectId();
  const consultationId = new Types.ObjectId();
  const patientId = new Types.ObjectId();
  const referringDoctorId = new Types.ObjectId();
  const targetDoctorId = new Types.ObjectId();
  const actorId = new Types.ObjectId();
  const appointmentId = new Types.ObjectId();
  const calendarDate = new Date('2026-09-03T00:00:00.000Z');

  try {
    await mongoose.connect(database.getUri());
    await Promise.all([
      OpdVisitModel.create({
        _id: visitId,
        visitNumber: 'OPD-2026-000001',
        patientId,
        patientNumber: 'HMS-2026-000001',
        patientName: 'Referral Patient',
        doctorId: referringDoctorId,
        doctorName: 'Dr Referrer',
        doctorSpecialization: 'General Medicine',
        branchId,
        departmentId,
        visitDate: new Date('2026-09-01T00:00:00.000Z'),
        checkInTime: new Date('2026-09-01T08:00:00.000Z'),
        visitType: 'NEW_CONSULTATION',
        priority: 'ROUTINE',
        status: 'COMPLETED',
        createdBy: actorId,
        updatedBy: actorId,
      }),
      OpdReferralModel.create({
        visitId,
        branchId,
        consultationId,
        patientId,
        patientNumber: 'HMS-2026-000001',
        patientName: 'Referral Patient',
        referringDoctorId,
        referringDoctorName: 'Dr Referrer',
        referralType: 'INTERNAL',
        specialty: 'Cardiology',
        priority: 'ROUTINE',
        referredDoctorId: targetDoctorId,
        referredDoctorName: 'Dr Specialist',
        reason: 'Specialist assessment',
        status: 'SUBMITTED',
        submittedAt: new Date(),
        createdBy: actorId,
        updatedBy: actorId,
      }),
      OpdFollowUpModel.create({
        visitId,
        consultationId,
        patientId,
        patientNumber: 'HMS-2026-000001',
        patientName: 'Referral Patient',
        originatingDoctorId: referringDoctorId,
        originatingDoctorName: 'Dr Referrer',
        assignedDoctorId: targetDoctorId,
        assignedDoctorName: 'Dr Specialist',
        appointmentId,
        appointmentNumber: 'APT-2026-000001',
        followUpType: 'CLINICAL_REVIEW',
        nextVisitDate: calendarDate,
        startTime: '09:00',
        durationMinutes: 30,
        reminderType: 'SMS',
        status: 'SCHEDULED',
        scheduledAt: new Date(),
        createdBy: actorId,
        updatedBy: actorId,
      }),
      AppointmentModel.create({
        _id: appointmentId,
        appointmentNumber: 'APT-2026-000001',
        patientId,
        patientNumber: 'HMS-2026-000001',
        patientName: 'Referral Patient',
        doctorId: targetDoctorId,
        doctorName: 'Dr Specialist',
        doctorSpecialization: 'Cardiology',
        branchId,
        departmentId,
        appointmentDate: calendarDate,
        startTime: '09:00',
        endTime: '09:30',
        durationMinutes: 30,
        visitType: 'FOLLOW_UP',
        priority: 'ROUTINE',
        status: 'SCHEDULED',
        createdBy: actorId,
        updatedBy: actorId,
      }),
      EmergencyEncounterModel.create({
        encounterNumber: 'ER-20260901-0001',
        emergencyIdentifier: 'EID-20260901-0001',
        branchId,
        departmentId,
        patientId,
        patientNumber: 'HMS-2026-000001',
        patientName: 'Referral Patient',
        arrivalMode: 'WALK_IN',
        arrivalAt: new Date(),
        chiefComplaint: 'Emergency assessment',
        status: 'IN_TREATMENT',
        version: 1,
        priorityHistory: [],
        queueHistory: [],
        assignedDoctorId: referringDoctorId,
        assignedDoctorName: 'Dr Emergency',
        referral: {
          sourceType: 'EMERGENCY_ENCOUNTER',
          targetDepartmentId: departmentId,
          targetDepartmentName: 'Cardiology',
          targetDoctorId,
          targetDoctorName: 'Dr Specialist',
          priority: 'EMERGENCY',
          reason: 'Emergency specialist assessment',
          clinicalNotes: 'Immediate bedside review required.',
          status: 'SUBMITTED',
          submittedAt: new Date(),
          submittedBy: actorId,
        },
        orders: [],
        createdBy: actorId,
        updatedBy: actorId,
      }),
    ]);

    await mongoose.disconnect();
    await mongoose.connect(database.getUri());

    const [referral, followUp, appointment, emergency] = await Promise.all([
      OpdReferralModel.findOne({ visitId }).lean(),
      OpdFollowUpModel.findOne({ visitId }).lean(),
      AppointmentModel.findById(appointmentId).lean(),
      EmergencyEncounterModel.findOne({ encounterNumber: 'ER-20260901-0001' }).lean(),
    ]);
    expect(referral?.branchId?.toString()).toBe(branchId.toString());
    expect(referral?.referredDoctorId?.toString()).toBe(targetDoctorId.toString());
    expect(followUp?.appointmentId?.toString()).toBe(appointmentId.toString());
    expect(appointment?.doctorId.toString()).toBe(targetDoctorId.toString());
    expect(appointment?.appointmentDate?.toISOString()).toBe(calendarDate.toISOString());
    expect(emergency?.referral?.targetDoctorId?.toString()).toBe(targetDoctorId.toString());

    const [opdQueue, emergencyQueue, doctorCalendar] = await Promise.all([
      new OpdReferralRepository().listSubmitted({ page: 1, limit: 20 }, [branchId.toString()]),
      new EmergencyRepository({} as ConstructorParameters<typeof EmergencyRepository>[0])
        .listSubmittedReferrals({ page: 1, limit: 20 }, [branchId.toString()]),
      new AppointmentRepository().list({
        doctor_id: targetDoctorId.toString(),
        date_from: '2026-09-03',
        date_to: '2026-09-03T23:59:59.999Z',
        page: 1,
        limit: 20,
      }, [branchId.toString()]),
    ]);
    expect(opdQueue.data).toHaveLength(1);
    expect(emergencyQueue.data).toHaveLength(1);
    expect(doctorCalendar.data).toHaveLength(1);
  } finally {
    await mongoose.disconnect();
    await database.stop();
  }
}, 15_000);
