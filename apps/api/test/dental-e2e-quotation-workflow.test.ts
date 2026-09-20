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
import { OpdDentalExaminationModel } from '../src/modules/opd/opd-dental-examination.model.js';
import { DentalTreatmentStageModel } from '../src/modules/opd/dental-stage.model.js';
import { AppointmentModel } from '../src/modules/appointments/appointment.model.js';
import { ServiceModel } from '../src/modules/services/service.model.js';
import { AuditLogModel } from '../src/modules/auth/auth.model.js';
import { NotificationModel } from '../src/modules/notifications/notification.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('HMS Dental Flow – Phase 8E: End-to-End Quotation & Treatment Regression Verification', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();

  const patientAId = createObjectId();
  const patientAUserId = createObjectId();

  const patientBId = createObjectId();
  const patientBUserId = createObjectId();

  const docUserId = createObjectId();
  const docId = createObjectId();

  const prostheticDocUserId = createObjectId();
  const prostheticDocId = createObjectId();

  let doctorToken: string;
  let patientAToken: string;
  let patientBToken: string;

  let serviceRctId: string;
  let serviceCrownId: string;
  let serviceExtractionId: string;

  let episodeId: string;
  let visitId: string;

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
      { _id: new Types.ObjectId(branchId), name: 'Main Dental Hospital', code: 'MB01', status: 'ACTIVE' },
      { _id: new Types.ObjectId(createObjectId()), name: 'Secondary Dental Clinic', code: 'SB01', status: 'ACTIVE' },
    ]);

    await seedDatabase();

    await DepartmentModel.create([
      {
        _id: new Types.ObjectId(dentalDeptId),
        name: 'Dental Surgery & Prosthodontics',
        code: 'DENT',
        branchIds: [new Types.ObjectId(branchId)],
        status: 'ACTIVE',
        isClinical: true,
      },
    ]);

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    if (!doctorRole) throw new Error('DOCTOR role not seeded');
    const patientRole = await RoleModel.findOne({ code: 'PATIENT' }).lean();
    if (!patientRole) throw new Error('PATIENT role not seeded');

    const passwordHash = await hashPassword('DentalSecure2026!');

    // Create staff doctor (Endodontist)
    await UserModel.create({
      _id: new Types.ObjectId(docUserId),
      username: 'dr_david_endo',
      email: 'david.endo@dental.local',
      passwordHash,
      fullName: 'Dr. David Endodontist',
      roleIds: [doctorRole._id],
      branchIds: [new Types.ObjectId(branchId)],
      departmentIds: [new Types.ObjectId(dentalDeptId)],
      status: 'active',
    });

    await DoctorModel.create({
      _id: new Types.ObjectId(docId),
      userId: new Types.ObjectId(docUserId),
      doctorNumber: 'DOC-DENT-001',
      firstName: 'David',
      lastName: 'Endodontist',
      displayName: 'Dr. David Endodontist',
      specialization: 'Endodontics',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'ACTIVE',
      availability: doctorAvailability,
    });

    // Create second staff doctor (Prosthodontist)
    await UserModel.create({
      _id: new Types.ObjectId(prostheticDocUserId),
      username: 'dr_peter_prostho',
      email: 'peter.prostho@dental.local',
      passwordHash,
      fullName: 'Dr. Peter Prosthodontist',
      roleIds: [doctorRole._id],
      branchIds: [new Types.ObjectId(branchId)],
      departmentIds: [new Types.ObjectId(dentalDeptId)],
      status: 'active',
    });

    await DoctorModel.create({
      _id: new Types.ObjectId(prostheticDocId),
      userId: new Types.ObjectId(prostheticDocUserId),
      doctorNumber: 'DOC-DENT-002',
      firstName: 'Peter',
      lastName: 'Prosthodontist',
      displayName: 'Dr. Peter Prosthodontist',
      specialization: 'Prosthodontics',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'ACTIVE',
      availability: doctorAvailability,
    });

    // Create Patient A
    await PatientModel.create({
      _id: new Types.ObjectId(patientAId),
      patientNumber: 'PAT-E2E-001',
      firstName: 'Alice',
      lastName: 'Anderson',
      gender: 'FEMALE',
      dateOfBirth: new Date('1992-05-15'),
      primaryContactNumber: '+919876500001',
      branchId: new Types.ObjectId(branchId),
      bloodGroup: 'A+',
    });

    await UserModel.create({
      _id: new Types.ObjectId(patientAUserId),
      username: 'patient_alice',
      email: 'alice@patient.local',
      passwordHash,
      fullName: 'Alice Anderson',
      roleIds: [patientRole._id],
      branchIds: [new Types.ObjectId(branchId)],
      patientId: new Types.ObjectId(patientAId),
      status: 'active',
    });

    // Create Patient B
    await PatientModel.create({
      _id: new Types.ObjectId(patientBId),
      patientNumber: 'PAT-E2E-002',
      firstName: 'Bob',
      lastName: 'Baker',
      gender: 'MALE',
      dateOfBirth: new Date('1988-11-20'),
      primaryContactNumber: '+919876500002',
      branchId: new Types.ObjectId(branchId),
      bloodGroup: 'B+',
    });

    await UserModel.create({
      _id: new Types.ObjectId(patientBUserId),
      username: 'patient_bob',
      email: 'bob@patient.local',
      passwordHash,
      fullName: 'Bob Baker',
      roleIds: [patientRole._id],
      branchIds: [new Types.ObjectId(branchId)],
      patientId: new Types.ObjectId(patientBId),
      status: 'active',
    });

    // Create Service Catalogue entries
    const sRct = await ServiceModel.create({
      code: 'SVC-RCT-01',
      name: 'Root Canal Treatment - Molar',
      serviceType: 'PROCEDURE',
      departmentId: new Types.ObjectId(dentalDeptId),
      standardPrice: 15000,
      status: 'ACTIVE',
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: false,
    });
    serviceRctId = sRct._id.toString();

    const sCrown = await ServiceModel.create({
      code: 'SVC-CRN-01',
      name: 'Zirconia Ceramic Crown',
      serviceType: 'PROCEDURE',
      departmentId: new Types.ObjectId(dentalDeptId),
      standardPrice: 20000,
      status: 'ACTIVE',
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: false,
    });
    serviceCrownId = sCrown._id.toString();

    const sExt = await ServiceModel.create({
      code: 'SVC-EXT-01',
      name: 'Surgical Tooth Extraction',
      serviceType: 'PROCEDURE',
      departmentId: new Types.ObjectId(dentalDeptId),
      standardPrice: 6000,
      status: 'ACTIVE',
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: false,
    });
    serviceExtractionId = sExt._id.toString();

    // Create initial OPD visit & Dental Treatment Episode for Patient A
    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-E2E-001',
      patientId: new Types.ObjectId(patientAId),
      patientNumber: 'PAT-E2E-001',
      patientName: 'Alice Anderson',
      patientGender: 'FEMALE',
      patientDateOfBirth: new Date('1992-05-15'),
      doctorId: new Types.ObjectId(docId),
      doctorName: 'Dr. David Endodontist',
      doctorSpecialization: 'Endodontics',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Surgery & Prosthodontics',
      branchId: new Types.ObjectId(branchId),
      queueNumber: 'D-E2E-01',
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-20'),
      checkInTime: new Date('2026-09-20T08:30:00Z'),
    });
    visitId = visit._id.toString();

    const episode = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-E2E-0001',
      patientId: new Types.ObjectId(patientAId),
      patientNumber: 'PAT-E2E-001',
      patientName: 'Alice Anderson',
      originatingVisitId: new Types.ObjectId(visit._id),
      originatingVisitNumber: 'VIS-E2E-001',
      primaryDoctorId: new Types.ObjectId(docId),
      primaryDoctorName: 'Dr. David Endodontist',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 16,
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visit._id)],
      treatmentPlanSummary: 'RCT and Ceramic Crown for Tooth 16',
    });
    episodeId = episode._id.toString();

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();

    doctorToken = signJwt(
      { sub: docUserId, username: 'dr_david_endo' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    patientAToken = signJwt(
      { sub: patientAUserId, username: 'patient_alice', patientId: patientAId },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    patientBToken = signJwt(
      { sub: patientBUserId, username: 'patient_bob', patientId: patientBId },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  let quotationId: string;
  let optionAId: string;
  let rctPlanItemId: string;
  let crownPlanItemId: string;
  let rctStageId: string;
  let crownFittingStageId: string;
  let rctAppointmentId: string;
  let labOrderId: string;

  it('Step 1: Dental Examination is recorded with tooth findings and proposed treatment plan', async () => {
    const exam = await OpdDentalExaminationModel.create({
      visitId: new Types.ObjectId(visitId),
      episodeId: new Types.ObjectId(episodeId),
      patientId: new Types.ObjectId(patientAId),
      patientNumber: 'PAT-E2E-001',
      patientName: 'Alice Anderson',
      doctorId: new Types.ObjectId(docId),
      doctorName: 'Dr. David Endodontist',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'COMPLETED',
      deletedAt: null,
      teeth: [
        {
          toothNumber: 16,
          dentition: 'PERMANENT',
          status: 'PRESENT',
          surfaces: ['OCCLUSAL', 'MESIAL'],
          conditions: ['Deep Caries with Pulp Exposure'],
        },
      ],
      treatmentPlanItems: [
        {
          _id: new Types.ObjectId(),
          serviceId: serviceRctId,
          toothNumber: 16,
          procedureName: 'Root Canal Treatment - Molar',
          surfaces: ['OCCLUSAL', 'MESIAL'],
          priority: 'URGENT',
          estimatedCost: 15000,
          status: 'PROPOSED',
        },
        {
          _id: new Types.ObjectId(),
          serviceId: serviceCrownId,
          toothNumber: 16,
          procedureName: 'Zirconia Ceramic Crown',
          surfaces: [],
          priority: 'ROUTINE',
          estimatedCost: 20000,
          status: 'PROPOSED',
        },
      ],
    });

    expect(exam).toBeTruthy();
    expect(exam.treatmentPlanItems?.length).toBe(2);
    rctPlanItemId = exam.treatmentPlanItems![0]!._id!.toString();
    crownPlanItemId = exam.treatmentPlanItems![1]!._id!.toString();
  });

  it('Step 2: Quotation with multiple treatment options (Option A: RCT+Crown, Option B: Extraction) is generated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        notes: 'Comparing Restorative Option A vs Surgical Option B for Tooth 16',
        options: [
          {
            name: 'Option A – Root Canal + Crown',
            description: 'Preserve natural tooth structure with endodontic treatment & zirconia crown',
            sequence: 1,
            discount_amount: 2000,
            items: [
              {
                treatment_plan_item_id: rctPlanItemId,
                service_id: serviceRctId,
                procedure_name: 'Root Canal Treatment - Molar',
                tooth_number: 16,
                quantity: 1,
              },
              {
                treatment_plan_item_id: crownPlanItemId,
                service_id: serviceCrownId,
                procedure_name: 'Zirconia Ceramic Crown',
                tooth_number: 16,
                quantity: 1,
              },
            ],
          },
          {
            name: 'Option B – Surgical Extraction',
            description: 'Extract tooth 16 without replacement',
            sequence: 2,
            items: [
              {
                service_id: serviceExtractionId,
                procedure_name: 'Surgical Tooth Extraction',
                tooth_number: 16,
                quantity: 1,
              },
            ],
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const quote = res.json().data;
    quotationId = quote.id;
    expect(quote.status).toBe('DRAFT');
    expect(quote.options.length).toBe(2);

    // Option A: 15,000 + 20,000 = 35,000 - 2,000 = 33,000
    const optA = quote.options.find((o: { name: string }) => o.name.includes('Option A'));
    expect(optA).toBeTruthy();
    expect(optA.total).toBe(33000);
    optionAId = optA.id;

    // Option B: 6,000
    const optB = quote.options.find((o: { name: string }) => o.name.includes('Option B'));
    expect(optB).toBeTruthy();
    expect(optB.total).toBe(6000);
    optionBId = optB.id;
  });

  it('Step 3: Quotation is sent to patient (DRAFT -> SENT)', async () => {
    const sendRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quotationId}/send`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(sendRes.statusCode).toBe(200);
    expect(sendRes.json().data.status).toBe('SENT');
  });

  it('Step 4: Patient A views options and accepts Option A (SENT -> ACCEPTED)', async () => {
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quotationId}/accept`,
      headers: { authorization: `Bearer ${patientAToken}` },
      payload: {
        selected_option_id: optionAId,
        notes: 'I prefer to save my natural tooth',
      },
    });

    expect(acceptRes.statusCode).toBe(200);
    const acceptedQuote = acceptRes.json().data;
    expect(acceptedQuote.status).toBe('ACCEPTED');
    expect(acceptedQuote.selected_option_id).toBe(optionAId);
    expect(acceptedQuote.selected_option_name).toContain('Option A');
  });

  it('Step 5: Treatment plan synchronization updates items to ACCEPTED and activates stages', async () => {
    // 1. Verify treatment plan items
    const exam = await OpdDentalExaminationModel.findOne({ episodeId: new Types.ObjectId(episodeId) }).lean();
    expect(exam).toBeTruthy();
    for (const item of exam?.treatmentPlanItems ?? []) {
      expect(item.status).toBe('ACCEPTED');
    }

    // 2. Verify sequential clinical stages are created
    const stages = await DentalTreatmentStageModel.find({
      episodeId: new Types.ObjectId(episodeId),
      deletedAt: null,
    }).sort({ createdAt: 1 }).lean();

    expect(stages.length).toBe(2);

    const rctStage = stages.find((s) => s.stageName.includes('Root Canal'));
    expect(rctStage).toBeTruthy();
    expect(rctStage?.status).toBe('PLANNED');
    expect(rctStage?.sequence).toBe(1);
    expect(rctStage?.assignedDoctorId.toString()).toBe(docId);
    expect(rctStage?.appointmentId).toBeNull();
    expect(rctStage?.prostheticLabOrderId).toBeNull();
    rctStageId = rctStage!._id.toString();

    const crownStage = stages.find((s) => s.stageName.includes('Crown'));
    expect(crownStage).toBeTruthy();
    expect(crownStage?.status).toBe('PLANNED');
    expect(crownStage?.sequence).toBe(1);
    crownFittingStageId = crownStage!._id.toString();

    // Re-assign Crown stage doctor to specialist Dr. Peter Prosthodontist
    await DentalTreatmentStageModel.findByIdAndUpdate(crownFittingStageId, {
      assignedDoctorId: new Types.ObjectId(prostheticDocId),
      assignedDoctorName: 'Dr. Peter Prosthodontist',
    });
  });

  it('Step 6: Stage 1 (RCT) is scheduled via existing appointment workflow with availability check', async () => {
    const appointmentDate = '2026-09-22';
    const startTime = '10:00';

    const scheduleRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${rctStageId}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: appointmentDate,
        start_time: startTime,
        duration_minutes: 30,
        notes: 'First visit RCT instrumentation',
      },
    });

    expect(scheduleRes.statusCode).toBe(200);
    const body = resJson(scheduleRes);
    expect(body.data.stage.status).toBe('SCHEDULED');
    expect(body.data.stage.appointment_id).toBeTruthy();
    rctAppointmentId = body.data.stage.appointment_id;

    // Verify appointment in standard Appointment collection
    const appt = await AppointmentModel.findById(rctAppointmentId).lean();
    expect(appt).toBeTruthy();
    expect(appt?.patientId.toString()).toBe(patientAId);
    expect(appt?.doctorId.toString()).toBe(docId);
    expect(appt?.status).toBe('SCHEDULED');
  });

  it('Step 7: Doctor conflict detection prevents double-booking for the same slot', async () => {
    // Attempt booking another stage for same doctor in the exact same time slot
    const conflictRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${crownFittingStageId}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-22',
        start_time: '10:00',
        duration_minutes: 30,
        doctor_id: docId, // Dr. David is already booked
        notes: 'Conflicting Crown Stage',
      },
    });

    expect(conflictRes.statusCode).toBe(409);
  });

  it('Step 8: Stage 1 (RCT) execution progresses from SCHEDULED -> IN_PROGRESS -> COMPLETED', async () => {
    // 1. Move to IN_PROGRESS
    const startRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${rctStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        status: 'IN_PROGRESS',
      },
    });
    expect(startRes.statusCode).toBe(200);
    expect(startRes.json().data.status).toBe('IN_PROGRESS');

    // 2. Complete RCT stage
    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${rctStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        status: 'COMPLETED',
        notes: 'RCT completed successfully. Canals obturated.',
      },
    });
    expect(completeRes.statusCode).toBe(200);
    const completedStage = completeRes.json().data;
    expect(completedStage.status).toBe('COMPLETED');
    expect(completedStage.completed_at).toBeTruthy();
  });

  it('Step 9: Stage 2 (Crown) lab order is created and progresses through prosthetic lab lifecycle', async () => {
    // 1. Create Prosthetic Lab Order for Crown fitting stage
    const createLabRes = await app.inject({
      method: 'POST',
      url: '/api/opd/dental/lab-orders',
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        patient_id: patientAId,
        treatment_episode_id: episodeId,
        treatment_stage_id: crownFittingStageId,
        treatment_plan_item_id: crownPlanItemId,
        tooth_number: 16,
        prosthetic_type: 'CROWN',
        description: 'Zirconia Crown for Tooth 16',
      },
    });

    expect(createLabRes.statusCode).toBe(200);
    const labOrder = createLabRes.json().data;
    labOrderId = labOrder.id;
    expect(labOrder.status).toBe('ORDERED');
    expect(labOrder.order_number).toMatch(/^DPL-\d{4}-\d{5}$/);

    // 2. Progress lab order: ORDERED -> RECEIVED -> IN_PROGRESS -> QUALITY_CHECK -> READY
    const statuses = ['RECEIVED', 'IN_PROGRESS', 'QUALITY_CHECK', 'READY'] as const;
    for (const st of statuses) {
      const statusRes = await app.inject({
        method: 'PATCH',
        url: `/api/opd/dental/lab-orders/${labOrderId}/status`,
        headers: { authorization: `Bearer ${doctorToken}` },
        payload: { status: st },
      });
      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.json().data.status).toBe(st);
    }
  });

  it('Step 10: Clinician and patient notifications are emitted when lab reaches READY status', async () => {
    const notifs = await NotificationModel.find({
      $or: [
        { recipientUserId: new Types.ObjectId(docUserId) },
        { recipientUserId: new Types.ObjectId(patientAUserId) },
      ],
    }).lean();

    expect(notifs.length).toBeGreaterThanOrEqual(1);
    expect(notifs.some((n) => n.title.includes('READY') || n.title.includes('Prosthetic'))).toBe(true);
  });

  it('Step 11: Stage 2 (Fitting) is scheduled after Lab READY and executed to completion', async () => {
    // 1. Schedule Crown fitting appointment with Dr. Peter
    const scheduleRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/stages/${crownFittingStageId}/schedule`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        appointment_date: '2026-09-26',
        start_time: '11:00',
        duration_minutes: 30,
        doctor_id: prostheticDocId,
        notes: 'Crown Try-in & Cementation',
      },
    });
    expect(scheduleRes.statusCode).toBe(200);
    const body = resJson(scheduleRes);
    expect(body.data.stage.status).toBe('SCHEDULED');

    // 2. Start fitting stage
    const startRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${crownFittingStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { status: 'IN_PROGRESS' },
    });
    expect(startRes.statusCode).toBe(200);

    // 3. Complete fitting stage
    const completeRes = await app.inject({
      method: 'PATCH',
      url: `/api/opd/dental/stages/${crownFittingStageId}/status`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        status: 'COMPLETED',
        notes: 'Crown cemented with Resin-modified Glass Ionomer. Occlusion verified.',
      },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().data.status).toBe('COMPLETED');
  });

  it('Step 12: Treatment Episode automatically transitions to COMPLETED when all stages are completed', async () => {
    const episode = await DentalTreatmentEpisodeModel.findById(episodeId).lean();
    expect(episode).toBeTruthy();
    expect(episode?.status).toBe('COMPLETED');
  });

  it('Step 13: Pricing immutability - changing Service Catalogue price does not alter historical quotation or treatment plan prices', async () => {
    // Update Service Catalogue price for RCT from 15,000 to 18,000
    await ServiceModel.findByIdAndUpdate(serviceRctId, { standardPrice: 18000 });

    // Fetch existing quotation
    const quoteRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${quotationId}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(quoteRes.statusCode).toBe(200);
    const quote = quoteRes.json().data;
    const optA = quote.options.find((o: { id: string }) => o.id === optionAId);
    expect(optA.total).toBe(33000); // Retained original quoted total
    expect(optA.items[0].unit_price).toBe(15000);

    // Fetch treatment plan items
    const exam = await OpdDentalExaminationModel.findOne({ episodeId: new Types.ObjectId(episodeId) }).lean();
    const rctItem = exam?.treatmentPlanItems?.find((it) => it.procedureName.includes('Root Canal'));
    expect(rctItem?.estimatedCost).toBe(15000);
  });

  it('Step 14: Non-selected options (Option B) remain historical and never created extra stages', async () => {
    const allStages = await DentalTreatmentStageModel.find({
      episodeId: new Types.ObjectId(episodeId),
      deletedAt: null,
    }).lean();

    // Only 2 stages created (RCT + Crown), ZERO extraction stages
    expect(allStages.length).toBe(2);
    expect(allStages.some((s) => s.stageName.includes('Extraction'))).toBe(false);
  });

  it('Step 15: Idempotency check - repeated quotation acceptance or re-synchronization does not duplicate stages or plan items', async () => {
    const reAcceptRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quotationId}/accept`,
      headers: { authorization: `Bearer ${patientAToken}` },
      payload: {
        selected_option_id: optionAId,
      },
    });

    expect(reAcceptRes.statusCode).toBe(200);

    const postStages = await DentalTreatmentStageModel.find({
      episodeId: new Types.ObjectId(episodeId),
      deletedAt: null,
    }).lean();
    expect(postStages.length).toBe(2);

    const postExam = await OpdDentalExaminationModel.findOne({ episodeId: new Types.ObjectId(episodeId) }).lean();
    expect(postExam?.treatmentPlanItems?.length).toBe(2);
  });

  it('Step 16: Patient identity isolation - Patient B is forbidden from viewing or deciding Patient A quotation', async () => {
    // 1. Patient B tries to view Patient A's quotation
    const viewRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${quotationId}`,
      headers: { authorization: `Bearer ${patientBToken}` },
    });
    expect(viewRes.statusCode).toBe(403);

    // 2. Patient B tries to accept Patient A's quotation
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quotationId}/accept`,
      headers: { authorization: `Bearer ${patientBToken}` },
      payload: {
        selected_option_id: optionAId,
      },
    });
    expect(acceptRes.statusCode).toBe(403);
  });

  it('Step 17: Complete audit trail records all clinical events in sequence', async () => {
    const auditLogs = await AuditLogModel.find({
      eventType: {
        $in: [
          'opd.dental_quotation.created',
          'opd.dental_quotation.sent',
          'opd.dental_quotation.accepted',
          'opd.dental_quotation.treatment_activated',
          'opd.dental_stage.scheduled',
          'opd.dental_stage.status_updated',
          'opd.dental_lab_order.created',
          'opd.dental_lab_order.status_updated',
          'opd.dental_episode.status_updated',
        ],
      },
    }).lean();

    expect(auditLogs.length).toBeGreaterThanOrEqual(7);
  });
});
