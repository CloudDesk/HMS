import mongoose, { Types, type ClientSession } from 'mongoose';
import { AppError } from '../../shared/errors/app-error.js';
import type { PharmacyInventoryRepository } from './pharmacy-inventory.repository.js';
import type {
  PharmacyBatchListQuery,
  PharmacyInventoryListQuery,
  PharmacyInventoryRequestMetadata,
  PharmacyMovementListQuery,
  RecordMedicineStockMovementDTO,
  RegisterMedicineBatchDTO,
  UpdateLowStockThresholdDTO,
  UpdateMedicineBatchDTO,
} from './pharmacy-inventory.types.js';

const startOfUtcDay = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const parseDateOnly = (value: string) => {
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new AppError('Date is invalid', 400, 'VALIDATION_ERROR');
  }
  return parsed;
};

const isDuplicateKeyError = (error: unknown): error is { code: number; keyPattern?: Record<string, unknown> } =>
  typeof error === 'object' && error !== null && 'code' in error && Number(error.code) === 11000;

export class PharmacyInventoryService {
  constructor(private readonly repository: PharmacyInventoryRepository) {}

  private async requireBranchAccess(userId: string, branchId: string) {
    if (!Types.ObjectId.isValid(branchId) || !(await this.repository.isAuthorizedBranch(userId, branchId))) {
      throw new AppError('Active assigned branch is required', 403, 'BRANCH_ACCESS_DENIED');
    }
  }

  private async requireMedicine(id: string, session?: ClientSession) {
    const medicine = await this.repository.getMedicine(id, session);
    if (!medicine) throw new AppError('Medicine not found', 404, 'MEDICINE_NOT_FOUND');
    return medicine;
  }

  private async requireActiveMedicine(id: string, session?: ClientSession) {
    const medicine = await this.requireMedicine(id, session);
    if (medicine.status !== 'ACTIVE') {
      throw new AppError('Active medicine is required for stock operations', 409, 'MEDICINE_INACTIVE');
    }
    return medicine;
  }

  private async auditStockStateTransition(
    previousState: string | undefined,
    nextState: string,
    medicineId: string,
    branchId: string,
    actorUserId: string,
    metadata: PharmacyInventoryRequestMetadata,
    session: ClientSession,
  ) {
    if (previousState === nextState) return;
    if (nextState === 'LOW_STOCK') {
      await this.repository.audit('medicine_inventory.low_stock_entered', actorUserId, metadata, {
        medicineId,
        branchId,
        previousState,
        stockState: nextState,
      }, session);
    } else if (nextState === 'AVAILABLE' && (previousState === 'LOW_STOCK' || previousState === 'OUT_OF_STOCK')) {
      await this.repository.audit('medicine_inventory.low_stock_recovered', actorUserId, metadata, {
        medicineId,
        branchId,
        previousState,
        stockState: nextState,
      }, session);
    }
  }

  private async reconcileExpiry(
    branchId: string,
    actorUserId: string,
    metadata: PharmacyInventoryRequestMetadata,
  ) {
    const candidates = await this.repository.findExpiredActiveBatches(branchId);
    if (candidates.length === 0) return;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const medicineIds = new Set<string>();
        const previousStates = new Map<string, string>();
        for (const candidate of candidates) {
          const medicineId = String(candidate.medicineId);
          const previous = await this.repository.getInventory(medicineId, branchId, session);
          if (previous) previousStates.set(medicineId, previous.stockState);
          const expired = await this.repository.expireBatch(String(candidate._id), session);
          if (!expired) continue;
          medicineIds.add(medicineId);
          await this.repository.audit('medicine_inventory.batch_expired', actorUserId, metadata, {
            medicineId,
            branchId,
            batchId: String(candidate._id),
            batchNumber: candidate.batchNumber,
            expiryDate: candidate.expiryDate,
            quantityOnHand: candidate.quantityOnHand,
            source: 'automatic_expiry_reconciliation',
          }, session);
        }
        for (const medicineId of medicineIds) {
          const refreshed = await this.repository.refreshInventorySnapshot(medicineId, branchId, actorUserId, session);
          if (refreshed) {
            await this.auditStockStateTransition(
              previousStates.get(medicineId),
              refreshed.stockState,
              medicineId,
              branchId,
              actorUserId,
              metadata,
              session,
            );
          }
        }
      });
    } finally {
      await session.endSession();
    }
  }

  async list(query: PharmacyInventoryListQuery, actorUserId: string, metadata: PharmacyInventoryRequestMetadata) {
    await this.requireBranchAccess(actorUserId, query.branch_id);
    await this.reconcileExpiry(query.branch_id, actorUserId, metadata);
    return this.repository.list(query);
  }

  async summary(branchId: string, actorUserId: string, metadata: PharmacyInventoryRequestMetadata) {
    await this.requireBranchAccess(actorUserId, branchId);
    await this.reconcileExpiry(branchId, actorUserId, metadata);
    return this.repository.summary(branchId);
  }

  async getDetail(
    medicineId: string,
    branchId: string,
    actorUserId: string,
    metadata: PharmacyInventoryRequestMetadata,
  ) {
    await this.requireBranchAccess(actorUserId, branchId);
    await this.reconcileExpiry(branchId, actorUserId, metadata);
    await this.requireMedicine(medicineId);
    const inventory = await this.repository.getDetail(medicineId, branchId);
    if (!inventory) throw new AppError('Medicine has no inventory record in this branch', 404, 'INVENTORY_NOT_FOUND');
    return inventory;
  }

  async listBatches(
    medicineId: string,
    query: PharmacyBatchListQuery,
    actorUserId: string,
    metadata: PharmacyInventoryRequestMetadata,
  ) {
    await this.requireBranchAccess(actorUserId, query.branch_id);
    await this.reconcileExpiry(query.branch_id, actorUserId, metadata);
    await this.requireMedicine(medicineId);
    return this.repository.listBatches(medicineId, query);
  }

  async listAllBatches(
    query: PharmacyBatchListQuery,
    actorUserId: string,
    metadata: PharmacyInventoryRequestMetadata,
  ) {
    await this.requireBranchAccess(actorUserId, query.branch_id);
    await this.reconcileExpiry(query.branch_id, actorUserId, metadata);
    return this.repository.listAllBatches(query);
  }

  async listMovements(query: PharmacyMovementListQuery, actorUserId: string) {
    await this.requireBranchAccess(actorUserId, query.branch_id);
    const dateFrom = query.date_from ? parseDateOnly(query.date_from) : null;
    const dateTo = query.date_to ? parseDateOnly(query.date_to) : null;
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new AppError('From date must be on or before to date', 400, 'VALIDATION_ERROR');
    }
    return this.repository.listMovements(query);
  }

  async registerBatch(
    medicineId: string,
    data: RegisterMedicineBatchDTO,
    actorUserId: string,
    metadata: PharmacyInventoryRequestMetadata,
  ) {
    await this.requireBranchAccess(actorUserId, data.branch_id);
    await this.reconcileExpiry(data.branch_id, actorUserId, metadata);
    const expiryDate = parseDateOnly(data.expiry_date);
    if (expiryDate < startOfUtcDay()) {
      throw new AppError('An expired batch cannot be registered', 400, 'BATCH_ALREADY_EXPIRED');
    }
    const session = await mongoose.startSession();
    try {
      let batchId: string | undefined;
      await session.withTransaction(async () => {
        await this.requireActiveMedicine(medicineId, session);
        const previous = await this.repository.ensureInventory(medicineId, data.branch_id, actorUserId, session);
        const batch = await this.repository.createBatch(medicineId, data, expiryDate, actorUserId, session);
        batchId = String(batch._id);
        const refreshed = await this.repository.refreshInventorySnapshot(medicineId, data.branch_id, actorUserId, session);
        if (!refreshed) throw new AppError('Inventory snapshot could not be updated', 500, 'INVENTORY_UPDATE_FAILED');
        await this.repository.audit('medicine_inventory.batch_registered', actorUserId, metadata, {
          medicineId,
          branchId: data.branch_id,
          batchId,
          batchNumber: batch.batchNumber,
          expiryDate,
          openingQuantity: data.opening_quantity,
          barcode: batch.barcode ?? null,
        }, session);
        if (data.opening_quantity > 0) {
          await this.repository.createMovement({
            medicineId,
            branchId: data.branch_id,
            batchId,
            movementType: 'OPENING_STOCK',
            quantity: data.opening_quantity,
            batchBefore: 0,
            batchAfter: data.opening_quantity,
            availableBefore: previous.availableQuantity,
            availableAfter: refreshed.availableQuantity,
            reason: data.reason?.trim() || 'Opening stock',
            reference: null,
            idempotencyKey: null,
          }, actorUserId, session);
          await this.repository.audit('medicine_inventory.opening_stock', actorUserId, metadata, {
            medicineId,
            branchId: data.branch_id,
            batchId,
            quantity: data.opening_quantity,
            availableQuantityBefore: previous.availableQuantity,
            availableQuantityAfter: refreshed.availableQuantity,
          }, session);
        }
        await this.auditStockStateTransition(
          previous.stockState,
          refreshed.stockState,
          medicineId,
          data.branch_id,
          actorUserId,
          metadata,
          session,
        );
      });
      if (!batchId) throw new AppError('Batch registration did not complete', 500, 'BATCH_REGISTRATION_FAILED');
      return {
        batch: await this.repository.getBatch(batchId, data.branch_id).then((batch) => batch ? {
          id: String(batch._id),
          medicine_id: String(batch.medicineId),
          branch_id: String(batch.branchId),
          batch_number: batch.batchNumber,
          expiry_date: batch.expiryDate,
          barcode: batch.barcode ?? null,
          quantity_on_hand: batch.quantityOnHand,
          status: batch.status,
          created_at: batch.createdAt,
          updated_at: batch.updatedAt,
        } : null),
        inventory: await this.repository.getDetail(medicineId, data.branch_id),
      };
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError('Batch number already exists for this medicine and branch', 409, 'DUPLICATE_BATCH_NUMBER');
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async updateBatch(
    batchId: string,
    data: UpdateMedicineBatchDTO,
    actorUserId: string,
    metadata: PharmacyInventoryRequestMetadata,
  ) {
    await this.requireBranchAccess(actorUserId, data.branch_id);
    const expiryDate = data.expiry_date ? parseDateOnly(data.expiry_date) : undefined;
    if (expiryDate && expiryDate < startOfUtcDay()) {
      throw new AppError('Batch expiry cannot be changed to a past date', 400, 'BATCH_ALREADY_EXPIRED');
    }
    const session = await mongoose.startSession();
    try {
      let medicineId: string | undefined;
      await session.withTransaction(async () => {
        const existing = await this.repository.getBatch(batchId, data.branch_id, session);
        if (!existing) throw new AppError('Medicine batch not found', 404, 'BATCH_NOT_FOUND');
        if (existing.status === 'EXPIRED') {
          throw new AppError('Expired batch metadata cannot be changed', 409, 'EXPIRED_BATCH_IMMUTABLE');
        }
        medicineId = String(existing.medicineId);
        const updated = await this.repository.updateBatchMetadata(batchId, data, expiryDate, actorUserId, session);
        if (!updated) throw new AppError('Medicine batch not found', 404, 'BATCH_NOT_FOUND');
        await this.repository.refreshInventorySnapshot(medicineId, data.branch_id, actorUserId, session);
        await this.repository.audit('medicine_inventory.batch_corrected', actorUserId, metadata, {
          medicineId,
          branchId: data.branch_id,
          batchId,
          previousExpiryDate: existing.expiryDate,
          expiryDate: updated.expiryDate,
          previousBarcode: existing.barcode ?? null,
          barcode: updated.barcode ?? null,
          reason: data.reason,
        }, session);
      });
      return this.repository.getBatch(batchId, data.branch_id);
    } finally {
      await session.endSession();
    }
  }

  async recordMovement(
    data: RecordMedicineStockMovementDTO,
    actorUserId: string,
    metadata: PharmacyInventoryRequestMetadata,
  ) {
    await this.requireBranchAccess(actorUserId, data.branch_id);
    const existingMovement = await this.repository.findMovementByIdempotencyKey(data.branch_id, data.idempotency_key);
    if (existingMovement) return { movement: existingMovement, replayed: true };
    await this.reconcileExpiry(data.branch_id, actorUserId, metadata);
    const session = await mongoose.startSession();
    try {
      let result: { movement: Awaited<ReturnType<PharmacyInventoryRepository['createMovement']>>; replayed: boolean } | undefined;
      await session.withTransaction(async () => {
        const replay = await this.repository.findMovementByIdempotencyKey(data.branch_id, data.idempotency_key, session);
        if (replay) {
          result = { movement: replay, replayed: true };
          return;
        }
        const batch = await this.repository.getBatch(data.batch_id, data.branch_id, session);
        if (!batch) throw new AppError('Medicine batch not found', 404, 'BATCH_NOT_FOUND');
        const expiredAdjustmentOut = data.movement_type === 'ADJUSTMENT_OUT' && batch.status === 'EXPIRED';
        if (!expiredAdjustmentOut && (batch.status === 'EXPIRED' || batch.expiryDate < startOfUtcDay())) {
          throw new AppError('Expired batch cannot be used for stock movement', 409, 'BATCH_EXPIRED');
        }
        const medicineId = String(batch.medicineId);
        await this.requireActiveMedicine(medicineId, session);
        const previous = await this.repository.ensureInventory(medicineId, data.branch_id, actorUserId, session);
        const isIncrease = data.movement_type === 'STOCK_IN' || data.movement_type === 'ADJUSTMENT_IN';
        const delta = isIncrease ? data.quantity : -data.quantity;
        const updatedBatch = await this.repository.updateBatchQuantity(
          data.batch_id,
          data.branch_id,
          delta,
          actorUserId,
          session,
          expiredAdjustmentOut,
        );
        if (!updatedBatch) {
          throw new AppError('Insufficient batch quantity or batch is unavailable', 409, 'INSUFFICIENT_BATCH_QUANTITY');
        }
        const refreshed = await this.repository.refreshInventorySnapshot(medicineId, data.branch_id, actorUserId, session);
        if (!refreshed) throw new AppError('Inventory snapshot could not be updated', 500, 'INVENTORY_UPDATE_FAILED');
        const movement = await this.repository.createMovement({
          medicineId,
          branchId: data.branch_id,
          batchId: data.batch_id,
          movementType: data.movement_type,
          quantity: data.quantity,
          batchBefore: batch.quantityOnHand,
          batchAfter: updatedBatch.quantityOnHand,
          availableBefore: previous.availableQuantity,
          availableAfter: refreshed.availableQuantity,
          reason: data.reason,
          reference: data.reference,
          idempotencyKey: data.idempotency_key,
        }, actorUserId, session);
        await this.repository.audit(`medicine_inventory.${data.movement_type.toLowerCase()}`, actorUserId, metadata, {
          medicineId,
          branchId: data.branch_id,
          batchId: data.batch_id,
          movementId: movement.id,
          quantity: data.quantity,
          batchQuantityBefore: batch.quantityOnHand,
          batchQuantityAfter: updatedBatch.quantityOnHand,
          availableQuantityBefore: previous.availableQuantity,
          availableQuantityAfter: refreshed.availableQuantity,
          reason: data.reason,
          reference: data.reference ?? null,
          idempotencyKey: data.idempotency_key,
        }, session);
        await this.auditStockStateTransition(
          previous.stockState,
          refreshed.stockState,
          medicineId,
          data.branch_id,
          actorUserId,
          metadata,
          session,
        );
        result = { movement, replayed: false };
      });
      if (!result) throw new AppError('Stock movement did not complete', 500, 'STOCK_MOVEMENT_FAILED');
      return result;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const replay = await this.repository.findMovementByIdempotencyKey(data.branch_id, data.idempotency_key);
        if (replay) return { movement: replay, replayed: true };
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  async updateThreshold(
    medicineId: string,
    data: UpdateLowStockThresholdDTO,
    actorUserId: string,
    metadata: PharmacyInventoryRequestMetadata,
  ) {
    await this.requireBranchAccess(actorUserId, data.branch_id);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await this.requireMedicine(medicineId, session);
        const previous = await this.repository.ensureInventory(medicineId, data.branch_id, actorUserId, session);
        const updated = await this.repository.updateThreshold(
          medicineId,
          data.branch_id,
          data.low_stock_threshold,
          actorUserId,
          session,
        );
        if (!updated) throw new AppError('Inventory could not be updated', 500, 'INVENTORY_UPDATE_FAILED');
        await this.repository.audit('medicine_inventory.low_stock_threshold_changed', actorUserId, metadata, {
          medicineId,
          branchId: data.branch_id,
          previousThreshold: previous.lowStockThreshold,
          lowStockThreshold: data.low_stock_threshold,
          reason: data.reason,
        }, session);
        await this.auditStockStateTransition(
          previous.stockState,
          updated.stockState,
          medicineId,
          data.branch_id,
          actorUserId,
          metadata,
          session,
        );
      });
      return this.repository.getDetail(medicineId, data.branch_id);
    } finally {
      await session.endSession();
    }
  }
}
