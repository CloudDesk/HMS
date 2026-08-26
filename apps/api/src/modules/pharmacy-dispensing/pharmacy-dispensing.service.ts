import mongoose, { Types } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { createBillingNumber } from '../billing/billing-number.js';
import type { BillingSourceType } from '../billing/billing.types.js';
import type { PharmacyDispensingItemFields } from './pharmacy-dispensing.model.js';
import type { PharmacyDispensingRepository } from './pharmacy-dispensing.repository.js';
import type { PharmacyDispensingListQuery, PharmacyRequestMetadata, SavePharmacyDispensingDTO } from './pharmacy-dispensing.types.js';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const billingSourceTypeForVisit = (visitType: string): BillingSourceType => {
  if (visitType === 'EMERGENCY') return 'EMERGENCY';
  if (visitType === 'PROCEDURE') return 'PROCEDURE';
  if (visitType === 'IP_ADMISSION') return 'IP_ADMISSION';
  return 'OPD';
};

type ResolvedDispensingItem = PharmacyDispensingItemFields & {
  medicineId: Types.ObjectId;
  batchId: Types.ObjectId;
  confirmedQuantity: number;
};

const isResolvedDispensingItem = (item: PharmacyDispensingItemFields): item is ResolvedDispensingItem =>
  item.medicineId != null &&
  item.batchId != null &&
  item.confirmedQuantity != null &&
  Number.isInteger(item.confirmedQuantity) &&
  item.confirmedQuantity > 0;

export class PharmacyDispensingService {
  constructor(private readonly repository: PharmacyDispensingRepository) {}

  private async context(prescriptionId: string, actor: string, session?: mongoose.ClientSession) {
    const prescription = await this.repository.getPrescription(prescriptionId, session);
    if (!prescription) throw new AppError('Prescription not found', 404, 'PRESCRIPTION_NOT_FOUND');
    const visit = prescription.visitId ? await this.repository.getVisit(prescription.visitId.toString(), session) : null;
    const context = visit ?? { _id: prescription.sourceId, branchId: prescription.branchId, appointmentId: null, visitType: prescription.sourceType === 'EMERGENCY_ENCOUNTER' ? 'EMERGENCY' : prescription.sourceType === 'PROCEDURE_BOOKING' ? 'PROCEDURE' : prescription.sourceType === 'INPATIENT_ADMISSION' ? 'IP_ADMISSION' : 'OPD' };
    if (!await this.repository.authorized(actor, context.branchId.toString())) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    const billingVisit = visit ?? (prescription.sourceType === 'PROCEDURE_BOOKING' && prescription.encounterId ? await this.repository.getVisit(prescription.encounterId.toString(), session) : null);
    return { prescription, visit: context, billingVisit };
  }

  async list(query: PharmacyDispensingListQuery, actor: string) {
    if (!await this.repository.authorized(actor, query.branch_id)) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    return this.repository.listPrescriptions(query);
  }

  async get(prescriptionId: string, actor: string) {
    const { prescription, visit } = await this.context(prescriptionId, actor);
    return this.repository.ensureDraft(prescription, visit, actor);
  }

  async save(
    prescriptionId: string,
    data: SavePharmacyDispensingDTO,
    actor: string,
    metadata: PharmacyRequestMetadata,
  ) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const { prescription, visit } = await this.context(prescriptionId, actor, session);
        const draft = await this.repository.ensureDraft(prescription, visit, actor, session);
        if (!draft.id) throw new AppError('Dispensing draft is unavailable', 409, 'DISPENSING_NOT_FOUND');
        const sourceItems = new Map(prescription.items.map((item) => [item._id.toString(), item]));
        const submittedItemIds = new Set(data.items.map((item) => item.prescription_item_id));
        if (data.items.length !== prescription.items.length || submittedItemIds.size !== data.items.length || data.items.some((item) => !sourceItems.has(item.prescription_item_id))) {
          throw new AppError('All prescribed medicines must be mapped before saving', 422, 'DISPENSING_ITEMS_INVALID');
        }
        const fields = [];
        for (const item of data.items) {
          const source = sourceItems.get(item.prescription_item_id);
          if (!source) throw new AppError('Prescription item not found', 422, 'DISPENSING_ITEMS_INVALID');
          const medicine = await this.repository.getInventoryRepository().getMedicine(item.medicine_id, session);
          const batch = await this.repository.getInventoryRepository().getAvailableBatch(item.batch_id, visit.branchId.toString(), session);
          if (!medicine || medicine.status !== 'ACTIVE' || !batch || batch.medicineId.toString() !== item.medicine_id) {
            throw new AppError('Selected medicine batch is invalid', 422, 'BATCH_NOT_AVAILABLE');
          }
          if (batch.quantityOnHand < item.confirmed_quantity) throw new AppError(`Insufficient stock for ${source.medicineName}`, 409, 'INSUFFICIENT_STOCK');
          fields.push({ prescriptionItemId: source._id, medicineId: new Types.ObjectId(item.medicine_id), batchId: new Types.ObjectId(item.batch_id), medicineName: medicine.name, batchNumber: batch.batchNumber, requestedQuantity: source.quantity ?? null, confirmedQuantity: item.confirmed_quantity, availableQuantity: batch.quantityOnHand, unitPrice: batch.unitPrice, lineTotal: money(batch.unitPrice * item.confirmed_quantity), pharmacistInstructions: item.pharmacist_instructions?.trim() || null });
        }
        const updated = await this.repository.saveInSession(draft.id, data.version, fields, actor, session);
        if (!updated) throw new AppError('Dispensing changed; refresh and retry', 409, 'STALE_VERSION');
        await this.repository.audit('pharmacy.dispensing.draft_saved', actor, metadata, {
          dispensingId: draft.id,
          prescriptionId,
          previousVersion: data.version,
          version: updated.version,
          items: fields.map((item) => ({
            prescriptionItemId: item.prescriptionItemId.toString(),
            requestedQuantity: item.requestedQuantity,
            confirmedQuantity: item.confirmedQuantity,
            medicineId: item.medicineId.toString(),
            batchId: item.batchId.toString(),
          })),
        }, session);
        return this.repository.getByPrescription(prescriptionId, session);
      });
    } finally {
      await session.endSession();
    }
  }

  async confirm(prescriptionId: string, version: number, key: string, actor: string, metadata: PharmacyRequestMetadata) {
    const session = await mongoose.startSession();
    try {
      return await session.withTransaction(async () => {
        const { prescription, visit, billingVisit } = await this.context(prescriptionId, actor, session);
        if (prescription.status !== 'SUBMITTED') throw new AppError('Prescription is not actionable', 409, 'PRESCRIPTION_NOT_ACTIONABLE');
        if (prescription.sourceType === 'PROCEDURE_BOOKING' && (!prescription.procedureId || !prescription.encounterId || !await this.repository.hasActiveProcedureContext(prescription.procedureId.toString(), prescription.patientId.toString(), prescription.branchId.toString(), prescription.encounterId.toString(), session))) throw new AppError('Procedure booking is no longer active for dispensing', 409, 'PROCEDURE_CONTEXT_NOT_ACTIVE');
        if (prescription.sourceType === 'PROCEDURE_BOOKING' && (!billingVisit || billingVisit.patientId.toString() !== prescription.patientId.toString() || billingVisit.branchId.toString() !== prescription.branchId.toString())) throw new AppError('Procedure billing encounter context is invalid', 409, 'PROCEDURE_BILLING_CONTEXT_INVALID');
        const dispensing = await this.repository.getRawByPrescription(prescriptionId, session);
        if (!dispensing || dispensing.status !== 'DRAFT') throw new AppError('Dispensing is not confirmable', 409, 'INVALID_STATE_TRANSITION');
        if (dispensing.version !== version) throw new AppError('Dispensing changed; refresh and retry', 409, 'STALE_VERSION');
        const dispensingItemIds = new Set(dispensing.items.map((item) => item.prescriptionItemId.toString()));
        if (dispensing.items.length !== prescription.items.length || dispensing.items.length === 0 || dispensingItemIds.size !== dispensing.items.length) {
          throw new AppError('All prescribed medicines must be resolved before confirmation', 422, 'DISPENSING_ITEMS_UNRESOLVED');
        }
        const sourceItems = new Map(prescription.items.map((item) => [item._id.toString(), item]));
        const inventory = this.repository.getInventoryRepository();
        const billItems = [];
        for (const item of dispensing.items) {
          const source = sourceItems.get(item.prescriptionItemId.toString());
          if (!source || item.requestedQuantity !== (source.quantity ?? null) || !isResolvedDispensingItem(item)) {
            throw new AppError('All prescribed medicines must be resolved before confirmation', 422, 'DISPENSING_ITEMS_UNRESOLVED');
          }
          const batch = await inventory.getAvailableBatch(item.batchId.toString(), visit.branchId.toString(), session);
          if (!batch || batch.medicineId.toString() !== item.medicineId.toString()) throw new AppError('Selected medicine batch is invalid', 422, 'BATCH_NOT_AVAILABLE');
          if (batch.quantityOnHand < item.confirmedQuantity) throw new AppError(`Insufficient stock for ${item.medicineName}`, 409, 'INSUFFICIENT_STOCK');
          const before = batch.quantityOnHand;
          const changed = await inventory.updateBatchQuantity(item.batchId.toString(), visit.branchId.toString(), -item.confirmedQuantity, actor, session);
          if (!changed) throw new AppError(`Stock changed for ${item.medicineName}; retry`, 409, 'INSUFFICIENT_STOCK');
          const refreshed = await inventory.refreshInventorySnapshot(item.medicineId.toString(), visit.branchId.toString(), actor, session);
          if (!refreshed) throw new AppError('Inventory snapshot could not be refreshed', 500, 'INVENTORY_REFRESH_FAILED');
          await inventory.createMovement({ medicineId: item.medicineId.toString(), branchId: visit.branchId.toString(), batchId: item.batchId.toString(), movementType: 'STOCK_OUT', quantity: item.confirmedQuantity, batchBefore: before, batchAfter: changed.quantityOnHand, availableBefore: refreshed.availableQuantity + item.confirmedQuantity, availableAfter: refreshed.availableQuantity, reason: 'Prescription dispensing', reference: prescriptionId, idempotencyKey: `${key}:${item._id.toString()}` }, actor, session);
          billItems.push({ serviceId: item.batchId.toString(), serviceName: item.medicineName, serviceType: 'PHARMACY' as const, originatingOrderId: prescriptionId, quantity: item.confirmedQuantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal });
        }
        const total = money(billItems.reduce((sum, item) => sum + item.lineTotal, 0));
        const invoiceVisit = billingVisit ?? visit;
        const invoice = await this.repository.getBillingRepository().createInvoice({ invoiceNumber: createBillingNumber('INV'), patientId: prescription.patientId.toString(), visitId: invoiceVisit._id.toString(), sourceType: prescription.sourceType === 'PROCEDURE_BOOKING' ? 'PROCEDURE' : billingSourceTypeForVisit(invoiceVisit.visitType), encounterId: prescription.encounterId?.toString() ?? invoiceVisit._id.toString(), admissionId: prescription.admissionId?.toString() ?? null, procedureId: prescription.procedureId?.toString() ?? null, appointmentId: invoiceVisit.appointmentId?.toString() ?? null, branchId: visit.branchId.toString(), invoiceDate: new Date(), subtotal: total, discountAmount: 0, taxAmount: 0, totalAmount: total, balanceAmount: total }, billItems, actor, session);
        await this.repository.getBillingRepository().updateInvoice(invoice.id, { status: 'PENDING' }, actor, session);
        const confirmed = await this.repository.confirm(dispensing._id.toString(), version, actor, invoice.id, key, session);
        if (!confirmed) throw new AppError('Dispensing changed; refresh and retry', 409, 'STALE_VERSION');
        const prescriptionUpdated = await this.repository.getPrescription(prescriptionId, session);
        if (!prescriptionUpdated || prescriptionUpdated.status !== 'SUBMITTED') throw new AppError('Prescription changed; retry', 409, 'INVALID_STATE_TRANSITION');
        const prescriptionStatus = await this.repository.getPrescriptionRepository().updateStatusIf(prescriptionId, 'SUBMITTED', 'DISPENSED', actor, session);
        if (!prescriptionStatus) throw new AppError('Prescription changed; retry', 409, 'INVALID_STATE_TRANSITION');
        await this.repository.audit('pharmacy.dispensing.confirmed', actor, metadata, { dispensingId: dispensing._id.toString(), prescriptionId, invoiceId: invoice.id, stockItemCount: dispensing.items.length }, session);
        return this.repository.getByPrescription(prescriptionId, session);
      });
    } finally { await session.endSession(); }
  }

  async cancel(prescriptionId: string, version: number, reason: string, actor: string, metadata: PharmacyRequestMetadata) {
    const session = await mongoose.startSession();
    try { return await session.withTransaction(async () => {
      const { visit } = await this.context(prescriptionId, actor, session);
      const dispensing = await this.repository.getRawByPrescription(prescriptionId, session);
      if (!dispensing || dispensing.status !== 'DRAFT' || dispensing.version !== version) throw new AppError('Dispensing is not cancellable', 409, 'INVALID_STATE_TRANSITION');
      const updated = await this.repository.cancel(dispensing._id.toString(), version, actor, reason, session);
      if (!updated) throw new AppError('Dispensing changed; refresh and retry', 409, 'STALE_VERSION');
      const prescriptionStatus = await this.repository.getPrescriptionRepository().updateStatusIf(prescriptionId, 'SUBMITTED', 'CANCELLED', actor, session);
      if (!prescriptionStatus) throw new AppError('Prescription changed; retry', 409, 'INVALID_STATE_TRANSITION');
      await this.repository.audit('pharmacy.dispensing.cancelled', actor, metadata, { dispensingId: dispensing._id.toString(), prescriptionId, reason, branchId: visit.branchId.toString() }, session);
      return this.repository.getByPrescription(prescriptionId, session);
    }); } finally { await session.endSession(); }
  }

  async reverse(prescriptionId: string, version: number, reason: string, key: string, actor: string, metadata: PharmacyRequestMetadata) {
    const session = await mongoose.startSession();
    try { return await session.withTransaction(async () => {
      const { visit } = await this.context(prescriptionId, actor, session);
      const dispensing = await this.repository.getRawByPrescription(prescriptionId, session);
      if (!dispensing || dispensing.status !== 'CONFIRMED' || dispensing.version !== version) throw new AppError('Dispensing is not reversible', 409, 'DISPENSING_REVERSAL_NOT_ALLOWED');
      if (!dispensing.invoiceId) throw new AppError('Dispensing invoice is missing', 409, 'DISPENSING_REVERSAL_NOT_ALLOWED');
      const invoice = await this.repository.getBillingRepository().getById(dispensing.invoiceId.toString(), undefined, session);
      if (!invoice || invoice.paid_amount > 0 || !['DRAFT', 'PENDING'].includes(invoice.status)) throw new AppError('Paid dispensing requires a refund workflow', 409, 'PAID_DISPENSING_REVERSAL_REQUIRES_REFUND');
      const inventory = this.repository.getInventoryRepository();
      for (const item of dispensing.items) {
        if (!isResolvedDispensingItem(item)) throw new AppError('Dispensing contains unresolved stock items', 409, 'DISPENSING_REVERSAL_NOT_ALLOWED');
        const batch = await inventory.getBatch(item.batchId.toString(), visit.branchId.toString(), session);
        if (!batch) throw new AppError('Original stock batch is missing', 409, 'DISPENSING_REVERSAL_NOT_ALLOWED');
        const before = batch.quantityOnHand;
        const changed = await inventory.updateBatchQuantity(item.batchId.toString(), visit.branchId.toString(), item.confirmedQuantity, actor, session, true);
        if (!changed) throw new AppError('Stock restoration failed', 409, 'DISPENSING_REVERSAL_NOT_ALLOWED');
        const refreshed = await inventory.refreshInventorySnapshot(item.medicineId.toString(), visit.branchId.toString(), actor, session);
        if (!refreshed) throw new AppError('Inventory snapshot could not be refreshed', 500, 'INVENTORY_REFRESH_FAILED');
        await inventory.createMovement({ medicineId: item.medicineId.toString(), branchId: visit.branchId.toString(), batchId: item.batchId.toString(), movementType: 'STOCK_IN', quantity: item.confirmedQuantity, batchBefore: before, batchAfter: changed.quantityOnHand, availableBefore: refreshed.availableQuantity - item.confirmedQuantity, availableAfter: refreshed.availableQuantity, reason: 'Prescription dispensing reversal', reference: prescriptionId, idempotencyKey: `${key}:${item._id.toString()}` }, actor, session);
      }
      const cancelledInvoice = await this.repository.getBillingRepository().cancelInvoice(invoice.id, actor, session);
      if (!cancelledInvoice) throw new AppError('Dispensing invoice could not be cancelled', 409, 'DISPENSING_REVERSAL_NOT_ALLOWED');
      const reversed = await this.repository.reverse(dispensing._id.toString(), version, actor, key, reason, session);
      if (!reversed) throw new AppError('Dispensing changed; refresh and retry', 409, 'STALE_VERSION');
      const prescriptionStatus = await this.repository.getPrescriptionRepository().updateStatusIf(prescriptionId, 'DISPENSED', 'CANCELLED', actor, session);
      if (!prescriptionStatus) throw new AppError('Prescription changed; retry', 409, 'INVALID_STATE_TRANSITION');
      await this.repository.audit('pharmacy.dispensing.reversed', actor, metadata, { dispensingId: dispensing._id.toString(), prescriptionId, invoiceId: invoice.id, reason }, session);
      return this.repository.getByPrescription(prescriptionId, session);
    }); } finally { await session.endSession(); }
  }
}
