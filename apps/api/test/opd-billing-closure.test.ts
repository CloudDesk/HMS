import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { AppError } from '../src/shared/errors/app-error.js';
import { setupTestDatabase, teardownTestDatabase, clearTestDatabase } from './setup.js';
import { createObjectId } from './factories.js';
import { BillingInvoiceModel } from '../src/modules/billing/billing.model.js';
import { BillingRepository } from '../src/modules/billing/billing.repository.js';
import { BillingService } from '../src/modules/billing/billing.service.js';
import { OpdVisitService } from '../src/modules/opd/opd-visit.service.js';
import { OpdConsultationService } from '../src/modules/opd/opd-consultation.service.js';
import type { OpdVisit } from '../src/modules/opd/opd-visit.types.js';

describe('OPD Billing Closure Enforcement Tests (Finding H6)', () => {
  const branchId = createObjectId();
  const actorUserId = createObjectId();
  const patientId = createObjectId();
  const doctorId = createObjectId();
  const departmentId = createObjectId();
  const visitId = createObjectId();

  let billingRepository: BillingRepository;
  let billingService: BillingService;

  beforeAll(async () => {
    await setupTestDatabase();
    billingRepository = new BillingRepository();
    billingService = new BillingService(
      billingRepository,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }, 30000);

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  const sampleVisit: OpdVisit = {
    id: visitId,
    visit_number: 'OPD-1001',
    queue_token_number: 1,
    appointment_id: null,
    patient_id: patientId,
    patient_number: 'P-1001',
    patient_name: 'Jane Doe',
    doctor_id: doctorId,
    doctor_name: 'Dr. Smith',
    doctor_specialization: 'General Medicine',
    branch_id: branchId,
    department_id: departmentId,
    visit_date: new Date(),
    check_in_time: new Date(),
    visit_type: 'NEW_CONSULTATION',
    priority: 'ROUTINE',
    status: 'IN_CONSULTATION',
    reason: 'Fever and cold',
    notes: 'In consultation with doctor',
    created_by: actorUserId,
    updated_by: actorUserId,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const createTestInvoice = async (overrides: Partial<Parameters<typeof BillingInvoiceModel.create>[0][0]> = {}) => {
    return (await BillingInvoiceModel.create([{
      invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      patientId: new Types.ObjectId(patientId),
      visitId: new Types.ObjectId(visitId),
      encounterId: new Types.ObjectId(visitId),
      branchId: new Types.ObjectId(branchId),
      invoiceDate: new Date(),
      status: 'DRAFT',
      subtotal: 500,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 500,
      paidAmount: 0,
      balanceAmount: 500,
      createdBy: new Types.ObjectId(actorUserId),
      updatedBy: new Types.ObjectId(actorUserId),
      ...overrides,
    }]))[0];
  };

  const setupOpdVisitService = () => {
    const mockVisitRepo = {
      resolveBranchScope: vi.fn(async () => [branchId]),
      getById: vi.fn(async () => sampleVisit),
      updateStatus: vi.fn(async (_id, data) => ({ ...sampleVisit, ...data })),
      auditStatusTransition: vi.fn(async () => {}),
    };
    const mockConsultationRepo = {
      getByVisit: vi.fn(async () => ({ id: createObjectId(), status: 'COMPLETED' })),
    };
    const mockPatientRepo = {
      addTimelineEvent: vi.fn(async () => {}),
    };
    const mockDoctorRepo = {
      getByUserId: vi.fn(async () => ({ id: doctorId })),
    };
    const mockAppointmentRepo = {
      getById: vi.fn(async () => null),
      updateStatus: vi.fn(async () => null),
      auditStatusTransition: vi.fn(async () => {}),
    };

    const visitService = new OpdVisitService(
      mockVisitRepo as any,
      mockAppointmentRepo as any,
      mockPatientRepo as any,
      mockDoctorRepo as any,
      mockConsultationRepo as any,
      {} as any,
      {} as any,
      billingService,
    );

    return { visitService, mockVisitRepo, mockConsultationRepo };
  };

  const setupOpdConsultationService = () => {
    const mockConsultationRepo = {
      getByVisit: vi.fn(async () => null),
      saveForVisit: vi.fn(async (data: any) => ({ id: createObjectId(), status: 'COMPLETED', ...data })),
    };
    const mockVisitRepo = {
      resolveBranchScope: vi.fn(async () => [branchId]),
      getById: vi.fn(async () => sampleVisit),
      updateStatus: vi.fn(async (_id, data) => ({ ...sampleVisit, ...data })),
    };
    const mockVitalsRepo = {
      getByVisit: vi.fn(async () => ({ id: createObjectId() })),
      getLatestByVisit: vi.fn(async () => ({ id: createObjectId() })),
    };
    const mockPatientRepo = {
      addTimelineEvent: vi.fn(async () => {}),
      auditClinicalEvent: vi.fn(async () => {}),
    };
    const mockAppointmentRepo = {
      getPatientPreConsultationByAppointmentId: vi.fn(async () => null),
      updateStatus: vi.fn(async () => null),
    };

    const consultationService = new OpdConsultationService(
      mockConsultationRepo as any,
      mockVisitRepo as any,
      mockVitalsRepo as any,
      mockPatientRepo as any,
      mockAppointmentRepo as any,
      { validateAssessment: vi.fn(async () => {}) } as any,
      billingService,
    );

    return { consultationService, mockVisitRepo, mockConsultationRepo };
  };

  describe('1. BillingRepository.hasUnresolvedInvoicesForEncounter', () => {
    it('returns true when DRAFT invoice with positive balance exists', async () => {
      await createTestInvoice({ status: 'DRAFT', balanceAmount: 500, totalAmount: 500 });
      const unresolved = await billingRepository.hasUnresolvedInvoicesForEncounter(visitId);
      expect(unresolved).toBe(true);
    });

    it('returns true when PENDING invoice with positive balance exists', async () => {
      await createTestInvoice({ status: 'PENDING', balanceAmount: 300, totalAmount: 300 });
      const unresolved = await billingRepository.hasUnresolvedInvoicesForEncounter(visitId);
      expect(unresolved).toBe(true);
    });

    it('returns true when PARTIALLY_PAID invoice with positive balance exists', async () => {
      await createTestInvoice({
        status: 'PARTIALLY_PAID',
        paidAmount: 200,
        balanceAmount: 100,
        totalAmount: 300,
      });
      const unresolved = await billingRepository.hasUnresolvedInvoicesForEncounter(visitId);
      expect(unresolved).toBe(true);
    });

    it('returns false when invoice is PAID and balance is 0', async () => {
      await createTestInvoice({
        status: 'PAID',
        paidAmount: 500,
        balanceAmount: 0,
        totalAmount: 500,
      });
      const unresolved = await billingRepository.hasUnresolvedInvoicesForEncounter(visitId);
      expect(unresolved).toBe(false);
    });

    it('returns false when invoice is CANCELLED', async () => {
      await createTestInvoice({
        status: 'CANCELLED',
        balanceAmount: 0,
        totalAmount: 500,
      });
      const unresolved = await billingRepository.hasUnresolvedInvoicesForEncounter(visitId);
      expect(unresolved).toBe(false);
    });

    it('returns false when invoice is waived / zero balance (balanceAmount = 0)', async () => {
      await createTestInvoice({
        status: 'PAID',
        discountAmount: 500,
        balanceAmount: 0,
        totalAmount: 0,
      });
      const unresolved = await billingRepository.hasUnresolvedInvoicesForEncounter(visitId);
      expect(unresolved).toBe(false);
    });

    it('returns false when invoice is soft-deleted', async () => {
      await createTestInvoice({
        status: 'PENDING',
        balanceAmount: 500,
        deletedAt: new Date(),
      });
      const unresolved = await billingRepository.hasUnresolvedInvoicesForEncounter(visitId);
      expect(unresolved).toBe(false);
    });

    it('returns false when visit has no invoices at all (zero charges recorded)', async () => {
      const unresolved = await billingRepository.hasUnresolvedInvoicesForEncounter(visitId);
      expect(unresolved).toBe(false);
    });

    it('correctly matches invoice associated by visitId even if encounterId is null', async () => {
      await createTestInvoice({
        encounterId: null,
        visitId: new Types.ObjectId(visitId),
        status: 'PENDING',
        balanceAmount: 250,
      });
      const unresolved = await billingRepository.hasUnresolvedInvoicesForEncounter(visitId);
      expect(unresolved).toBe(true);
    });
  });

  describe('2. OpdVisitService.updateStatus -> COMPLETED enforcement', () => {
    it('blocks visit completion when an invoice is unpaid (DRAFT) with 409 OPD_BILLING_CLOSURE_REQUIRED', async () => {
      await createTestInvoice({ status: 'DRAFT', balanceAmount: 500, totalAmount: 500 });
      const { visitService } = setupOpdVisitService();

      await expect(
        visitService.updateStatus(visitId, { status: 'COMPLETED', notes: 'Consultation concluded' }, actorUserId),
      ).rejects.toSatisfy((err: unknown) => {
        return err instanceof AppError &&
          err.statusCode === 409 &&
          err.code === 'OPD_BILLING_CLOSURE_REQUIRED';
      });
    });

    it('blocks visit completion when an invoice is PENDING with 409 OPD_BILLING_CLOSURE_REQUIRED', async () => {
      await createTestInvoice({ status: 'PENDING', balanceAmount: 350, totalAmount: 350 });
      const { visitService } = setupOpdVisitService();

      await expect(
        visitService.updateStatus(visitId, { status: 'COMPLETED', notes: 'Patient finished consultation' }, actorUserId),
      ).rejects.toSatisfy((err: unknown) => {
        return err instanceof AppError &&
          err.statusCode === 409 &&
          err.code === 'OPD_BILLING_CLOSURE_REQUIRED';
      });
    });

    it('blocks visit completion when an invoice is PARTIALLY_PAID with remaining balance', async () => {
      await createTestInvoice({
        status: 'PARTIALLY_PAID',
        paidAmount: 200,
        balanceAmount: 150,
        totalAmount: 350,
      });
      const { visitService } = setupOpdVisitService();

      await expect(
        visitService.updateStatus(visitId, { status: 'COMPLETED', notes: 'Finished' }, actorUserId),
      ).rejects.toSatisfy((err: unknown) => {
        return err instanceof AppError &&
          err.statusCode === 409 &&
          err.code === 'OPD_BILLING_CLOSURE_REQUIRED';
      });
    });

    it('allows visit completion when invoice is fully PAID', async () => {
      await createTestInvoice({
        status: 'PAID',
        paidAmount: 500,
        balanceAmount: 0,
        totalAmount: 500,
      });
      const { visitService, mockVisitRepo } = setupOpdVisitService();

      const result = await visitService.updateStatus(
        visitId,
        { status: 'COMPLETED', notes: 'Consultation successfully closed' },
        actorUserId,
      );

      expect(result.status).toBe('COMPLETED');
      expect(mockVisitRepo.updateStatus).toHaveBeenCalled();
    });

    it('allows visit completion when invoice has 0 balance (waived charges / 100% discount)', async () => {
      await createTestInvoice({
        status: 'PAID',
        discountAmount: 500,
        balanceAmount: 0,
        totalAmount: 0,
      });
      const { visitService, mockVisitRepo } = setupOpdVisitService();

      const result = await visitService.updateStatus(
        visitId,
        { status: 'COMPLETED', notes: 'Free consultation / waived charges' },
        actorUserId,
      );

      expect(result.status).toBe('COMPLETED');
      expect(mockVisitRepo.updateStatus).toHaveBeenCalled();
    });

    it('allows visit completion when visit has zero charges recorded (no invoice exists)', async () => {
      const { visitService, mockVisitRepo } = setupOpdVisitService();

      const result = await visitService.updateStatus(
        visitId,
        { status: 'COMPLETED', notes: 'Routine check-up closed' },
        actorUserId,
      );

      expect(result.status).toBe('COMPLETED');
      expect(mockVisitRepo.updateStatus).toHaveBeenCalled();
    });

    it('allows visit completion when invoice was CANCELLED', async () => {
      await createTestInvoice({
        status: 'CANCELLED',
        balanceAmount: 0,
        totalAmount: 500,
      });
      const { visitService, mockVisitRepo } = setupOpdVisitService();

      const result = await visitService.updateStatus(
        visitId,
        { status: 'COMPLETED', notes: 'Cancelled invoice and closed visit' },
        actorUserId,
      );

      expect(result.status).toBe('COMPLETED');
      expect(mockVisitRepo.updateStatus).toHaveBeenCalled();
    });

    it('blocks visit completion when multi-service charges have one unsettled invoice among multiple', async () => {
      // First invoice is paid
      await createTestInvoice({
        status: 'PAID',
        paidAmount: 200,
        balanceAmount: 0,
        totalAmount: 200,
      });
      // Second invoice (e.g. lab/imaging) is still pending
      await createTestInvoice({
        status: 'PENDING',
        balanceAmount: 300,
        totalAmount: 300,
      });
      const { visitService } = setupOpdVisitService();

      await expect(
        visitService.updateStatus(visitId, { status: 'COMPLETED', notes: 'Closing with pending lab invoice' }, actorUserId),
      ).rejects.toSatisfy((err: unknown) => {
        return err instanceof AppError && err.code === 'OPD_BILLING_CLOSURE_REQUIRED';
      });
    });

    it('allows visit completion once all multi-service invoices are settled', async () => {
      await createTestInvoice({
        status: 'PAID',
        paidAmount: 200,
        balanceAmount: 0,
        totalAmount: 200,
      });
      await createTestInvoice({
        status: 'PAID',
        paidAmount: 300,
        balanceAmount: 0,
        totalAmount: 300,
      });
      const { visitService, mockVisitRepo } = setupOpdVisitService();

      const result = await visitService.updateStatus(
        visitId,
        { status: 'COMPLETED', notes: 'All multi-service bills cleared' },
        actorUserId,
      );

      expect(result.status).toBe('COMPLETED');
      expect(mockVisitRepo.updateStatus).toHaveBeenCalled();
    });

    it('still requires consultation completion before checking billing', async () => {
      const { visitService, mockConsultationRepo } = setupOpdVisitService();
      mockConsultationRepo.getByVisit.mockResolvedValueOnce({ id: createObjectId(), status: 'DRAFT' } as any);

      await expect(
        visitService.updateStatus(visitId, { status: 'COMPLETED', notes: 'Notes' }, actorUserId),
      ).rejects.toSatisfy((err: unknown) => {
        return err instanceof AppError && err.code === 'CONSULTATION_NOT_COMPLETED';
      });
    });
  });

  describe('3. OpdConsultationService.complete enforcement', () => {
    it('blocks direct consultation completion when visit has an unresolved invoice', async () => {
      await createTestInvoice({ status: 'PENDING', balanceAmount: 400, totalAmount: 400 });
      const { consultationService } = setupOpdConsultationService();

      await expect(
        consultationService.complete(
          visitId,
          { assessment: 'Patient assessed with fever' },
          actorUserId,
        ),
      ).rejects.toSatisfy((err: unknown) => {
        return err instanceof AppError &&
          err.statusCode === 409 &&
          err.code === 'OPD_BILLING_CLOSURE_REQUIRED';
      });
    });

    it('allows direct consultation completion when billing is settled', async () => {
      await createTestInvoice({
        status: 'PAID',
        paidAmount: 400,
        balanceAmount: 0,
        totalAmount: 400,
      });
      const { consultationService, mockVisitRepo } = setupOpdConsultationService();

      const result = await consultationService.complete(
        visitId,
        { assessment: 'Patient assessed with fever, recovered' },
        actorUserId,
      );

      expect(result.status).toBe('COMPLETED');
      expect(mockVisitRepo.updateStatus).toHaveBeenCalledWith(
        visitId,
        expect.objectContaining({ status: 'COMPLETED' }),
        actorUserId,
      );
    });

    it('allows direct consultation completion when no charges exist (zero-charge visit)', async () => {
      const { consultationService, mockVisitRepo } = setupOpdConsultationService();

      const result = await consultationService.complete(
        visitId,
        { assessment: 'Patient assessed; no billable orders' },
        actorUserId,
      );

      expect(result.status).toBe('COMPLETED');
      expect(mockVisitRepo.updateStatus).toHaveBeenCalledWith(
        visitId,
        expect.objectContaining({ status: 'COMPLETED' }),
        actorUserId,
      );
    });
  });
});
