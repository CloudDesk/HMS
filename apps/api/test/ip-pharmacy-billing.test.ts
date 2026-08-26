import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';
import { BillingInvoiceItemModel, BillingInvoiceModel } from '../src/modules/billing/billing.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { MedicineModel } from '../src/modules/medicines/medicine.model.js';
import { PharmacyMedicineBatchModel, PharmacyMedicineInventoryModel, PharmacyMedicineStockMovementModel } from '../src/modules/pharmacy-inventory/pharmacy-inventory.model.js';
import { InpatientAdmissionModel } from '../src/modules/inpatient-admissions/inpatient-admission.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { createServiceRegistry } from '../src/shared/services/service-registry.js';
import { clearTestDatabase, setupTestDatabase, teardownTestDatabase } from './setup.js';

const objectId = () => new Types.ObjectId();

test('IP Pharmacy dispensing updates inventory and creates one IP_ADMISSION invoice', async (t) => {
  await setupTestDatabase();
  t.after(async () => { await clearTestDatabase(); await teardownTestDatabase(); });

  const actorId = objectId(); const patientId = objectId();
  const branchId = objectId(); const departmentId = objectId();
  const doctorId = objectId(); const admissionId = objectId();
  const medicineId = objectId(); const batchId = objectId();
  const wardId = objectId(); const bedId = objectId();
  const now = new Date();

  await Promise.all([
    BranchModel.create({ _id: branchId, code: 'IP-RX', name: 'IP Pharmacy Branch', status: 'ACTIVE' }),
    UserModel.create({ _id: actorId, username: 'ip-pharmacy-user', email: 'ip-pharmacy@example.test', fullName: 'IP Pharmacy User', passwordHash: 'test', roleIds: [], branchIds: [branchId], departmentIds: [departmentId], status: 'active' }),
    MedicineModel.create({ _id: medicineId, code: 'MED-IP-RX', name: 'IP Antibiotic', status: 'ACTIVE' }),
  ]);
  
  await InpatientAdmissionModel.create({ 
    _id: admissionId, admissionNumber: 'IP-RX-001', patientId, patientNumber: 'MRN-IP-RX', patientName: 'IP Patient', 
    branchId, wardId, bedId, admittingDoctorId: doctorId, admittingDoctorName: 'IP Doctor', departmentId, departmentName: 'IP Dept', 
    admissionDate: now, admissionType: 'MEDICAL', reason: 'Test IP Rx', status: 'ADMITTED', sourceType: 'DIRECT', createdBy: actorId, updatedBy: actorId 
  });
  
  await PharmacyMedicineBatchModel.create({ _id: batchId, medicineId, branchId, batchNumber: 'BATCH-IP-RX', expiryDate: new Date(now.getTime() + 86_400_000 * 30), unitPrice: 25, quantityOnHand: 20, status: 'ACTIVE', createdBy: actorId, updatedBy: actorId });
  await PharmacyMedicineInventoryModel.create({ medicineId, branchId, availableQuantity: 20, lowStockThreshold: 5, stockState: 'AVAILABLE', activeBatchCount: 1, expiredBatchCount: 0, nextExpiryDate: new Date(now.getTime() + 86_400_000 * 30), createdBy: actorId, updatedBy: actorId });

  const services = createServiceRegistry();
  const prescription = await services.inpatientAdmissions.submitPrescription(admissionId.toString(), branchId.toString(), { items: [{ medicine_name: 'IP Antibiotic', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 4, instructions: null }] }, actorId.toString(), {});
  assert.equal(prescription.source_type, 'INPATIENT_ADMISSION'); assert.equal(prescription.admission_id, admissionId.toString()); assert.equal(prescription.patient_id, patientId.toString()); assert.equal(prescription.branch_id, branchId.toString());

  const queued = await services.pharmacyDispensing.list({ branch_id: branchId.toString(), status: 'PENDING', page: 1, limit: 20 }, actorId.toString());
  assert.equal(queued.data.some((item) => item.prescription_id === prescription.id && item.admission_id === admissionId.toString()), true);
  
  const draft = await services.pharmacyDispensing.get(prescription.id, actorId.toString()); const draftItem = draft.items[0];
  if (!draftItem?.medicine_id || !draftItem.batch_id) throw new Error('Expected a fully matched Pharmacy draft item');
  
  const saved = await services.pharmacyDispensing.save(prescription.id, { version: draft.version, items: [{ prescription_item_id: draftItem.prescription_item_id, medicine_id: draftItem.medicine_id, batch_id: draftItem.batch_id, confirmed_quantity: 4, pharmacist_instructions: null }] }, actorId.toString(), {});
  if (!saved) throw new Error('Expected a saved Pharmacy dispensing draft');

  const confirmed = await services.pharmacyDispensing.confirm(prescription.id, saved.version, 'ip-pharmacy-confirm-001', actorId.toString(), {});
  if (!confirmed) throw new Error('Expected a confirmed Pharmacy dispensing record');
  
  assert.equal(confirmed.status, 'CONFIRMED'); 
  assert.equal((await PharmacyMedicineBatchModel.findById(batchId).lean())?.quantityOnHand, 16); 
  assert.equal((await PharmacyMedicineInventoryModel.findOne({ medicineId, branchId }).lean())?.availableQuantity, 16);
  assert.equal(await PharmacyMedicineStockMovementModel.countDocuments({ reference: prescription.id, movementType: 'STOCK_OUT' }), 1);
  
  const invoice = await BillingInvoiceModel.findById(confirmed.invoice_id).lean();
  assert.equal(invoice?.sourceType, 'IP_ADMISSION'); 
  assert.equal(invoice?.admissionId?.toString(), admissionId.toString()); 
  assert.equal(invoice?.patientId.toString(), patientId.toString()); 
  assert.equal(invoice?.branchId.toString(), branchId.toString()); 
  assert.equal(invoice?.status, 'PENDING'); 
  assert.equal(invoice?.totalAmount, 100);
  assert.equal(await BillingInvoiceItemModel.countDocuments({ invoiceId: invoice?._id, serviceType: 'PHARMACY', originatingOrderId: prescription.id }), 1);
});
