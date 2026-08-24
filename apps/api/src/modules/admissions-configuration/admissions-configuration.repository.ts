import { Types, type ClientSession } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import { BedModel, type BedFields, WardModel, type WardFields } from './admissions-configuration.model.js';
import type { Bed, BedListQuery, BedSummary, CreateBedDTO, CreateWardDTO, StatusActionMetadata, UpdateBedDTO, UpdateWardDTO, Ward, WardListQuery } from './admissions-configuration.types.js';

type WardRecord = WardFields & { _id: Types.ObjectId };
type BedRecord = BedFields & { _id: Types.ObjectId };
const oid = (value: string) => new Types.ObjectId(value);
const regex = (value: string) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
const page = (value?: number) => value ?? 1;
const limit = (value?: number) => value ?? 20;
const meta = (total: number, currentPage: number, currentLimit: number) => ({ total, page: currentPage, limit: currentLimit, totalPages: Math.ceil(total / currentLimit) || 1 });

const toWard = (item: WardRecord): Ward => ({ id: item._id.toString(), branch_id: item.branchId.toString(), name: item.name, ward_type: item.wardType, room_type: item.roomType ?? null, floor: item.floor, capacity: item.capacity ?? null, description: item.description ?? null, status: item.status, created_at: item.createdAt, updated_at: item.updatedAt });
const toBed = (item: BedRecord & { ward?: { name: string } | null }): Bed => ({ id: item._id.toString(), branch_id: item.branchId.toString(), ward_id: item.wardId.toString(), ward_name: item.ward?.name ?? '', bed_number: item.bedNumber, bed_category: item.bedCategory, bed_type: item.bedType ?? item.bedCategory, charge_category: item.chargeCategory ?? item.bedCategory, gender_restriction: item.genderRestriction ?? 'ANY', room_number: item.roomNumber ?? null, status: item.status, created_at: item.createdAt, updated_at: item.updatedAt });

export class AdmissionsConfigurationRepository {
  async hasBranchAccess(userId: string, branchId: string) {
    const [user, branch] = await Promise.all([UserModel.findOne({ _id: userId, status: 'active', deletedAt: null }).select('branchIds roleIds').lean(), BranchModel.exists({ _id: branchId, status: 'ACTIVE', deletedAt: null })]);
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

  async getWard(id: string, branchId: string) { const record = await WardModel.findOne({ _id: oid(id), branchId: oid(branchId) }).lean<WardRecord>(); return record ? toWard(record) : null; }
  async createWard(data: CreateWardDTO, userId: string, session?: ClientSession) { const record = new WardModel({ branchId: oid(data.branch_id), name: data.name.trim(), wardType: data.ward_type.trim(), roomType: data.room_type?.trim() || null, floor: data.floor.trim(), capacity: data.capacity ?? null, description: data.description?.trim() || null, status: 'ACTIVE', createdBy: oid(userId), updatedBy: oid(userId) }); await record.save({ session }); return toWard(record.toObject<WardRecord>()); }
  async updateWard(id: string, data: UpdateWardDTO, userId: string, session?: ClientSession) { const record = await WardModel.findOneAndUpdate({ _id: oid(id), branchId: oid(data.branch_id) }, { $set: { name: data.name?.trim(), wardType: data.ward_type?.trim(), roomType: data.room_type === undefined ? undefined : data.room_type?.trim() || null, floor: data.floor?.trim(), capacity: data.capacity, description: data.description === undefined ? undefined : data.description?.trim() || null, updatedBy: oid(userId) } }, { returnDocument: 'after', lean: true, runValidators: true, session }).lean<WardRecord>(); return record ? toWard(record) : null; }
  async updateWardStatus(id: string, branchId: string, status: 'ACTIVE' | 'INACTIVE', userId: string, session?: ClientSession) { const record = await WardModel.findOneAndUpdate({ _id: oid(id), branchId: oid(branchId) }, { $set: { status, updatedBy: oid(userId) } }, { returnDocument: 'after', lean: true, session }).lean<WardRecord>(); return record ? toWard(record) : null; }
  async countBedsForWard(wardId: string, branchId: string) { return BedModel.countDocuments({ wardId: oid(wardId), branchId: oid(branchId), status: { $ne: 'INACTIVE' } }); }

  async listBeds(query: BedListQuery) {
    const currentPage = page(query.page); const currentLimit = limit(query.limit); const filter: Record<string, unknown> = { branchId: oid(query.branch_id) };
    if (query.ward_id) filter.wardId = oid(query.ward_id); if (query.bed_category) filter.bedCategory = query.bed_category; if (query.room_number) filter.roomNumber = query.room_number; if (query.status) filter.status = query.status;
    if (query.search) filter.$or = [{ bedNumber: regex(query.search) }, { roomNumber: regex(query.search) }];
    const [records, total] = await Promise.all([BedModel.aggregate<BedRecord & { ward?: { name: string } | null }>([{ $match: filter }, { $lookup: { from: 'hmswards', localField: 'wardId', foreignField: '_id', as: 'ward' } }, { $unwind: { path: '$ward', preserveNullAndEmptyArrays: true } }, { $sort: { bedNumber: 1, _id: 1 } }, { $skip: (currentPage - 1) * currentLimit }, { $limit: currentLimit }]), BedModel.countDocuments(filter)]);
    return { data: records.map(toBed), meta: meta(total, currentPage, currentLimit) };
  }

  async getBed(id: string, branchId: string) { const [record] = await BedModel.aggregate<BedRecord & { ward?: { name: string } | null }>([{ $match: { _id: oid(id), branchId: oid(branchId) } }, { $lookup: { from: 'hmswards', localField: 'wardId', foreignField: '_id', as: 'ward' } }, { $unwind: { path: '$ward', preserveNullAndEmptyArrays: true } }]); return record ? toBed(record) : null; }
  async createBed(data: CreateBedDTO, userId: string, session?: ClientSession) { const record = new BedModel({ branchId: oid(data.branch_id), wardId: oid(data.ward_id), bedNumber: data.bed_number.trim().toUpperCase(), bedCategory: data.bed_category.trim(), bedType: data.bed_type?.trim() || data.bed_category.trim(), chargeCategory: data.charge_category?.trim() || data.bed_category.trim(), genderRestriction: data.gender_restriction ?? 'ANY', roomNumber: data.room_number?.trim() || null, status: 'AVAILABLE', createdBy: oid(userId), updatedBy: oid(userId) }); await record.save({ session }); return this.getBed(record._id.toString(), data.branch_id); }
  async updateBed(id: string, branchId: string, data: UpdateBedDTO, userId: string, session?: ClientSession) { const record = await BedModel.findOneAndUpdate({ _id: oid(id), branchId: oid(branchId) }, { $set: { bedNumber: data.bed_number?.trim().toUpperCase(), bedCategory: data.bed_category?.trim(), bedType: data.bed_type?.trim(), chargeCategory: data.charge_category?.trim(), genderRestriction: data.gender_restriction, roomNumber: data.room_number === undefined ? undefined : data.room_number?.trim() || null, updatedBy: oid(userId) } }, { returnDocument: 'after', lean: true, runValidators: true, session }).lean<BedRecord>(); return record ? this.getBed(record._id.toString(), branchId) : null; }
  async updateBedStatus(id: string, branchId: string, status: BedFields['status'], userId: string, session?: ClientSession) { const record = await BedModel.findOneAndUpdate({ _id: oid(id), branchId: oid(branchId) }, { $set: { status, updatedBy: oid(userId) } }, { returnDocument: 'after', lean: true, session }).lean<BedRecord>(); return record ? this.getBed(record._id.toString(), branchId) : null; }
  async summary(branchId: string): Promise<BedSummary> { const [result] = await BedModel.aggregate<{ total: number; rows: Array<{ _id: string; count: number }> }>([{ $match: { branchId: oid(branchId) } }, { $facet: { total: [{ $count: 'count' }], rows: [{ $group: { _id: '$status', count: { $sum: 1 } } }] } }, { $project: { total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] }, rows: 1 } }]); const counts = new Map((result?.rows ?? []).map((row) => [row._id, row.count])); return { total: result?.total ?? 0, available: counts.get('AVAILABLE') ?? 0, occupied: counts.get('OCCUPIED') ?? 0, reserved: counts.get('RESERVED') ?? 0, blocked: counts.get('BLOCKED') ?? 0, under_maintenance: counts.get('UNDER_MAINTENANCE') ?? 0, inactive: counts.get('INACTIVE') ?? 0 }; }
  async audit(eventType: string, actorUserId: string, metadata: StatusActionMetadata, details: Record<string, unknown>, session?: ClientSession) { const entry = { eventType, actorUserId, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent, metadataJson: details }; if (session) { await AuditLogModel.create([entry], { session }); } else await AuditLogModel.create(entry); }
  duplicateError(error: unknown) { return error instanceof Error && 'code' in error && error.code === 11000; }
}
