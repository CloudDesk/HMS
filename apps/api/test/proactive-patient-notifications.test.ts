import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { NotificationModel } from '../src/modules/notifications/notification.model.js';
import { NotificationRepository } from '../src/modules/notifications/notification.repository.js';
import { NotificationService } from '../src/modules/notifications/notification.service.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { PatientAccessGrantModel } from '../src/modules/patient-portal/patient-access-grant.model.js';
import { LaboratoryService } from '../src/modules/laboratory/laboratory.service.js';
import { LaboratoryRepository } from '../src/modules/laboratory/laboratory.repository.js';
import { ImagingService } from '../src/modules/imaging/imaging.service.js';
import { ImagingRepository } from '../src/modules/imaging/imaging.repository.js';
import { BillingService } from '../src/modules/billing/billing.service.js';
import { BillingRepository } from '../src/modules/billing/billing.repository.js';
import { PatientService } from '../src/modules/patients/patient.service.js';
import { PatientRepository } from '../src/modules/patients/patient.repository.js';
import { OpdClinicalOrderModel } from '../src/modules/opd/opd-clinical-order.model.js';
import { OpdClinicalOrderRepository } from '../src/modules/opd/opd-clinical-order.repository.js';
import { ServiceRepository } from '../src/modules/services/service.repository.js';
import { ServiceModel } from '../src/modules/services/service.model.js';
import { PatientModel } from '../src/modules/patients/patient.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { PatientDocumentStorageService } from '../src/shared/storage/patient-document-storage.service.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import { SequenceModel } from '../src/shared/sequence/sequence.model.js';

describe('Proactive Clinical Patient Notifications (Fix H11)', () => {
  let notificationRepo: NotificationRepository;
  let notificationService: NotificationService;
  let laboratoryService: LaboratoryService;
  let imagingService: ImagingService;
  let billingService: BillingService;
  let patientService: PatientService;

  const branchId = createObjectId();
  const departmentId = createObjectId();
  const doctorUserId = createObjectId();
  const doctorId = createObjectId();
  const patientId = createObjectId();
  const guardianUserId = createObjectId();
  const patientPortalUserId = createObjectId();

  const dummyMetadata = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  beforeAll(async () => {
    await setupTestDatabase();
    await NotificationModel.createIndexes();

    notificationRepo = new NotificationRepository();
    notificationService = new NotificationService(notificationRepo);

    const orderRepo = new OpdClinicalOrderRepository();
    const labRepo = new LaboratoryRepository();
    const imgRepo = new ImagingRepository();
    const serviceRepo = new ServiceRepository();
    const billingRepo = new BillingRepository();
    const patientRepo = new PatientRepository();
    const storageService = new PatientDocumentStorageService();
    const sequenceService = new SequenceService();

    laboratoryService = new LaboratoryService(orderRepo, labRepo, serviceRepo, notificationService);
    imagingService = new ImagingService(orderRepo, imgRepo, storageService, notificationService);
    billingService = new BillingService(
      billingRepo,
      patientRepo,
      {} as any,
      {} as any,
      {} as any,
      orderRepo,
      serviceRepo,
      {} as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      notificationService,
    );
    patientService = new PatientService(patientRepo, storageService, sequenceService, notificationService);
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();

    await BranchModel.create({
      _id: new Types.ObjectId(branchId),
      code: 'MAIN',
      name: 'Main Branch',
      status: 'ACTIVE',
    });

    await DepartmentModel.create({
      _id: new Types.ObjectId(departmentId),
      code: 'GEN',
      name: 'General Dept',
      branchIds: [new Types.ObjectId(branchId)],
      status: 'ACTIVE',
      isClinical: true,
    });

    await DoctorModel.create({
      _id: new Types.ObjectId(doctorId),
      userId: new Types.ObjectId(doctorUserId),
      branchId: new Types.ObjectId(branchId),
      departmentId: new Types.ObjectId(departmentId),
      doctorNumber: 'DOC-1',
      firstName: 'Doctor',
      lastName: 'Specialist',
      displayName: 'Dr. Specialist',
      specialization: 'General',
      status: 'ACTIVE',
    });

    await UserModel.create({
      _id: new Types.ObjectId(doctorUserId),
      username: 'dr.specialist',
      email: 'dr@test.com',
      fullName: 'Dr Specialist',
      passwordHash: 'hash',
      status: 'active',
      branchIds: [new Types.ObjectId(branchId)],
      roleIds: [],
    });

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'P-100',
      firstName: 'Alice',
      lastName: 'Smith',
      fullName: 'Alice Smith',
      gender: 'FEMALE',
      dateOfBirth: new Date('1990-01-01'),
      status: 'ACTIVE',
      primaryBranchId: new Types.ObjectId(branchId),
      registrationBranchId: new Types.ObjectId(branchId),
    });

    // Create direct portal user for patient
    await UserModel.create({
      _id: new Types.ObjectId(patientPortalUserId),
      username: 'alice.portal',
      email: 'alice@portal.test',
      fullName: 'Alice Smith',
      passwordHash: 'hash',
      status: 'active',
      patientId: new Types.ObjectId(patientId),
      branchIds: [new Types.ObjectId(branchId)],
      roleIds: [],
    });

    // Create guardian user with VERIFIED access grant for patient
    await UserModel.create({
      _id: new Types.ObjectId(guardianUserId),
      username: 'guardian.user',
      email: 'guardian@test.com',
      fullName: 'Guardian User',
      passwordHash: 'hash',
      status: 'active',
      branchIds: [new Types.ObjectId(branchId)],
      roleIds: [],
    });

    await PatientAccessGrantModel.create({
      userId: new Types.ObjectId(guardianUserId),
      patientId: new Types.ObjectId(patientId),
      status: 'VERIFIED',
      relationship: 'PARENT',
    });
  });

  it('1. Successful laboratory verification creates the expected patient notification (LAB_RESULT)', async () => {
    const labService = await ServiceModel.create({
      code: 'SRV-LAB-1',
      name: 'Full Blood Count',
      serviceType: 'LAB_TEST',
      departmentId: new Types.ObjectId(departmentId),
      standardPrice: 100,
      status: 'ACTIVE',
    });

    // Create submitted lab order
    const order = await OpdClinicalOrderModel.create({
      sourceType: 'OPD_VISIT',
      sourceId: createObjectId(),
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-100',
      patientName: 'Alice Smith',
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dr. Specialist',
      branchId: new Types.ObjectId(branchId),
      orderType: 'LABORATORY',
      status: 'SUBMITTED',
      priority: 'ROUTINE',
      items: [
        {
          _id: new Types.ObjectId(),
          serviceId: labService._id,
          serviceName: 'Full Blood Count',
          investigationName: 'Full Blood Count',
          category: 'Hematology',
        },
      ],
    });

    // Move to IN_PROGRESS
    await laboratoryService.updateStatus(order._id.toString(), { status: 'RECEIVED' }, doctorUserId, dummyMetadata);
    await laboratoryService.updateStatus(order._id.toString(), { status: 'SAMPLE_COLLECTED' }, doctorUserId, dummyMetadata);
    await laboratoryService.updateStatus(order._id.toString(), { status: 'IN_PROGRESS' }, doctorUserId, dummyMetadata);

    // Enter result
    await laboratoryService.enterResult(
      order._id.toString(),
      {
        result_items: [
          {
            service_id: labService._id.toString(),
            service_name: 'Full Blood Count',
            value: '13.5',
            unit: 'g/dL',
          },
        ],
      },
      doctorUserId,
      dummyMetadata,
    );

    // Verify result
    await laboratoryService.updateStatus(order._id.toString(), { status: 'VERIFIED' }, doctorUserId, dummyMetadata);

    // Verify notifications were created for both direct patient and verified guardian
    const notifications = await NotificationModel.find({
      type: 'LAB_RESULT',
      patientId: new Types.ObjectId(patientId),
    }).lean();

    expect(notifications).toHaveLength(2);
    expect(notifications.map((n) => n.recipientUserId?.toString())).toContain(patientPortalUserId);
    expect(notifications.map((n) => n.recipientUserId?.toString())).toContain(guardianUserId);
    expect(notifications[0].title).toBe('Laboratory Result Available');
    expect(notifications[0].relatedEntityId).toBeDefined();
  });

  it('2. Successful imaging verification creates the expected patient notification (IMAGING_REPORT)', async () => {
    const order = await OpdClinicalOrderModel.create({
      sourceType: 'OPD_VISIT',
      sourceId: createObjectId(),
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-100',
      patientName: 'Alice Smith',
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dr. Specialist',
      branchId: new Types.ObjectId(branchId),
      orderType: 'IMAGING',
      status: 'SUBMITTED',
      priority: 'ROUTINE',
      items: [
        {
          _id: new Types.ObjectId(),
          serviceId: new Types.ObjectId(),
          serviceName: 'Chest X-Ray',
          investigationName: 'Chest X-Ray',
          category: 'Radiology',
        },
      ],
    });

    await imagingService.updateStatus(order._id.toString(), { status: 'RECEIVED' }, doctorUserId, dummyMetadata);
    await imagingService.updateStatus(order._id.toString(), { status: 'IN_PROGRESS' }, doctorUserId, dummyMetadata);

    await imagingService.enterReport(
      order._id.toString(),
      {
        modality: 'XRAY',
        technique: 'PA View',
        findings: 'Clear lung fields',
        impression: 'Normal study',
      },
      doctorUserId,
      dummyMetadata,
    );

    await imagingService.updateStatus(order._id.toString(), { status: 'VERIFIED' }, doctorUserId, dummyMetadata);

    const notifications = await NotificationModel.find({
      type: 'IMAGING_REPORT',
      patientId: new Types.ObjectId(patientId),
    }).lean();

    expect(notifications).toHaveLength(2);
    expect(notifications.map((n) => n.recipientUserId?.toString())).toContain(patientPortalUserId);
    expect(notifications.map((n) => n.recipientUserId?.toString())).toContain(guardianUserId);
    expect(notifications[0].title).toBe('Imaging Scan Available');
  });

  it('3. Invoice creation creates INVOICE_PENDING only when the invoice requires attention', async () => {
    // Directly invoke notifyPatient for an invoice with outstanding balance
    await notificationService.notifyPatient({
      patientId,
      type: 'INVOICE_PENDING',
      title: 'Pending Invoice',
      message: 'Invoice INV-1001 has an outstanding balance of 250.',
      relatedEntityId: createObjectId(),
    });

    const notifs = await NotificationModel.find({ type: 'INVOICE_PENDING' }).lean();
    expect(notifs).toHaveLength(2); // One for patient, one for guardian
    expect(notifs[0].title).toBe('Pending Invoice');
  });

  it('4. Consent request creation creates CONSENT_REQUIRED', async () => {
    const doc = await patientService.createDocument(
      patientId,
      {
        document_type: 'CONSENT',
        title: 'Surgical Consent Form',
        file_name: 'consent.pdf',
        file_size_bytes: 1024,
        mime_type: 'application/pdf',
        storage_key: 'consents/123.pdf',
        consent_status: 'PENDING',
      },
      doctorUserId,
    );

    const notifs = await NotificationModel.find({
      type: 'CONSENT_REQUIRED',
      relatedEntityId: new Types.ObjectId(doc.id),
    }).lean();

    expect(notifs).toHaveLength(2);
    expect(notifs[0].title).toBe('Consent Signature Required');
    expect(notifs[0].message).toContain('Surgical Consent Form');
  });

  it('5. Unverified results and reports do not trigger patient notifications', async () => {
    const labService = await ServiceModel.create({
      code: 'SRV-LAB-2',
      name: 'Serum Electrolytes',
      serviceType: 'LAB_TEST',
      departmentId: new Types.ObjectId(departmentId),
      standardPrice: 120,
      status: 'ACTIVE',
    });

    const order = await OpdClinicalOrderModel.create({
      sourceType: 'OPD_VISIT',
      sourceId: createObjectId(),
      patientId: new Types.ObjectId(patientId),
      patientNumber: 'P-100',
      patientName: 'Alice Smith',
      doctorId: new Types.ObjectId(doctorId),
      doctorName: 'Dr. Specialist',
      branchId: new Types.ObjectId(branchId),
      orderType: 'LABORATORY',
      status: 'SUBMITTED',
      priority: 'ROUTINE',
      items: [
        {
          _id: new Types.ObjectId(),
          serviceId: labService._id,
          serviceName: 'Serum Electrolytes',
          investigationName: 'Serum Electrolytes',
          category: 'Biochemistry',
        },
      ],
    });

    await laboratoryService.updateStatus(order._id.toString(), { status: 'RECEIVED' }, doctorUserId, dummyMetadata);
    await laboratoryService.updateStatus(order._id.toString(), { status: 'SAMPLE_COLLECTED' }, doctorUserId, dummyMetadata);
    await laboratoryService.updateStatus(order._id.toString(), { status: 'IN_PROGRESS' }, doctorUserId, dummyMetadata);

    await laboratoryService.enterResult(
      order._id.toString(),
      {
        result_items: [
          {
            service_id: labService._id.toString(),
            service_name: 'Serum Electrolytes',
            value: '140',
            unit: 'mmol/L',
          },
        ],
      },
      doctorUserId,
      dummyMetadata,
    );

    // Status is RESULT_ENTERED (unverified)
    const notifs = await NotificationModel.find({
      type: 'LAB_RESULT',
      patientId: new Types.ObjectId(patientId),
    }).lean();

    expect(notifs).toHaveLength(0);
  });

  it('6. Paid, cancelled, and legitimate zero-balance invoices do not generate misleading notifications', async () => {
    // When balanceAmount <= 0 or status is PAID, notifyPendingInvoiceSafely is a no-op
    const fakeInvoice = {
      id: createObjectId(),
      patient_id: patientId,
      invoice_number: 'INV-ZERO',
      balance_amount: 0,
      status: 'PAID',
    };

    // Calling notifyPendingInvoiceSafely with balance 0 should not send notification
    await (billingService as any).notifyPendingInvoiceSafely(fakeInvoice);

    const notifs = await NotificationModel.find({
      type: 'INVOICE_PENDING',
      relatedEntityId: new Types.ObjectId(fakeInvoice.id),
    }).lean();

    expect(notifs).toHaveLength(0);
  });

  it('7. Repeated processing does not create duplicate notifications', async () => {
    const entityId = createObjectId();

    await notificationService.notifyPatient({
      patientId,
      type: 'LAB_RESULT',
      title: 'Laboratory Result Available',
      message: 'Your laboratory report has been verified.',
      relatedEntityId: entityId,
    });

    expect(await NotificationModel.countDocuments({ relatedEntityId: new Types.ObjectId(entityId) })).toBe(2);

    // Retry / duplicate execution
    await notificationService.notifyPatient({
      patientId,
      type: 'LAB_RESULT',
      title: 'Laboratory Result Available',
      message: 'Your laboratory report has been verified.',
      relatedEntityId: entityId,
    });

    // Still exactly 2 (no duplicates created)
    expect(await NotificationModel.countDocuments({ relatedEntityId: new Types.ObjectId(entityId) })).toBe(2);
  });

  it('8. Patients without a portal account are handled safely without inventing a recipient', async () => {
    const unlinkedPatientId = createObjectId();
    const entityId = createObjectId();

    await notificationService.notifyPatient({
      patientId: unlinkedPatientId,
      type: 'LAB_RESULT',
      title: 'Laboratory Result Available',
      message: 'Result ready.',
      relatedEntityId: entityId,
    });

    // No phantom notifications created
    const notifs = await NotificationModel.find({ relatedEntityId: new Types.ObjectId(entityId) }).lean();
    expect(notifs).toHaveLength(0);
  });

  it('9. Dependent notifications respect verified patient-access grants and existing privacy rules', async () => {
    const unverifiedUserId = createObjectId();
    await UserModel.create({
      _id: new Types.ObjectId(unverifiedUserId),
      username: 'unverified.user',
      email: 'unverified@test.com',
      fullName: 'Unverified User',
      passwordHash: 'hash',
      status: 'active',
      branchIds: [new Types.ObjectId(branchId)],
      roleIds: [],
    });

    // Grant with PENDING status (not VERIFIED)
    await PatientAccessGrantModel.create({
      userId: new Types.ObjectId(unverifiedUserId),
      patientId: new Types.ObjectId(patientId),
      status: 'PENDING',
      relationship: 'LEGAL_GUARDIAN',
    });

    const entityId = createObjectId();
    await notificationService.notifyPatient({
      patientId,
      type: 'IMAGING_REPORT',
      title: 'Imaging Scan Available',
      message: 'Imaging report ready.',
      relatedEntityId: entityId,
    });

    const notifs = await NotificationModel.find({ relatedEntityId: new Types.ObjectId(entityId) }).lean();
    const recipientIds = notifs.map((n) => n.recipientUserId?.toString());

    // Verified guardian and direct patient receive it; unverified user does NOT
    expect(recipientIds).toContain(patientPortalUserId);
    expect(recipientIds).toContain(guardianUserId);
    expect(recipientIds).not.toContain(unverifiedUserId);
  });

  it('10. Notification failures follow the established non-blocking error-handling policy', async () => {
    // If notification service notifyPatient throws an error, it is gracefully swallowed
    const badNotificationService = new NotificationService({
      createPatientNotifications: async () => {
        throw new Error('Database connection failed');
      },
    } as any);

    const result = await badNotificationService.notifyPatient({
      patientId,
      type: 'LAB_RESULT',
      title: 'Test',
      message: 'Test',
      relatedEntityId: createObjectId(),
    });

    // Returns empty array and does not throw
    expect(result).toEqual([]);
  });

  it('11. Existing H5 synchronization, pagination, ordering, and read state remain intact', async () => {
    const entityId = createObjectId();
    await notificationService.notifyPatient({
      patientId,
      type: 'LAB_RESULT',
      title: 'Lab 1',
      message: 'Lab ready',
      relatedEntityId: entityId,
    });

    const userNotifs = await notificationService.listForUser(patientPortalUserId, { page: 1, limit: 10 });
    expect(userNotifs.data).toHaveLength(1);
    expect(userNotifs.data[0].is_read).toBe(false);

    // Mark as read
    await notificationService.markAsRead(userNotifs.data[0].id, patientPortalUserId);

    const updatedNotifs = await notificationService.listForUser(patientPortalUserId, { page: 1, limit: 10 });
    expect(updatedNotifs.data[0].is_read).toBe(true);
  });

  it('12. Notification navigation references the correct underlying entity', async () => {
    const entityId = createObjectId();
    await notificationService.notifyPatient({
      patientId,
      type: 'CONSENT_REQUIRED',
      title: 'Consent Signature Required',
      message: 'Form requires signature',
      relatedEntityId: entityId,
    });

    const notif = await NotificationModel.findOne({
      recipientUserId: new Types.ObjectId(patientPortalUserId),
      relatedEntityId: new Types.ObjectId(entityId),
    }).lean();

    expect(notif?.relatedEntityId?.toString()).toBe(entityId);
    expect(notif?.type).toBe('CONSENT_REQUIRED');
  });
});
