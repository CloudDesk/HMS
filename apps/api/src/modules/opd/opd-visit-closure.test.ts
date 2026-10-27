import Fastify from 'fastify';
import { Types } from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServiceRegistry } from '../../shared/services/service-registry.js';
import { registerErrorHandler } from '../../middleware/error-handler.js';
import { OpdVisitRepository } from './opd-visit.repository.js';
import { OpdConsultationRepository } from './opd-consultation.repository.js';
import { AppointmentRepository } from '../appointments/appointment.repository.js';
import { PatientRepository } from '../patients/patient.repository.js';
import { BillingInvoiceModel } from '../billing/billing.model.js';
import { OpdPrescriptionModel } from './opd-prescription.model.js';
import { PharmacyDispensingModel } from '../pharmacy-dispensing/pharmacy-dispensing.model.js';
import { OphthalmologyAlertModel } from '../ophthalmology/ophthalmology-intake.model.js';
import { OphthalmologyConsultationFinalizationModel } from '../ophthalmology/ophthalmology-consultation.model.js';
import { registerOpdVisitRoutes } from './opd-visit.routes.js';
import type { OpdVisit } from './opd-visit.types.js';

vi.mock('../../shared/database/transaction.js', () => ({
  executeRequiredTransaction: vi.fn(async (_repo: unknown, callback: (session: unknown) => Promise<unknown>) => callback({ inTransaction: () => true })),
  executeTransaction: vi.fn(async (_repo: unknown, callback: (session: unknown) => Promise<unknown>) => callback({ inTransaction: () => true })),
}));

describe('Phase 7B-2 OPD Visit Closure API (POST /api/opd/visits/:id/close-journey)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setupTest = (overrides?: {
    visitStatus?: OpdVisit['status'];
    consultationStatus?: string;
    isOph?: boolean;
    hasFinalization?: boolean;
    hasActiveEmergency?: boolean;
    invoices?: Array<{ status: string; balanceAmount: number; totalAmount: number }>;
    prescriptions?: Array<{ status: string; _id: Types.ObjectId }>;
    dispensingRecords?: Array<{ status: string; items: Array<{ requestedQuantity: number; confirmedQuantity: number }> }>;
    hasAppointment?: boolean;
  }) => {
    const visitId = new Types.ObjectId().toString();
    const patientId = new Types.ObjectId().toString();
    const branchId = new Types.ObjectId().toString();
    const departmentId = new Types.ObjectId().toString();
    const doctorId = new Types.ObjectId().toString();
    const appointmentId = overrides?.hasAppointment !== false ? new Types.ObjectId().toString() : null;
    const actor = new Types.ObjectId().toString();

    const visit: OpdVisit = {
      id: visitId,
      visit_number: 'OPD-2026-TEST',
      queue_token_number: 1,
      appointment_id: appointmentId,
      patient_id: patientId,
      patient_number: 'P-001',
      patient_name: 'Test Patient',
      doctor_id: doctorId,
      doctor_name: 'Dr. Specialist',
      doctor_specialization: 'Ophthalmology',
      branch_id: branchId,
      department_id: departmentId,
      visit_date: new Date(),
      check_in_time: new Date(),
      visit_type: 'NEW_CONSULTATION',
      priority: 'ROUTINE',
      status: overrides?.visitStatus ?? 'CLINICALLY_COMPLETED',
      version: 1,
      reason: null,
      notes: null,
      created_by: actor,
      updated_by: actor,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.spyOn(OpdVisitRepository.prototype, 'resolveBranchScope').mockResolvedValue([branchId]);
    vi.spyOn(OpdVisitRepository.prototype, 'getById').mockResolvedValue(visit);
    vi.spyOn(OpdVisitRepository.prototype, 'updateStatusIf').mockImplementation(async (_id, _allowed, data) => ({
      ...visit,
      status: data.status,
      version: visit.version + 1,
    }));
    vi.spyOn(OpdVisitRepository.prototype, 'auditStatusTransition').mockResolvedValue(undefined as never);
    vi.spyOn(PatientRepository.prototype, 'addTimelineEvent').mockResolvedValue({ id: 't1' } as never);

    vi.spyOn(AppointmentRepository.prototype, 'isOphthalmologyDepartment').mockResolvedValue(overrides?.isOph ?? true);
    vi.spyOn(AppointmentRepository.prototype, 'updateStatus').mockResolvedValue({ id: appointmentId } as never);

    vi.spyOn(OpdConsultationRepository.prototype, 'getByVisit').mockResolvedValue(
      overrides?.consultationStatus === null
        ? null
        : ({ id: 'c1', status: overrides?.consultationStatus ?? 'COMPLETED', version: 1 } as never),
    );

    // Mock Mongoose queries
    vi.spyOn(OphthalmologyConsultationFinalizationModel, 'findOne').mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(overrides?.hasFinalization !== false ? { id: 'f1', status: 'COMPLETED' } : null),
    } as never);

    vi.spyOn(OphthalmologyAlertModel, 'findOne').mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(overrides?.hasActiveEmergency ? { id: 'a1', type: 'EMERGENCY_SCREENING', status: 'ACTIVE' } : null),
    } as never);

    const invoiceList = overrides?.invoices ?? [{ status: 'PAID', balanceAmount: 0, totalAmount: 500 }];
    vi.spyOn(BillingInvoiceModel, 'find').mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(invoiceList),
    } as never);

    const prescriptionList = overrides?.prescriptions ?? [];
    vi.spyOn(OpdPrescriptionModel, 'find').mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(prescriptionList),
    } as never);

    const dispensingList = overrides?.dispensingRecords ?? [];
    vi.spyOn(PharmacyDispensingModel, 'find').mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(dispensingList),
    } as never);

    const services = createServiceRegistry();
    vi.spyOn(services.auth, 'authenticateAccessToken').mockResolvedValue({
      id: actor,
      username: 'cashier',
      fullName: 'Cashier User',
      email: null,
      status: 'active',
      patientId: null,
    });
    vi.spyOn(services.permissions, 'userHasPermission').mockResolvedValue(true);
    vi.spyOn(services.permissions, 'auditDeniedAccess').mockResolvedValue(undefined as never);

    return { services, visitId, actor, branchId, appointmentId };
  };

  it('closes journey successfully when signed, settled, and dispensed', async () => {
    const rxId = new Types.ObjectId();
    const { services, visitId } = setupTest({
      visitStatus: 'CLINICALLY_COMPLETED',
      invoices: [{ status: 'PAID', balanceAmount: 0, totalAmount: 1000 }],
      prescriptions: [{ status: 'DISPENSED', _id: rxId }],
      dispensingRecords: [{ status: 'CONFIRMED', items: [{ requestedQuantity: 10, confirmedQuantity: 10 }] }],
    });

    const app = Fastify();
    registerErrorHandler(app);
    await registerOpdVisitRoutes(app, services);

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${visitId}/close-journey`,
        headers: { authorization: 'Bearer token' },
        payload: { notes: 'Settled in full' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.success).toBe(true);
      expect(body.data.visit.status).toBe('COMPLETED');
      expect(body.data.settlement.billing_settled).toBe(true);
      expect(body.data.settlement.dispensing_settled).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('blocks closure with 409 when invoice balance is outstanding', async () => {
    const { services, visitId } = setupTest({
      invoices: [{ status: 'PARTIALLY_PAID', balanceAmount: 250, totalAmount: 500 }],
    });

    const app = Fastify();
    registerErrorHandler(app);
    await registerOpdVisitRoutes(app, services);

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${visitId}/close-journey`,
        headers: { authorization: 'Bearer token' },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('OPD_BILLING_SETTLEMENT_PENDING');
      expect(response.json().error.message).toContain('outstanding invoice balance');
    } finally {
      await app.close();
    }
  });

  it('blocks closure with 409 when prescription is still SUBMITTED', async () => {
    const rxId = new Types.ObjectId();
    const { services, visitId } = setupTest({
      prescriptions: [{ status: 'SUBMITTED', _id: rxId }],
    });

    const app = Fastify();
    registerErrorHandler(app);
    await registerOpdVisitRoutes(app, services);

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${visitId}/close-journey`,
        headers: { authorization: 'Bearer token' },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('OPD_MEDICATION_DISPENSING_PENDING');
      expect(response.json().error.message).toContain('medication dispensing is incomplete');
    } finally {
      await app.close();
    }
  });

  it('blocks closure when medication is only partially dispensed', async () => {
    const rxId = new Types.ObjectId();
    const { services, visitId } = setupTest({
      prescriptions: [{ status: 'DISPENSED', _id: rxId }],
      dispensingRecords: [{ status: 'CONFIRMED', items: [{ requestedQuantity: 10, confirmedQuantity: 5 }] }],
    });

    const app = Fastify();
    registerErrorHandler(app);
    await registerOpdVisitRoutes(app, services);

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${visitId}/close-journey`,
        headers: { authorization: 'Bearer token' },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('OPD_MEDICATION_DISPENSING_PENDING');
    } finally {
      await app.close();
    }
  });

  it('satisfies dispensing gate when no medication is prescribed', async () => {
    const { services, visitId } = setupTest({
      prescriptions: [],
    });

    const app = Fastify();
    registerErrorHandler(app);
    await registerOpdVisitRoutes(app, services);

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${visitId}/close-journey`,
        headers: { authorization: 'Bearer token' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.settlement.dispensing_settled).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('blocks closure when clinical sign-off is missing (not CLINICALLY_COMPLETED)', async () => {
    const { services, visitId } = setupTest({
      visitStatus: 'IN_CONSULTATION',
    });

    const app = Fastify();
    registerErrorHandler(app);
    await registerOpdVisitRoutes(app, services);

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${visitId}/close-journey`,
        headers: { authorization: 'Bearer token' },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('OPD_CLINICAL_COMPLETION_PENDING');
    } finally {
      await app.close();
    }
  });

  it('blocks closure when emergency restriction is unresolved', async () => {
    const { services, visitId } = setupTest({
      hasActiveEmergency: true,
    });

    const app = Fastify();
    registerErrorHandler(app);
    await registerOpdVisitRoutes(app, services);

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${visitId}/close-journey`,
        headers: { authorization: 'Bearer token' },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('OPD_EMERGENCY_RESTRICTION_ACTIVE');
    } finally {
      await app.close();
    }
  });

  it('denies closure with 403 when user lacks OPD Visits Edit permission', async () => {
    const { services, visitId } = setupTest();
    vi.spyOn(services.permissions, 'userHasPermission').mockResolvedValue(false);

    const app = Fastify();
    registerErrorHandler(app);
    await registerOpdVisitRoutes(app, services);

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${visitId}/close-journey`,
        headers: { authorization: 'Bearer token' },
      });

      expect(response.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  });

  it('returns idempotent 200 on repeated closure requests', async () => {
    const { services, visitId } = setupTest({
      visitStatus: 'COMPLETED',
    });

    const app = Fastify();
    registerErrorHandler(app);
    await registerOpdVisitRoutes(app, services);

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${visitId}/close-journey`,
        headers: { authorization: 'Bearer token' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.message).toContain('already completed');
    } finally {
      await app.close();
    }
  });

  it('completes linked appointment atomically with visit', async () => {
    const { services, visitId, appointmentId } = setupTest();
    const updateApptSpy = vi.spyOn(AppointmentRepository.prototype, 'updateStatus');

    const app = Fastify();
    registerErrorHandler(app);
    await registerOpdVisitRoutes(app, services);

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/opd/visits/${visitId}/close-journey`,
        headers: { authorization: 'Bearer token' },
      });

      expect(response.statusCode).toBe(200);
      expect(updateApptSpy).toHaveBeenCalledWith(
        appointmentId,
        expect.objectContaining({ status: 'COMPLETED' }),
        expect.any(String),
        expect.any(Array),
        expect.anything(),
      );
    } finally {
      await app.close();
    }
  });
});
