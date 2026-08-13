import { Types, type ClientSession, type PipelineStage } from 'mongoose';
import { AuditLogModel } from '../auth/auth.model.js';
import { BranchModel } from '../branches/branch.model.js';
import { MedicineModel } from '../medicines/medicine.model.js';
import { RoleModel } from '../roles/role.model.js';
import { UserModel } from '../users/user.model.js';
import {
  PharmacyMedicineBatchModel,
  PharmacyMedicineInventoryModel,
  PharmacyMedicineStockMovementModel,
} from './pharmacy-inventory.model.js';
import type {
  MedicineStockState,
  MedicineStockMovementType,
  PharmacyBatchListQuery,
  PharmacyInventoryListQuery,
  PharmacyInventoryRequestMetadata,
  PharmacyMovementListQuery,
  RegisterMedicineBatchDTO,
  UpdateMedicineBatchDTO,
} from './pharmacy-inventory.types.js';

const EXPIRY_WARNING_DAYS = 30;
const objectId = (value: string) => new Types.ObjectId(value);
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const startOfUtcDay = (date = new Date()) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const expiryWarningEnd = (date = new Date()) => {
  const value = startOfUtcDay(date);
  value.setUTCDate(value.getUTCDate() + EXPIRY_WARNING_DAYS);
  return value;
};

const stockStateFor = (availableQuantity: number, threshold: number): MedicineStockState => {
  if (availableQuantity === 0) return 'OUT_OF_STOCK';
  if (threshold > 0 && availableQuantity <= threshold) return 'LOW_STOCK';
  return 'AVAILABLE';
};

const expiryStateFor = (expiredBatchCount: number, nextExpiryDate?: Date | null) => {
  if (expiredBatchCount > 0) return 'EXPIRED' as const;
  if (nextExpiryDate && nextExpiryDate <= expiryWarningEnd()) return 'EXPIRING_SOON' as const;
  return 'VALID' as const;
};

const toInventory = (record: any) => ({
  id: String(record._id),
  medicine_id: String(record.medicineId),
  branch_id: String(record.branchId),
  medicine: {
    code: record.medicine.code,
    name: record.medicine.name,
    generic_name: record.medicine.genericName ?? null,
    strength: record.medicine.strength ?? null,
    dosage_form: record.medicine.dosageForm ?? null,
    unit: record.medicine.unit ?? null,
    status: record.medicine.status,
  },
  branch: record.branch ? { code: record.branch.code, name: record.branch.name } : null,
  available_quantity: record.availableQuantity,
  low_stock_threshold: record.lowStockThreshold,
  stock_state: record.stockState,
  active_batch_count: record.activeBatchCount,
  expired_batch_count: record.expiredBatchCount,
  next_expiry_date: record.nextExpiryDate ?? null,
  expiry_state: expiryStateFor(record.expiredBatchCount, record.nextExpiryDate),
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const toBatch = (record: any) => ({
  id: String(record._id),
  medicine_id: String(record.medicineId),
  branch_id: String(record.branchId),
  batch_number: record.batchNumber,
  expiry_date: record.expiryDate,
  barcode: record.barcode ?? null,
  quantity_on_hand: record.quantityOnHand,
  status: record.status,
  expiry_state: record.status === 'EXPIRED'
    ? 'EXPIRED'
    : record.expiryDate <= expiryWarningEnd() ? 'EXPIRING_SOON' : 'VALID',
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const toMovement = (record: any) => ({
  id: String(record._id),
  medicine_id: String(record.medicineId),
  branch_id: String(record.branchId),
  batch_id: String(record.batchId),
  medicine: record.medicine ? { code: record.medicine.code, name: record.medicine.name } : null,
  batch_number: record.batch?.batchNumber ?? null,
  movement_type: record.movementType,
  quantity: record.quantity,
  batch_quantity_before: record.batchQuantityBefore,
  batch_quantity_after: record.batchQuantityAfter,
  available_quantity_before: record.availableQuantityBefore,
  available_quantity_after: record.availableQuantityAfter,
  reason: record.reason,
  reference: record.reference ?? null,
  idempotency_key: record.idempotencyKey ?? null,
  created_by: String(record.createdBy),
  created_at: record.createdAt,
});

export class PharmacyInventoryRepository {
  async isAuthorizedBranch(userId: string, branchId: string) {
    const [user, branch] = await Promise.all([
      UserModel.findOne({ _id: userId, status: 'active', deletedAt: null }).select('branchIds roleIds').lean(),
      BranchModel.exists({ _id: branchId, status: 'ACTIVE', deletedAt: null }),
    ]);
    if (!user || !branch) return false;
    if ((user.branchIds ?? []).some((assignedBranchId) => String(assignedBranchId) === branchId)) return true;
    return Boolean(await RoleModel.exists({
      _id: { $in: user.roleIds ?? [] },
      code: 'SUPER_ADMIN',
      status: 'active',
      deletedAt: null,
    }));
  }

  async getMedicine(id: string, session?: ClientSession) {
    const query = MedicineModel.findOne({ _id: id, deletedAt: null })
      .select('_id code name status')
      .lean();
    if (session) query.session(session);
    return query;
  }

  async hasInventoryReferences(medicineId: string) {
    return Boolean(await PharmacyMedicineInventoryModel.exists({ medicineId }));
  }

  async hasPositiveStock(medicineId: string) {
    return Boolean(await PharmacyMedicineBatchModel.exists({ medicineId, quantityOnHand: { $gt: 0 } }));
  }

  private inventoryPipeline(query: PharmacyInventoryListQuery): PipelineStage[] {
    const match: Record<string, unknown> = { branchId: objectId(query.branch_id) };
    if (query.stock_state) match.stockState = query.stock_state;
    if (query.expiry_state === 'EXPIRED') match.expiredBatchCount = { $gt: 0 };
    if (query.expiry_state === 'EXPIRING_SOON') {
      match.expiredBatchCount = 0;
      match.nextExpiryDate = { $gte: startOfUtcDay(), $lte: expiryWarningEnd() };
    }
    if (query.expiry_state === 'VALID') {
      match.expiredBatchCount = 0;
      match.$or = [{ nextExpiryDate: null }, { nextExpiryDate: { $gt: expiryWarningEnd() } }];
    }

    const pipeline: PipelineStage[] = [
      { $match: match },
      { $lookup: { from: 'medicines', localField: 'medicineId', foreignField: '_id', as: 'medicine' } },
      { $unwind: '$medicine' },
      { $match: { 'medicine.deletedAt': null } },
      { $lookup: { from: 'branches', localField: 'branchId', foreignField: '_id', as: 'branch' } },
      { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
    ];
    if (query.search) {
      const expression = new RegExp(escapeRegExp(query.search), 'i');
      pipeline.push({
        $match: {
          $or: [
            { 'medicine.code': expression },
            { 'medicine.name': expression },
            { 'medicine.genericName': expression },
          ],
        },
      });
    }
    return pipeline;
  }

  async list(query: PharmacyInventoryListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const sortColumns = {
      medicine_name: 'medicine.name',
      available_quantity: 'availableQuantity',
      next_expiry_date: 'nextExpiryDate',
      updated_at: 'updatedAt',
    } as const;
    const sortColumn = sortColumns[query.sortBy ?? 'updated_at'];
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const [result] = await PharmacyMedicineInventoryModel.aggregate([
      ...this.inventoryPipeline(query),
      {
        $facet: {
          data: [
            { $sort: { [sortColumn]: sortOrder, _id: 1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
          ],
          count: [{ $count: 'total' }],
        },
      },
    ]);
    const records = result?.data ?? [];
    const total = result?.count?.[0]?.total ?? 0;
    return {
      data: records.map(toInventory),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async summary(branchId: string) {
    const warningEnd = expiryWarningEnd();
    const [summary] = await PharmacyMedicineInventoryModel.aggregate([
      { $match: { branchId: objectId(branchId) } },
      {
        $group: {
          _id: null,
          totalMedicines: { $sum: 1 },
          stockedMedicines: { $sum: { $cond: [{ $gt: ['$availableQuantity', 0] }, 1, 0] } },
          totalAvailable: { $sum: '$availableQuantity' },
          lowStock: { $sum: { $cond: [{ $eq: ['$stockState', 'LOW_STOCK'] }, 1, 0] } },
          outOfStock: { $sum: { $cond: [{ $eq: ['$stockState', 'OUT_OF_STOCK'] }, 1, 0] } },
          expiringSoon: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ['$nextExpiryDate', null] }, { $lte: ['$nextExpiryDate', warningEnd] }] },
                1,
                0,
              ],
            },
          },
          expired: { $sum: { $cond: [{ $gt: ['$expiredBatchCount', 0] }, 1, 0] } },
        },
      },
    ]);
    return {
      total_medicines: summary?.totalMedicines ?? 0,
      stocked_medicines: summary?.stockedMedicines ?? 0,
      total_available_quantity: summary?.totalAvailable ?? 0,
      low_stock_medicines: summary?.lowStock ?? 0,
      out_of_stock_medicines: summary?.outOfStock ?? 0,
      expiring_soon_medicines: summary?.expiringSoon ?? 0,
      expired_medicines: summary?.expired ?? 0,
      expiry_warning_days: EXPIRY_WARNING_DAYS,
    };
  }

  async getInventory(medicineId: string, branchId: string, session?: ClientSession) {
    const query = PharmacyMedicineInventoryModel.findOne({
      medicineId: objectId(medicineId),
      branchId: objectId(branchId),
    }).lean();
    if (session) query.session(session);
    return query;
  }

  async getDetail(medicineId: string, branchId: string) {
    const [record] = await PharmacyMedicineInventoryModel.aggregate([
      { $match: { medicineId: objectId(medicineId), branchId: objectId(branchId) } },
      { $lookup: { from: 'medicines', localField: 'medicineId', foreignField: '_id', as: 'medicine' } },
      { $unwind: '$medicine' },
      { $lookup: { from: 'branches', localField: 'branchId', foreignField: '_id', as: 'branch' } },
      { $unwind: { path: '$branch', preserveNullAndEmptyArrays: true } },
    ]);
    return record ? toInventory(record) : undefined;
  }

  async ensureInventory(medicineId: string, branchId: string, actorUserId: string, session: ClientSession) {
    return PharmacyMedicineInventoryModel.findOneAndUpdate(
      { medicineId: objectId(medicineId), branchId: objectId(branchId) },
      {
        $setOnInsert: {
          availableQuantity: 0,
          lowStockThreshold: 0,
          stockState: 'OUT_OF_STOCK',
          activeBatchCount: 0,
          expiredBatchCount: 0,
          nextExpiryDate: null,
          createdBy: objectId(actorUserId),
        },
        $set: { updatedBy: objectId(actorUserId) },
      },
      { upsert: true, returnDocument: 'after', session, runValidators: true },
    ).lean();
  }

  async createBatch(
    medicineId: string,
    data: RegisterMedicineBatchDTO,
    expiryDate: Date,
    actorUserId: string,
    session: ClientSession,
  ) {
    const record = new PharmacyMedicineBatchModel({
      medicineId: objectId(medicineId),
      branchId: objectId(data.branch_id),
      batchNumber: data.batch_number.trim().toUpperCase(),
      expiryDate,
      barcode: data.barcode?.trim() || null,
      quantityOnHand: data.opening_quantity,
      status: data.opening_quantity > 0 ? 'ACTIVE' : 'DEPLETED',
      createdBy: objectId(actorUserId),
      updatedBy: objectId(actorUserId),
    });
    await record.save({ session });
    return record.toObject();
  }

  async getBatch(id: string, branchId: string, session?: ClientSession) {
    const query = PharmacyMedicineBatchModel.findOne({ _id: id, branchId }).lean();
    if (session) query.session(session);
    return query;
  }

  async updateBatchMetadata(
    id: string,
    data: UpdateMedicineBatchDTO,
    expiryDate: Date | undefined,
    actorUserId: string,
    session: ClientSession,
  ) {
    const set: Record<string, unknown> = { updatedBy: objectId(actorUserId) };
    if (expiryDate) set.expiryDate = expiryDate;
    if (data.barcode !== undefined) set.barcode = data.barcode?.trim() || null;
    return PharmacyMedicineBatchModel.findOneAndUpdate(
      { _id: id, branchId: data.branch_id },
      { $set: set },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    );
  }

  async listBatches(medicineId: string, query: PharmacyBatchListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const filter: Record<string, unknown> = { medicineId, branchId: query.branch_id };
    if (query.status) filter.status = query.status;
    const sortColumns = {
      batch_number: 'batchNumber',
      expiry_date: 'expiryDate',
      quantity_on_hand: 'quantityOnHand',
      created_at: 'createdAt',
    } as const;
    const sortColumn = sortColumns[query.sortBy ?? 'expiry_date'];
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;
    const [records, total] = await Promise.all([
      PharmacyMedicineBatchModel.find(filter)
        .sort({ [sortColumn]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PharmacyMedicineBatchModel.countDocuments(filter),
    ]);
    return {
      data: records.map(toBatch),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async findMovementByIdempotencyKey(branchId: string, key: string, session?: ClientSession) {
    const query = PharmacyMedicineStockMovementModel.findOne({ branchId, idempotencyKey: key }).lean();
    if (session) query.session(session);
    const movement = await query;
    return movement ? toMovement(movement) : undefined;
  }

  async updateBatchQuantity(
    batchId: string,
    branchId: string,
    delta: number,
    actorUserId: string,
    session: ClientSession,
    allowExpired = false,
  ) {
    const filter: Record<string, unknown> = { _id: batchId, branchId };
    if (!allowExpired) filter.status = { $ne: 'EXPIRED' };
    if (delta < 0) filter.quantityOnHand = { $gte: Math.abs(delta) };
    const batch = await PharmacyMedicineBatchModel.findOneAndUpdate(
      filter,
      [{
        $set: {
          quantityOnHand: { $add: ['$quantityOnHand', delta] },
          status: {
            $cond: [
              { $eq: ['$status', 'EXPIRED'] },
              'EXPIRED',
              { $cond: [{ $eq: [{ $add: ['$quantityOnHand', delta] }, 0] }, 'DEPLETED', 'ACTIVE'] },
            ],
          },
          updatedBy: objectId(actorUserId),
          updatedAt: '$$NOW',
        },
      }],
      { returnDocument: 'after', lean: true, session },
    );
    return batch;
  }

  async createMovement(
    data: {
      medicineId: string;
      branchId: string;
      batchId: string;
      movementType: MedicineStockMovementType;
      quantity: number;
      batchBefore: number;
      batchAfter: number;
      availableBefore: number;
      availableAfter: number;
      reason: string;
      reference?: string | null;
      idempotencyKey?: string | null;
    },
    actorUserId: string,
    session: ClientSession,
  ) {
    const record = new PharmacyMedicineStockMovementModel({
      medicineId: objectId(data.medicineId),
      branchId: objectId(data.branchId),
      batchId: objectId(data.batchId),
      movementType: data.movementType,
      quantity: data.quantity,
      batchQuantityBefore: data.batchBefore,
      batchQuantityAfter: data.batchAfter,
      availableQuantityBefore: data.availableBefore,
      availableQuantityAfter: data.availableAfter,
      reason: data.reason,
      reference: data.reference?.trim() || null,
      idempotencyKey: data.idempotencyKey ?? null,
      createdBy: objectId(actorUserId),
    });
    await record.save({ session });
    return toMovement(record.toObject());
  }

  async listMovements(query: PharmacyMovementListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const match: Record<string, unknown> = { branchId: objectId(query.branch_id) };
    if (query.medicine_id) match.medicineId = objectId(query.medicine_id);
    if (query.batch_id) match.batchId = objectId(query.batch_id);
    if (query.movement_type) match.movementType = query.movement_type;
    if (query.date_from || query.date_to) {
      const createdAt: Record<string, Date> = {};
      if (query.date_from) createdAt.$gte = new Date(`${query.date_from}T00:00:00.000Z`);
      if (query.date_to) createdAt.$lte = new Date(`${query.date_to}T23:59:59.999Z`);
      match.createdAt = createdAt;
    }
    const [result] = await PharmacyMedicineStockMovementModel.aggregate([
      { $match: match },
      { $lookup: { from: 'medicines', localField: 'medicineId', foreignField: '_id', as: 'medicine' } },
      { $unwind: { path: '$medicine', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'pharmacy_medicine_batches', localField: 'batchId', foreignField: '_id', as: 'batch' } },
      { $unwind: { path: '$batch', preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          data: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }],
          count: [{ $count: 'total' }],
        },
      },
    ]);
    const total = result?.count?.[0]?.total ?? 0;
    return {
      data: (result?.data ?? []).map(toMovement),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async updateThreshold(
    medicineId: string,
    branchId: string,
    threshold: number,
    actorUserId: string,
    session: ClientSession,
  ) {
    const inventory = await this.ensureInventory(medicineId, branchId, actorUserId, session);
    const stockState = stockStateFor(inventory.availableQuantity, threshold);
    return PharmacyMedicineInventoryModel.findOneAndUpdate(
      { medicineId, branchId },
      { $set: { lowStockThreshold: threshold, stockState, updatedBy: objectId(actorUserId) } },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    );
  }

  async refreshInventorySnapshot(
    medicineId: string,
    branchId: string,
    actorUserId: string,
    session: ClientSession,
  ) {
    const today = startOfUtcDay();
    const farFuture = new Date('9999-12-31T00:00:00.000Z');
    const [totals] = await PharmacyMedicineBatchModel.aggregate([
      { $match: { medicineId: objectId(medicineId), branchId: objectId(branchId) } },
      {
        $group: {
          _id: null,
          availableQuantity: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$status', 'ACTIVE'] }, { $gte: ['$expiryDate', today] }] },
                '$quantityOnHand',
                0,
              ],
            },
          },
          activeBatchCount: {
            $sum: { $cond: [{ $and: [{ $eq: ['$status', 'ACTIVE'] }, { $gte: ['$expiryDate', today] }] }, 1, 0] },
          },
          expiredBatchCount: {
            $sum: { $cond: [{ $and: [{ $eq: ['$status', 'EXPIRED'] }, { $gt: ['$quantityOnHand', 0] }] }, 1, 0] },
          },
          nextExpiryDate: {
            $min: {
              $cond: [
                { $and: [{ $eq: ['$status', 'ACTIVE'] }, { $gt: ['$quantityOnHand', 0] }, { $gte: ['$expiryDate', today] }] },
                '$expiryDate',
                farFuture,
              ],
            },
          },
        },
      },
    ]).session(session);
    const inventory = await this.ensureInventory(medicineId, branchId, actorUserId, session);
    const availableQuantity = totals?.availableQuantity ?? 0;
    const nextExpiryDate = totals?.nextExpiryDate && totals.nextExpiryDate < farFuture
      ? totals.nextExpiryDate
      : null;
    const updated = await PharmacyMedicineInventoryModel.findOneAndUpdate(
      { medicineId, branchId },
      {
        $set: {
          availableQuantity,
          activeBatchCount: totals?.activeBatchCount ?? 0,
          expiredBatchCount: totals?.expiredBatchCount ?? 0,
          nextExpiryDate,
          stockState: stockStateFor(availableQuantity, inventory.lowStockThreshold),
          updatedBy: objectId(actorUserId),
        },
      },
      { returnDocument: 'after', lean: true, runValidators: true, session },
    );
    return updated;
  }

  async findExpiredActiveBatches(branchId: string, limit = 100) {
    return PharmacyMedicineBatchModel.find({
      branchId,
      status: 'ACTIVE',
      quantityOnHand: { $gt: 0 },
      expiryDate: { $lt: startOfUtcDay() },
    }).sort({ expiryDate: 1, _id: 1 }).limit(limit).lean();
  }

  async expireBatch(batchId: string, session: ClientSession) {
    return PharmacyMedicineBatchModel.findOneAndUpdate(
      { _id: batchId, status: 'ACTIVE', expiryDate: { $lt: startOfUtcDay() } },
      { $set: { status: 'EXPIRED' } },
      { returnDocument: 'after', lean: true, session },
    );
  }

  async audit(
    eventType: string,
    actorUserId: string | undefined,
    metadata: PharmacyInventoryRequestMetadata,
    details: Record<string, unknown>,
    session?: ClientSession,
  ) {
    const document = {
      eventType,
      actorUserId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      metadataJson: details,
    };
    if (session) {
      await AuditLogModel.create([document], { session });
      return;
    }
    await AuditLogModel.create(document);
  }
}
