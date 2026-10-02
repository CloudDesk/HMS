import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';
import { buildApp } from '../src/app.js';
import { setupTestDatabase, teardownTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { DentalTreatmentQuotationModel } from '../src/modules/opd/dental-quotation.model.js';
import { PatientModel } from '../src/modules/patients/patient.model.js';
import { RoleModel } from '../src/modules/roles/role.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { OpdVisitModel } from '../src/modules/opd/opd-visit.model.js';
import { DentalTreatmentEpisodeModel } from '../src/modules/opd/dental-episode.model.js';
import { OpdDentalExaminationModel } from '../src/modules/opd/opd-dental-examination.model.js';
import { PatientAccessGrantModel } from '../src/modules/patient-portal/patient-access-grant.model.js';
import { seedDatabase } from '../src/database/seed.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('HMS Dental Flow – Quotation Send to Patient & Patient Portal Sync Tests', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();

  // Patient A
  const patientAId = createObjectId();
  const patientAUserId = createObjectId();

  // Patient B (for identity isolation checks)
  const patientBId = createObjectId();
  const patientBUserId = createObjectId();

  // Doctor / Staff
  const doctorUserId = createObjectId();
  const doctorId = createObjectId();
  const visitId = createObjectId();
  const episodeId = createObjectId();

  let doctorToken: string;
  let patientAToken: string;
  let patientBToken: string;

  const planItemCrownId = createObjectId();
  const planItemBridgeId = createObjectId();
  const planItemWisdomId = createObjectId();
  const planItemScalingId = createObjectId();
  const planItemUnrelatedId = createObjectId();

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
    const superAdminRole = await RoleModel.findOne({ code: 'SUPER_ADMIN' }).lean();

    const doctorUser = await UserModel.create({
      _id: new Types.ObjectId(doctorUserId),
      branchIds: [new Types.ObjectId(branchId)],
      departmentIds: [new Types.ObjectId(dentalDeptId)],
      username: 'dr_portal_sync',
      email: 'dr_portal_sync@example.com',
      passwordHash: await hashPassword('password123'),
      firstName: 'Dental',
      lastName: 'Surgeon',
      fullName: 'Dental Surgeon',
      roleIds: superAdminRole ? [doctorRole!._id, superAdminRole._id] : [doctorRole!._id],
      status: 'active',
    });

    await DoctorModel.create({
      _id: new Types.ObjectId(doctorId),
      userId: new Types.ObjectId(doctorUserId),
      doctorNumber: 'DOC-PORTAL-01',
      firstName: 'Dental',
      lastName: 'Surgeon',
      displayName: 'Dr. Dental Surgeon',
      specialization: 'Restorative Dentistry',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'ACTIVE',
      availability: [],
    });

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();

    doctorToken = signJwt(
      { sub: doctorUser._id.toString(), username: doctorUser.username },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    // 2. Patient Role
    const patientRole = (await RoleModel.findOne({ code: 'PATIENT' }).lean()) || (await RoleModel.create({
      code: 'PATIENT',
      name: 'Patient Portal Role',
      permissions: [],
      description: 'Patient Portal User',
      isSystem: true,
      status: 'active',
    }));

    // 3. Seed Patient A Record & User
    await PatientModel.create({
      _id: patientAId,
      registrationBranchId: branchId,
      patientNumber: 'PAT-PORTAL-A',
      firstName: 'Alice',
      lastName: 'Smith',
      gender: 'FEMALE',
      dateOfBirth: new Date('1992-05-15'),
      phone: '+254711000001',
      status: 'ACTIVE',
    });

    const userPatientA = await UserModel.create({
      _id: patientAUserId,
      branchIds: [new Types.ObjectId(branchId)],
      patientId: new Types.ObjectId(patientAId),
      username: 'alice_patient',
      email: 'alice@example.com',
      passwordHash: await hashPassword('password123'),
      firstName: 'Alice',
      lastName: 'Smith',
      fullName: 'Alice Smith',
      roleIds: [patientRole._id],
      status: 'active',
    });

    await PatientAccessGrantModel.create({
      userId: userPatientA._id,
      patientId: new Types.ObjectId(patientAId),
      relationship: 'SELF',
      status: 'VERIFIED',
      isPrimary: true,
    });

    patientAToken = signJwt(
      { sub: userPatientA._id.toString(), username: userPatientA.username },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    // 4. Seed Patient B Record & User
    await PatientModel.create({
      _id: patientBId,
      registrationBranchId: branchId,
      patientNumber: 'PAT-PORTAL-B',
      firstName: 'Bob',
      lastName: 'Jones',
      gender: 'MALE',
      dateOfBirth: new Date('1985-08-20'),
      phone: '+254711000002',
      status: 'ACTIVE',
    });

    const userPatientB = await UserModel.create({
      _id: patientBUserId,
      branchIds: [new Types.ObjectId(branchId)],
      patientId: new Types.ObjectId(patientBId),
      username: 'bob_patient',
      email: 'bob@example.com',
      passwordHash: await hashPassword('password123'),
      firstName: 'Bob',
      lastName: 'Jones',
      fullName: 'Bob Jones',
      roleIds: [patientRole._id],
      status: 'active',
    });

    await PatientAccessGrantModel.create({
      userId: userPatientB._id,
      patientId: new Types.ObjectId(patientBId),
      relationship: 'SELF',
      status: 'VERIFIED',
      isPrimary: true,
    });

    patientBToken = signJwt(
      { sub: userPatientB._id.toString(), username: userPatientB.username },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    // 5. Seed Visit & Episode for Patient A
    await OpdVisitModel.create({
      _id: visitId,
      visitNumber: 'VIS-PORTAL-001',
      patientId: new Types.ObjectId(patientAId),
      patientNumber: 'PAT-PORTAL-A',
      patientName: 'Alice Smith',
      patientGender: 'FEMALE',
      patientDateOfBirth: new Date('1992-05-15'),
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dental Surgeon',
      doctorSpecialization: 'General Dentistry',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Surgery',
      branchId: new Types.ObjectId(branchId),
      queueNumber: 'D-01',
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-20'),
      checkInTime: new Date('2026-09-20T09:00:00Z'),
    });

    await DentalTreatmentEpisodeModel.create({
      _id: new Types.ObjectId(episodeId),
      episodeNumber: 'DTE-PORTAL-0001',
      patientId: new Types.ObjectId(patientAId),
      patientNumber: 'PAT-PORTAL-A',
      patientName: 'Alice Smith',
      originatingVisitId: new Types.ObjectId(visitId),
      originatingVisitNumber: 'VIS-PORTAL-001',
      primaryDoctorId: new Types.ObjectId(doctorId),
      primaryDoctorName: 'Dr. Dental Surgeon',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 63,
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visitId)],
      chiefComplaint: 'Tooth pain and missing teeth',
    });

    // 6. Seed Examination with 4 proposed treatment plan items
    await OpdDentalExaminationModel.create({
      visitId: new Types.ObjectId(visitId),
      patientId: new Types.ObjectId(patientAId),
      patientNumber: 'PAT-PORTAL-A',
      patientName: 'Alice Smith',
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dr. Dental Surgeon',
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
  });

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  let quotationId: string;
  let optionAId: string;

  it('1. Internal user creates a multi-option quotation in DRAFT status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        notes: 'Clinical treatment plan options for Alice',
        options: [
          {
            name: 'Option A – Recommended',
            description: 'Comprehensive restorative plan (Crown + Bridge + Extraction)',
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
            name: 'Option B – Phased Plan',
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
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    quotationId = body.data.id;
    optionAId = body.data.options[0].id;

    expect(body.data.status).toBe('DRAFT');
    expect(body.data.quotation_number).toMatch(/^DTQ-\d{4}-\d{5}$/);
    expect(body.data.patient_id).toBe(patientAId.toString());
    expect(body.data.options.length).toBe(2);
    expect(body.data.options[0].total).toBe(66000);
    expect(body.data.options[1].total).toBe(18000);
  });

  it('2. Quotation is initially NOT visible in Patient Portal while in DRAFT status', async () => {
    // Patient A lists their quotations
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/patient/${patientAId}`,
      headers: { authorization: `Bearer ${patientAToken}` },
    });

    expect(listRes.statusCode).toBe(200);
    const body = listRes.json();
    // DRAFT quotation must be hidden from the patient
    expect(body.data.length).toBe(0);

    // Direct GET on draft quotation by patient should return 404
    const singleRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${quotationId}`,
      headers: { authorization: `Bearer ${patientAToken}` },
    });
    expect(singleRes.statusCode).toBe(404);
  });

  it('3. Internal user clicks "Send to Patient" -> backend persists SENT status in database', async () => {
    const sendRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quotationId}/send`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(sendRes.statusCode).toBe(200);
    const body = sendRes.json();
    expect(body.data.status).toBe('SENT');
    expect(body.data.sent_at).toBeTruthy();

    // Verify direct in MongoDB
    const doc = await DentalTreatmentQuotationModel.findById(quotationId).lean();
    expect(doc).toBeTruthy();
    expect(doc?.status).toBe('SENT');
    expect(doc?.sentAt).toBeTruthy();
  });

  it('4. Patient Portal retrieves the quotation after Send to Patient', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/patient/${patientAId}`,
      headers: { authorization: `Bearer ${patientAToken}` },
    });

    expect(listRes.statusCode).toBe(200);
    const body = listRes.json();
    expect(body.data.length).toBe(1);

    const quote = body.data[0];
    expect(quote.id).toBe(quotationId);
    expect(quote.status).toBe('SENT');
    expect(quote.patient_id).toBe(patientAId.toString());
    expect(quote.doctor_id).toBe(doctorId.toString());
    expect(quote.doctor_name).toBe('Dr. Dental Surgeon');
    expect(quote.options.length).toBe(2);

    // Option A details
    expect(quote.options[0].name).toBe('Option A – Recommended');
    expect(quote.options[0].total).toBe(66000);
    expect(quote.options[0].items.length).toBe(3);
    expect(quote.options[0].items[0].procedure_name).toBe('Crown');
    expect(quote.options[0].items[0].tooth_number).toBe(63);
    expect(quote.options[0].items[0].unit_price).toBe(18000);

    // Direct single GET by patient now works
    const singleRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${quotationId}`,
      headers: { authorization: `Bearer ${patientAToken}` },
    });
    expect(singleRes.statusCode).toBe(200);
    expect(singleRes.json().data.id).toBe(quotationId);
  });

  it('5. Security: Patient B cannot retrieve Patient A quotation (403 FORBIDDEN)', async () => {
    // Attempt list
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/patient/${patientAId}`,
      headers: { authorization: `Bearer ${patientBToken}` },
    });
    expect(listRes.statusCode).toBe(403);

    // Attempt single view
    const singleRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${quotationId}`,
      headers: { authorization: `Bearer ${patientBToken}` },
    });
    expect(singleRes.statusCode).toBe(403);

    // Attempt accept
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

  it('6. Lifecycle safety: Attempting to re-send an already SENT quotation returns 400 without corrupting state', async () => {
    const sendAgainRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quotationId}/send`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(sendAgainRes.statusCode).toBe(400);

    // Verify DB remains untouched in SENT state
    const doc = await DentalTreatmentQuotationModel.findById(quotationId).lean();
    expect(doc?.status).toBe('SENT');
    expect(doc?.options.length).toBe(2);

    const count = await DentalTreatmentQuotationModel.countDocuments({
      treatmentEpisodeId: new Types.ObjectId(episodeId),
    });
    expect(count).toBe(1);
  });

  it('7. Patient accepts Option A via Patient Portal -> persists ACCEPTED and syncs treatment plan', async () => {
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quotationId}/accept`,
      headers: { authorization: `Bearer ${patientAToken}` },
      payload: {
        selected_option_id: optionAId,
      },
    });

    expect(acceptRes.statusCode).toBe(200);
    const body = acceptRes.json();
    expect(body.data.status).toBe('ACCEPTED');
    expect(body.data.selected_option_id).toBe(optionAId);
    expect(body.data.selected_option_name).toBe('Option A – Recommended');
    expect(body.data.accepted_at).toBeTruthy();

    // Verify database document
    const doc = await DentalTreatmentQuotationModel.findById(quotationId).lean();
    expect(doc?.status).toBe('ACCEPTED');
    expect(doc?.selectedOptionId?.toString()).toBe(optionAId);

    // Verify Treatment Plan items synchronized in examination
    const exam = await OpdDentalExaminationModel.findOne({ visitId: new Types.ObjectId(visitId) }).lean();
    expect(exam).toBeTruthy();
    const items = exam?.treatmentPlanItems ?? [];

    const crownItem = items.find((i) => i._id?.toString() === planItemCrownId.toString());
    const bridgeItem = items.find((i) => i._id?.toString() === planItemBridgeId.toString());
    const wisdomItem = items.find((i) => i._id?.toString() === planItemWisdomId.toString());
    const scalingItem = items.find((i) => i._id?.toString() === planItemUnrelatedId.toString());

    expect(crownItem?.status).toBe('ACCEPTED');
    expect(bridgeItem?.status).toBe('ACCEPTED');
    expect(wisdomItem?.status).toBe('ACCEPTED');
    expect(scalingItem?.status).toBe('PROPOSED'); // Unrelated procedure remains PROPOSED
  });

  it('8. Internal HMS and Patient Portal both retrieve and display the quotation as ACCEPTED', async () => {
    // Patient portal
    const portalRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/patient/${patientAId}`,
      headers: { authorization: `Bearer ${patientAToken}` },
    });
    expect(portalRes.statusCode).toBe(200);
    const portalQuote = portalRes.json().data[0];
    expect(portalQuote.status).toBe('ACCEPTED');
    expect(portalQuote.selected_option_id).toBe(optionAId);

    // Internal HMS
    const internalRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(internalRes.statusCode).toBe(200);
    const internalQuote = internalRes.json().data[0];
    expect(internalQuote.status).toBe('ACCEPTED');
    expect(internalQuote.selected_option_id).toBe(optionAId);
  });
});
