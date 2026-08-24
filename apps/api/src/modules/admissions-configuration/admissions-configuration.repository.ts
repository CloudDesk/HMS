import mongoose, { Types, type ClientSession, type PipelineStage } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { InpatientAdmissionModel, type InpatientAdmissionFields } from '../inpatient-admissions/inpatient-admission.model.js';
import { PatientModel } from '../patients/patient.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import {
  AdmissionPolicyModel,
  BedAssignmentHistoryModel,
  BedHoldModel,
  BedModel,
  BedTransferModel,
  WardModel,
  type AdmissionPolicyFields,
  type BedFields,
  type BedHoldFields,
  type BedTransferFields,
  type WardFields,
} from './admissions-configuration.model.js';
import type {
  AdmissionPolicy,
  Bed,
  BedHold,
  BedListQuery,
  BedSummary,
  BedTransfer,
  CreateBedDTO,
  CreateBedHoldDTO,
  CreateBedTransferDTO,
  CreateWardDTO,
  SaveAdmissionPolicyDTO,
  StatusActionMetadata,
  UpdateBedDTO,
  UpdateWardDTO,
  Ward,
  WardListQuery,
} from './admissions-configuration.types.js';

export type WardRecord = WardFields & { _id: Types.ObjectId };
export type BedRecord = BedFields & { _id: Types.ObjectId };
export type HoldRecord = BedHoldFields & { _id: Types.ObjectId };
export type TransferRecord = BedTransferFields & { _id: Types.ObjectId };
export type AdmissionRecord = InpatientAdmissionFields & { _id: Types.ObjectId };
type PolicyRecord = AdmissionPolicyFields & { _id: Types.ObjectId };
type BedBoardRecord = BedRecord & {
  ward?: { name: string } | null;
  hold?: { holdNumber: string; expiresAt: Date; patientId: Types.ObjectId } | null;
  admission?: { admissionNumber: string; patientId: Types.ObjectId; patientNumber: string; patientName: string } | null;
};

const oid = (value: string) => new Types.ObjectId(value);
const regex = (value: string) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const page = (value?: number) => value ?? 1;
const limit = (value?: number) => value ?? 20;
const meta = (total: number, currentPage: number, currentLimit: number) => ({ total, page: currentPage, limit: currentLimit, totalPages: Math.ceil(total / currentLimit) || 1 });

const toWard = (item: WardRecord): Ward => ({ id: item._id.toString(), branch_id: item.branchId.toString(), name: item.name, ward_type: item.wardType, floor: item.floor, description: item.description ?? null, status: item.status, created_at: item.createdAt, updated_at: item.updatedAt });
const toBed = (item: BedBoardRecord): Bed => ({
  id: item._id.toString(), branch_id: item.branchId.toString(), ward_id: item.wardId.toString(), ward_name: item.ward?.name ?? '', bed_number: item.bedNumber, bed_category: item.bedCategory, room_number: item.roomNumber ?? null, status: item.status, block_reason_code: item.blockReasonCode ?? null,
  current_hold_id: item.currentHoldId?.toString() ?? null, current_admission_id: item.currentAdmissionId?.toString() ?? null, hold_number: item.hold?.holdNumber ?? null, hold_expires_at: item.hold?.expiresAt ?? null,
  admission_number: item.admission?.admissionNumber ?? null, patient_id: (item.admission?.patientId ?? item.hold?.patientId)?.toString() ?? null, patient_number: item.admission?.patientNumber ?? null, patient_name: item.admission?.patientName ?? null,
  version: item.version ?? 0, created_at: item.createdAt, updated_at: item.updatedAt,
});
const toPolicy = (item: PolicyRecord): AdmissionPolicy => ({ id: item._id.toString(), branch_id: item.branchId.toString(), bed_hold_duration_minutes: item.bedHoldDurationMinutes, admission_consent_required: item.admissionConsentRequired, admission_advance_deposit_required: item.admissionAdvanceDepositRequired, admission_minimum_deposit_amount: item.admissionMinimumDepositAmount, status: item.status, version: item.version, created_at: item.createdAt, updated_at: item.updatedAt });
const toHold = (item: HoldRecord): BedHold => ({ id: item._id.toString(), hold_number: item.holdNumber, idempotency_key: item.idempotencyKey, patient_id: item.patientId.toString(), branch_id: item.branchId.toString(), ward_id: item.wardId.toString(), bed_id: item.bedId.toString(), admission_id: item.admissionId?.toString() ?? null, bed_number: item.bedNumber, ward_name: item.wardName, room_number: item.roomNumber ?? null, status: item.status, held_at: item.heldAt, expires_at: item.expiresAt, reason: item.reason, terminal_reason: item.terminalReason ?? null, version: item.version, created_at: item.createdAt, updated_at: item.updatedAt });
export const toTransfer = (item: TransferRecord): BedTransfer => ({ id: item._id.toString(), admission_id: item.admissionId.toString(), patient_id: item.patientId.toString(), source_branch_id: item.sourceBranchId.toString(), source_ward_id: item.sourceWardId.toString(), source_bed_id: item.sourceBedId.toString(), destination_branch_id: item.destinationBranchId.toString(), destination_ward_id: item.destinationWardId.toString(), destination_bed_id: item.destinationBedId.toString(), source_bed_number: item.sourceBedNumber, destination_bed_number: item.destinationBedNumber, reason: item.reason, status: item.status, requested_at: item.requestedAt, completed_at: item.completedAt ?? null, cancelled_at: item.cancelledAt ?? null, created_at: item.createdAt, updated_at: item.updatedAt });

const bedBoardPipeline = (filter: Record<string, unknown>, currentPage?: number, currentLimit?: number) => {
  const pipeline: PipelineStage[] = [
    { $match: filter },
    { $lookup: { from: 'hmswards', localField: 'wardId', foreignField: '_id', as: 'ward' } },
    { $unwind: { path: '$ward', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'bedholds', localField: 'currentHoldId', foreignField: '_id', as: 'hold' } },
    { $unwind: { path: '$hold', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'inpatientadmissions', localField: 'currentAdmissionId', foreignField: '_id', as: 'admission' } },
    { $unwind: { path: '$admission', preserveNullAndEmptyArrays: true } },
    { $sort: { bedNumber: 1, _id: 1 } },
  ];
  if (currentPage !== undefined && currentLimit !== undefined) pipeline.push({ $skip: (currentPage - 1) * currentLimit }, { $limit: currentLimit });
  return pipeline;
};

export class AdmissionsConfigurationRepository {
  async session() { return mongoose.startSession(); }

  async hasBranchAccess(userId: string, branchId: string) {
    const [user, branch] = await Promise.all([
      UserModel.findOne({ _id: userId, status: 'active', deletedAt: null }).select('branchIds roleIds').lean(),
      BranchModel.exists({ _id: branchId, status: 'ACTIVE', deletedAt: null }),
    ]);
    if (!user || !branch) return false;
    if ((user.branchIds ?? []).some((id) => id.toString() === branchId)) return true;
    return Boolean(await RoleModel.exists({ _id: { $in: user.roleIds ?? [] }, code: 'SUPER_ADMIN', status: 'active', deletedAt: null }));
  }

  async listWards(query: WardListQuery) {
    const currentPage = page(query.page); const currentLimit = limit(query.limit); const filter: Record<string, unknown> = { branchId: oid(query.branch_id) };
    if (query.search) filter.$or = [{ name: regex(query.search) }, { wardType: regex(query.search) }];
    if (query.ward_type) filter.wardType = query.ward_type; if (query.floor) filter.floor = query.floor; if (query.status) filter.status = query.status;
    const [records, total] = await Promise.all([WardModel.find(filter).sort({ name: 1, _id: 1 }).skip((currentPage - 1) * currentLimit).limit(currentLimit).lean<WardRecord[]>(), WardModel.countDocuments(filter)]);
    return { data: records.map(toWard), meta: meta(total, currentPage, currentLimit) };
  }

  async getWard(id: string, branchId: string, session?: ClientSession) { const query = WardModel.findOne({ _id: oid(id), branchId: oid(branchId) }); if (session) query.session(session); return query.lean<WardRecord>(); }
  async createWard(data: CreateWardDTO, userId: string, session?: ClientSession) { const record = new WardModel({ branchId: oid(data.branch_id), name: data.name.trim(), wardType: data.ward_type.trim(), floor: data.floor.trim(), description: data.description?.trim() || null, status: 'ACTIVE', createdBy: oid(userId), updatedBy: oid(userId) }); await record.save({ session }); return toWard(record.toObject<WardRecord>()); }
  async updateWard(id: string, data: UpdateWardDTO, userId: string, session?: ClientSession) { const set: Record<string, unknown> = { updatedBy: oid(userId) }; if (data.name !== undefined) set.name = data.name.trim(); if (data.ward_type !== undefined) set.wardType = data.ward_type.trim(); if (data.floor !== undefined) set.floor = data.floor.trim(); if (data.description !== undefined) set.description = data.description?.trim() || null; const record = await WardModel.findOneAndUpdate({ _id: oid(id), branchId: oid(data.branch_id) }, { $set: set }, { returnDocument: 'after', lean: true, runValidators: true, session }).lean<WardRecord>(); return record ? toWard(record) : null; }
  async updateWardStatus(id: string, branchId: string, status: 'ACTIVE' | 'INACTIVE', userId: string, session?: ClientSession) { return WardModel.findOneAndUpdate({ _id: oid(id), branchId: oid(branchId) }, { $set: { status, updatedBy: oid(userId) } }, { returnDocument: 'after', lean: true, session }).lean<WardRecord>(); }
  async countProtectedBedsInWard(wardId: string, branchId: string) { return BedModel.countDocuments({ wardId: oid(wardId), branchId: oid(branchId), $or: [{ currentHoldId: { $ne: null } }, { currentAdmissionId: { $ne: null } }, { status: { $in: ['RESERVED', 'OCCUPIED'] } }] }); }

  async listBeds(query: BedListQuery) {
    const currentPage = page(query.page); const currentLimit = limit(query.limit); const filter: Record<string, unknown> = { branchId: oid(query.branch_id) };
    if (query.ward_id) filter.wardId = oid(query.ward_id); if (query.bed_category) filter.bedCategory = query.bed_category; if (query.room_number) filter.roomNumber = query.room_number; if (query.status) filter.status = query.status;
    if (query.search) filter.$or = [{ bedNumber: regex(query.search) }, { roomNumber: regex(query.search) }];
    const [records, total] = await Promise.all([BedModel.aggregate<BedBoardRecord>(bedBoardPipeline(filter, currentPage, currentLimit)), BedModel.countDocuments(filter)]);
    return { data: records.map(toBed), meta: meta(total, currentPage, currentLimit) };
  }

  async getBed(id: string, branchId: string, session?: ClientSession) { const aggregate = BedModel.aggregate<BedBoardRecord>(bedBoardPipeline({ _id: oid(id), branchId: oid(branchId) })); if (session) aggregate.session(session); const [record] = await aggregate; return record ? toBed(record) : null; }
  async getBedRecord(id: string, branchId: string, session?: ClientSession) { const query = BedModel.findOne({ _id: oid(id), branchId: oid(branchId) }); if (session) query.session(session); return query.lean<BedRecord>(); }
  async createBed(data: CreateBedDTO, userId: string, session?: ClientSession) { const record = new BedModel({ branchId: oid(data.branch_id), wardId: oid(data.ward_id), bedNumber: data.bed_number.trim().toUpperCase(), bedCategory: data.bed_category.trim(), roomNumber: data.room_number?.trim() || null, status: 'AVAILABLE', blockReasonCode: null, currentHoldId: null, currentAdmissionId: null, createdBy: oid(userId), updatedBy: oid(userId) }); await record.save({ session }); return this.getBed(record._id.toString(), data.branch_id, session); }
  async updateBed(id: string, branchId: string, data: UpdateBedDTO, userId: string, session?: ClientSession) { const set: Record<string, unknown> = { updatedBy: oid(userId) }; if (data.bed_number !== undefined) set.bedNumber = data.bed_number.trim().toUpperCase(); if (data.bed_category !== undefined) set.bedCategory = data.bed_category.trim(); if (data.room_number !== undefined) set.roomNumber = data.room_number?.trim() || null; const record = await BedModel.findOneAndUpdate({ _id: oid(id), branchId: oid(branchId), currentHoldId: null, currentAdmissionId: null }, { $set: set, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, runValidators: true, session }).lean<BedRecord>(); return record ? this.getBed(record._id.toString(), branchId, session) : null; }
  async updateBedStatus(id: string, branchId: string, status: BedFields['status'], reason: string | null, userId: string, session?: ClientSession) { const record = await BedModel.findOneAndUpdate({ _id: oid(id), branchId: oid(branchId), currentHoldId: null, currentAdmissionId: null, status: { $nin: ['OCCUPIED', 'RESERVED'] } }, { $set: { status, blockReasonCode: status === 'BLOCKED' || status === 'UNDER_MAINTENANCE' ? reason : null, updatedBy: oid(userId) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<BedRecord>(); return record ? this.getBed(record._id.toString(), branchId, session) : null; }
  async summary(branchId: string): Promise<BedSummary> { const [result] = await BedModel.aggregate<{ total: number; rows: Array<{ _id: string; count: number }> }>([{ $match: { branchId: oid(branchId) } }, { $facet: { total: [{ $count: 'count' }], rows: [{ $group: { _id: '$status', count: { $sum: 1 } } }] } }, { $project: { total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] }, rows: 1 } }]); const counts = new Map((result?.rows ?? []).map((row) => [row._id, row.count])); return { total: result?.total ?? 0, available: counts.get('AVAILABLE') ?? 0, occupied: counts.get('OCCUPIED') ?? 0, reserved: counts.get('RESERVED') ?? 0, blocked: counts.get('BLOCKED') ?? 0, under_maintenance: counts.get('UNDER_MAINTENANCE') ?? 0, inactive: counts.get('INACTIVE') ?? 0 }; }

  async getPolicy(branchId: string, session?: ClientSession) { const query = AdmissionPolicyModel.findOne({ branchId: oid(branchId), status: 'ACTIVE' }); if (session) query.session(session); const record = await query.lean<PolicyRecord>(); return record ? toPolicy(record) : null; }
  async savePolicy(data: SaveAdmissionPolicyDTO, actor: string, session: ClientSession) { const record = await AdmissionPolicyModel.findOneAndUpdate({ branchId: oid(data.branch_id), status: 'ACTIVE' }, { $set: { bedHoldDurationMinutes: data.bed_hold_duration_minutes, admissionConsentRequired: data.admission_consent_required, admissionAdvanceDepositRequired: data.admission_advance_deposit_required, admissionMinimumDepositAmount: data.admission_minimum_deposit_amount, updatedBy: oid(actor) }, $setOnInsert: { branchId: oid(data.branch_id), status: 'ACTIVE', createdBy: oid(actor) }, $inc: { version: 1 } }, { upsert: true, returnDocument: 'after', lean: true, runValidators: true, session }).lean<PolicyRecord>(); if (!record) throw new Error('Admission policy save returned no record'); return toPolicy(record); }
  async patientExists(patientId: string, session: ClientSession) { return Boolean(await PatientModel.exists({ _id: oid(patientId), status: 'ACTIVE', deletedAt: null }).session(session)); }

  async getHoldById(id: string, branchId: string, session?: ClientSession) { const query = BedHoldModel.findOne({ _id: oid(id), branchId: oid(branchId) }); if (session) query.session(session); const record = await query.lean<HoldRecord>(); return record ? toHold(record) : null; }
  async getHoldByIdempotencyKey(key: string, session?: ClientSession) { const query = BedHoldModel.findOne({ idempotencyKey: key }); if (session) query.session(session); const record = await query.lean<HoldRecord>(); return record ? { hold: toHold(record), requestHash: record.requestHash } : null; }
  async createHold(id: Types.ObjectId, holdNumber: string, requestHash: string, bed: BedRecord, ward: WardRecord, data: CreateBedHoldDTO, actor: string, expiresAt: Date, session: ClientSession) { const [created] = await BedHoldModel.create([{ _id: id, holdNumber, idempotencyKey: data.idempotency_key, requestHash, patientId: oid(data.patient_id), branchId: oid(data.branch_id), wardId: bed.wardId, bedId: bed._id, admissionId: data.admission_id ? oid(data.admission_id) : null, wardName: ward.name, bedNumber: bed.bedNumber, bedCategory: bed.bedCategory, roomNumber: bed.roomNumber ?? null, status: 'ACTIVE', heldAt: new Date(), expiresAt, reason: data.reason, terminalReason: null, version: 0, createdBy: oid(actor), updatedBy: oid(actor) }], { session }); if (!created) throw new Error('Bed hold create returned no record'); return toHold(created.toObject<HoldRecord>()); }
  async reserveBedForHold(bedId: string, branchId: string, holdId: Types.ObjectId, actor: string, session: ClientSession) { return BedModel.findOneAndUpdate({ _id: oid(bedId), branchId: oid(branchId), status: 'AVAILABLE', currentHoldId: null, currentAdmissionId: null }, { $set: { status: 'RESERVED', currentHoldId: holdId, blockReasonCode: null, updatedBy: oid(actor) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<BedRecord>(); }
  async findExpiredHolds(branchId: string, now: Date, maxItems = 100) { return BedHoldModel.find({ branchId: oid(branchId), status: 'ACTIVE', expiresAt: { $lte: now } }).sort({ expiresAt: 1, _id: 1 }).limit(maxItems).select('_id').lean<Array<{ _id: Types.ObjectId }>>(); }
  async closeHold(id: string, branchId: string, status: 'RELEASED' | 'EXPIRED' | 'CANCELLED', reason: string, actor: string, session: ClientSession) { const now = new Date(); const actorFields = status === 'CANCELLED' ? { cancelledBy: oid(actor), cancelledAt: now } : { releasedBy: oid(actor), releasedAt: now }; const record = await BedHoldModel.findOneAndUpdate({ _id: oid(id), branchId: oid(branchId), status: 'ACTIVE' }, { $set: { status, terminalReason: reason, updatedBy: oid(actor), ...actorFields }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<HoldRecord>(); if (!record) return null; const bed = await BedModel.findOneAndUpdate({ _id: record.bedId, branchId: record.branchId, status: 'RESERVED', currentHoldId: record._id, currentAdmissionId: null }, { $set: { status: 'AVAILABLE', currentHoldId: null, updatedBy: oid(actor) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<BedRecord>(); return bed ? toHold(record) : null; }

  async getAdmission(id: string, branchId: string, session?: ClientSession) { const query = InpatientAdmissionModel.findOne({ _id: oid(id), branchId: oid(branchId) }); if (session) query.session(session); return query.lean<AdmissionRecord>(); }
  async allotBed(admission: AdmissionRecord, bedId: string, branchId: string, holdId: string | null, actor: string, session: ClientSession) {
    if (holdId) {
      const hold = await BedHoldModel.findOneAndUpdate({ _id: oid(holdId), branchId: oid(branchId), bedId: oid(bedId), patientId: admission.patientId, status: 'ACTIVE', expiresAt: { $gt: new Date() } }, { $set: { status: 'CONSUMED', admissionId: admission._id, consumedBy: oid(actor), consumedAt: new Date(), updatedBy: oid(actor) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<HoldRecord>();
      if (!hold) return null;
      return BedModel.findOneAndUpdate({ _id: oid(bedId), branchId: oid(branchId), status: 'RESERVED', currentHoldId: hold._id, currentAdmissionId: null }, { $set: { status: 'OCCUPIED', currentHoldId: null, currentAdmissionId: admission._id, updatedBy: oid(actor) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<BedRecord>();
    }
    return BedModel.findOneAndUpdate({ _id: oid(bedId), branchId: oid(branchId), status: 'AVAILABLE', currentHoldId: null, currentAdmissionId: null }, { $set: { status: 'OCCUPIED', currentAdmissionId: admission._id, updatedBy: oid(actor) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<BedRecord>();
  }
  async releaseAdmissionBed(admission: AdmissionRecord, preparationRequired: boolean, actor: string, session: ClientSession) {
    return BedModel.findOneAndUpdate(
      { _id: admission.bedId, branchId: admission.branchId, status: 'OCCUPIED', currentAdmissionId: admission._id, currentHoldId: null },
      { $set: { status: preparationRequired ? 'BLOCKED' : 'AVAILABLE', blockReasonCode: preparationRequired ? 'CLEANING' : null, currentAdmissionId: null, updatedBy: oid(actor) }, $inc: { version: 1 } },
      { returnDocument: 'after', lean: true, session },
    ).lean<BedRecord>();
  }
  async recordAssignment(admission: AdmissionRecord, bed: BedRecord, ward: WardRecord, eventType: 'ALLOTTED' | 'TRANSFERRED_OUT' | 'TRANSFERRED_IN' | 'RELEASED', reason: string, actor: string, transferId: Types.ObjectId | null, session: ClientSession) { await BedAssignmentHistoryModel.create([{ admissionId: admission._id, patientId: admission.patientId, branchId: bed.branchId, wardId: bed.wardId, bedId: bed._id, wardName: ward.name, bedNumber: bed.bedNumber, bedCategory: bed.bedCategory, roomNumber: bed.roomNumber ?? null, eventType, reason, transferId, occurredAt: new Date(), actorUserId: oid(actor) }], { session }); }

  async getPendingTransferForAdmission(admissionId: string, session?: ClientSession) { const query = BedTransferModel.findOne({ admissionId: oid(admissionId), status: 'PENDING' }); if (session) query.session(session); const record = await query.lean<TransferRecord>(); return record ? toTransfer(record) : null; }
  async createTransfer(admission: AdmissionRecord, sourceBed: BedRecord, sourceWard: WardRecord, destinationBed: BedRecord, destinationWard: WardRecord, data: CreateBedTransferDTO, actor: string, session: ClientSession) { const [created] = await BedTransferModel.create([{ admissionId: admission._id, patientId: admission.patientId, sourceBranchId: admission.branchId, sourceWardId: sourceBed.wardId, sourceBedId: sourceBed._id, destinationBranchId: destinationBed.branchId, destinationWardId: destinationBed.wardId, destinationBedId: destinationBed._id, sourceWardName: sourceWard.name, sourceBedNumber: sourceBed.bedNumber, sourceRoomNumber: sourceBed.roomNumber ?? null, destinationWardName: destinationWard.name, destinationBedNumber: destinationBed.bedNumber, destinationRoomNumber: destinationBed.roomNumber ?? null, reason: data.reason, status: 'PENDING', requestedAt: new Date(), requestedBy: oid(actor), version: 0 }], { session }); if (!created) throw new Error('Bed transfer create returned no record'); return toTransfer(created.toObject<TransferRecord>()); }
  async getTransfer(id: string, branchId: string, session?: ClientSession) { const query = BedTransferModel.findOne({ _id: oid(id), sourceBranchId: oid(branchId) }); if (session) query.session(session); return query.lean<TransferRecord>(); }
  async claimTransferDestination(transfer: TransferRecord, actor: string, session: ClientSession) { return BedModel.findOneAndUpdate({ _id: transfer.destinationBedId, branchId: transfer.destinationBranchId, wardId: transfer.destinationWardId, status: 'AVAILABLE', currentHoldId: null, currentAdmissionId: null }, { $set: { status: 'OCCUPIED', currentAdmissionId: transfer.admissionId, updatedBy: oid(actor) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<BedRecord>(); }
  async releaseTransferSource(transfer: TransferRecord, actor: string, session: ClientSession) { return BedModel.findOneAndUpdate({ _id: transfer.sourceBedId, branchId: transfer.sourceBranchId, status: 'OCCUPIED', currentAdmissionId: transfer.admissionId }, { $set: { status: 'AVAILABLE', currentAdmissionId: null, updatedBy: oid(actor) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<BedRecord>(); }
  async updateAdmissionForTransfer(transfer: TransferRecord, actor: string, session: ClientSession) { return InpatientAdmissionModel.findOneAndUpdate({ _id: transfer.admissionId, branchId: transfer.sourceBranchId, bedId: transfer.sourceBedId, status: 'ADMITTED' }, { $set: { branchId: transfer.destinationBranchId, wardId: transfer.destinationWardId, bedId: transfer.destinationBedId, updatedBy: oid(actor) } }, { returnDocument: 'after', lean: true, session }).lean<AdmissionRecord>(); }
  async completeTransfer(id: string, actor: string, session: ClientSession) { return BedTransferModel.findOneAndUpdate({ _id: oid(id), status: 'PENDING' }, { $set: { status: 'COMPLETED', completedAt: new Date(), completedBy: oid(actor) }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<TransferRecord>(); }
  async cancelTransfer(id: string, branchId: string, reason: string, actor: string, session: ClientSession) { const record = await BedTransferModel.findOneAndUpdate({ _id: oid(id), sourceBranchId: oid(branchId), status: 'PENDING' }, { $set: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: oid(actor), cancellationReason: reason }, $inc: { version: 1 } }, { returnDocument: 'after', lean: true, session }).lean<TransferRecord>(); return record ? toTransfer(record) : null; }

  async audit(eventType: string, actorUserId: string, metadata: StatusActionMetadata, details: Record<string, unknown>, session?: ClientSession) { const entry = { eventType, actorUserId, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent, metadataJson: details }; if (session) await AuditLogModel.create([entry], { session }); else await AuditLogModel.create(entry); }
  duplicateError(error: unknown) { return error instanceof Error && 'code' in error && error.code === 11000; }
}
