import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { ImagingRepository } from '../src/modules/imaging/imaging.repository.js';
import { LaboratoryRepository } from '../src/modules/laboratory/laboratory.repository.js';
import type { ClinicalSourceContext } from '../src/modules/opd/clinical-context.types.js';
import { OpdClinicalOrderRepository } from '../src/modules/opd/opd-clinical-order.repository.js';
import { OpdClinicalOrderService } from '../src/modules/opd/opd-clinical-order.service.js';
import { OpdConsultationRepository } from '../src/modules/opd/opd-consultation.repository.js';
import { OpdPrescriptionRepository } from '../src/modules/opd/opd-prescription.repository.js';
import { OpdPrescriptionService } from '../src/modules/opd/opd-prescription.service.js';
import { OpdVisitRepository } from '../src/modules/opd/opd-visit.repository.js';
import { PatientRepository } from '../src/modules/patients/patient.repository.js';
import { ServiceModel } from '../src/modules/services/service.model.js';
import { ServiceRepository } from '../src/modules/services/service.repository.js';
import { clearTestDatabase, setupTestDatabase, teardownTestDatabase } from './setup.js';

const id = () => new Types.ObjectId().toString();
const context = (sourceType: ClinicalSourceContext['source_type']): ClinicalSourceContext => {
  const sourceId = id();
  return {
    source_type: sourceType,
    source_id: sourceId,
    encounter_id: id(),
    admission_id: sourceType === 'INPATIENT_ADMISSION' ? sourceId : null,
    procedure_id: sourceType === 'PROCEDURE_BOOKING' ? sourceId : null,
    patient_id: id(), patient_number: 'MRN-CTX', patient_name: 'Context Patient',
    doctor_id: id(), doctor_name: 'Context Doctor', branch_id: id(),
  };
};

describe('IP and procedure downstream clinical contexts', () => {
  let prescriptionRepository: OpdPrescriptionRepository;
  let clinicalOrderRepository: OpdClinicalOrderRepository;
  let visitRepository: OpdVisitRepository;
  let consultationRepository: OpdConsultationRepository;
  let patientRepository: PatientRepository;
  let serviceRepository: ServiceRepository;
  let prescriptions: OpdPrescriptionService;
  let clinicalOrders: OpdClinicalOrderService;
  let laboratory: LaboratoryRepository;
  let imaging: ImagingRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    prescriptionRepository = new OpdPrescriptionRepository();
    clinicalOrderRepository = new OpdClinicalOrderRepository();
    visitRepository = new OpdVisitRepository();
    consultationRepository = new OpdConsultationRepository();
    patientRepository = new PatientRepository();
    serviceRepository = new ServiceRepository();
    prescriptions = new OpdPrescriptionService(prescriptionRepository, visitRepository, consultationRepository, patientRepository);
    clinicalOrders = new OpdClinicalOrderService(clinicalOrderRepository, visitRepository, consultationRepository, patientRepository, serviceRepository);
    laboratory = new LaboratoryRepository();
    imaging = new ImagingRepository();
  }, 30000);

  afterEach(clearTestDatabase);
  afterAll(teardownTestDatabase);

  for (const sourceType of ['INPATIENT_ADMISSION', 'PROCEDURE_BOOKING'] as const) {
    it(`${sourceType} -> Pharmacy preserves context and is idempotent`, async () => {
      const source = context(sourceType);
      const actor = id();
      const session = await mongoose.startSession();
      const payload = { items: [{ medicine_name: 'Paracetamol', strength: '500 mg', dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 6, instructions: null }] };
      try {
        let firstId = '';
        await session.withTransaction(async () => {
          const first = await prescriptions.submitForContext(source, payload, actor, session);
          const retry = await prescriptions.submitForContext(source, payload, actor, session);
          firstId = first.id;
          expect(retry.id).toBe(first.id);
          expect(first.source_type).toBe(sourceType);
          expect(first.admission_id).toBe(source.admission_id);
          expect(first.procedure_id).toBe(source.procedure_id);
          expect(first.encounter_id).toBe(source.encounter_id);
        });
        expect(firstId).toBeTruthy();
      } finally {
        await session.endSession();
      }
    });

    for (const orderType of ['LABORATORY', 'IMAGING'] as const) {
      it(`${sourceType} -> ${orderType} preserves context through result storage`, async () => {
        const source = context(sourceType);
        const actor = id();
        const serviceId = id();
        await ServiceModel.create({ _id: serviceId, code: `${orderType}-${source.source_id}`, name: `${orderType} service`, serviceType: orderType === 'LABORATORY' ? 'LAB_TEST' : 'IMAGING_SERVICE', departmentId: id(), standardPrice: 100, status: 'ACTIVE' });
        const session = await mongoose.startSession();
        try {
          await session.withTransaction(async () => {
            const payload = { priority: 'ROUTINE' as const, destination: null, specimen_type: orderType === 'LABORATORY' ? 'Blood' : null, items: [{ service_id: serviceId, investigation_name: '', category: orderType }], clinical_notes: null, instructions: null };
            const order = await clinicalOrders.submitForContext(source, orderType, payload, actor, session);
            const retry = await clinicalOrders.submitForContext(source, orderType, payload, actor, session);
            expect(retry.id).toBe(order.id);
            expect(order.source_type).toBe(sourceType);
            expect(order.admission_id).toBe(source.admission_id);
            expect(order.procedure_id).toBe(source.procedure_id);
            if (orderType === 'LABORATORY') {
              const result = await laboratory.createResult(order, { result_items: [{ service_id: serviceId, service_name: order.items[0]!.service_name, value: 'Normal' }] }, actor, session);
              expect(result.visit_id).toBeNull();
              expect(result.admission_id).toBe(source.admission_id);
              expect(result.procedure_id).toBe(source.procedure_id);
            } else {
              const report = await imaging.createReport(order, { findings: 'No acute finding', impression: 'Normal' }, actor, session);
              expect(report.visit_id).toBeNull();
              expect(report.admission_id).toBe(source.admission_id);
              expect(report.procedure_id).toBe(source.procedure_id);
            }
          });
        } finally {
          await session.endSession();
        }
      });
    }
  }

  it('changed retry is rejected without overwriting the prescription', async () => {
    const source = context('INPATIENT_ADMISSION');
    const actor = id();
    const session = await mongoose.startSession();
    const payload = { items: [{ medicine_name: 'Paracetamol', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Daily', duration: '1 day', quantity: 1, instructions: null }] };
    try {
      await session.withTransaction(async () => {
        const first = await prescriptions.submitForContext(source, payload, actor, session);
        await expect(
          prescriptions.submitForContext(source, { ...payload, items: [{ ...payload.items[0]!, quantity: 2 }] }, actor, session),
        ).rejects.toSatisfy((error: unknown) => error instanceof Error && 'code' in error && error.code === 'CONTEXT_PRESCRIPTION_CONFLICT');
        const stored = await prescriptions.getForContext(source, session);
        expect(stored?.id).toBe(first.id);
        expect(stored?.items[0]?.quantity).toBe(1);
      });
    } finally {
      await session.endSession();
    }
  });
});
