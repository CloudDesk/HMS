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
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Dental Quotation Acceptance -> Treatment Plan Status Sync Integration Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const patientId = createObjectId();
  const doctorUserId = createObjectId();
  const doctorId = createObjectId();

  let episodeId: string;
  let visitId: string;
  let doctorToken: string;

  // Plan item persistent IDs
  const planItemCrownId = new Types.ObjectId().toString();
  const planItemBridgeId = new Types.ObjectId().toString();
  const planItemWisdomId = new Types.ObjectId().toString();
  const planItemUnrelatedId = new Types.ObjectId().toString();

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
      { _id: new Types.ObjectId(branchId), name: 'Main Dental Branch', code: 'MB01', status: 'ACTIVE' },
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
        _id: new Types.ObjectId(doctorUserId),
        username: 'dr_anderson_james_sync',
        email: 'anderson.sync@dental.local',
        passwordHash,
        fullName: 'Dr. Anderson James',
        roleIds: superAdminRole ? [doctorRole._id, superAdminRole._id] : [doctorRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
    ]);

    await DoctorModel.create([
      {
        _id: new Types.ObjectId(doctorId),
        userId: new Types.ObjectId(doctorUserId),
        doctorNumber: 'DOC-AJ-SYNC',
        firstName: 'Anderson',
        lastName: 'James',
        displayName: 'Dr. Anderson James',
        specialization: 'Restorative Dentistry',
        branchId: new Types.ObjectId(branchId),
        departmentId: new Types.ObjectId(dentalDeptId),
        status: 'ACTIVE',
        availability: doctorAvailability,
      },
    ]);

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'PAT-HARISHITHA-001',
      firstName: 'Harishitha',
      lastName: 'S',
      gender: 'FEMALE',
      dateOfBirth: new Date('1995-03-20'),
      primaryContactNumber: '+919876500001',
      branchId: new Types.ObjectId(branchId),
      bloodGroup: 'A+',
    });

    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-SYNC-0001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-HARISHITHA-001',
      patientName: 'Harishitha S',
      patientGender: 'FEMALE',
      patientDateOfBirth: new Date('1995-03-20'),
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dr. Anderson James',
      doctorSpecialization: 'Restorative Dentistry',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Surgery',
      branchId: new Types.ObjectId(branchId),
      queueNumber: 'D-01',
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-23'),
      checkInTime: new Date('2026-09-23T09:00:00Z'),
    });
    visitId = visit._id.toString();

    // Treatment Episode for Tooth #61
    const episode = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-2026-00003',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-HARISHITHA-001',
      patientName: 'Harishitha S',
      originatingVisitId: new Types.ObjectId(visitId),
      originatingVisitNumber: 'VIS-SYNC-0001',
      primaryDoctorId: new Types.ObjectId(doctorId),
      primaryDoctorName: 'Dr. Anderson James',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 61,
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visitId)],
      chiefComplaint: 'Tooth 61 evaluation and general treatment plan',
    });
    episodeId = episode._id.toString();

    // Examination with 4 treatment plan procedures in PROPOSED status
    await OpdDentalExaminationModel.create({
      visitId: new Types.ObjectId(visitId),
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-HARISHITHA-001',
      patientName: 'Harishitha S',
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dr. Anderson James',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'DRAFT',
      teeth: [],
      treatmentPlanItems: [
        {
          _id: new Types.ObjectId(planItemCrownId),
          procedureName: 'Crown',
          toothNumber: 63,
          priority: 'ROUTINE',
          estimatedCost: 18000,
          status: 'PROPOSED',
        },
        {
          _id: new Types.ObjectId(planItemBridgeId),
          procedureName: 'Bridge',
          toothNumber: null,
          priority: 'ROUTINE',
          estimatedCost: 40000,
          status: 'PROPOSED',
        },
        {
          _id: new Types.ObjectId(planItemWisdomId),
          procedureName: 'Wisdom Tooth Extraction',
          toothNumber: null,
          priority: 'ROUTINE',
          estimatedCost: 8000,
          status: 'PROPOSED',
        },
        {
          _id: new Types.ObjectId(planItemUnrelatedId),
          procedureName: 'Scaling and Polishing',
          toothNumber: null,
          priority: 'ROUTINE',
          estimatedCost: 3000,
          status: 'PROPOSED',
        },
      ],
    });

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();

    doctorToken = signJwt(
      { sub: doctorUserId, username: 'dr_anderson_james_sync' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  let quotation3OptionsId: string;
  let optionAId: string;

  it('1. Generates quotation DTQ with 3 treatment options (Option A: Crown #63 + Bridge + Wisdom Extraction; Option B: Crown only; Option C: Bridge only)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        notes: '3 Presented treatment options',
        options: [
          {
            name: 'Option A – Recommended',
            description: 'Comprehensive restorative treatment plan',
            sequence: 1,
            items: [
              {
                treatment_plan_item_id: planItemCrownId,
                procedure_name: 'Crown',
                tooth_number: 63,
                quantity: 1,
                unit_price: 18000,
              },
              {
                treatment_plan_item_id: planItemBridgeId,
                procedure_name: 'Bridge',
                tooth_number: null,
                quantity: 1,
                unit_price: 40000,
              },
              {
                treatment_plan_item_id: planItemWisdomId,
                procedure_name: 'Wisdom Tooth Extraction',
                tooth_number: null,
                quantity: 1,
                unit_price: 8000,
              },
            ],
          },
          {
            name: 'Option B – Alternative',
            description: 'Crown only',
            sequence: 2,
            items: [
              {
                treatment_plan_item_id: planItemCrownId,
                procedure_name: 'Crown',
                tooth_number: 63,
                quantity: 1,
                unit_price: 18000,
              },
            ],
          },
          {
            name: 'Option C – Alternative',
            description: 'Bridge only',
            sequence: 3,
            items: [
              {
                treatment_plan_item_id: planItemBridgeId,
                procedure_name: 'Bridge',
                tooth_number: null,
                quantity: 1,
                unit_price: 40000,
              },
            ],
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    quotation3OptionsId = body.data.id;
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.options.length).toBe(3);

    optionAId = body.data.options[0].id;
    expect(body.data.options[1].id).toBeTruthy();
    expect(body.data.options[2].id).toBeTruthy();

    expect(body.data.options[0].total).toBe(66000);
    expect(body.data.options[1].total).toBe(18000);
    expect(body.data.options[2].total).toBe(40000);
  });

  it('2. Pending/Draft quotation does not change treatment-plan procedure status (all remain PROPOSED)', async () => {
    const exam = await OpdDentalExaminationModel.findOne({ visitId: new Types.ObjectId(visitId) }).lean();
    expect(exam).toBeTruthy();
    const items = exam?.treatmentPlanItems ?? [];
    expect(items.length).toBe(4);
    for (const item of items) {
      expect(item.status).toBe('PROPOSED');
    }
  });

  it('3. Rejected quotation does not mark treatment-plan procedures as accepted', async () => {
    // Create another quotation to test rejection
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        options: [
          {
            name: 'Option A – Extraction only',
            items: [
              {
                treatment_plan_item_id: planItemWisdomId,
                procedure_name: 'Wisdom Tooth Extraction',
                tooth_number: null,
                quantity: 1,
                unit_price: 8000,
              },
            ],
          },
        ],
      },
    });
    const quoteToRejectId = createRes.json().data.id;

    // Send then reject
    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quoteToRejectId}/send`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quoteToRejectId}/reject`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { reason: 'Patient declined this quote' },
    });
    expect(rejectRes.statusCode).toBe(200);

    const exam = await OpdDentalExaminationModel.findOne({ visitId: new Types.ObjectId(visitId) }).lean();
    const items = exam?.treatmentPlanItems ?? [];
    const wisdomItem = items.find((it) => it._id?.toString() === planItemWisdomId);
    expect(wisdomItem?.status).toBe('PROPOSED');
  });

  it('4. Send 3-option quotation to patient (DRAFT -> SENT)', async () => {
    const sendRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quotation3OptionsId}/send`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(sendRes.statusCode).toBe(200);
    expect(sendRes.json().data.status).toBe('SENT');
  });

  it('5. Accepting Option A updates ALL 3 included procedures (Crown #63, Bridge, Wisdom Extraction) from PROPOSED -> ACCEPTED', async () => {
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quotation3OptionsId}/accept`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        selected_option_id: optionAId,
        notes: 'Patient accepted Option A - Recommended',
      },
    });

    expect(acceptRes.statusCode).toBe(200);
    const body = acceptRes.json();
    expect(body.data.status).toBe('ACCEPTED');
    expect(body.data.selected_option_id).toBe(optionAId);

    // Verify Treatment Plan in DB
    const exam = await OpdDentalExaminationModel.findOne({ visitId: new Types.ObjectId(visitId) }).lean();
    expect(exam).toBeTruthy();
    const items = exam?.treatmentPlanItems ?? [];

    const crownItem = items.find((it) => it._id?.toString() === planItemCrownId);
    const bridgeItem = items.find((it) => it._id?.toString() === planItemBridgeId);
    const wisdomItem = items.find((it) => it._id?.toString() === planItemWisdomId);
    const unrelatedItem = items.find((it) => it._id?.toString() === planItemUnrelatedId);

    // Crown #63 -> ACCEPTED
    expect(crownItem).toBeTruthy();
    expect(crownItem?.status).toBe('ACCEPTED');
    expect(crownItem?.toothNumber).toBe(63);
    expect(crownItem?.estimatedCost).toBe(18000);

    // Bridge (General) -> ACCEPTED
    expect(bridgeItem).toBeTruthy();
    expect(bridgeItem?.status).toBe('ACCEPTED');
    expect(bridgeItem?.toothNumber).toBeNull();
    expect(bridgeItem?.estimatedCost).toBe(40000);

    // Wisdom Tooth Extraction (General) -> ACCEPTED
    expect(wisdomItem).toBeTruthy();
    expect(wisdomItem?.status).toBe('ACCEPTED');
    expect(wisdomItem?.toothNumber).toBeNull();
    expect(wisdomItem?.estimatedCost).toBe(8000);

    // Unrelated procedure (Scaling) -> remains PROPOSED
    expect(unrelatedItem).toBeTruthy();
    expect(unrelatedItem?.status).toBe('PROPOSED');
    expect(unrelatedItem?.estimatedCost).toBe(3000);
  });

  it('6. Repeated acceptance is idempotent and does not alter statuses or create duplicates', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quotation3OptionsId}/accept`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        selected_option_id: optionAId,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('ACCEPTED');

    const exam = await OpdDentalExaminationModel.findOne({ visitId: new Types.ObjectId(visitId) }).lean();
    expect(exam?.treatmentPlanItems?.length).toBe(4);
  });

  it('7. Single procedure option acceptance: creates new quote with only 1 item and verifies only that item becomes ACCEPTED while others stay untouched', async () => {
    // Reset plan item 4 to PROPOSED
    await OpdDentalExaminationModel.updateOne(
      { visitId: new Types.ObjectId(visitId), 'treatmentPlanItems._id': new Types.ObjectId(planItemUnrelatedId) },
      { $set: { 'treatmentPlanItems.$.status': 'PROPOSED' } },
    );

    const singleQuoteRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        options: [
          {
            name: 'Option A – Scaling Prophylaxis',
            items: [
              {
                treatment_plan_item_id: planItemUnrelatedId,
                procedure_name: 'Scaling and Polishing',
                tooth_number: null,
                quantity: 1,
                unit_price: 3500,
              },
            ],
          },
        ],
      },
    });
    const singleQuoteId = singleQuoteRes.json().data.id;
    const singleOptionId = singleQuoteRes.json().data.options[0].id;

    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${singleQuoteId}/send`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    const acceptSingleRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${singleQuoteId}/accept`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: { selected_option_id: singleOptionId },
    });
    expect(acceptSingleRes.statusCode).toBe(200);

    const exam = await OpdDentalExaminationModel.findOne({ visitId: new Types.ObjectId(visitId) }).lean();
    const scalingItem = exam?.treatmentPlanItems?.find((it) => it._id?.toString() === planItemUnrelatedId);
    expect(scalingItem?.status).toBe('ACCEPTED');
    expect(scalingItem?.estimatedCost).toBe(3500);
  });
});
