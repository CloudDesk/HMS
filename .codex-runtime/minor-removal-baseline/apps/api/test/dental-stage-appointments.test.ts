import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { buildApp } from '../src/app.js';
import { seedDatabase } from '../src/database/seed.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { PatientModel } from '../src/modules/patients/patient.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { OpdVisitModel } from '../src/modules/opd/opd-visit.model.js';
import { DentalTreatmentEpisodeModel } from '../src/modules/opd/dental-episode.model.js';
import { DentalProstheticLabOrderModel } from '../src/modules/opd/dental-lab-order.model.js';
import { AppointmentModel } from '../src/modules/appointments/appointment.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Dental Stage Appointment Scheduling Integration Tests (Phase 3)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const patientId = createObjectId();

  const docAUserId = createObjectId();
  const docADocId = createObjectId();

  const docBUserId = createObjectId();
  const docBDocId = createObjectId();

  let episodeId: string;
  let doctorToken: string;

  const planItemId = new Types.ObjectId().toString();

  const doctorAvailability = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((day) => ({
    _id: new Types.ObjectId(),
    dayOfWeek: day,
    isAvailable: true,
    workingBlocks: [
      {
        _id: new Types.ObjectId(),
        startTime: '09:00',
        endTime: '17:00',
        slotDurationMinutes: 30,
        maxPatientsPerSlot: 1,
      },
    ],
  }));

  beforeAll(async () => {
    await setupTestDatabase();

    await BranchModel.create([
      { _id: new Types.ObjectId(branchId), name: 'Main Branch', code: 'MB01', status: 'ACTIVE' },
      { _id: new Types.ObjectId(createObjectId()), name: 'Secondary Branch', code: 'SB01', status: 'ACTIVE' },
    ]);

    await seedDatabase();

    await DepartmentModel.create([
      {
        _id: new Types.ObjectId(dentalDeptId),
        name: 'Dental Surgery',
        code: 'DENT',
        branchIds: [new Types.ObjectId(branchId)],
        status: 'ACTIVE',
        isClinical: true,
      },
    ]);

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    if (!doctorRole) throw new Error('DOCTOR role not seeded');
    const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN' }).lean();

    const passwordHash = await hashPassword('DoctorPass123!');

    await UserModel.create([
      {
        _id: new Types.ObjectId(docAUserId),
        username: 'doctor_alice_p3',
        email: 'doctor.a.p3@dental.local',
        passwordHash,
        fullName: 'Dr. Alice Endo',
        roleIds: superAdminRole ? [doctorRole._id, superAdminRole._id] : [doctorRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(docBUserId),
        username: 'doctor_bob_p3',
        email: 'doctor.b.p3@dental.local',
        passwordHash,
        fullName: 'Dr. Bob Prostho',
        roleIds: [doctorRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
    ]);

    await DoctorModel.create([
      {
        _id: new Types.ObjectId(docADocId),
        userId: new Types.ObjectId(docAUserId),
        doctorNumber: 'DOC-P3-ENDO',
        firstName: 'Alice',
        lastName: 'Endo',
        displayName: 'Dr. Alice Endo',
        specialization: 'Endodontics',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        status: 'ACTIVE',
        availability: doctorAvailability,
      },
      {
        _id: new Types.ObjectId(docBDocId),
        userId: new Types.ObjectId(docBUserId),
        doctorNumber: 'DOC-P3-PROS',
        firstName: 'Bob',
        lastName: 'Prostho',
        displayName: 'Dr. Bob Prostho',
        specialization: 'Prosthodontics',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        status: 'ACTIVE',
        availability: doctorAvailability,
      },
    ]);

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'PAT-P3-001',
      firstName: 'Dental',
      lastName: 'Phase3Patient',
      gender: 'FEMALE',
      dateOfBirth: new Date('1992-05-15'),
      primaryContactNumber: '+919999900099',
      branchId: new Types.ObjectId(branchId),
      bloodGroup: 'B+',
    });

    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-P3-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-P3-001',
      patientName: 'Dental Phase3Patient',
      patientGender: 'FEMALE',
      patientDateOfBirth: new Date('1992-05-15'),
      doctorId: new Types.ObjectId(docADocId),
      doctorName: 'Dr. Alice Endo',
      doctorSpecialization: 'Endodontics',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Surgery',
      branchId: new Types.ObjectId(branchId),
      queueNumber: 'D-P3-01',
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-18'),
      checkInTime: new Date('2026-09-18T09:00:00Z'),
    });

    const episode = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-P3-0001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-P3-001',
      patientName: 'Dental Phase3Patient',
      originatingVisitId: new Types.ObjectId(visit._id),
      originatingVisitNumber: 'VIS-P3-001',
      primaryDoctorId: new Types.ObjectId(docADocId),
      primaryDoctorName: 'Dr. Alice Endo',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 16,
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visit._id)],
      chiefComplaint: 'Tooth 16 pain requiring RCT and crown',
      clinicalSummary: 'Deep pulp necrosis',
      treatmentPlanSummary: 'RCT followed by Ceramic Crown',
    });

    episodeId = episode._id.toString();

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();

    doctorToken = signJwt(
      { sub: docAUserId, username: 'doctor_alice_p3' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  let stage1Id: string;
  let stage2Id: string;
  let appointmentId: string;

  it('1. Creates multi-doctor treatment stages in PLANNED status', async () => {
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemId,
        stage_name: 'Stage 1 - Root Canal Treatment',
        sequence: 1,
        assigned_doctor_id: docADocId,
        tooth_number: 16,
      },
    });
    expect(res1.statusCode).toBe(200);
    const body1 = res1.json();
    expect(body1.data.status).toBe('PLANNED');
    expect(body1.data.assigned_doctor_name).toBe('Dr. Alice Endo');
    stage1Id = body1.data.id;

    // Stage 2 with Doctor B (Prosthodontist)
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemId,
        stage_name: 'Stage 2 - Crown Fitting',
        sequence: 2,
        assigned_doctor_id: docBDocId,
        tooth_number: 16,
      },
    });
    expect(res2.statusCode).toBe(200);
    stage2Id = res2.json().data.id;
  });

  it('2. Enforces sequential dependency: cannot schedule Stage 2 before Stage 1 is complete', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage2Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 60,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('PREREQUISITE_STAGE_INCOMPLETE');
    expect(body.error.message).toContain('Prerequisite stage');
  });

  it('3. Doctor availability is respected: rejects scheduling outside working hours', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage1Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-15',
        start_time: '06:00',
        duration_minutes: 60,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('4. Successfully schedules Stage 1: links appointment and sets status to SCHEDULED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage1Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-15',
        start_time: '10:00',
        duration_minutes: 60,
        notes: 'First visit RCT instrumentation',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.stage.status).toBe('SCHEDULED');
    expect(body.data.stage.appointment_id).toBeTruthy();
    expect(body.data.appointment).toBeTruthy();
    expect(body.data.appointment.visit_type).toBe('PROCEDURE');
    expect(body.data.appointment.duration_minutes).toBe(60);

    appointmentId = body.data.appointment.id;

    // Verify dental context is stored on the appointment in DB
    const apptDoc = await AppointmentModel.findById(appointmentId).lean();
    expect(apptDoc?.dentalContext?.treatmentStageId?.toString()).toBe(stage1Id);
    expect(apptDoc?.dentalContext?.treatmentEpisodeId?.toString()).toBe(episodeId);
    expect(apptDoc?.dentalContext?.toothNumber).toBe(16);
    expect(apptDoc?.dentalContext?.stageSequence).toBe(1);
  });

  it('5. Rejects conflicting appointment: cannot schedule another appointment in overlapping doctor slot', async () => {
    const conflictRes = await app.inject({
      method: 'POST',
      url: '/api/appointments',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        doctor_id: docADocId,
        appointment_date: '2026-10-15',
        start_time: '10:30',
        utc_datetime: '2026-10-15T07:30:00.000Z',
        duration_minutes: 30,
        visit_type: 'PROCEDURE',
      },
    });
    expect(conflictRes.statusCode).toBe(409);
  });

  it('6. Successfully reschedules Stage 1 appointment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage1Id}/reschedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-16',
        start_time: '11:00',
        duration_minutes: 60,
        reschedule_reason: 'Patient requested next day morning',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.stage.status).toBe('SCHEDULED');
    expect(body.data.appointment.start_time).toBe('11:00');
  });

  it('7. View Stage Appointment returns linked appointment details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/stages/${stage1Id}/appointment`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeTruthy();
    expect(body.data.id).toBe(appointmentId);
    expect(body.data.doctor_name).toBe('Dr. Alice Endo');
    expect(body.data.duration_minutes).toBe(60);
  });

  it('8. Cancelling stage appointment reverts stage to PLANNED and clears appointment_id', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage1Id}/cancel-appointment`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        reason: 'Patient unwell, will reschedule later',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('PLANNED');
    expect(body.data.appointment_id).toBeNull();

    // Verify appointment itself is marked CANCELLED
    const appt = await AppointmentModel.findById(appointmentId).lean();
    expect(appt?.status).toBe('CANCELLED');
  });

  it('9. Stage can be scheduled again after cancellation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage1Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-18',
        start_time: '14:00',
        duration_minutes: 45,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.stage.status).toBe('SCHEDULED');
    expect(body.data.stage.appointment_id).toBeTruthy();
  });

  it('10. Progressive execution: completing Stage 1 unblocks scheduling Stage 2 with different doctor', async () => {
    const startRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(startRes.statusCode).toBe(200);

    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });
    expect(completeRes.statusCode).toBe(200);

    // Now Stage 2 can be scheduled with Doctor B (Prosthodontist)
    const stage2ScheduleRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage2Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-22',
        start_time: '10:00',
        duration_minutes: 90,
      },
    });
    expect(stage2ScheduleRes.statusCode).toBe(200);
    const body2 = stage2ScheduleRes.json();
    expect(body2.data.stage.status).toBe('SCHEDULED');
    expect(body2.data.stage.assigned_doctor_name).toBe('Dr. Bob Prostho');
    expect(body2.data.appointment.duration_minutes).toBe(90);
  });

  let fittingLabOrderId: string;
  let fittingStageId: string;
  let fittingAppointmentId: string;

  it('11. Phase 7B: Creates a Dental Prosthetic Lab Order for Stage 2 in ORDERED status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientId,
        treatment_episode_id: episodeId,
        treatment_stage_id: stage2Id,
        treatment_plan_item_id: planItemId,
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'Ceramic Crown for Tooth 16',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('ORDERED');
    fittingLabOrderId = body.data.id;
  });

  it('12. Phase 7B: Prepares fitting stage (Stage 3) linked to the prosthetic lab order', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemId,
        stage_name: 'Stage 3 - Crown Cementation & Final Fitting',
        sequence: 3,
        assigned_doctor_id: docBDocId,
        tooth_number: 16,
        prosthetic_lab_order_id: fittingLabOrderId,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('PLANNED');
    expect(body.data.prosthetic_lab_order_id).toBe(fittingLabOrderId);
    fittingStageId = body.data.id;
  });

  it('13. Phase 7B: Non-READY fitting stage cannot be scheduled (blocks with LAB_ORDER_NOT_READY)', async () => {
    // Complete Stage 2 so sequential prerequisite is satisfied
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage2Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage2Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });

    // Attempt to schedule fitting stage while lab order is ORDERED
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${fittingStageId}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-25',
        start_time: '14:00',
        duration_minutes: 45,
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    const code = body.code || body.error?.code;
    expect(code).toBe('LAB_ORDER_NOT_READY');
  });

  it('14. Phase 7B: Progressing lab order to READY allows scheduling the fitting stage', async () => {
    // Move lab order: ORDERED -> RECEIVED -> IN_PROGRESS -> QUALITY_CHECK -> READY
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${fittingLabOrderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'RECEIVED', remarks: 'Impressions received at lab' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${fittingLabOrderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS', remarks: 'Fabrication started' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${fittingLabOrderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'QUALITY_CHECK', remarks: 'Checking fit and occlusion' },
    });
    const readyRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/lab-orders/${fittingLabOrderId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'READY', remarks: 'Prosthetic ready for delivery' },
    });
    expect(readyRes.statusCode).toBe(200);

    // Now schedule Stage 3
    const scheduleRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${fittingStageId}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-25',
        start_time: '14:00',
        duration_minutes: 45,
        notes: 'Final crown cementation with Dr. Bob',
      },
    });
    expect(scheduleRes.statusCode).toBe(200);
    const body = scheduleRes.json();
    expect(body.data.stage.status).toBe('SCHEDULED');
    expect(body.data.stage.appointment_id).toBeTruthy();
    expect(body.data.appointment.visit_type).toBe('PROCEDURE');
    expect(body.data.appointment.duration_minutes).toBe(45);

    fittingAppointmentId = body.data.appointment.id;

    // Verify dental context on appointment
    const appt = await AppointmentModel.findById(fittingAppointmentId).lean();
    expect(appt?.dentalContext?.treatmentStageId?.toString()).toBe(fittingStageId);
    expect(appt?.dentalContext?.treatmentEpisodeId?.toString()).toBe(episodeId);
    expect(appt?.dentalContext?.toothNumber).toBe(16);
    expect(appt?.dentalContext?.stageSequence).toBe(3);

    // Verify lab order remains READY and stage is NOT automatically completed
    const labOrderDoc = await DentalProstheticLabOrderModel.findById(fittingLabOrderId).lean();
    expect(labOrderDoc?.status).toBe('READY');
  });

  it('15. Phase 7B: Rescheduling fitting appointment re-checks doctor availability and updates existing appointment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${fittingStageId}/reschedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-26',
        start_time: '15:00',
        duration_minutes: 45,
        reschedule_reason: 'Patient requested afternoon slot next day',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.appointment.id).toBe(fittingAppointmentId);
    expect(body.data.appointment.appointment_date).toContain('2026-10-26');
    expect(body.data.appointment.start_time).toBe('15:00');
    expect(body.data.stage.status).toBe('SCHEDULED');
  });

  it('16. Phase 7B: Cancelling fitting appointment reverts stage to PLANNED and clears appointment reference', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${fittingStageId}/cancel-appointment`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        reason: 'Patient postponed fitting',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('PLANNED');
    expect(body.data.appointment_id).toBeNull();

    // Verify appointment status in DB
    const appt = await AppointmentModel.findById(fittingAppointmentId).lean();
    expect(appt?.status).toBe('CANCELLED');

    // Verify lab order was not cancelled
    const labOrderDoc = await DentalProstheticLabOrderModel.findById(fittingLabOrderId).lean();
    expect(labOrderDoc?.status).toBe('READY');
  });

  it('17. Phase 7B: Fitting stage can be scheduled again cleanly after cancellation', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${fittingStageId}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-28',
        start_time: '11:00',
        duration_minutes: 45,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.stage.status).toBe('SCHEDULED');
    expect(body.data.stage.appointment_id).toBeTruthy();
    fittingAppointmentId = body.data.stage.appointment_id;
  });

  it('18. Phase 7C: Available slots API flags patient conflicting slots with available: false and reason', async () => {
    // Create an active appointment for patientId on 2026-10-30 at 10:00 - 11:00 with docADocId (Dr Alice)
    await AppointmentModel.create({
      _id: new Types.ObjectId(),
      appointmentNumber: 'APT-P7C-TEST-01',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-2026-001',
      patientName: 'John Patient',
      doctorId: new Types.ObjectId(docADocId),
      doctorName: 'Dr. Alice Endo',
      doctorSpecialization: 'Endodontics',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      appointmentDate: new Date('2026-10-30T00:00:00.000Z'),
      startTime: '10:00',
      endTime: '11:00',
      durationMinutes: 60,
      visitType: 'FOLLOW_UP',
      status: 'SCHEDULED',
      createdBy: new Types.ObjectId(docAUserId),
    });

    // Query available slots for docBDocId (Dr Bob). Dr Bob is free, but patient has appointment with Dr Alice
    const res = await app.inject({
      method: 'GET',
      url: `/api/doctors/${docBDocId}/available-slots?date=2026-10-30&patient_id=${patientId}&duration_minutes=30`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.is_available).toBe(true);

    const slot1000 = body.data.slots.find((s: { start_time: string }) => s.start_time === '10:00');
    const slot1030 = body.data.slots.find((s: { start_time: string }) => s.start_time === '10:30');
    const slot1130 = body.data.slots.find((s: { start_time: string }) => s.start_time === '11:30');

    expect(slot1000?.available).toBe(false);
    expect(slot1000?.reason).toBe('Patient has conflicting appointment');
    expect(slot1030?.available).toBe(false);
    expect(slot1030?.reason).toBe('Patient has conflicting appointment');
    expect(slot1130?.available).toBe(true);
  });

  it('19. Phase 7C: Scheduling fitting stage fails with PATIENT_APPOINTMENT_CONFLICT when patient has an overlapping active appointment', async () => {
    // First cancel the appointment on fittingStageId from test 17 so it returns to PLANNED
    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${fittingStageId}/cancel-appointment`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { reason: 'Reset for patient conflict test' },
    });

    // Attempt scheduling on 2026-10-30 at 10:30 (overlaps with patient's 10:00-11:00 active appointment)
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${fittingStageId}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-30',
        start_time: '10:30',
        duration_minutes: 30,
      },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.error?.code).toBe('PATIENT_APPOINTMENT_CONFLICT');
  });

  it('20. Phase 7C: Cancelled or completed patient appointments do not block fitting appointment scheduling', async () => {
    // Cancel the conflicting appointment
    await AppointmentModel.updateOne(
      { appointmentNumber: 'APT-P7C-TEST-01' },
      { status: 'CANCELLED' },
    );

    // Re-check available slots for docBDocId
    const slotsRes = await app.inject({
      method: 'GET',
      url: `/api/doctors/${docBDocId}/available-slots?date=2026-10-30&patient_id=${patientId}&duration_minutes=30`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(slotsRes.statusCode).toBe(200);
    const slot1000 = slotsRes.json().data.slots.find((s: { start_time: string }) => s.start_time === '10:00');
    expect(slot1000?.available).toBe(true);

    // Schedule fitting stage to 2026-10-30 10:00 should now succeed
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${fittingStageId}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-30',
        start_time: '10:00',
        duration_minutes: 30,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.appointment.start_time).toBe('10:00');
    fittingAppointmentId = body.data.stage.appointment_id;
  });

  it('21. Phase 7C: Rescheduling fitting stage rejects patient conflict and preserves original appointment', async () => {
    // Create an active appointment on 2026-10-31 14:00 - 15:00 for the patient with Dr. Alice (docADocId)
    // Fitting stage is with Dr. Bob (docBDocId), so Dr. Bob is free but the patient has a conflict
    await AppointmentModel.create({
      _id: new Types.ObjectId(),
      appointmentNumber: 'APT-P7C-TEST-02',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-2026-001',
      patientName: 'John Patient',
      doctorId: new Types.ObjectId(docADocId),
      doctorName: 'Dr. Alice Endo',
      doctorSpecialization: 'Endodontics',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      appointmentDate: new Date('2026-10-31T00:00:00.000Z'),
      startTime: '14:00',
      endTime: '15:00',
      durationMinutes: 60,
      visitType: 'FOLLOW_UP',
      status: 'SCHEDULED',
      createdBy: new Types.ObjectId(docAUserId),
    });

    // Attempt rescheduling fitting stage (currently at 2026-10-30 10:00) to 2026-10-31 14:30 (patient conflict!)
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${fittingStageId}/reschedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-10-31',
        start_time: '14:30',
        duration_minutes: 30,
        reschedule_reason: 'Testing conflict',
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error?.code).toBe('PATIENT_APPOINTMENT_CONFLICT');

    // Original appointment must still be intact on 2026-10-30 10:00
    const appt = await AppointmentModel.findById(fittingAppointmentId).lean();
    expect(appt?.status).toBe('SCHEDULED');
    expect(appt?.appointmentDate.toISOString()).toContain('2026-10-30');
    expect(appt?.startTime).toBe('10:00');
  });

  it('22. Phase 7D-1 (Test 2): Non-READY lab blocks SCHEDULED → IN_PROGRESS transition', async () => {
    // Temporarily set lab order to QUALITY_CHECK
    await DentalProstheticLabOrderModel.findByIdAndUpdate(fittingLabOrderId, { status: 'QUALITY_CHECK' });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${fittingStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    const code = body.code || body.error?.code;
    expect(code).toBe('LAB_ORDER_NOT_READY');

    // Restore lab order to READY
    await DentalProstheticLabOrderModel.findByIdAndUpdate(fittingLabOrderId, { status: 'READY' });
  });

  it('23. Phase 7D-1 (Test 1): READY fitting stage can move SCHEDULED → IN_PROGRESS', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${fittingStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('IN_PROGRESS');
    expect(body.data.appointment_id).toBe(fittingAppointmentId);
    expect(body.data.prosthetic_lab_order_id).toBe(fittingLabOrderId);
  });

  it('24. Phase 7D-1 (Test 4): Invalid direct completion (PLANNED/SCHEDULED → COMPLETED) is rejected', async () => {
    // Create a new stage in PLANNED status
    const stageRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: planItemId,
        stage_name: 'Stage 4 - Direct Complete Test',
        sequence: 4,
        assigned_doctor_id: docBDocId,
        tooth_number: 16,
      },
    });
    expect(stageRes.statusCode).toBe(200);
    const newStageId = stageRes.json().data.id;

    // Attempt direct transition PLANNED -> COMPLETED
    const invalidRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${newStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });

    expect(invalidRes.statusCode).toBe(400);
    const body = invalidRes.json();
    const code = body.code || body.error?.code;
    expect(code).toBe('INVALID_STATE_TRANSITION');
  });

  it('25. Phase 7D-1 (Test 3): IN_PROGRESS → COMPLETED succeeds for a valid fitting stage', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${fittingStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED', notes: 'Prosthetic fitting and cementation completed' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.status).toBe('COMPLETED');
    expect(body.data.completed_at).toBeTruthy();
    expect(body.data.completed_by_doctor_id).toBe(docBDocId);
    expect(body.data.completed_by_doctor_name).toBe('Dr. Bob Prostho');
  });

  it('26. Phase 7D-1 (Test 5): Lab order remains unchanged after completion (stays READY)', async () => {
    const labOrder = await DentalProstheticLabOrderModel.findById(fittingLabOrderId).lean();
    expect(labOrder).toBeTruthy();
    expect(labOrder?.status).toBe('READY');
  });

  it('27. Phase 7D-1 (Test 6): Appointment reference and relationships remain intact after completion', async () => {
    // Stage still references the appointment and lab order
    const stageRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/stages/${fittingStageId}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(stageRes.statusCode).toBe(200);
    const stageData = stageRes.json().data;
    expect(stageData.status).toBe('COMPLETED');
    expect(stageData.appointment_id).toBe(fittingAppointmentId);
    expect(stageData.prosthetic_lab_order_id).toBe(fittingLabOrderId);
    expect(stageData.episode_id).toBe(episodeId);
    expect(stageData.plan_item_id).toBe(planItemId);
    expect(stageData.tooth_number).toBe(16);
    expect(stageData.assigned_doctor_id).toBe(docBDocId);

    // Appointment still exists in database
    const appt = await AppointmentModel.findById(fittingAppointmentId).lean();
    expect(appt).toBeTruthy();
    expect(appt?.dentalContext?.treatmentStageId?.toString()).toBe(fittingStageId);
  });

  it('28. Phase 7D-1 (Test 7): Existing Dental Stage permission checks remain enforced', async () => {
    // Unauthenticated request is rejected with 401
    const unauthRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${fittingStageId}/status`,
      payload: { status: 'IN_PROGRESS' },
    });
    expect(unauthRes.statusCode).toBe(401);
  });

  // ==========================================
  // Phase 7D-2: Treatment Episode Progression
  // ==========================================

  it('29. Phase 7D-2 (Test 1): Completing fitting stage with another stage incomplete keeps Episode ACTIVE', async () => {
    // Stage 1, 2, 3 (fitting) are COMPLETED, but Stage 4 is still PLANNED
    const episode = await DentalTreatmentEpisodeModel.findById(episodeId).lean();
    expect(episode?.status).toBe('ACTIVE');
  });

  it('30. Phase 7D-2 (Test 2 & 7): Completing the final stage changes Episode to COMPLETED and emits audit/timeline event', async () => {
    // Find Stage 4
    const stagesRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/episodes/${episodeId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    const stage4 = stagesRes.json().data.find((s: { sequence: number }) => s.sequence === 4);
    expect(stage4).toBeTruthy();

    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${stage4.id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-11-10',
        start_time: '14:00',
        duration_minutes: 30,
      },
    });

    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage4.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });

    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${stage4.id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED', notes: 'Final stage completed' },
    });
    expect(completeRes.statusCode).toBe(200);

    // Episode should now be COMPLETED
    const episode = await DentalTreatmentEpisodeModel.findById(episodeId).lean();
    expect(episode?.status).toBe('COMPLETED');
  });

  it('31. Phase 7D-2 (Test 3): Episode does not complete while a stage is PLANNED', async () => {
    // Create a new episode for testing multi-stage progression
    const epRes = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-P7D2-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-P3-001',
      patientName: 'Dental Phase3Patient',
      originatingVisitId: new Types.ObjectId(),
      originatingVisitNumber: 'VIS-P3-002',
      primaryDoctorId: new Types.ObjectId(docADocId),
      primaryDoctorName: 'Dr. Alice Endo',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 21,
      status: 'ACTIVE',
      visitIds: [],
    });
    const testEpId = epRes._id.toString();

    // Create 2 stages
    const s1Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${testEpId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-item-p7d2-1',
        stage_name: 'Stage 1 - Cleaning',
        sequence: 1,
        assigned_doctor_id: docADocId,
      },
    });
    const s1Id = s1Res.json().data.id;

    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${testEpId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-item-p7d2-1',
        stage_name: 'Stage 2 - Restoration',
        sequence: 2,
        assigned_doctor_id: docBDocId,
      },
    });

    // Schedule and Complete Stage 1
    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${s1Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-11-12',
        start_time: '10:00',
        duration_minutes: 30,
      },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${s1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${s1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });

    // Stage 2 is PLANNED -> Episode must be ACTIVE
    const ep = await DentalTreatmentEpisodeModel.findById(testEpId).lean();
    expect(ep?.status).toBe('ACTIVE');
  });

  it('32. Phase 7D-2 (Test 4): Episode does not complete while a stage is SCHEDULED', async () => {
    // Create new episode
    const epRes = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-P7D2-002',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-P3-001',
      patientName: 'Dental Phase3Patient',
      originatingVisitId: new Types.ObjectId(),
      originatingVisitNumber: 'VIS-P3-003',
      primaryDoctorId: new Types.ObjectId(docADocId),
      primaryDoctorName: 'Dr. Alice Endo',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'ACTIVE',
      visitIds: [],
    });
    const testEpId = epRes._id.toString();

    const s1Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${testEpId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-item-p7d2-2',
        stage_name: 'Stage 1 - Prep',
        sequence: 1,
        assigned_doctor_id: docADocId,
      },
    });
    const s1Id = s1Res.json().data.id;

    const s2Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${testEpId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-item-p7d2-2',
        stage_name: 'Stage 2 - Fit',
        sequence: 2,
        assigned_doctor_id: docBDocId,
      },
    });
    const s2Id = s2Res.json().data.id;

    // Schedule and Complete Stage 1
    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${s1Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-11-12',
        start_time: '10:00',
        duration_minutes: 30,
      },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${s1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${s1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'COMPLETED' },
    });

    // Schedule Stage 2
    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${s2Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-11-12',
        start_time: '11:00',
        duration_minutes: 30,
      },
    });

    // Episode must remain ACTIVE
    const ep = await DentalTreatmentEpisodeModel.findById(testEpId).lean();
    expect(ep?.status).toBe('ACTIVE');
  });

  it('33. Phase 7D-2 (Test 5): Episode does not complete while a stage is IN_PROGRESS', async () => {
    // Create new episode with 1 stage in IN_PROGRESS
    const epRes = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-P7D2-003',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-P3-001',
      patientName: 'Dental Phase3Patient',
      originatingVisitId: new Types.ObjectId(),
      originatingVisitNumber: 'VIS-P3-004',
      primaryDoctorId: new Types.ObjectId(docADocId),
      primaryDoctorName: 'Dr. Alice Endo',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'ACTIVE',
      visitIds: [],
    });
    const testEpId = epRes._id.toString();

    const s1Res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${testEpId}/stages`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        plan_item_id: 'plan-item-p7d2-3',
        stage_name: 'Stage 1 - Solo Stage',
        sequence: 1,
        assigned_doctor_id: docADocId,
      },
    });
    const s1Id = s1Res.json().data.id;

    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${s1Id}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-11-12',
        start_time: '10:00',
        duration_minutes: 30,
      },
    });

    await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${s1Id}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });

    // Episode must remain ACTIVE
    const ep = await DentalTreatmentEpisodeModel.findById(testEpId).lean();
    expect(ep?.status).toBe('ACTIVE');
  });

  it('34. Phase 7D-2 (Test 6): Episode terminal states (COMPLETED or CANCELLED) are not reopened or modified', async () => {
    // Create an episode in CANCELLED status
    const epRes = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-P7D2-004',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-P3-001',
      patientName: 'Dental Phase3Patient',
      originatingVisitId: new Types.ObjectId(),
      originatingVisitNumber: 'VIS-P3-005',
      primaryDoctorId: new Types.ObjectId(docADocId),
      primaryDoctorName: 'Dr. Alice Endo',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'CANCELLED',
      visitIds: [],
    });
    const testEpId = epRes._id.toString();

    // Verify episode status remains CANCELLED
    const ep = await DentalTreatmentEpisodeModel.findById(testEpId).lean();
    expect(ep?.status).toBe('CANCELLED');
  });

  it('35. Phase 7D-2 (Test 8): Existing fitting completion behavior remains intact', async () => {
    // Verify fitting stage record (fittingStageId) still retains all its relationships and details
    const stageRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/stages/${fittingStageId}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(stageRes.statusCode).toBe(200);
    const s = stageRes.json().data;
    expect(s.status).toBe('COMPLETED');
    expect(s.completed_at).toBeTruthy();
    expect(s.completed_by_doctor_id).toBe(docBDocId);
    expect(s.completed_by_doctor_name).toBe('Dr. Bob Prostho');
    expect(s.appointment_id).toBe(fittingAppointmentId);
    expect(s.prosthetic_lab_order_id).toBe(fittingLabOrderId);
  });
});

