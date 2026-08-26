import assert from 'node:assert/strict';
import test from 'node:test';
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

test('IP and procedure downstream clinical contexts', async (t) => {
  await setupTestDatabase();
  const prescriptionRepository = new OpdPrescriptionRepository();
  const clinicalOrderRepository = new OpdClinicalOrderRepository();
  const visitRepository = new OpdVisitRepository();
  const consultationRepository = new OpdConsultationRepository();
  const patientRepository = new PatientRepository();
  const serviceRepository = new ServiceRepository();
  const prescriptions = new OpdPrescriptionService(prescriptionRepository, visitRepository, consultationRepository, patientRepository);
  const clinicalOrders = new OpdClinicalOrderService(clinicalOrderRepository, visitRepository, consultationRepository, patientRepository, serviceRepository);
  const laboratory = new LaboratoryRepository();
  const imaging = new ImagingRepository();

  t.afterEach(clearTestDatabase);
  t.after(teardownTestDatabase);

  for (const sourceType of ['INPATIENT_ADMISSION', 'PROCEDURE_BOOKING'] as const) {
    await t.test(`${sourceType} -> Pharmacy preserves context and is idempotent`, async () => {
      const source = context(sourceType); const actor = id(); const session = await mongoose.startSession();
      const payload = { items: [{ medicine_name: 'Paracetamol', strength: '500 mg', dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 6, instructions: null }] };
      try { let firstId = ''; await session.withTransaction(async () => { const first = await prescriptions.submitForContext(source, payload, actor, session); const retry = await prescriptions.submitForContext(source, payload, actor, session); firstId = first.id; assert.equal(retry.id, first.id); assert.equal(first.source_type, sourceType); assert.equal(first.admission_id, source.admission_id); assert.equal(first.procedure_id, source.procedure_id); assert.equal(first.encounter_id, source.encounter_id); }); assert.ok(firstId); } finally { await session.endSession(); }
    });

    for (const orderType of ['LABORATORY', 'IMAGING'] as const) {
      await t.test(`${sourceType} -> ${orderType} preserves context through result storage`, async () => {
        const source = context(sourceType); const actor = id(); const serviceId = id();
        await ServiceModel.create({ _id: serviceId, code: `${orderType}-${source.source_id}`, name: `${orderType} service`, serviceType: orderType === 'LABORATORY' ? 'LAB_TEST' : 'IMAGING_SERVICE', departmentId: id(), standardPrice: 100, status: 'ACTIVE' });
        const session = await mongoose.startSession();
        try { await session.withTransaction(async () => {
          const payload = { priority: 'ROUTINE' as const, destination: null, specimen_type: orderType === 'LABORATORY' ? 'Blood' : null, items: [{ service_id: serviceId, investigation_name: '', category: orderType }], clinical_notes: null, instructions: null };
          const order = await clinicalOrders.submitForContext(source, orderType, payload, actor, session);
          const retry = await clinicalOrders.submitForContext(source, orderType, payload, actor, session);
          assert.equal(retry.id, order.id); assert.equal(order.source_type, sourceType); assert.equal(order.admission_id, source.admission_id); assert.equal(order.procedure_id, source.procedure_id);
          if (orderType === 'LABORATORY') {
            const result = await laboratory.createResult(order, { result_items: [{ service_id: serviceId, service_name: order.items[0]!.service_name, value: 'Normal' }] }, actor, session);
            assert.equal(result.visit_id, null); assert.equal(result.admission_id, source.admission_id); assert.equal(result.procedure_id, source.procedure_id);
          } else {
            const report = await imaging.createReport(order, { findings: 'No acute finding', impression: 'Normal' }, actor, session);
            assert.equal(report.visit_id, null); assert.equal(report.admission_id, source.admission_id); assert.equal(report.procedure_id, source.procedure_id);
          }
        }); } finally { await session.endSession(); }
      });
    }
  }

  await t.test('changed retry is rejected without overwriting the prescription', async () => {
    const source = context('INPATIENT_ADMISSION'); const actor = id(); const session = await mongoose.startSession();
    const payload = { items: [{ medicine_name: 'Paracetamol', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Daily', duration: '1 day', quantity: 1, instructions: null }] };
    try { await session.withTransaction(async () => { const first = await prescriptions.submitForContext(source, payload, actor, session); await assert.rejects(() => prescriptions.submitForContext(source, { ...payload, items: [{ ...payload.items[0]!, quantity: 2 }] }, actor, session), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'CONTEXT_PRESCRIPTION_CONFLICT'); const stored = await prescriptions.getForContext(source, session); assert.equal(stored?.id, first.id); assert.equal(stored?.items[0]?.quantity, 1); }); } finally { await session.endSession(); }
  });
});
