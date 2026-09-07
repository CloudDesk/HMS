import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
import { AppError } from '../src/shared/errors/app-error.js';

const objectId = () => new Types.ObjectId();

describe('Surgery prescription dispensing updates inventory and creates one procedure invoice', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  }, 30000);

  afterAll(async () => {
    await clearTestDatabase();
    await teardownTestDatabase();
  });

  it('runs surgery pharmacy integration flow', async () => {
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
    await expect(services.surgery.submitPrescription(bookingId.toString(), branchId.toString(), { items: [{ medicine_name: 'Procedure Antibiotic', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 4, instructions: null }] }, unauthorizedId.toString(), {})).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === 'BRANCH_ACCESS_DENIED');
    await expect(services.surgery.submitPrescription(bookingId.toString(), otherBranchId.toString(), { items: [{ medicine_name: 'Procedure Antibiotic', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 4, instructions: null }] }, actorId.toString(), {})).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === 'PROCEDURE_BOOKING_NOT_FOUND');
    await ProcedureBookingModel.updateOne({ _id: bookingId }, { $set: { status: 'CANCELLED' } });
    await expect(services.surgery.submitPrescription(bookingId.toString(), branchId.toString(), { items: [{ medicine_name: 'Procedure Antibiotic', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 4, instructions: null }] }, actorId.toString(), {})).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === 'PROCEDURE_CONTEXT_NOT_ACTIVE');
    await ProcedureBookingModel.updateOne({ _id: bookingId }, { $set: { status: 'BOOKED' } });

    const prescription = await services.surgery.submitPrescription(bookingId.toString(), branchId.toString(), { items: [{ medicine_name: 'Procedure Antibiotic', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 4, instructions: null }] }, actorId.toString(), {});
    expect(prescription.source_type).toBe('PROCEDURE_BOOKING');
    expect(prescription.procedure_id).toBe(bookingId.toString());
    expect(prescription.encounter_id).toBe(encounterId.toString());
    expect(prescription.patient_id).toBe(patientId.toString());
    expect(prescription.branch_id).toBe(branchId.toString());
    expect(prescription.doctor_id).toBe(doctorId.toString());
    
    const retry = await services.surgery.submitPrescription(bookingId.toString(), branchId.toString(), { items: [{ medicine_name: 'Procedure Antibiotic', strength: null, dosage: '1 tablet', route: 'Oral', frequency: 'Twice daily', duration: '3 days', quantity: 4, instructions: null }] }, actorId.toString(), {});
    expect(retry.id).toBe(prescription.id);

    const queued = await services.pharmacyDispensing.list({ branch_id: branchId.toString(), status: 'PENDING', page: 1, limit: 20 }, actorId.toString());
    expect(queued.data.some((item) => item.prescription_id === prescription.id && item.procedure_id === bookingId.toString())).toBe(true);
    const draft = await services.pharmacyDispensing.get(prescription.id, actorId.toString()); const draftItem = draft.items[0];
    if (!draftItem?.medicine_id || !draftItem.batch_id) throw new Error('Expected a fully matched Pharmacy draft item');
    const saved = await services.pharmacyDispensing.save(prescription.id, { version: draft.version, items: [{ prescription_item_id: draftItem.prescription_item_id, medicine_id: draftItem.medicine_id, batch_id: draftItem.batch_id, confirmed_quantity: 4, pharmacist_instructions: null }] }, actorId.toString(), {});
    if (!saved) throw new Error('Expected a saved Pharmacy dispensing draft');

    await ProcedureBookingModel.updateOne({ _id: bookingId }, { $set: { status: 'CANCELLED' } });
    await expect(services.pharmacyDispensing.confirm(prescription.id, saved.version, 'surgery-pharmacy-confirm-001', actorId.toString(), {})).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === 'PROCEDURE_CONTEXT_NOT_ACTIVE');
    expect((await PharmacyMedicineBatchModel.findById(batchId).lean())?.quantityOnHand).toBe(20);
    expect(await BillingInvoiceModel.countDocuments()).toBe(0);
    await ProcedureBookingModel.updateOne({ _id: bookingId }, { $set: { status: 'BOOKED' } });

    const confirmed = await services.pharmacyDispensing.confirm(prescription.id, saved.version, 'surgery-pharmacy-confirm-001', actorId.toString(), {});
    if (!confirmed) throw new Error('Expected a confirmed Pharmacy dispensing record');
    expect(confirmed.status).toBe('CONFIRMED');
    expect((await PharmacyMedicineBatchModel.findById(batchId).lean())?.quantityOnHand).toBe(16);
    expect((await PharmacyMedicineInventoryModel.findOne({ medicineId, branchId }).lean())?.availableQuantity).toBe(16);
    expect(await PharmacyMedicineStockMovementModel.countDocuments({ reference: prescription.id, movementType: 'STOCK_OUT' })).toBe(1);
    const invoice = await BillingInvoiceModel.findById(confirmed.invoice_id).lean();
    expect(invoice?.sourceType).toBe('PROCEDURE');
    expect(invoice?.procedureId?.toString()).toBe(bookingId.toString());
    expect(invoice?.encounterId?.toString()).toBe(encounterId.toString());
    expect(invoice?.patientId.toString()).toBe(patientId.toString());
    expect(invoice?.branchId.toString()).toBe(branchId.toString());
    expect(invoice?.status).toBe('PENDING');
    expect(invoice?.totalAmount).toBe(100);
    expect(await BillingInvoiceItemModel.countDocuments({ invoiceId: invoice?._id, serviceType: 'PHARMACY', originatingOrderId: prescription.id })).toBe(1);

    await expect(services.pharmacyDispensing.confirm(prescription.id, confirmed.version, 'surgery-pharmacy-confirm-001', actorId.toString(), {})).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === 'PRESCRIPTION_NOT_ACTIONABLE');
    expect((await PharmacyMedicineBatchModel.findById(batchId).lean())?.quantityOnHand).toBe(16);
    expect(await BillingInvoiceModel.countDocuments()).toBe(1);
    expect(await PharmacyMedicineStockMovementModel.countDocuments({ reference: prescription.id, movementType: 'STOCK_OUT' })).toBe(1);
  });
});
