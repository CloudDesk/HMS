import mongoose, { Schema, Types } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../shared/errors/app-error.js';
import { executeRequiredTransaction } from '../../shared/database/transaction.js';
import type { PatientRepository } from '../patients/patient.repository.js';
import type { ServiceRepository } from '../services/service.repository.js';
import { OpdClinicalOrderModel } from './opd-clinical-order.model.js';
import { OpdClinicalOrderRepository } from './opd-clinical-order.repository.js';
import { OpdClinicalOrderService } from './opd-clinical-order.service.js';
import type { OpdClinicalOrder } from './opd-clinical-order.types.js';
import { OpdConsultationModel } from './opd-consultation.model.js';
import { OpdConsultationRepository } from './opd-consultation.repository.js';
import { OpdVisitModel } from './opd-visit.model.js';
import { OpdVisitRepository } from './opd-visit.repository.js';
import type { OpdVisit } from './opd-visit.types.js';

const transactionProbeSchema = new Schema({ value: { type: String, required: true } });
const TransactionProbeModel = mongoose.models.Phase1TransactionProbe
  ?? mongoose.model('Phase1TransactionProbe', transactionProbeSchema);

const actorId = new Types.ObjectId().toString();
const visit: OpdVisit = {
  id: new Types.ObjectId().toString(),
  visit_number: 'OPD-PHASE1-001',
  queue_token_number: 1,
  appointment_id: null,
  patient_id: new Types.ObjectId().toString(),
  patient_number: 'P-001',
  patient_name: 'Phase One Patient',
  doctor_id: new Types.ObjectId().toString(),
  doctor_name: 'Dr Phase One',
  doctor_specialization: 'Ophthalmology',
  branch_id: new Types.ObjectId().toString(),
  department_id: new Types.ObjectId().toString(),
  visit_date: new Date(),
  check_in_time: new Date(),
  visit_type: 'NEW_CONSULTATION',
  priority: 'ROUTINE',
  status: 'IN_CONSULTATION',
  version: 0,
  reason: null,
  notes: null,
  created_by: actorId,
  updated_by: actorId,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('OPD Phase 1 shared-contract hardening', () => {
  let mongo: MongoMemoryReplSet;
  const consultationRepository = new OpdConsultationRepository();
  const clinicalOrderRepository = new OpdClinicalOrderRepository();
  const visitRepository = new OpdVisitRepository();

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri());
    await Promise.all([OpdConsultationModel.init(), OpdClinicalOrderModel.init(), OpdVisitModel.init()]);
  });

  beforeEach(async () => {
    await Promise.all([
      OpdConsultationModel.deleteMany({}),
      OpdClinicalOrderModel.deleteMany({}),
      OpdVisitModel.deleteMany({}),
      TransactionProbeModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  it('versions consultation writes and rejects a stale compare-and-set update', async () => {
    const created = await consultationRepository.saveForVisit(
      { visit, status: 'DRAFT', currentVersion: 0 },
      actorId,
    );
    expect(created.version).toBe(1);

    const updated = await consultationRepository.saveForVisit(
      {
        visit,
        assessment: 'Current assessment',
        status: 'DRAFT',
        currentVersion: created.version,
        currentStatus: created.status,
      },
      actorId,
    );
    expect(updated.version).toBe(2);

    await expect(consultationRepository.saveForVisit(
      {
        visit,
        assessment: 'Stale overwrite',
        status: 'DRAFT',
        currentVersion: created.version,
        currentStatus: created.status,
      },
      actorId,
    )).rejects.toMatchObject({ statusCode: 409, code: 'OPD_CONSULTATION_VERSION_CONFLICT' });
  });

  it('versions visit status transitions and rejects a stale compare-and-set update', async () => {
    await OpdVisitModel.create({
      _id: visit.id,
      visitNumber: visit.visit_number,
      queueTokenNumber: visit.queue_token_number,
      patientId: visit.patient_id,
      patientNumber: visit.patient_number,
      patientName: visit.patient_name,
      doctorId: visit.doctor_id,
      doctorName: visit.doctor_name,
      doctorSpecialization: visit.doctor_specialization,
      branchId: visit.branch_id,
      departmentId: visit.department_id,
      visitDate: visit.visit_date,
      checkInTime: visit.check_in_time,
      visitType: visit.visit_type,
      priority: visit.priority,
      status: 'IN_CONSULTATION',
    });
    const current = await visitRepository.getById(visit.id);
    expect(current?.version).toBe(0);

    const completed = await visitRepository.updateStatusIf(
      visit.id,
      ['IN_CONSULTATION'],
      { status: 'COMPLETED', notes: 'Completed safely' },
      actorId,
      undefined,
      current?.version,
    );
    expect(completed?.version).toBe(1);

    const stale = await visitRepository.updateStatusIf(
      visit.id,
      ['COMPLETED'],
      { status: 'COMPLETED', notes: 'Stale overwrite' },
      actorId,
      undefined,
      0,
    );
    expect(stale).toBeUndefined();
  });

  it('versions clinical-order writes and rejects a stale compare-and-set update', async () => {
    const consultation = await consultationRepository.saveForVisit(
      { visit, status: 'DRAFT', currentVersion: 0 },
      actorId,
    );
    const serviceId = new Types.ObjectId().toString();
    const created = await clinicalOrderRepository.saveForVisit({
      visit,
      consultation,
      orderType: 'LABORATORY',
      status: 'DRAFT',
      priority: 'ROUTINE',
      items: [{ service_id: serviceId, investigation_name: 'CBC', category: 'Haematology' }],
      currentVersion: 0,
    }, actorId);
    expect(created.version).toBe(1);

    const updated = await clinicalOrderRepository.saveForVisit({
      visit,
      consultation,
      orderType: 'LABORATORY',
      status: 'SUBMITTED',
      priority: 'ROUTINE',
      items: [{ service_id: serviceId, investigation_name: 'CBC', category: 'Haematology' }],
      currentVersion: created.version,
      currentStatus: created.status,
    }, actorId);
    expect(updated.version).toBe(2);

    await expect(clinicalOrderRepository.saveForVisit({
      visit,
      consultation,
      orderType: 'LABORATORY',
      status: 'DRAFT',
      priority: 'ROUTINE',
      items: [{ service_id: serviceId, investigation_name: 'CBC', category: 'Haematology' }],
      currentVersion: created.version,
      currentStatus: created.status,
    }, actorId)).rejects.toMatchObject({ statusCode: 409, code: 'CLINICAL_ORDER_VERSION_CONFLICT' });
  });

  it('rejects a billable service that is not active for the requested clinical order type', async () => {
    const wrongTypeServiceId = new Types.ObjectId().toString();
    const genericFallback = vi.fn().mockResolvedValue([{ _id: wrongTypeServiceId, name: 'Generic billable item' }]);
    const service = new OpdClinicalOrderService(
      {
        getByVisitAndType: vi.fn().mockResolvedValue(null),
      } as unknown as OpdClinicalOrderRepository,
      {
        resolveBranchScope: vi.fn().mockResolvedValue(undefined),
        getById: vi.fn().mockResolvedValue(visit),
      } as unknown as OpdVisitRepository,
      {
        getByVisit: vi.fn().mockResolvedValue({ id: new Types.ObjectId().toString(), status: 'DRAFT', version: 1 }),
      } as unknown as OpdConsultationRepository,
      {} as PatientRepository,
      {
        getActiveClinicalOrderServices: vi.fn().mockResolvedValue([]),
        getActiveBillingServices: genericFallback,
      } as unknown as ServiceRepository,
    );

    await expect(service.saveDraft(visit.id, 'LABORATORY', {
      priority: 'ROUTINE',
      items: [{ service_id: wrongTypeServiceId, investigation_name: 'Wrong type', category: 'Other' }],
    }, actorId)).rejects.toMatchObject({ statusCode: 400, code: 'INVALID_CLINICAL_ORDER_SERVICE' });
    expect(genericFallback).not.toHaveBeenCalled();
  });

  it('submits a clinical order while the consultation is still in draft', async () => {
    const serviceId = new Types.ObjectId().toString();
    const currentOrder: OpdClinicalOrder = {
      id: new Types.ObjectId().toString(),
      originating_order_id: new Types.ObjectId().toString(),
      source_type: 'OPD_VISIT',
      encounter_id: visit.id,
      admission_id: null,
      procedure_id: null,
      source_id: visit.id,
      visit_id: visit.id,
      consultation_id: new Types.ObjectId().toString(),
      patient_id: visit.patient_id,
      patient_number: visit.patient_number,
      patient_name: visit.patient_name,
      doctor_id: visit.doctor_id,
      doctor_name: visit.doctor_name,
      branch_id: visit.branch_id,
      order_type: 'LABORATORY',
      status: 'DRAFT',
      version: 1,
      priority: 'ROUTINE',
      destination: null,
      specimen_type: 'Blood',
      items: [{ id: new Types.ObjectId().toString(), service_id: serviceId, service_name: 'CBC', investigation_name: 'CBC', category: 'Haematology' }],
      clinical_notes: null,
      instructions: null,
      submitted_at: null,
      created_by: actorId,
      updated_by: actorId,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const submittedOrder = { ...currentOrder, status: 'SUBMITTED' as const, version: 2, submitted_at: new Date() };
    const session = {
      withTransaction: async (callback: () => Promise<void>) => callback(),
      endSession: async () => undefined,
    };
    const orderRepository = {
      getByVisitAndType: vi.fn().mockResolvedValue(currentOrder),
      saveForVisit: vi.fn().mockResolvedValue(submittedOrder),
    };
    const timeline = vi.fn().mockResolvedValue(undefined);
    const audit = vi.fn().mockResolvedValue(undefined);
    const service = new OpdClinicalOrderService(
      orderRepository as unknown as OpdClinicalOrderRepository,
      {
        session: vi.fn().mockResolvedValue(session),
        resolveBranchScope: vi.fn().mockResolvedValue(undefined),
        getById: vi.fn().mockResolvedValue(visit),
      } as unknown as OpdVisitRepository,
      {
        getByVisit: vi.fn().mockResolvedValue({ id: currentOrder.consultation_id, status: 'DRAFT', version: 1 }),
      } as unknown as OpdConsultationRepository,
      { addTimelineEvent: timeline, auditClinicalEvent: audit } as unknown as PatientRepository,
      {
        getActiveClinicalOrderServices: vi.fn().mockResolvedValue([{ _id: serviceId, name: 'CBC' }]),
      } as unknown as ServiceRepository,
    );

    const result = await service.submit(visit.id, 'LABORATORY', {
      expected_version: 1,
      expected_status: 'DRAFT',
      priority: 'ROUTINE',
      specimen_type: 'Blood',
      items: [{ service_id: serviceId, investigation_name: 'CBC', category: 'Haematology' }],
    }, actorId);

    expect(result.status).toBe('SUBMITTED');
    expect(orderRepository.saveForVisit).toHaveBeenCalledOnce();
    expect(timeline).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledOnce();
  });

  it('preserves branch-scope denial before reading or mutating an order', async () => {
    const getByVisitAndType = vi.fn();
    const service = new OpdClinicalOrderService(
      { getByVisitAndType } as unknown as OpdClinicalOrderRepository,
      {
        resolveBranchScope: vi.fn().mockRejectedValue(
          new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED'),
        ),
      } as unknown as OpdVisitRepository,
      {} as OpdConsultationRepository,
      {} as PatientRepository,
      {} as ServiceRepository,
    );

    await expect(service.getByVisitAndType(visit.id, 'LABORATORY', actorId))
      .rejects.toMatchObject({ statusCode: 403, code: 'BRANCH_ACCESS_DENIED' });
    expect(getByVisitAndType).not.toHaveBeenCalled();
  });

  it('rolls back a required transaction when a participating write fails', async () => {
    await expect(executeRequiredTransaction(
      () => mongoose.startSession(),
      async (session) => {
        await TransactionProbeModel.create([{ value: 'must-roll-back' }], { session });
        throw new AppError('Downstream write failed', 500, 'DOWNSTREAM_WRITE_FAILED');
      },
    )).rejects.toMatchObject({ code: 'DOWNSTREAM_WRITE_FAILED' });

    expect(await TransactionProbeModel.countDocuments()).toBe(0);
  });
});
