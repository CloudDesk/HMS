import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { NotificationRepository } from '../src/modules/notifications/notification.repository.js';
import { NotificationService } from '../src/modules/notifications/notification.service.js';
import { NotificationModel } from '../src/modules/notifications/notification.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { PatientAccessGrantModel } from '../src/modules/patient-portal/patient-access-grant.model.js';
import { PatientModel } from '../src/modules/patients/patient.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { DepartmentModel } from '../src/modules/departments/department.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import { ServiceModel } from '../src/modules/services/service.model.js';
import { BillingInvoiceModel } from '../src/modules/billing/billing.model.js';
import { BillingRepository } from '../src/modules/billing/billing.repository.js';
import { BillingService } from '../src/modules/billing/billing.service.js';
import { PharmacyDispensingService } from '../src/modules/pharmacy-dispensing/pharmacy-dispensing.service.js';
import { PharmacyDispensingRepository } from '../src/modules/pharmacy-dispensing/pharmacy-dispensing.repository.js';
import { SurgeryService } from '../src/modules/surgery/surgery.service.js';
import { SurgeryRepository } from '../src/modules/surgery/surgery.repository.js';
import { DoctorRepository } from '../src/modules/doctors/doctor.repository.js';
import { PatientService } from '../src/modules/patients/patient.service.js';
import { PatientRepository } from '../src/modules/patients/patient.repository.js';
import { PatientDocumentStorageService } from '../src/shared/storage/patient-document-storage.service.js';
import { SequenceService } from '../src/shared/sequence/sequence.service.js';
import { AdmissionsConfigurationService } from '../src/modules/admissions-configuration/admissions-configuration.service.js';
import { AdmissionsConfigurationRepository } from '../src/modules/admissions-configuration/admissions-configuration.repository.js';
import { AdvancePaymentService } from '../src/modules/advance-payment/advance-payment.service.js';
import { AdvancePaymentRepository } from '../src/modules/advance-payment/advance-payment.repository.js';
import { OpdPrescriptionService } from '../src/modules/opd/opd-prescription.service.js';
import { OpdPrescriptionRepository } from '../src/modules/opd/opd-prescription.repository.js';
import { OpdClinicalOrderService } from '../src/modules/opd/opd-clinical-order.service.js';
import { OpdClinicalOrderRepository } from '../src/modules/opd/opd-clinical-order.repository.js';
import { SettingsRepository } from '../src/modules/settings/settings.repository.js';
import { ProcedureRecommendationModel, ProcedureBookingModel } from '../src/modules/surgery/surgery.model.js';

describe('Durable Patient Notification Delivery & Complete Invoice Coverage (H11 Follow-up)', () => {
  let notificationRepo: NotificationRepository;
  let notificationService: NotificationService;
  let billingRepo: BillingRepository;
  let billingService: BillingService;

  const branchId = createObjectId();
  const departmentId = createObjectId();
  const doctorUserId = createObjectId();
  const doctorId = createObjectId();
  const patientId = createObjectId();
  const patientPortalUserId = createObjectId();
  const guardianUserId = createObjectId();
  const actorUserId = createObjectId();

  const dummyMetadata = {
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
  };

  beforeAll(async () => {
    await setupTestDatabase();
    await NotificationModel.createIndexes();
    await PatientAccessGrantModel.init();
    await BillingInvoiceModel.createIndexes();

    notificationRepo = new NotificationRepository();
    notificationService = new NotificationService(notificationRepo);
    billingRepo = new BillingRepository();

    billingService = new BillingService(
      billingRepo,
      new PatientRepository(),
      {} as any,
      {} as any,
      {} as any,
      new OpdClinicalOrderRepository(),
      {} as any,
      {} as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      notificationService,
    );
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
      code: 'SURG',
      name: 'Surgery Department',
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
      firstName: 'Lead',
      lastName: 'Surgeon',
      displayName: 'Dr. Surgeon',
      specialization: 'General Surgery',
      status: 'ACTIVE',
    });

    await UserModel.create([
      {
        _id: new Types.ObjectId(actorUserId),
        username: 'staff.user',
        email: 'staff@test.com',
        fullName: 'Staff User',
        passwordHash: 'hash',
        status: 'active',
        branchIds: [new Types.ObjectId(branchId)],
        roleIds: [],
      },
      {
        _id: new Types.ObjectId(patientPortalUserId),
        username: 'patient.portal',
        email: 'patient@portal.test',
        fullName: 'Alice Patient',
        passwordHash: 'hash',
        status: 'active',
        patientId: new Types.ObjectId(patientId),
        branchIds: [new Types.ObjectId(branchId)],
        roleIds: [],
      },
      {
        _id: new Types.ObjectId(guardianUserId),
        username: 'guardian.portal',
        email: 'guardian@portal.test',
        fullName: 'Bob Guardian',
        passwordHash: 'hash',
        status: 'active',
        branchIds: [new Types.ObjectId(branchId)],
        roleIds: [],
      },
    ]);

    await PatientModel.create({
      _id: new Types.ObjectId(patientId),
      patientNumber: 'P-100',
      firstName: 'Alice',
      lastName: 'Patient',
      fullName: 'Alice Patient',
      gender: 'FEMALE',
      dateOfBirth: new Date('1995-05-15'),
      status: 'ACTIVE',
      primaryBranchId: new Types.ObjectId(branchId),
      registrationBranchId: new Types.ObjectId(branchId),
    });

    await PatientAccessGrantModel.create({
      userId: new Types.ObjectId(guardianUserId),
      patientId: new Types.ObjectId(patientId),
      status: 'VERIFIED',
      relationship: 'PARENT',
      revokedAt: null,
    });
  });

  describe('Procedure Booking Invoice Notification Coverage', () => {
    it('createProcedureBookingInvoice marks non-zero deposit invoice as PENDING and notifies post-commit', async () => {
      const bookingId = createObjectId();
      const invoice = await billingService.createProcedureBookingInvoice(
        {
          patient_id: patientId,
          branch_id: branchId,
          booking_id: bookingId,
          service: {
            id: createObjectId(),
            name: 'Appendectomy',
            standardPrice: 1500,
          },
        },
        actorUserId,
        dummyMetadata,
      );

      expect(invoice.status).toBe('PENDING');
      expect(invoice.balance_amount).toBe(1500);

      // Verify that notification was dispatched to both patient and verified guardian
      const notifications = await NotificationModel.find({
        type: 'INVOICE_PENDING',
        relatedEntityId: new Types.ObjectId(invoice.id),
      }).lean();

      expect(notifications).toHaveLength(2);
      expect(notifications.map((n) => n.recipientUserId?.toString())).toContain(patientPortalUserId);
      expect(notifications.map((n) => n.recipientUserId?.toString())).toContain(guardianUserId);
      expect(notifications[0].message).toContain('1500');
    });

    it('zero-price procedure booking invoice is marked PAID and does NOT generate a pending notification', async () => {
      const bookingId = createObjectId();
      const invoice = await billingService.createProcedureBookingInvoice(
        {
          patient_id: patientId,
          branch_id: branchId,
          booking_id: bookingId,
          service: {
            id: createObjectId(),
            name: 'Complimentary Follow-up',
            standardPrice: 0,
          },
        },
        actorUserId,
        dummyMetadata,
      );

      expect(invoice.status).toBe('PAID');
      expect(invoice.balance_amount).toBe(0);

      const notifications = await NotificationModel.find({
        type: 'INVOICE_PENDING',
        relatedEntityId: new Types.ObjectId(invoice.id),
      }).lean();

      expect(notifications).toHaveLength(0);
    });

    it('SurgeryService.createBooking triggers post-commit invoice notification only when transaction commits', async () => {
      const mockSurgeryRepo = {
        hasBranchAccess: vi.fn(async () => true),
        getActiveRecommendationRecord: vi.fn(async () => ({
          _id: new Types.ObjectId(),
          patientId: new Types.ObjectId(patientId),
          branchId: new Types.ObjectId(branchId),
          encounterId: null,
          status: 'RECOMMENDED',
        })),
        bookingReferences: vi.fn(async () => ({
          doctor: { _id: new Types.ObjectId(doctorId), displayName: 'Dr. Surgeon' },
          service: {
            _id: new Types.ObjectId(),
            name: 'Hernia Repair',
            defaultDurationMinutes: 60,
            bookingCapacity: 2,
            standardPrice: 2000,
          },
        })),
        acquireConcurrencyLock: vi.fn(async () => {}),
        createBooking: vi.fn(async (_data, _rec, details) => ({
          id: createObjectId(),
          booking_number: 'SURG-001',
          service_name: 'Hernia Repair',
          patient_id: patientId,
          deposit_invoice_id: null,
        })),
        markRecommendationBooked: vi.fn(async () => true),
        audit: vi.fn(async () => {}),
        session: vi.fn(async () => mongoose.startSession()),
        startTransaction: vi.fn(),
      } as unknown as SurgeryRepository;

      const mockPatientService = {
        addProcedureTimeline: vi.fn(async () => {}),
      } as unknown as PatientService;

      const mockBillingService = {
        createProcedureBookingInvoice: vi.fn(async (data) => ({
          id: createObjectId(),
          invoice_number: 'INV-SURG-1',
          patient_id: data.patient_id,
          balance_amount: 2000,
          status: 'PENDING',
        })),
        notifyPendingInvoiceSafely: vi.fn(async (inv) => {
          await notificationService.notifyPatient({
            patientId: inv.patient_id,
            type: 'INVOICE_PENDING',
            title: 'Pending Invoice',
            message: `Invoice ${inv.invoice_number} has an outstanding balance of ${inv.balance_amount}.`,
            relatedEntityId: inv.id,
          });
        }),
      } as unknown as BillingService;

      const surgeryService = new SurgeryService(
        mockSurgeryRepo,
        { getDoctorAvailability: vi.fn(async () => ({ availability: [{ day_of_week: 'MONDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59', slot_duration_minutes: 60 }] }] })), hasActiveLeave: vi.fn(async () => false), getExceptionByDate: vi.fn(async () => null) } as any,
        mockPatientService,
        mockBillingService,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { get: async () => ({ localization: { timezone: 'UTC' } }) } as any,
      );

      vi.spyOn(surgeryService as any, 'validateSchedule').mockResolvedValue(undefined);

      const result = await surgeryService.createBooking(
        {
          recommendation_id: createObjectId(),
          doctor_id: doctorId,
          branch_id: branchId,
          scheduled_start: new Date('2026-10-19T10:00:00.000Z').toISOString(),
        },
        actorUserId,
        dummyMetadata,
      );

      expect(result).toBeDefined();
      expect(mockBillingService.notifyPendingInvoiceSafely).toHaveBeenCalledTimes(1);

      // Verify notifications were delivered to patient & guardian
      const notifs = await NotificationModel.find({ type: 'INVOICE_PENDING' }).lean();
      expect(notifs).toHaveLength(2);
      expect(notifs[0].message).toContain('2000');
    });

    it('SurgeryService.createBooking rollback suppresses invoice notification', async () => {
      const mockSurgeryRepo = {
        hasBranchAccess: vi.fn(async () => true),
        getActiveRecommendationRecord: vi.fn(async () => ({
          _id: new Types.ObjectId(),
          patientId: new Types.ObjectId(patientId),
          branchId: new Types.ObjectId(branchId),
          encounterId: null,
          status: 'RECOMMENDED',
        })),
        bookingReferences: vi.fn(async () => ({
          doctor: { _id: new Types.ObjectId(doctorId), displayName: 'Dr. Surgeon' },
          service: {
            _id: new Types.ObjectId(),
            name: 'Hernia Repair',
            defaultDurationMinutes: 60,
            bookingCapacity: 2,
            standardPrice: 2000,
          },
        })),
        acquireConcurrencyLock: vi.fn(async () => {}),
        createBooking: vi.fn(async () => ({
          id: createObjectId(),
          booking_number: 'SURG-002',
          service_name: 'Hernia Repair',
          patient_id: patientId,
        })),
        // Simulate concurrent conflict: recommendation consumed by another request
        markRecommendationBooked: vi.fn(async () => false),
        audit: vi.fn(async () => {}),
        session: vi.fn(async () => mongoose.startSession()),
      } as unknown as SurgeryRepository;

      const mockBillingService = {
        createProcedureBookingInvoice: vi.fn(async (data) => ({
          id: createObjectId(),
          invoice_number: 'INV-SURG-2',
          patient_id: data.patient_id,
          balance_amount: 2000,
          status: 'PENDING',
        })),
        notifyPendingInvoiceSafely: vi.fn(),
      } as unknown as BillingService;

      const surgeryService = new SurgeryService(
        mockSurgeryRepo,
        { getDoctorAvailability: vi.fn(async () => ({ availability: [{ day_of_week: 'MONDAY', is_available: true, working_blocks: [{ start_time: '00:00', end_time: '23:59', slot_duration_minutes: 60 }] }] })), hasActiveLeave: vi.fn(async () => false), getExceptionByDate: vi.fn(async () => null) } as any,
        { addProcedureTimeline: vi.fn() } as any,
        mockBillingService,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { get: async () => ({ localization: { timezone: 'UTC' } }) } as any,
      );

      vi.spyOn(surgeryService as any, 'validateSchedule').mockResolvedValue(undefined);

      await expect(
        surgeryService.createBooking(
          {
            recommendation_id: createObjectId(),
            doctor_id: doctorId,
            branch_id: branchId,
            scheduled_start: new Date('2026-10-19T10:00:00.000Z').toISOString(),
          },
          actorUserId,
          dummyMetadata,
        ),
      ).rejects.toThrow();

      // Post-commit notification hook must NOT have been called
      expect(mockBillingService.notifyPendingInvoiceSafely).not.toHaveBeenCalled();
      const notifs = await NotificationModel.find({ type: 'INVOICE_PENDING' }).lean();
      expect(notifs).toHaveLength(0);
    });
  });

  describe('Pharmacy Dispensing Invoice Notification Coverage', () => {
    it('PharmacyDispensingService.confirm triggers post-commit INVOICE_PENDING notification', async () => {
      const invoiceId = createObjectId();
      const prescriptionItemId = new Types.ObjectId();
      const medicineId = new Types.ObjectId();
      const batchId = new Types.ObjectId();
      const mockRepo = {
        authorized: vi.fn(async () => true),
        getPrescription: vi.fn(async () => ({
          _id: new Types.ObjectId(),
          patientId: new Types.ObjectId(patientId),
          branchId: new Types.ObjectId(branchId),
          visitId: new Types.ObjectId(),
          status: 'SUBMITTED',
          items: [{ _id: prescriptionItemId, quantity: 2, medicineName: 'Amoxicillin' }],
        })),
        getVisit: vi.fn(async () => ({
          _id: new Types.ObjectId(),
          branchId: new Types.ObjectId(branchId),
          visitType: 'OPD',
          appointmentId: null,
        })),
        getRawByPrescription: vi.fn(async () => ({
          _id: new Types.ObjectId(),
          status: 'DRAFT',
          version: 1,
          items: [
            {
              _id: new Types.ObjectId(),
              prescriptionItemId,
              medicineName: 'Amoxicillin',
              medicineId,
              batchId,
              requestedQuantity: 2,
              confirmedQuantity: 2,
              unitPrice: 25,
              lineTotal: 50,
            },
          ],
        })),
        getInventoryRepository: vi.fn(() => ({
          getAvailableBatch: vi.fn(async () => ({
            _id: batchId,
            medicineId,
            quantityOnHand: 100,
            salePrice: 25,
          })),
          updateBatchQuantity: vi.fn(async () => true),
          refreshInventorySnapshot: vi.fn(async () => ({ availableQuantity: 98 })),
          createMovement: vi.fn(async () => {}),
        })),
        getBillingRepository: vi.fn(() => ({
          createInvoice: vi.fn(async () => ({
            id: invoiceId,
            invoice_number: 'INV-PHARM-1',
            total_amount: 50,
            balance_amount: 50,
            status: 'PENDING',
          })),
          updateInvoice: vi.fn(async () => true),
        })),
        confirm: vi.fn(async () => true),
        getPrescriptionRepository: vi.fn(() => ({
          updateStatusIf: vi.fn(async () => true),
        })),
        audit: vi.fn(async () => {}),
        getByPrescription: vi.fn(async () => ({ id: 'dispensing-1', status: 'CONFIRMED' })),
      } as unknown as PharmacyDispensingRepository;

      const pharmacyService = new PharmacyDispensingService(mockRepo, notificationService);

      // Confirm prescription
      const result = await pharmacyService.confirm(
        createObjectId(),
        1,
        'idempotency-key-1',
        actorUserId,
        dummyMetadata,
      );

      expect(result).toBeDefined();

      // Verify that notification was created post-commit
      const notifs = await NotificationModel.find({
        type: 'INVOICE_PENDING',
        relatedEntityId: new Types.ObjectId(invoiceId),
      }).lean();

      expect(notifs).toHaveLength(2);
      expect(notifs.map((n) => n.recipientUserId?.toString())).toContain(patientPortalUserId);
      expect(notifs.map((n) => n.recipientUserId?.toString())).toContain(guardianUserId);
      expect(notifs[0].message).toContain('50');
    });

    it('PharmacyDispensingService.confirm transaction failure suppresses invoice notification', async () => {
      const mockRepo = {
        authorized: vi.fn(async () => true),
        getPrescription: vi.fn(async () => ({
          _id: new Types.ObjectId(),
          patientId: new Types.ObjectId(patientId),
          branchId: new Types.ObjectId(branchId),
          visitId: new Types.ObjectId(),
          status: 'SUBMITTED',
          items: [{ _id: new Types.ObjectId(), quantity: 2, medicineName: 'Amoxicillin' }],
        })),
        getVisit: vi.fn(async () => ({
          _id: new Types.ObjectId(),
          branchId: new Types.ObjectId(branchId),
          visitType: 'OPD',
          appointmentId: null,
        })),
        getRawByPrescription: vi.fn(async () => ({
          _id: new Types.ObjectId(),
          status: 'DRAFT',
          version: 1,
          items: [
            {
              _id: new Types.ObjectId(),
              prescriptionItemId: new Types.ObjectId(),
              medicineName: 'Amoxicillin',
              medicineId: new Types.ObjectId(),
              batchId: new Types.ObjectId(),
              requestedQuantity: 2,
              confirmedQuantity: 2,
              unitPrice: 25,
              lineTotal: 50,
            },
          ],
        })),
        getInventoryRepository: vi.fn(() => ({
          // Stock shortfall throws inside transaction
          getAvailableBatch: vi.fn(async () => ({
            _id: new Types.ObjectId(),
            medicineId: new Types.ObjectId(),
            quantityOnHand: 0,
            salePrice: 25,
          })),
        })),
      } as unknown as PharmacyDispensingRepository;

      const notifySpy = vi.spyOn(notificationService, 'notifyPatient');
      const pharmacyService = new PharmacyDispensingService(mockRepo, notificationService);

      await expect(
        pharmacyService.confirm(
          createObjectId(),
          1,
          'idempotency-key-fail',
          actorUserId,
          dummyMetadata,
        ),
      ).rejects.toThrow();

      expect(notifySpy).not.toHaveBeenCalled();
      const notifs = await NotificationModel.find({ type: 'INVOICE_PENDING' }).lean();
      expect(notifs).toHaveLength(0);
    });
  });

  describe('Authorization, Revocation and Durable Retry Guarantees', () => {
    it('revoked access grant denies delivery of pending invoice notifications', async () => {
      // Revoke the guardian grant
      await PatientAccessGrantModel.updateOne(
        { userId: new Types.ObjectId(guardianUserId), patientId: new Types.ObjectId(patientId) },
        { $set: { revokedAt: new Date() } },
      );

      const invoice = await billingService.createProcedureBookingInvoice(
        {
          patient_id: patientId,
          branch_id: branchId,
          booking_id: createObjectId(),
          service: { id: createObjectId(), name: 'General Check', standardPrice: 300 },
        },
        actorUserId,
        dummyMetadata,
      );

      const notifs = await NotificationModel.find({
        type: 'INVOICE_PENDING',
        relatedEntityId: new Types.ObjectId(invoice.id),
      }).lean();

      const recipientIds = notifs.map((n) => n.recipientUserId?.toString());
      expect(recipientIds).toContain(patientPortalUserId);
      expect(recipientIds).not.toContain(guardianUserId); // Revoked guardian must NOT receive notification
    });

    it('inactive user account is excluded from invoice notifications', async () => {
      // Deactivate patient portal account
      await UserModel.updateOne(
        { _id: new Types.ObjectId(patientPortalUserId) },
        { $set: { status: 'inactive' } },
      );

      const invoice = await billingService.createProcedureBookingInvoice(
        {
          patient_id: patientId,
          branch_id: branchId,
          booking_id: createObjectId(),
          service: { id: createObjectId(), name: 'Test Procedure', standardPrice: 400 },
        },
        actorUserId,
        dummyMetadata,
      );

      const notifs = await NotificationModel.find({
        type: 'INVOICE_PENDING',
        relatedEntityId: new Types.ObjectId(invoice.id),
      }).lean();
      const recipientIds = notifs.map((n) => n.recipientUserId?.toString());
      expect(recipientIds).not.toContain(patientPortalUserId); // Inactive account must NOT receive notification
      expect(recipientIds).toContain(guardianUserId); // Active guardian still receives it
    });

    it('notification failure does not cause caller business operation to fail', async () => {
      vi.spyOn(notificationRepo, 'createPatientNotifications').mockRejectedValueOnce(
        new Error('Transient Mongo cluster disconnection'),
      );

      // Business operation succeeds smoothly
      const invoice = await billingService.createProcedureBookingInvoice(
        {
          patient_id: patientId,
          branch_id: branchId,
          booking_id: createObjectId(),
          service: { id: createObjectId(), name: 'Procedure Safe', standardPrice: 500 },
        },
        actorUserId,
        dummyMetadata,
      );

      expect(invoice).toBeDefined();
      expect(invoice.balance_amount).toBe(500);
    });

    it('failure after business commit does not permanently lose notification intent; lazy reconciliation recovers it', async () => {
      // Simulate failure between business commit and proactive dispatch:
      // An invoice is committed in MongoDB, but notifyPatient failed or was never reached due to crash.
      const invoice = await BillingInvoiceModel.create({
        invoiceNumber: 'INV-CRASH-RECOVER',
        patientId: new Types.ObjectId(patientId),
        visitId: new Types.ObjectId(),
        sourceType: 'OPD',
        branchId: new Types.ObjectId(branchId),
        invoiceDate: new Date(),
        status: 'PENDING',
        subtotal: 750,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 750,
        paidAmount: 0,
        balanceAmount: 750,
      });

      // Initially, no notification exists in NotificationModel
      expect(
        await NotificationModel.countDocuments({ relatedEntityId: invoice._id }),
      ).toBe(0);

      // When the user lists notifications, lazy reconciliation recovers the pending invoice
      const result = await notificationService.listForUser(patientPortalUserId, { page: 1, limit: 10 });

      expect(
        await NotificationModel.countDocuments({ relatedEntityId: invoice._id }),
      ).toBe(1);

      const recoveredNotif = result.data.find(
        (n) => n.related_entity_id === invoice._id.toString(),
      );
      expect(recoveredNotif).toBeDefined();
      expect(recoveredNotif?.type).toBe('INVOICE_PENDING');
      expect(recoveredNotif?.message).toContain('750');

      // Repeated sync does not create duplicate notification records
      await notificationService.listForUser(patientPortalUserId, { page: 1, limit: 10 });
      expect(
        await NotificationModel.countDocuments({ relatedEntityId: invoice._id }),
      ).toBe(1);
    });

    it('revoked recipient is excluded from lazy reconciliation recovery', async () => {
      // Revoke the guardian grant
      await PatientAccessGrantModel.updateOne(
        { userId: new Types.ObjectId(guardianUserId), patientId: new Types.ObjectId(patientId) },
        { $set: { revokedAt: new Date() } },
      );

      const invoice = await BillingInvoiceModel.create({
        invoiceNumber: 'INV-REVOKED-SYNC',
        patientId: new Types.ObjectId(patientId),
        visitId: new Types.ObjectId(),
        sourceType: 'OPD',
        branchId: new Types.ObjectId(branchId),
        invoiceDate: new Date(),
        status: 'PENDING',
        subtotal: 600,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: 600,
        paidAmount: 0,
        balanceAmount: 600,
      });

      // Guardian attempts to sync notifications
      const result = await notificationService.listForUser(guardianUserId, { page: 1, limit: 10 });

      // Revoked guardian must not recover or see notifications for this patient
      const notifsForInvoice = await NotificationModel.find({
        recipientUserId: new Types.ObjectId(guardianUserId),
        relatedEntityId: invoice._id,
      }).lean();

      expect(notifsForInvoice).toHaveLength(0);
      expect(result.data.find((n) => n.related_entity_id === invoice._id.toString())).toBeUndefined();
    });
  });
});
