import { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import { AuditLogModel } from '../auth/auth.model.js';
import { BillingRepository } from '../billing/billing.repository.js';
import { OpdPrescriptionModel, type OpdPrescriptionFields } from '../opd/opd-prescription.model.js';
import type { OpdPrescriptionRepository } from '../opd/opd-prescription.repository.js';
import { OpdVisitModel, type OpdVisitFields } from '../opd/opd-visit.model.js';
import { ProcedureBookingModel, ProcedureRecommendationModel } from '../surgery/surgery.model.js';
import { PharmacyInventoryRepository } from '../pharmacy-inventory/pharmacy-inventory.repository.js';
import { PharmacyDispensingModel, type PharmacyDispensingFields } from './pharmacy-dispensing.model.js';
import type { PharmacyDispensing, PharmacyDispensingItem, PharmacyDispensingListQuery } from './pharmacy-dispensing.types.js';
type DispensingItemInput = Omit<PharmacyDispensingFields['items'][number], '_id'>;

type PrescriptionRecord = OpdPrescriptionFields & { _id: Types.ObjectId };
type VisitRecord = OpdVisitFields & { _id: Types.ObjectId };
type VisitSourceRecord = Pick<VisitRecord, '_id' | 'branchId' | 'visitType'>;
export type DispensingContext = { _id: Types.ObjectId; branchId: Types.ObjectId; visitType?: string; appointmentId?: Types.ObjectId | null };
type DispensingRecord = PharmacyDispensingFields & { _id: Types.ObjectId };
const objectId = (value: string) => new Types.ObjectId(value);
const toItem = (
  item: PharmacyDispensingFields['items'][number],
  prescribedMedicineName: string,
): PharmacyDispensingItem => ({
  id: item._id?.toString() ?? '', prescription_item_id: item.prescriptionItemId.toString(), medicine_id: item.medicineId?.toString() ?? null,
  prescribed_medicine_name: prescribedMedicineName,
  batch_id: item.batchId?.toString() ?? null, medicine_name: item.medicineName, batch_number: item.batchNumber,
  requested_quantity: item.requestedQuantity ?? null, confirmed_quantity: item.confirmedQuantity ?? null,
  available_quantity: item.availableQuantity, unit_price: item.unitPrice, line_total: item.lineTotal,
  pharmacist_instructions: item.pharmacistInstructions ?? null,
});

export class PharmacyDispensingRepository {
  constructor(
    private readonly inventory: PharmacyInventoryRepository,
    private readonly billing: BillingRepository,
    private readonly prescriptions: OpdPrescriptionRepository,
  ) {}

  async authorized(userId: string, branchId: string) {
    return this.inventory.isAuthorizedBranch(userId, branchId);
  }

  async getPrescription(id: string, session?: ClientSession) {
    const query = OpdPrescriptionModel.findOne({ _id: objectId(id), deletedAt: null }).lean<PrescriptionRecord>();
    if (session) query.session(session);
    return query;
  }

  async getVisit(id: string, session?: ClientSession) {
    const query = OpdVisitModel.findOne({ _id: objectId(id), deletedAt: null }).lean<VisitRecord>();
    if (session) query.session(session);
    return query;
  }

  async hasActiveProcedureContext(bookingId: string, patientId: string, branchId: string, encounterId: string, session: ClientSession) {
    const booking = await ProcedureBookingModel.findOne({
      _id: objectId(bookingId), patientId: objectId(patientId), branchId: objectId(branchId),
      status: { $in: ['PENDING_CONFIRMATION', 'BOOKED'] },
    }).select('recommendationId').session(session).lean();
    if (!booking) return false;
    return Boolean(await ProcedureRecommendationModel.exists({
      _id: booking.recommendationId, patientId: objectId(patientId), branchId: objectId(branchId),
      encounterId: objectId(encounterId), status: 'BOOKED', bookingId: objectId(bookingId),
    }).session(session));
  }

  private toDispensing(record: DispensingRecord, prescription: PrescriptionRecord, visit?: { _id: Types.ObjectId; visitType?: string }): PharmacyDispensing {
    const prescribedMedicineByItem = new Map(
      prescription.items.map((item) => [item._id.toString(), item.medicineName]),
    );
    return {
      id: record._id.toString(), prescription_id: record.prescriptionId.toString(), patient_id: record.patientId.toString(),
      source_type: record.sourceType ?? prescription.sourceType, encounter_id: record.encounterId?.toString() ?? prescription.encounterId?.toString() ?? visit?._id.toString() ?? null,
      admission_id: record.admissionId?.toString() ?? prescription.admissionId?.toString() ?? null, procedure_id: record.procedureId?.toString() ?? prescription.procedureId?.toString() ?? null,
      patient_number: prescription.patientNumber, patient_name: prescription.patientName, doctor_name: prescription.doctorName,
      visit_id: record.visitId?.toString() ?? null, branch_id: record.branchId.toString(), status: record.status, version: record.version,
      items: record.items.map((item) => toItem(
        item,
        prescribedMedicineByItem.get(item.prescriptionItemId.toString()) ?? item.medicineName,
      )), invoice_id: record.invoiceId?.toString() ?? null,
      submitted_at: prescription.submittedAt ?? null, confirmed_at: record.confirmedAt ?? null,
      cancelled_at: record.cancelledAt ?? null, reversed_at: record.reversedAt ?? null,
      reversal_reason: record.reversalReason ?? null, created_at: record.createdAt, updated_at: record.updatedAt,
    };
  }

  async getByPrescription(prescriptionId: string, session?: ClientSession) {
    const query = PharmacyDispensingModel.findOne({ prescriptionId: objectId(prescriptionId) }).lean<DispensingRecord>();
    if (session) query.session(session);
    const record = await query;
    if (!record) return null;
    const prescription = await this.getPrescription(prescriptionId, session);
    if (!prescription) return null;
    const visit = prescription.visitId ? await this.getVisit(prescription.visitId.toString(), session) : null;
    return this.toDispensing(record, prescription, visit ?? undefined);
  }

  async get(prescriptionId: string, actorUserId: string) {
    const context = await this.getPrescription(prescriptionId);
    if (!context) throw new AppError('Prescription not found', 404, 'PRESCRIPTION_NOT_FOUND');
    const visit = context.visitId ? await this.getVisit(context.visitId.toString()) : null;
    const dispensingContext: DispensingContext = visit ?? { _id: context.sourceId, branchId: context.branchId };
    if (!await this.authorized(actorUserId, dispensingContext.branchId.toString())) throw new AppError('Branch access denied', 403, 'BRANCH_ACCESS_DENIED');
    return this.ensureDraft(context, dispensingContext, actorUserId);
  }

  async getRawByPrescription(prescriptionId: string, session?: ClientSession) {
    const query = PharmacyDispensingModel.findOne({ prescriptionId: objectId(prescriptionId) }).lean<DispensingRecord>();
    if (session) query.session(session);
    return query;
  }

  async ensureDraft(prescription: PrescriptionRecord, visit: DispensingContext, userId: string, session?: ClientSession) {
    const existing = await this.getByPrescription(prescription._id.toString(), session);
    if (existing) return existing;
    if (prescription.status !== 'SUBMITTED') throw new AppError('Prescription is not actionable', 409, 'PRESCRIPTION_NOT_ACTIONABLE');
    const record = await PharmacyDispensingModel.findOneAndUpdate(
      { prescriptionId: prescription._id },
      { $setOnInsert: {
        prescriptionId: prescription._id, patientId: prescription.patientId, sourceType: prescription.sourceType,
        encounterId: prescription.encounterId ?? null, admissionId: prescription.admissionId ?? null, procedureId: prescription.procedureId ?? null,
        visitId: prescription.visitId ?? null, branchId: prescription.branchId,
        status: 'DRAFT', version: 0, items: [], createdBy: objectId(userId), updatedBy: objectId(userId),
      } }, { upsert: true, returnDocument: 'after', lean: true, session });
    if (!record) throw new AppError('Dispensing draft could not be created', 500, 'DISPENSING_CREATE_FAILED');
    const items = record.items.length > 0 ? record.items : await Promise.all(prescription.items.map(async (item) => {
      const medicine = await this.inventory.findMedicineByName(item.medicineName, session);
      const batch = medicine ? await this.inventory.findAvailableBatch(medicine._id.toString(), visit.branchId.toString(), session) : null;
      return { prescriptionItemId: item._id, medicineId: medicine?._id ?? null, batchId: batch?._id ?? null, medicineName: medicine?.name ?? item.medicineName, batchNumber: batch?.batchNumber ?? '', requestedQuantity: item.quantity ?? null, confirmedQuantity: item.quantity ?? null, availableQuantity: batch?.quantityOnHand ?? 0, unitPrice: batch?.unitPrice ?? 0, lineTotal: batch && item.quantity ? batch.unitPrice * item.quantity : 0, pharmacistInstructions: null, _id: new Types.ObjectId() };
    }));
    if (record.items.length === 0 && items.length > 0) {
      await PharmacyDispensingModel.updateOne({ _id: record._id, version: record.version }, { $set: { items, updatedBy: objectId(userId) } }, { session });
      const refreshed = await PharmacyDispensingModel.findById(record._id).session(session ?? null).lean<DispensingRecord>();
      return refreshed ? this.toDispensing(refreshed, prescription, visit) : this.toDispensing({ ...record, items }, prescription, visit);
    }
    return this.toDispensing(record as DispensingRecord, prescription, visit);
  }

  async save(recordId: string, version: number, items: DispensingItemInput[], userId: string) {
    const updated = await PharmacyDispensingModel.findOneAndUpdate(
      { _id: objectId(recordId), status: 'DRAFT', version },
      { $set: { items, updatedBy: objectId(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, runValidators: true },
    ).lean<DispensingRecord>();
    return updated;
  }

  async saveInSession(recordId: string, version: number, items: DispensingItemInput[], userId: string, session: ClientSession) {
    return PharmacyDispensingModel.findOneAndUpdate(
      { _id: objectId(recordId), status: 'DRAFT', version },
      { $set: { items, updatedBy: objectId(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    ).lean<DispensingRecord>();
  }

  async confirm(recordId: string, version: number, userId: string, invoiceId: string, key: string, session: ClientSession) {
    return PharmacyDispensingModel.findOneAndUpdate(
      { _id: objectId(recordId), status: 'DRAFT', version },
      { $set: { status: 'CONFIRMED', invoiceId: objectId(invoiceId), confirmIdempotencyKey: key, confirmedAt: new Date(), confirmedBy: objectId(userId), updatedBy: objectId(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session },
    ).lean<DispensingRecord>();
  }

  async reverse(recordId: string, version: number, userId: string, key: string, reason: string, session: ClientSession) {
    return PharmacyDispensingModel.findOneAndUpdate(
      { _id: objectId(recordId), status: 'CONFIRMED', version },
      { $set: { status: 'REVERSED', reverseIdempotencyKey: key, reversedAt: new Date(), reversedBy: objectId(userId), reversalReason: reason, updatedBy: objectId(userId) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session },
    ).lean<DispensingRecord>();
  }

  async listPrescriptions(query: PharmacyDispensingListQuery) {
    const page = query.page ?? 1; const limit = query.limit ?? 20;
const visits = await OpdVisitModel.find({
  branchId: objectId(query.branch_id),
  deletedAt: null,
})
  .select('_id branchId visitType')
  .lean<VisitSourceRecord[]>();

const visitById = new Map(
  visits.map((visit) => [visit._id.toString(), visit]),
);

const filter: Record<string, unknown> = {
  $or: [
    { branchId: objectId(query.branch_id) },
    { visitId: { $in: visits.map((visit) => visit._id) } },
  ],
  deletedAt: null,
};

if (query.status === 'PENDING') {
  filter.status = 'SUBMITTED';
} else if (
  query.status === 'CONFIRMED' ||
  query.status === 'REVERSED'
) {
  const dispensingRecords = await PharmacyDispensingModel.find({
    branchId: objectId(query.branch_id),
    status: query.status,
  })
    .select('prescriptionId')
    .lean<Array<{ prescriptionId: Types.ObjectId }>>();

  filter._id = {
    $in: dispensingRecords.map((record) => record.prescriptionId),
  };
  filter.status = 'DISPENSED';
} else if (query.status === 'CANCELLED') {
  filter.status = 'CANCELLED';
} else {
  filter.status = {
    $in: ['SUBMITTED', 'DISPENSED', 'CANCELLED'],
  };
}
    if (query.search) filter.$or = [
      { patientName: new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { patientNumber: new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    ];
    const [prescriptions, total] = await Promise.all([
      OpdPrescriptionModel.find(filter).sort({ submittedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean<PrescriptionRecord[]>(),
      OpdPrescriptionModel.countDocuments(filter),
    ]);
    const records = await PharmacyDispensingModel.find({ prescriptionId: { $in: prescriptions.map((item) => item._id) } }).lean<DispensingRecord[]>();
    const byPrescription = new Map(records.map((item) => [item.prescriptionId.toString(), item]));
    const mapped = prescriptions.map((prescription) => {
      const dispensing = byPrescription.get(prescription._id.toString());
      const visit = prescription.visitId ? visitById.get(prescription.visitId.toString()) : null;
      const ctx = visit ?? { _id: prescription.sourceId, branchId: objectId(query.branch_id) };
      if (!ctx) return null;
      return dispensing ? this.toDispensing(dispensing, prescription, ctx) : {
        id: '', prescription_id: prescription._id.toString(), patient_id: prescription.patientId.toString(),
        source_type: prescription.sourceType, encounter_id: prescription.encounterId?.toString() ?? null, admission_id: prescription.admissionId?.toString() ?? null, procedure_id: prescription.procedureId?.toString() ?? null,
        patient_number: prescription.patientNumber, patient_name: prescription.patientName, doctor_name: prescription.doctorName,
        visit_id: prescription.visitId?.toString() ?? null, branch_id: query.branch_id, status: 'DRAFT' as const, version: 0, items: [], invoice_id: null,
        submitted_at: prescription.submittedAt ?? null, confirmed_at: null, cancelled_at: null, reversed_at: null, reversal_reason: null,
        created_at: prescription.createdAt, updated_at: prescription.updatedAt,
      };
    });
    const available = mapped.filter((item): item is PharmacyDispensing => item !== null);
    const data = query.status && query.status !== 'PENDING'
      ? available.filter((item) => item.status === query.status)
      : available;
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async cancel(id: string, version: number, userId: string, reason: string, session: ClientSession) {
    return PharmacyDispensingModel.findOneAndUpdate(
      { _id: objectId(id), status: 'DRAFT', version },
      { $set: { status: 'CANCELLED', updatedBy: objectId(userId), cancelledAt: new Date(), cancelledBy: objectId(userId), cancellationReason: reason }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session },
    ).lean<DispensingRecord>();
  }

  async audit(eventType: string, actor: string, metadata: { ipAddress?: string; userAgent?: string }, details: Record<string, unknown>, session: ClientSession) {
    await AuditLogModel.create([{ eventType, actorUserId: actor, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent, metadataJson: details }], { session });
  }

  getInventoryRepository() { return this.inventory; }
  getBillingRepository() { return this.billing; }
  getPrescriptionRepository() { return this.prescriptions; }
}
