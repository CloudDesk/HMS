import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';
import { BillingInvoiceItemModel, BillingInvoiceModel } from '../src/modules/billing/billing.model.js';
import { BranchModel } from '../src/modules/branches/branch.model.js';
import { MedicineModel } from '../src/modules/medicines/medicine.model.js';
import { OpdVisitModel } from '../src/modules/opd/opd-visit.model.js';
import { PharmacyMedicineBatchModel, PharmacyMedicineInventoryModel, PharmacyMedicineStockMovementModel } from '../src/modules/pharmacy-inventory/pharmacy-inventory.model.js';
import { ProcedureBookingModel, ProcedureRecommendationModel } from '../src/modules/surgery/surgery.model.js';
import { UserModel } from '../src/modules/users/user.model.js';
import { createServiceRegistry } from '../src/shared/services/service-registry.js';
import { clearTestDatabase, setupTestDatabase, teardownTestDatabase } from './setup.js';

const objectId = () => new Types.ObjectId();

test('Surgery prescription dispensing updates inventory and creates one procedure invoice', async (t) => {
  await setupTestDatabase();
  t.after(async () => { await clearTestDatabase(); await teardownTestDatabase(); });

  const actorId = objectId(); const unauthorizedId = objectId(); const patientId = objectId();
  const branchId = objectId(); const otherBranchId = objectId(); const departmentId = objectId();
  const doctorId = objectId(); const procedureServiceId = objectId(); const encounterId = objectId();
  const recommendationId = objectId(); const bookingId = objectId(); const medicineId = objectId(); const batchId = objectId();
  const now = new Date();

  await Promise.all([
    BranchModel.create({ _id: branchId, code: 'SURG-RX', name: 'Surgery Pharmacy Branch', status: 'ACTIVE' }),
    BranchModel.create({ _id: otherBranchId, code: 'OTHER-RX', name: 'Other Branch', status: 'ACTIVE' }),
    UserModel.create({ _id: actorId, username: 'surgery-pharmacy-user', email: 'surgery-pharmacy@example.test', fullName: 'Surgery Pharmacy User', passwordHash: 'test', roleIds: [], branchIds: [branchId, otherBranchId], departmentIds: [departmentId], status: 'active' }),
    UserModel.create({ _id: unauthorizedId, username: 'unauthorized-pharmacy-user', email: 'unauthorized-pharmacy@example.test', fullName: 'Unauthorized User', passwordHash: 'test', roleIds: [], branchIds: [otherBranchId], departmentIds: [departmentId], status: 'active' }),
    MedicineModel.create({ _id: medicineId, code: 'MED-SURG-RX', name: 'Procedure Antibiotic', status: 'ACTIVE' }),
  ]);
  await OpdVisitModel.create({ _id: encounterId, visitNumber: 'VISIT-SURG-RX', patientId, patientNumber: 'MRN-SURG-RX', patientName: 'Procedure Patient', doctorId, doctorName: 'Procedure Doctor', doctorSpecialization: 'Surgery', branchId, departmentId, visitDate: now, checkInTime: now, visitType: 'PROCEDURE', priority: 'ROUTINE', status: 'IN_CONSULTATION' });
  await ProcedureRecommendationModel.create({ _id: recommendationId, recommendationNumber: 'PR-SURG-RX', patientId, patientNumber: 'MRN-SURG-RX', patientName: 'Procedure Patient', branchId, departmentId, departmentName: 'Surgery', recommendingDoctorId: doctorId, recommendingDoctorName: 'Procedure Doctor', serviceId: procedureServiceId, serviceName: 'Procedure Service', encounterType: 'OPD_VISIT', encounterId, clinicalReason: 'Focused integration test', status: 'BOOKED', bookingId, createdBy: actorId, updatedBy: actorId });
  await ProcedureBookingModel.create({ _id: bookingId, bookingNumber: 'PB-SURG-RX', recommendationId, patientId, patientNumber: 'MRN-SURG-RX', patientName: 'Procedure Patient', branchId, departmentId, departmentName: 'Surgery', serviceId: procedureServiceId, serviceName: 'Procedure Service', doctorId, doctorName: 'Procedure Doctor', scheduledStart: new Date(now.getTime() + 3_600_000), scheduledEnd: new Date(now.getTime() + 7_200_000), durationMinutes: 60, status: 'BOOKED', scheduleHistory: [], createdBy: actorId, updatedBy: actorId });
  await PharmacyMedicineBatchModel.create({ _id: batchId, medicineId, branchId, batchNumber: 'BATCH-SURG-RX', expiryDate: new Date(now.getTime() + 86_400_000 * 30), unitPrice: 25, quantityOnHand: 20, status: 'ACTIVE', createdBy: actorId, updatedBy: actorId });
  await PharmacyMedicineInventoryModel.create({ medicineId, branchId, availableQuantity: 20, lowStockThreshold: 5, stockState: 'AVAILABLE', activeBatchCount: 1, expiredBatchCount: 0, nextExpiryDate: new Date(now.getTime() + 86_400_000 * 30), createdBy: actorId, updatedBy: actorId });

  const services = createServiceRegistry();
  await assert.rejects(() => services.surgery.submitPrescription(bookingId.toString(), branchId.toString(), { items: [{ medicine_name: 'Procedure Antibiotic', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 4, instructions: null }] }, unauthorizedId.toString(), {}), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'BRANCH_ACCESS_DENIED');
  await assert.rejects(() => services.surgery.submitPrescription(bookingId.toString(), otherBranchId.toString(), { items: [{ medicine_name: 'Procedure Antibiotic', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 4, instructions: null }] }, actorId.toString(), {}), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'PROCEDURE_BOOKING_NOT_FOUND');
  await ProcedureBookingModel.updateOne({ _id: bookingId }, { $set: { status: 'CANCELLED' } });
  await assert.rejects(() => services.surgery.submitPrescription(bookingId.toString(), branchId.toString(), { items: [{ medicine_name: 'Procedure Antibiotic', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 4, instructions: null }] }, actorId.toString(), {}), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'PROCEDURE_CONTEXT_NOT_ACTIVE');
  await ProcedureBookingModel.updateOne({ _id: bookingId }, { $set: { status: 'BOOKED' } });

  const prescription = await services.surgery.submitPrescription(bookingId.toString(), branchId.toString(), { items: [{ medicine_name: 'Procedure Antibiotic', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 4, instructions: null }] }, actorId.toString(), {});
  assert.equal(prescription.source_type, 'PROCEDURE_BOOKING'); assert.equal(prescription.procedure_id, bookingId.toString()); assert.equal(prescription.encounter_id, encounterId.toString()); assert.equal(prescription.patient_id, patientId.toString()); assert.equal(prescription.branch_id, branchId.toString()); assert.equal(prescription.doctor_id, doctorId.toString());
  const retry = await services.surgery.submitPrescription(bookingId.toString(), branchId.toString(), { items: [{ medicine_name: 'Procedure Antibiotic', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 4, instructions: null }] }, actorId.toString(), {});
  assert.equal(retry.id, prescription.id);

  const queued = await services.pharmacyDispensing.list({ branch_id: branchId.toString(), status: 'PENDING', page: 1, limit: 20 }, actorId.toString());
  assert.equal(queued.data.some((item) => item.prescription_id === prescription.id && item.procedure_id === bookingId.toString()), true);
  const draft = await services.pharmacyDispensing.get(prescription.id, actorId.toString()); const draftItem = draft.items[0];
  if (!draftItem?.medicine_id || !draftItem.batch_id) throw new Error('Expected a fully matched Pharmacy draft item');
  const saved = await services.pharmacyDispensing.save(prescription.id, { version: draft.version, items: [{ prescription_item_id: draftItem.prescription_item_id, medicine_id: draftItem.medicine_id, batch_id: draftItem.batch_id, confirmed_quantity: 4, pharmacist_instructions: null }] }, actorId.toString(), {});
  if (!saved) throw new Error('Expected a saved Pharmacy dispensing draft');

  await ProcedureBookingModel.updateOne({ _id: bookingId }, { $set: { status: 'CANCELLED' } });
  await assert.rejects(() => services.pharmacyDispensing.confirm(prescription.id, saved.version, 'surgery-pharmacy-confirm-001', actorId.toString(), {}), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'PROCEDURE_CONTEXT_NOT_ACTIVE');
  assert.equal((await PharmacyMedicineBatchModel.findById(batchId).lean())?.quantityOnHand, 20);
  assert.equal(await BillingInvoiceModel.countDocuments(), 0);
  await ProcedureBookingModel.updateOne({ _id: bookingId }, { $set: { status: 'BOOKED' } });

  const confirmed = await services.pharmacyDispensing.confirm(prescription.id, saved.version, 'surgery-pharmacy-confirm-001', actorId.toString(), {});
  if (!confirmed) throw new Error('Expected a confirmed Pharmacy dispensing record');
  assert.equal(confirmed.status, 'CONFIRMED'); assert.equal((await PharmacyMedicineBatchModel.findById(batchId).lean())?.quantityOnHand, 16); assert.equal((await PharmacyMedicineInventoryModel.findOne({ medicineId, branchId }).lean())?.availableQuantity, 16);
  assert.equal(await PharmacyMedicineStockMovementModel.countDocuments({ reference: prescription.id, movementType: 'STOCK_OUT' }), 1);
  const invoice = await BillingInvoiceModel.findById(confirmed.invoice_id).lean();
  assert.equal(invoice?.sourceType, 'PROCEDURE'); assert.equal(invoice?.procedureId?.toString(), bookingId.toString()); assert.equal(invoice?.encounterId?.toString(), encounterId.toString()); assert.equal(invoice?.patientId.toString(), patientId.toString()); assert.equal(invoice?.branchId.toString(), branchId.toString()); assert.equal(invoice?.status, 'PENDING'); assert.equal(invoice?.totalAmount, 100);
  assert.equal(await BillingInvoiceItemModel.countDocuments({ invoiceId: invoice?._id, serviceType: 'PHARMACY', originatingOrderId: prescription.id }), 1);

  await assert.rejects(() => services.pharmacyDispensing.confirm(prescription.id, confirmed.version, 'surgery-pharmacy-confirm-001', actorId.toString(), {}), (error: unknown) => error instanceof Error && 'code' in error && error.code === 'PRESCRIPTION_NOT_ACTIONABLE');
  assert.equal((await PharmacyMedicineBatchModel.findById(batchId).lean())?.quantityOnHand, 16); assert.equal(await BillingInvoiceModel.countDocuments(), 1); assert.equal(await PharmacyMedicineStockMovementModel.countDocuments({ reference: prescription.id, movementType: 'STOCK_OUT' }), 1);
});
