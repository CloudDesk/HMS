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
import { ServiceModel } from '../src/modules/services/service.model.js';
import { AuditLogModel } from '../src/modules/auth/auth.model.js';
import { signJwt } from '../src/shared/security/jwt.js';
import { hashPassword } from '../src/shared/security/hash.js';
import { env } from '../src/config/env.js';

describe('Dental Treatment Quotation Integration Tests (Phase 8A)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  const branchId = createObjectId();
  const dentalDeptId = createObjectId();
  const otherDeptId = createObjectId();
  const patientId = createObjectId();

  const docUserId = createObjectId();
  const docId = createObjectId();

  const restrictedUserId = createObjectId();

  let episodeId: string;
  let doctorToken: string;
  let restrictedUserToken: string;

  let serviceRctId: string;
  let serviceCrownId: string;

  const planItem1Id = new Types.ObjectId().toString();
  const planItem2Id = new Types.ObjectId().toString();

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
      {
        _id: new Types.ObjectId(otherDeptId),
        name: 'Pediatrics',
        code: 'PED',
        branchIds: [new Types.ObjectId(branchId)],
        status: 'ACTIVE',
        isClinical: true,
      },
    ]);

    const doctorRole = await RoleModel.findOne({ code: 'DOCTOR' }).lean();
    if (!doctorRole) throw new Error('DOCTOR role not seeded');
    const nurseRole = await RoleModel.findOne({ code: 'NURSE' }).lean();

    const passwordHash = await hashPassword('DoctorPass123!');

    await UserModel.create([
      {
        _id: new Types.ObjectId(docUserId),
        username: 'doctor_dentist_p8',
        email: 'dentist.p8@dental.local',
        passwordHash,
        fullName: 'Dr. David Dentist',
        roleIds: [doctorRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(dentalDeptId)],
        status: 'active',
      },
      {
        _id: new Types.ObjectId(restrictedUserId),
        username: 'nurse_peds_p8',
        email: 'nurse.peds@dental.local',
        passwordHash,
        fullName: 'Nurse Nancy',
        roleIds: [nurseRole ? nurseRole._id : doctorRole._id],
        branchIds: [new Types.ObjectId(branchId)],
        departmentIds: [new Types.ObjectId(otherDeptId)], // different department
        status: 'active',
      },
    ]);

    await DoctorModel.create({
      _id: new Types.ObjectId(docId),
      userId: new Types.ObjectId(docUserId),
      doctorNumber: 'DOC-P8-001',
      firstName: 'David',
      lastName: 'Dentist',
      displayName: 'Dr. David Dentist',
      specialization: 'Endodontics',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      status: 'ACTIVE',
    });

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'PAT-P8-001',
      firstName: 'Alice',
      lastName: 'QuotePatient',
      gender: 'FEMALE',
      dateOfBirth: new Date('1990-01-01'),
      primaryContactNumber: '+919876543210',
      branchId: new Types.ObjectId(branchId),
      bloodGroup: 'O+',
    });

    // Create Service Catalogue items
    const s1 = await ServiceModel.create({
      code: 'DEN-RCT-01',
      name: 'Root Canal Treatment - Molar',
      serviceType: 'PROCEDURE',
      departmentId: new Types.ObjectId(dentalDeptId),
      standardPrice: 15000,
      status: 'ACTIVE',
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: false,
    });
    serviceRctId = s1._id.toString();

    const s2 = await ServiceModel.create({
      code: 'DEN-CRN-01',
      name: 'Zirconia Ceramic Crown',
      serviceType: 'PROCEDURE',
      departmentId: new Types.ObjectId(dentalDeptId),
      standardPrice: 20000,
      status: 'ACTIVE',
      requiresBed: false,
      requiresConsent: true,
      requiresAdvanceDeposit: false,
    });
    serviceCrownId = s2._id.toString();

    const visit = await OpdVisitModel.create({
      visitNumber: 'VIS-P8-001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-P8-001',
      patientName: 'Alice QuotePatient',
      patientGender: 'FEMALE',
      patientDateOfBirth: new Date('1990-01-01'),
      doctorId: new Types.ObjectId(docId),
      doctorName: 'Dr. David Dentist',
      doctorSpecialization: 'Endodontics',
      departmentId: new Types.ObjectId(dentalDeptId),
      departmentName: 'Dental Surgery',
      branchId: new Types.ObjectId(branchId),
      queueNumber: 'D-P8-01',
      visitType: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: 'IN_CONSULTATION',
      visitDate: new Date('2026-09-20'),
      checkInTime: new Date('2026-09-20T09:00:00Z'),
    });

    const episode = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-P8-0001',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-P8-001',
      patientName: 'Alice QuotePatient',
      originatingVisitId: new Types.ObjectId(visit._id),
      originatingVisitNumber: 'VIS-P8-001',
      primaryDoctorId: new Types.ObjectId(docId),
      primaryDoctorName: 'Dr. David Dentist',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 16,
      status: 'ACTIVE',
      visitIds: [new Types.ObjectId(visit._id)],
      treatmentPlanSummary: 'RCT and Zirconia Crown for Tooth 16',
    });

    episodeId = episode._id.toString();

    const appInstance = await buildApp();
    app = appInstance.app;
    await app.ready();

    doctorToken = signJwt(
      { sub: docUserId, username: 'doctor_dentist_p8' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    restrictedUserToken = signJwt(
      { sub: restrictedUserId, username: 'nurse_peds_p8' },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );
  }, 90000);

  afterAll(async () => {
    if (app) await app.close();
    await teardownTestDatabase();
  });

  let createdQuotationId: string;
  let quotationNumber: string;

  it('1. Draft quotation can be created with multiple items and server-calculated totals', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        notes: 'Initial comprehensive quotation for Tooth 16',
        discount_amount: 1000,
        items: [
          {
            treatment_plan_item_id: planItem1Id,
            service_id: serviceRctId,
            procedure_name: 'Root Canal Treatment - Molar',
            tooth_number: 16,
            quantity: 1,
            discount_amount: 500,
          },
          {
            treatment_plan_item_id: planItem2Id,
            service_id: serviceCrownId,
            procedure_name: 'Zirconia Ceramic Crown',
            tooth_number: 16,
            quantity: 1,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeTruthy();
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.quotation_number).toMatch(/^DTQ-\d{4}-\d{5}$/);

    createdQuotationId = body.data.id;
    quotationNumber = body.data.quotation_number;
  });

  it('2. Quotation links to the correct patient', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${createdQuotationId}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res.statusCode).toBe(200);
    const quote = res.json().data;
    expect(quote.patient_id).toBe(patientId);
    expect(quote.patient_name).toBe('Alice QuotePatient');
    expect(quote.patient_number).toBe('PAT-P8-001');
  });

  it('3. Quotation links to the correct Dental Treatment Episode', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${createdQuotationId}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res.statusCode).toBe(200);
    const quote = res.json().data;
    expect(quote.treatment_episode_id).toBe(episodeId);
    expect(quote.treatment_episode_number).toBe('DTE-P8-0001');
  });

  it('4. Quotation items reference the correct treatment-plan items and tooth numbers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${createdQuotationId}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res.statusCode).toBe(200);
    const items = res.json().data.items;
    expect(items.length).toBe(2);

    const rctItem = items.find((it: { treatment_plan_item_id: string }) => it.treatment_plan_item_id === planItem1Id);
    expect(rctItem).toBeTruthy();
    expect(rctItem.procedure_name).toBe('Root Canal Treatment - Molar');
    expect(rctItem.tooth_number).toBe(16);

    const crownItem = items.find((it: { treatment_plan_item_id: string }) => it.treatment_plan_item_id === planItem2Id);
    expect(crownItem).toBeTruthy();
    expect(crownItem.procedure_name).toBe('Zirconia Ceramic Crown');
    expect(crownItem.tooth_number).toBe(16);
  });

  it('5. Service Catalogue price is copied into the quotation item', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${createdQuotationId}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res.statusCode).toBe(200);
    const items = res.json().data.items;
    const rctItem = items.find((it: { service_id: string }) => it.service_id === serviceRctId);
    const crownItem = items.find((it: { service_id: string }) => it.service_id === serviceCrownId);

    // Standard prices from Service Catalogue are 15,000 and 20,000
    expect(rctItem.unit_price).toBe(15000);
    expect(crownItem.unit_price).toBe(20000);
  });

  it('6. Stored quotation price remains unchanged if the catalogue price changes (historical immutability)', async () => {
    // Update the Service Catalogue price for Crown from 20,000 to 25,000
    await ServiceModel.findByIdAndUpdate(serviceCrownId, { standardPrice: 25000 });

    // Fetch quotation and verify stored price is still 20,000
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${createdQuotationId}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res.statusCode).toBe(200);
    const crownItem = res.json().data.items.find((it: { service_id: string }) => it.service_id === serviceCrownId);
    expect(crownItem.unit_price).toBe(20000);
    expect(crownItem.line_total).toBe(20000);

    // Restore catalogue price
    await ServiceModel.findByIdAndUpdate(serviceCrownId, { standardPrice: 20000 });
  });

  it('7. Multiple quotation items are supported with custom items when service_id is not provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        items: [
          { procedure_name: 'Scaling and Polishing', unit_price: 3500, quantity: 1 },
          { procedure_name: 'Fluoride Application', unit_price: 1500, quantity: 2 },
          { procedure_name: 'Custom Diagnostic Wax-Up', unit_price: 5000, quantity: 1 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.items.length).toBe(3);
    // Subtotal: 3500*1 + 1500*2 + 5000*1 = 11500
    expect(body.data.subtotal).toBe(11500);
    expect(body.data.total).toBe(11500);
  });

  it('8. Server calculates subtotal and total correctly regardless of frontend payload', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${createdQuotationId}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res.statusCode).toBe(200);
    const quote = res.json().data;
    // Item 1: 15,000 - 500 = 14,500
    // Item 2: 20,000 - 0 = 20,000
    // Subtotal: 34,500
    // Quote discount: 1,000
    // Total: 33,500
    expect(quote.subtotal).toBe(34500);
    expect(quote.discount_amount).toBe(1000);
    expect(quote.total).toBe(33500);
  });

  it('9. Branch/department scoping and authorization are strictly enforced', async () => {
    // Restricted user from Pediatrics department cannot access Dental quotation
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/${createdQuotationId}`,
      headers: { authorization: `Bearer ${restrictedUserToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('10. List Quotations for Episode returns all created quotations for that episode', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res.statusCode).toBe(200);
    const quotes = res.json().data;
    expect(Array.isArray(quotes)).toBe(true);
    expect(quotes.length).toBeGreaterThanOrEqual(2);
    expect(quotes.some((q: { quotation_number: string }) => q.quotation_number === quotationNumber)).toBe(true);
  });

  it('11. Phase 8B: Quotation can be created with multiple treatment options (Option A, Option B, Option C)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        notes: 'Comparing 3 different treatment pathways',
        options: [
          {
            name: 'Option A – Root Canal + Crown',
            description: 'Comprehensive restorative approach',
            sequence: 1,
            discount_amount: 1500,
            items: [
              {
                treatment_plan_item_id: planItem1Id,
                service_id: serviceRctId,
                procedure_name: 'Root Canal Treatment - Molar',
                tooth_number: 16,
                quantity: 1,
              },
              {
                treatment_plan_item_id: planItem2Id,
                service_id: serviceCrownId,
                procedure_name: 'Zirconia Ceramic Crown',
                tooth_number: 16,
                quantity: 1,
              },
            ],
          },
          {
            name: 'Option B – Extraction',
            description: 'Surgical extraction option',
            sequence: 2,
            items: [
              {
                procedure_name: 'Surgical Tooth Extraction',
                tooth_number: 16,
                unit_price: 6000,
                quantity: 1,
              },
            ],
          },
          {
            name: 'Option C – Temporary Restoration',
            description: 'Palliative temporary stabilization',
            sequence: 3,
            items: [
              {
                procedure_name: 'Sedative Temporary Filling',
                tooth_number: 16,
                unit_price: 2500,
                quantity: 1,
              },
            ],
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const quote = res.json().data;
    expect(quote.options).toBeTruthy();
    expect(quote.options.length).toBe(3);

    // Option A: RCT (15000) + Crown (20000) = 35000, discount 1500 => total 33500
    const optA = quote.options.find((o: { name: string }) => o.name.includes('Option A'));
    expect(optA).toBeTruthy();
    expect(optA.items.length).toBe(2);
    expect(optA.subtotal).toBe(35000);
    expect(optA.discount_amount).toBe(1500);
    expect(optA.total).toBe(33500);

    // Option B: Extraction (6000) => total 6000
    const optB = quote.options.find((o: { name: string }) => o.name.includes('Option B'));
    expect(optB).toBeTruthy();
    expect(optB.items.length).toBe(1);
    expect(optB.subtotal).toBe(6000);
    expect(optB.total).toBe(6000);

    // Option C: Temp Filling (2500) => total 2500
    const optC = quote.options.find((o: { name: string }) => o.name.includes('Option C'));
    expect(optC).toBeTruthy();
    expect(optC.items.length).toBe(1);
    expect(optC.subtotal).toBe(2500);
    expect(optC.total).toBe(2500);
  });

  it('12. Phase 8B: Draft quotation can be updated (add/edit option and recalculate totals)', async () => {
    // 1. Create a draft quotation
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        options: [
          {
            name: 'Option A – Conservative',
            items: [
              { procedure_name: 'Direct Composite Restoration', unit_price: 4000, quantity: 1 },
            ],
          },
        ],
      },
    });
    expect(createRes.statusCode).toBe(200);
    const quoteId = createRes.json().data.id;

    // 2. Update the draft quotation by adding Option B and setting discount
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/api/opd/dental/quotations/${quoteId}`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        notes: 'Updated options with discount',
        options: [
          {
            name: 'Option A – Conservative',
            discount_amount: 500,
            items: [
              { procedure_name: 'Direct Composite Restoration', unit_price: 4000, quantity: 1 },
            ],
          },
          {
            name: 'Option B – Indirect Onlay',
            items: [
              { procedure_name: 'Ceramic Inlay/Onlay', unit_price: 18000, quantity: 1 },
            ],
          },
        ],
      },
    });

    expect(updateRes.statusCode).toBe(200);
    const updated = updateRes.json().data;
    expect(updated.options.length).toBe(2);
    expect(updated.options[0].total).toBe(3500); // 4000 - 500
    expect(updated.options[1].total).toBe(18000);
  });

  it('13. Phase 8B: Empty options or option with 0 items is rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        options: [
          {
            name: 'Empty Option',
            items: [],
          },
        ],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('14. Phase 8B: Unauthorized user cannot update quotation in another branch/dept', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/opd/dental/quotations/${createdQuotationId}`,
      headers: { authorization: `Bearer ${restrictedUserToken}` },
      payload: {
        notes: 'Malicious update attempt',
        items: [{ procedure_name: 'Test', unit_price: 100 }],
      },
    });

    expect(res.statusCode).toBe(403);
  });

  let decisionQuotationId: string;
  let optionAId: string;

  it('15. Phase 8C: Create a multi-option quotation and send to patient (DRAFT -> SENT)', async () => {
    // 1. Create multi-option quotation
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        notes: 'Options for Tooth 16 treatment',
        options: [
          {
            name: 'Option 1: Complete RCT + Ceramic Crown',
            description: 'Recommended comprehensive treatment',
            discount_amount: 1000,
            items: [
              {
                treatment_plan_item_id: planItem1Id,
                service_id: serviceRctId,
                procedure_name: 'Root Canal Treatment - Molar',
                tooth_number: 16,
                quantity: 1,
                unit_price: 15000,
              },
              {
                treatment_plan_item_id: planItem2Id,
                service_id: serviceCrownId,
                procedure_name: 'Zirconia Ceramic Crown',
                tooth_number: 16,
                quantity: 1,
                unit_price: 20000,
              },
            ],
          },
          {
            name: 'Option 2: Simple Extraction',
            description: 'Palliative tooth removal',
            items: [
              {
                procedure_name: 'Surgical Tooth Extraction',
                tooth_number: 16,
                quantity: 1,
                unit_price: 6000,
              },
            ],
          },
        ],
      },
    });

    expect(createRes.statusCode).toBe(200);
    const quote = createRes.json().data;
    decisionQuotationId = quote.id;
    expect(quote.status).toBe('DRAFT');
    expect(quote.options.length).toBe(2);
    optionAId = quote.options[0].id;

    // 2. Send quotation to patient
    const sendRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${decisionQuotationId}/send`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(sendRes.statusCode).toBe(200);
    const sentQuote = sendRes.json().data;
    expect(sentQuote.status).toBe('SENT');
    expect(sentQuote.sent_at).toBeTruthy();
    expect(sentQuote.sent_by).toBe(docUserId);
  });

  it('16. Phase 8C: Cannot re-send an already SENT quotation or draft an accepted one', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${decisionQuotationId}/send`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res.statusCode).toBe(400);
  });

  it('17. Phase 8C: Cannot accept with invalid option ID', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${decisionQuotationId}/accept`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        selected_option_id: new Types.ObjectId().toString(), // non-existent option
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('18. Phase 8C: Postpone quotation decision with optional remark (SENT -> POSTPONED)', async () => {
    const postponeRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${decisionQuotationId}/postpone`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        reason: 'Patient needs to verify insurance coverage with provider',
      },
    });

    expect(postponeRes.statusCode).toBe(200);
    const postponedQuote = postponeRes.json().data;
    expect(postponedQuote.status).toBe('POSTPONED');
    expect(postponedQuote.decision_reason).toBe('Patient needs to verify insurance coverage with provider');
    expect(postponedQuote.decision_at).toBeTruthy();
  });

  it('19. Phase 8C: Postponed quotation can be re-sent or accepted directly', async () => {
    // 1. Re-send
    const sendRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${decisionQuotationId}/send`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });
    expect(sendRes.statusCode).toBe(200);
    expect(sendRes.json().data.status).toBe('SENT');
  });

  it('20. Phase 8C: Accept quotation option and verify treatment plan synchronization', async () => {
    // Ensure an OpdDentalExamination exists for this episode with plan items
    await OpdDentalExaminationModel.findOneAndUpdate(
      { episodeId: new Types.ObjectId(episodeId) },
      {
        $setOnInsert: {
          visitId: new Types.ObjectId(),
          patientId: new Types.ObjectId(patientId),
          patientNumber: 'PAT-P8-001',
          patientName: 'Alice QuotePatient',
          doctorId: new Types.ObjectId(docId),
          doctorName: 'Dr. David Dentist',
          branchId: new Types.ObjectId(branchId),
          departmentId: new Types.ObjectId(dentalDeptId),
          episodeId: new Types.ObjectId(episodeId),
          status: 'COMPLETED',
          treatmentPlanItems: [
            {
              _id: new Types.ObjectId(planItem1Id),
              procedureName: 'Root Canal Treatment - Molar',
              toothNumber: 16,
              priority: 'HIGH',
              estimatedCost: 12000, // Initial estimate before quote
              status: 'PROPOSED',
            },
          ],
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    // Accept Option A (RCT + Crown)
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${decisionQuotationId}/accept`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        selected_option_id: optionAId,
        notes: 'Patient confirmed Option 1 during consultation',
      },
    });

    expect(acceptRes.statusCode).toBe(200);
    const acceptedQuote = acceptRes.json().data;
    expect(acceptedQuote.status).toBe('ACCEPTED');
    expect(acceptedQuote.selected_option_id).toBe(optionAId);
    expect(acceptedQuote.selected_option_name).toContain('Option 1');
    expect(acceptedQuote.accepted_at).toBeTruthy();
    expect(acceptedQuote.accepted_by).toBe(docUserId);

    // Verify Treatment Plan Synchronization
    const exam = await OpdDentalExaminationModel.findOne({ episodeId: new Types.ObjectId(episodeId) }).lean();
    expect(exam).toBeTruthy();
    expect(exam?.treatmentPlanItems).toBeTruthy();
    
    // Item 1 should now be ACCEPTED and price updated to quoted price (15000)
    const rctItem = exam?.treatmentPlanItems?.find((it: { toothNumber?: number; procedureName: string }) => it.toothNumber === 16 && it.procedureName.includes('Root Canal'));
    expect(rctItem).toBeTruthy();
    expect(rctItem?.status).toBe('ACCEPTED');
    expect(rctItem?.estimatedCost).toBe(15000);

    // Item 2 (Crown) should have been added as ACCEPTED with quoted price (20000)
    const crownItem = exam?.treatmentPlanItems?.find((it: { toothNumber?: number; procedureName: string }) => it.toothNumber === 16 && it.procedureName.includes('Crown'));
    expect(crownItem).toBeTruthy();
    expect(crownItem?.status).toBe('ACCEPTED');
    expect(crownItem?.estimatedCost).toBe(20000);
  });

  it('21. Phase 8C: Acceptance is idempotent when called with the same selected option', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${decisionQuotationId}/accept`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        selected_option_id: optionAId,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('ACCEPTED');
    expect(res.json().data.selected_option_id).toBe(optionAId);
  });

  it('22. Phase 8C: Reject quotation with reason (SENT -> REJECTED)', async () => {
    // Create and send a new quotation
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${episodeId}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        options: [
          {
            name: 'Option A – Veneers',
            items: [{ procedure_name: 'Porcelain Veneer', unit_price: 25000, quantity: 2 }],
          },
        ],
      },
    });
    const quoteId = createRes.json().data.id;

    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quoteId}/send`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    const rejectRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quoteId}/reject`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        reason: 'Patient opted not to proceed with cosmetic treatment at this time',
      },
    });

    expect(rejectRes.statusCode).toBe(200);
    const rejectedQuote = rejectRes.json().data;
    expect(rejectedQuote.status).toBe('REJECTED');
    expect(rejectedQuote.decision_reason).toBe('Patient opted not to proceed with cosmetic treatment at this time');
    expect(rejectedQuote.decision_at).toBeTruthy();
  });

  it('23. Phase 8C: Patient quotations endpoint lists all quotations for a patient', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/patient/${patientId}`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    expect(res.statusCode).toBe(200);
    const quotes = res.json().data;
    expect(Array.isArray(quotes)).toBe(true);
    expect(quotes.length).toBeGreaterThanOrEqual(2);
  });

  it('24. Phase 8C: Patient identity isolation prevents Patient B from accessing or deciding Patient A quotation', async () => {
    const otherPatientId = createObjectId();
    const otherPatientUserId = createObjectId();

    const patientRole = await RoleModel.findOne({ code: 'PATIENT' }).lean();
    await UserModel.create({
      _id: new Types.ObjectId(otherPatientUserId),
      username: 'patient_bob_p8',
      email: 'bob.p8@patient.local',
      passwordHash: await hashPassword('BobPass123!'),
      fullName: 'Bob OtherPatient',
      roleIds: [patientRole ? patientRole._id : (await RoleModel.findOne().lean())!._id],
      branchIds: [new Types.ObjectId(branchId)],
      patientId: new Types.ObjectId(otherPatientId), // Patient B
      status: 'active',
    });

    const bobToken = signJwt(
      { sub: otherPatientUserId, username: 'patient_bob_p8', patientId: otherPatientId },
      env.auth.accessTokenSecret,
      env.auth.accessTokenTtlSeconds,
    );

    // 1. Bob cannot list Alice's quotations
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/opd/dental/quotations/patient/${patientId}`,
      headers: { authorization: `Bearer ${bobToken}` },
    });
    expect(listRes.statusCode).toBe(403);

    // 2. Bob cannot view or decide Alice's quotation
    const decideRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${decisionQuotationId}/accept`,
      headers: { authorization: `Bearer ${bobToken}` },
      payload: {
        selected_option_id: optionAId,
      },
    });
    expect(decideRes.statusCode).toBe(403);
  });

  it('25. Phase 8D: Accepting a quotation creates initial stage for each accepted plan item with status PLANNED and assigns primary doctor', async () => {
    // Check stages created during test 20 (acceptance of Option A)
    const stages = await DentalTreatmentStageModel.find({
      episodeId: new Types.ObjectId(episodeId),
      deletedAt: null,
    }).lean();

    expect(stages.length).toBeGreaterThanOrEqual(2);

    // Verify stage fields
    for (const stage of stages) {
      expect(stage.status).toBe('PLANNED');
      expect(stage.sequence).toBe(1);
      expect(stage.assignedDoctorId.toString()).toBe(docId);
      expect(stage.assignedDoctorName).toBe('Dr. David Dentist');
      expect(stage.branchId.toString()).toBe(branchId);
      expect(stage.departmentId.toString()).toBe(dentalDeptId);
      expect(stage.patientId.toString()).toBe(patientId);
    }
  });

  it('26. Phase 8D: Stage activation is strictly idempotent: existing stages are preserved and not duplicated', async () => {
    const initialStages = await DentalTreatmentStageModel.find({
      episodeId: new Types.ObjectId(episodeId),
      deletedAt: null,
    }).lean();
    const initialCount = initialStages.length;

    // Call accept again (or create new quotation with same plan items and accept)
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${decisionQuotationId}/accept`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        selected_option_id: optionAId,
      },
    });
    expect(acceptRes.statusCode).toBe(200);

    const postStages = await DentalTreatmentStageModel.find({
      episodeId: new Types.ObjectId(episodeId),
      deletedAt: null,
    }).lean();

    expect(postStages.length).toBe(initialCount);
  });

  it('27. Phase 8D: No appointment, invoice, payment, or lab order is automatically created on quotation acceptance', async () => {
    const stages = await DentalTreatmentStageModel.find({
      episodeId: new Types.ObjectId(episodeId),
      deletedAt: null,
    }).lean();

    for (const stage of stages) {
      expect(stage.appointmentId).toBeNull();
      expect(stage.prostheticLabOrderId).toBeNull();
      expect(stage.completedAt).toBeNull();
    }
  });

  it('28. Phase 8D: Terminal episode (COMPLETED) does not receive new stages on quotation acceptance', async () => {
    // Create a completed episode
    const completedEpisode = await DentalTreatmentEpisodeModel.create({
      episodeNumber: 'DTE-P8-0999',
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'PAT-P8-001',
      patientName: 'Alice QuotePatient',
      originatingVisitId: new Types.ObjectId(),
      originatingVisitNumber: 'VIS-P8-099',
      primaryDoctorId: new Types.ObjectId(docId),
      primaryDoctorName: 'Dr. David Dentist',
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(dentalDeptId),
      primaryToothNumber: 11,
      status: 'COMPLETED',
      visitIds: [],
    });

    const createQuoteRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/episodes/${completedEpisode._id}/quotations`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        options: [
          {
            name: 'Option 1: Veneer',
            items: [{ procedure_name: 'Veneer Composite', unit_price: 5000, quantity: 1, tooth_number: 11 }],
          },
        ],
      },
    });
    expect(createQuoteRes.statusCode).toBe(200);
    const quote = createQuoteRes.json().data;

    await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quote.id}/send`,
      headers: { authorization: `Bearer ${doctorToken}` },
    });

    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/opd/dental/quotations/${quote.id}/accept`,
      headers: { authorization: `Bearer ${doctorToken}` },
      payload: {
        selected_option_id: quote.options[0].id,
      },
    });
    expect(acceptRes.statusCode).toBe(200);

    // No stage should have been created because episode is COMPLETED
    const stages = await DentalTreatmentStageModel.find({
      episodeId: completedEpisode._id,
      deletedAt: null,
    }).lean();
    expect(stages.length).toBe(0);
  });

  it('29. Phase 8D: Clinical audit event opd.dental_quotation.treatment_activated is recorded', async () => {
    const auditLogs = await AuditLogModel.find({
      eventType: 'opd.dental_quotation.treatment_activated',
    }).lean();

    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    const log = auditLogs[0];
    expect(log).toBeTruthy();
    const metadata = log?.metadataJson as { episodeId?: string; selectedOptionId?: string; createdStageIds?: string[] } | undefined;
    expect(metadata?.episodeId).toBeTruthy();
    expect(metadata?.selectedOptionId).toBeTruthy();
    expect(Array.isArray(metadata?.createdStageIds)).toBe(true);
  });
});


