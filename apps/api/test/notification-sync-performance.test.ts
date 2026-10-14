import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NotificationRepository } from '../src/modules/notifications/notification.repository.js';
import { NotificationModel } from '../src/modules/notifications/notification.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { PatientAccessGrantModel } from '../src/modules/patient-portal/patient-access-grant.model.js';
import { LaboratoryResultModel } from '../src/modules/laboratory/laboratory-result.model.js';
import { ImagingReportModel } from '../src/modules/imaging/imaging-report.model.js';
import { BillingInvoiceModel } from '../src/modules/billing/billing.model.js';
import { PatientDocumentModel } from '../src/modules/patients/patient.model.js';
import { DentalTreatmentQuotationModel } from '../src/modules/opd/dental-quotation.model.js';

describe('Notification Synchronization Performance & Regression (H5)', () => {
  let mongodb: MongoMemoryServer;
  let repository: NotificationRepository;

  beforeAll(async () => {
    mongodb = await MongoMemoryServer.create();
    await mongoose.connect(mongodb.getUri());
    repository = new NotificationRepository();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongodb.stop();
  });

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    await NotificationModel.createIndexes();
  });

  const createTestUser = async (overrides: Record<string, unknown> = {}) => {
    return UserModel.create({
      username: `user_${new Types.ObjectId().toString()}`,
      email: `${new Types.ObjectId().toString()}@example.com`,
      fullName: 'Test User',
      passwordHash: 'hashed_password',
      status: 'active',
      roleIds: [],
      branchIds: [],
      departmentIds: [],
      ...overrides,
    });
  };

  const createTestLabResult = (patientId: Types.ObjectId, overrides: Record<string, unknown> = {}) => {
    const actorId = new Types.ObjectId();
    return {
      patientId,
      orderId: new Types.ObjectId(),
      resultItems: [{ serviceId: new Types.ObjectId(), serviceName: 'CBC', value: 'Normal' }],
      enteredBy: actorId,
      enteredAt: new Date(),
      verifiedBy: actorId,
      verifiedAt: new Date(),
      createdBy: actorId,
      updatedBy: actorId,
      ...overrides,
    };
  };

  const createTestImagingReport = (patientId: Types.ObjectId, overrides: Record<string, unknown> = {}) => {
    const actorId = new Types.ObjectId();
    return {
      patientId,
      orderId: new Types.ObjectId(),
      findings: 'Normal scan',
      impression: 'No acute abnormality',
      enteredBy: actorId,
      enteredAt: new Date(),
      verifiedBy: actorId,
      verifiedAt: new Date(),
      createdBy: actorId,
      updatedBy: actorId,
      ...overrides,
    };
  };

  const createTestInvoice = (patientId: Types.ObjectId, overrides: Record<string, unknown> = {}) => {
    return {
      patientId,
      invoiceNumber: `INV-${new Types.ObjectId().toString().slice(-4)}`,
      visitId: new Types.ObjectId(),
      branchId: new Types.ObjectId(),
      invoiceDate: new Date(),
      status: 'PENDING' as const,
      subtotal: 100,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 100,
      paidAmount: 0,
      balanceAmount: 100,
      ...overrides,
    };
  };

  const createTestConsentDocument = (patientId: Types.ObjectId, overrides: Record<string, unknown> = {}) => {
    return {
      patientId,
      title: 'Surgery Consent Form',
      documentType: 'CONSENT' as const,
      consentKind: 'STAFF_WITNESS' as const,
      consentStatus: 'PENDING' as const,
      status: 'ACTIVE' as const,
      storageKey: 'consent_key_1',
      fileSizeBytes: 1024,
      mimeType: 'application/pdf',
      fileName: 'consent.pdf',
      ...overrides,
    };
  };

  const createTestQuotation = (patientId: Types.ObjectId, overrides: Record<string, unknown> = {}) => {
    return {
      quotationNumber: `Q-${new Types.ObjectId().toString().slice(-4)}`,
      patientId,
      patientNumber: 'P-100',
      patientName: 'Test Patient',
      treatmentEpisodeId: new Types.ObjectId(),
      doctorId: new Types.ObjectId(),
      doctorName: 'Dr. Test',
      branchId: new Types.ObjectId(),
      departmentId: new Types.ObjectId(),
      status: 'SENT' as const,
      currency: 'USD',
      subtotal: 500,
      discountAmount: 0,
      taxAmount: 0,
      total: 500,
      items: [],
      options: [],
      sentAt: new Date(),
      ...overrides,
    };
  };

  it('1. Handles empty patient/user context gracefully without queries or errors', async () => {
    // Non-existent user
    const fakeUserId = new Types.ObjectId().toString();
    await repository.syncPatientNotifications(fakeUserId);

    const count = await NotificationModel.countDocuments();
    expect(count).toBe(0);

    // Invalid ObjectId format
    await repository.syncPatientNotifications('invalid-id');
    expect(await NotificationModel.countDocuments()).toBe(0);
  });

  it('2. Synchronizes candidate items across domains into proper notification records', async () => {
    const patientId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    await createTestUser({
      _id: userId,
      patientId,
    });

    const labId = new Types.ObjectId();
    const imgId = new Types.ObjectId();
    const invId = new Types.ObjectId();
    const docId = new Types.ObjectId();
    const quoteId = new Types.ObjectId();

    await LaboratoryResultModel.create(createTestLabResult(patientId, { _id: labId }));
    await ImagingReportModel.create(createTestImagingReport(patientId, { _id: imgId }));
    await BillingInvoiceModel.create(createTestInvoice(patientId, { _id: invId, invoiceNumber: 'INV-1001', balanceAmount: 150 }));

    await PatientDocumentModel.create(createTestConsentDocument(patientId, { _id: docId }));

    await DentalTreatmentQuotationModel.create(createTestQuotation(patientId, { _id: quoteId, quotationNumber: 'Q-2001' }));

    // Run synchronization
    await repository.syncPatientNotifications(userId.toString());

    const notifications = await NotificationModel.find({ recipientUserId: userId }).sort({ type: 1 }).lean();
    expect(notifications.length).toBe(5);

    const types = notifications.map((n) => n.type);
    expect(types).toContain('LAB_RESULT');
    expect(types).toContain('IMAGING_REPORT');
    expect(types).toContain('INVOICE_PENDING');
    expect(types).toContain('CONSENT_REQUIRED');
    expect(types).toContain('QUOTATION_AVAILABLE');

    // All should be unread and assigned to patient role
    for (const n of notifications) {
      expect(n.isRead).toBe(false);
      expect(n.recipientRole).toBe('PATIENT');
      expect(n.patientId?.toString()).toBe(patientId.toString());
      expect(n.relatedEntityId).toBeDefined();
    }
  });

  it('3. Demonstrates O(1) query count reduction (eliminating N+1 per-item round trips)', async () => {
    const patientId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    await createTestUser({
      _id: userId,
      patientId,
    });

    // Create 10 lab results, 10 imaging reports, 10 invoices (Total 30 candidate items)
    const labDocs = Array.from({ length: 10 }).map(() => createTestLabResult(patientId));
    const imgDocs = Array.from({ length: 10 }).map(() => createTestImagingReport(patientId));
    const invDocs = Array.from({ length: 10 }).map((_, i) =>
      createTestInvoice(patientId, { invoiceNumber: `INV-${3000 + i}`, balanceAmount: 100 + i }),
    );

    await LaboratoryResultModel.insertMany(labDocs);
    await ImagingReportModel.insertMany(imgDocs);
    await BillingInvoiceModel.insertMany(invDocs);

    // Track queries executed on NotificationModel
    let notificationModelFindQueries = 0;
    let notificationModelExistsQueries = 0;
    let notificationModelInsertManyQueries = 0;

    const originalFind = NotificationModel.find.bind(NotificationModel);
    const originalExists = NotificationModel.exists.bind(NotificationModel);
    const originalInsertMany = NotificationModel.insertMany.bind(NotificationModel);

    NotificationModel.find = ((...args: Parameters<typeof originalFind>) => {
      notificationModelFindQueries++;
      return originalFind(...args);
    }) as typeof NotificationModel.find;

    NotificationModel.exists = ((...args: Parameters<typeof originalExists>) => {
      notificationModelExistsQueries++;
      return originalExists(...args);
    }) as typeof NotificationModel.exists;

    NotificationModel.insertMany = ((...args: Parameters<typeof originalInsertMany>) => {
      notificationModelInsertManyQueries++;
      return originalInsertMany(...args);
    }) as typeof NotificationModel.insertMany;

    try {
      await repository.syncPatientNotifications(userId.toString());

      // In the legacy implementation:
      // 30 candidate items would have triggered:
      // - 30 NotificationModel.exists() queries
      // - 30 NotificationModel.create() queries
      // Total NotificationModel queries = 60!
      //
      // In the optimized implementation:
      // - 0 NotificationModel.exists() queries (completely eliminated!)
      // - Exactly 1 batched NotificationModel.find() with $in
      // - Exactly 1 bulk NotificationModel.insertMany()
      // Total NotificationModel queries = 2!
      expect(notificationModelExistsQueries).toBe(0);
      expect(notificationModelFindQueries).toBe(1);
      expect(notificationModelInsertManyQueries).toBe(1);

      // Verify all 30 notifications were successfully created
      const count = await NotificationModel.countDocuments({ recipientUserId: userId });
      expect(count).toBe(30);

      // Reset query counters for second run (idempotent / already synced check)
      notificationModelFindQueries = 0;
      notificationModelExistsQueries = 0;
      notificationModelInsertManyQueries = 0;

      await repository.syncPatientNotifications(userId.toString());

      // On re-sync: exactly 1 find with $in, 0 exists, 0 insertMany needed
      expect(notificationModelExistsQueries).toBe(0);
      expect(notificationModelFindQueries).toBe(1);
      expect(notificationModelInsertManyQueries).toBe(0);

      // Still exactly 30 notifications (no duplicates)
      const recount = await NotificationModel.countDocuments({ recipientUserId: userId });
      expect(recount).toBe(30);
    } finally {
      NotificationModel.find = originalFind;
      NotificationModel.exists = originalExists;
      NotificationModel.insertMany = originalInsertMany;
    }
  });

  it('4. Ignores unverified, deleted, or zero-balance source records', async () => {
    const patientId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    await createTestUser({
      _id: userId,
      patientId,
    });

    // Lab result not verified
    await LaboratoryResultModel.create(createTestLabResult(patientId, { verifiedAt: null, verifiedBy: null }));

    // Imaging report deleted
    await ImagingReportModel.create(createTestImagingReport(patientId, { deletedAt: new Date() }));

    // Invoice with zero balance
    await BillingInvoiceModel.create(createTestInvoice(patientId, { invoiceNumber: 'INV-ZERO', balanceAmount: 0, status: 'PAID' }));

    // Consent already signed
    await PatientDocumentModel.create(
      createTestConsentDocument(patientId, {
        title: 'Signed Consent',
        consentStatus: 'SIGNED',
      }),
    );

    // Quotation already accepted (not 'SENT')
    await DentalTreatmentQuotationModel.create(
      createTestQuotation(patientId, {
        quotationNumber: 'Q-ACCEPTED',
        status: 'ACCEPTED',
      }),
    );

    await repository.syncPatientNotifications(userId.toString());

    const count = await NotificationModel.countDocuments({ recipientUserId: userId });
    expect(count).toBe(0);
  });

  it('5. Supports patient access grants for dependents', async () => {
    const guardianUserId = new Types.ObjectId();
    const dependentPatientId = new Types.ObjectId();

    await createTestUser({
      _id: guardianUserId,
    });

    await PatientAccessGrantModel.create({
      userId: guardianUserId,
      patientId: dependentPatientId,
      relationship: 'PARENT',
      status: 'VERIFIED',
    });

    await LaboratoryResultModel.create(createTestLabResult(dependentPatientId));

    await repository.syncPatientNotifications(guardianUserId.toString());

    const notifs = await NotificationModel.find({ recipientUserId: guardianUserId }).lean();
    expect(notifs.length).toBe(1);
    expect(notifs[0].patientId?.toString()).toBe(dependentPatientId.toString());
  });

  it('6. Preserves pagination, ordering, and read state in listForUser', async () => {
    const userId = new Types.ObjectId();
    const patientId = new Types.ObjectId();

    await createTestUser({
      _id: userId,
      patientId,
    });

    const now = Date.now();
    await NotificationModel.create([
      {
        recipientUserId: userId,
        patientId,
        recipientRole: 'PATIENT',
        type: 'GENERAL',
        title: 'Older unread',
        message: 'Older message',
        isRead: false,
        createdAt: new Date(now - 20000),
      },
      {
        recipientUserId: userId,
        patientId,
        recipientRole: 'PATIENT',
        type: 'GENERAL',
        title: 'Newer unread',
        message: 'Newer message',
        isRead: false,
        createdAt: new Date(now - 10000),
      },
      {
        recipientUserId: userId,
        patientId,
        recipientRole: 'PATIENT',
        type: 'GENERAL',
        title: 'Read notification',
        message: 'Already read message',
        isRead: true,
        createdAt: new Date(now - 5000),
      },
    ]);

    // Test list unread only
    const unreadResult = await repository.listForUser(userId.toString(), { is_read: false, page: 1, limit: 10 });
    expect(unreadResult.meta.total).toBe(2);
    expect(unreadResult.data.length).toBe(2);
    // Ordered by createdAt: -1 (newest first)
    expect(unreadResult.data[0].title).toBe('Newer unread');
    expect(unreadResult.data[1].title).toBe('Older unread');

    // Test pagination (page 1, limit 1)
    const page1 = await repository.listForUser(userId.toString(), { page: 1, limit: 1 });
    expect(page1.meta.total).toBe(3);
    expect(page1.meta.totalPages).toBe(3);
    expect(page1.data.length).toBe(1);
    expect(page1.data[0].title).toBe('Read notification'); // newest overall

    const page2 = await repository.listForUser(userId.toString(), { page: 2, limit: 1 });
    expect(page2.data.length).toBe(1);
    expect(page2.data[0].title).toBe('Newer unread');
  });

  it('7. Enforces database-level unique index on { recipientUserId, relatedEntityId, type }', async () => {
    const userId = new Types.ObjectId();
    const relatedEntityId = new Types.ObjectId();

    await NotificationModel.create({
      recipientUserId: userId,
      type: 'LAB_RESULT',
      relatedEntityId,
      title: 'Lab 1',
      message: 'Result ready',
      isRead: false,
    });

    // Attempting to insert duplicate with same user, type, and relatedEntityId must reject with E11000
    await expect(
      NotificationModel.create({
        recipientUserId: userId,
        type: 'LAB_RESULT',
        relatedEntityId,
        title: 'Lab 1 Duplicate',
        message: 'Duplicate result',
        isRead: false,
      }),
    ).rejects.toThrow(/E11000/);

    // Notifications without relatedEntityId (e.g. general notifications) should NOT conflict
    await NotificationModel.create({
      recipientUserId: userId,
      type: 'GENERAL',
      title: 'General 1',
      message: 'Message 1',
      isRead: false,
    });

    await expect(
      NotificationModel.create({
        recipientUserId: userId,
        type: 'GENERAL',
        title: 'General 2',
        message: 'Message 2',
        isRead: false,
      }),
    ).resolves.toBeDefined();
  });
});
