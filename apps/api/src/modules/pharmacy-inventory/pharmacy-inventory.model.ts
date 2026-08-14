import mongoose, { Schema, Types } from 'mongoose';
import type {
  MedicineBatchStatus,
  MedicineStockMovementType,
  MedicineStockState,
} from './pharmacy-inventory.types.js';

export type PharmacyMedicineInventoryFields = {
  medicineId: Types.ObjectId;
  branchId: Types.ObjectId;
  availableQuantity: number;
  lowStockThreshold: number;
  stockState: MedicineStockState;
  activeBatchCount: number;
  expiredBatchCount: number;
  nextExpiryDate?: Date | null;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PharmacyMedicineBatchFields = {
  medicineId: Types.ObjectId;
  branchId: Types.ObjectId;
  batchNumber: string;
  expiryDate: Date;
  unitPrice: number;
  barcode?: string | null;
  quantityOnHand: number;
  status: MedicineBatchStatus;
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PharmacyMedicineStockMovementFields = {
  medicineId: Types.ObjectId;
  branchId: Types.ObjectId;
  batchId: Types.ObjectId;
  movementType: MedicineStockMovementType;
  quantity: number;
  batchQuantityBefore: number;
  batchQuantityAfter: number;
  availableQuantityBefore: number;
  availableQuantityAfter: number;
  reason: string;
  reference?: string | null;
  idempotencyKey?: string | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
};

const inventorySchema = new Schema<PharmacyMedicineInventoryFields>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    availableQuantity: { type: Number, min: 0, default: 0, required: true },
    lowStockThreshold: { type: Number, min: 0, default: 0, required: true },
    stockState: { type: String, enum: ['AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK'], default: 'OUT_OF_STOCK', required: true },
    activeBatchCount: { type: Number, min: 0, default: 0, required: true },
    expiredBatchCount: { type: Number, min: 0, default: 0, required: true },
    nextExpiryDate: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'pharmacy_medicine_inventory' },
);

inventorySchema.index({ medicineId: 1, branchId: 1 }, { unique: true });
inventorySchema.index({ branchId: 1, stockState: 1, updatedAt: -1 });
inventorySchema.index({ branchId: 1, nextExpiryDate: 1 });

const batchSchema = new Schema<PharmacyMedicineBatchFields>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    batchNumber: { type: String, required: true, trim: true, uppercase: true },
    expiryDate: { type: Date, required: true },
    unitPrice: { type: Number, min: 0, required: true },
    barcode: { type: String, trim: true, default: null },
    quantityOnHand: { type: Number, min: 0, default: 0, required: true },
    status: { type: String, enum: ['ACTIVE', 'DEPLETED', 'EXPIRED'], required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'pharmacy_medicine_batches' },
);

batchSchema.index({ medicineId: 1, branchId: 1, batchNumber: 1 }, { unique: true });
batchSchema.index({ branchId: 1, expiryDate: 1, quantityOnHand: 1 });
batchSchema.index({ branchId: 1, medicineId: 1, status: 1, expiryDate: 1 });
batchSchema.index({ branchId: 1, barcode: 1 }, { sparse: true });

const movementSchema = new Schema<PharmacyMedicineStockMovementFields>(
  {
    medicineId: { type: Schema.Types.ObjectId, ref: 'Medicine', required: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
    batchId: { type: Schema.Types.ObjectId, ref: 'PharmacyMedicineBatch', required: true },
    movementType: {
      type: String,
      enum: ['OPENING_STOCK', 'STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'],
      required: true,
    },
    quantity: { type: Number, min: 1, required: true },
    batchQuantityBefore: { type: Number, min: 0, required: true },
    batchQuantityAfter: { type: Number, min: 0, required: true },
    availableQuantityBefore: { type: Number, min: 0, required: true },
    availableQuantityAfter: { type: Number, min: 0, required: true },
    reason: { type: String, required: true, trim: true },
    reference: { type: String, trim: true, default: null },
    idempotencyKey: { type: String, trim: true, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'pharmacy_medicine_stock_movements' },
);

movementSchema.index({ branchId: 1, medicineId: 1, createdAt: -1 });
movementSchema.index({ branchId: 1, batchId: 1, createdAt: -1 });
movementSchema.index(
  { branchId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);

export const PharmacyMedicineInventoryModel = mongoose.model<PharmacyMedicineInventoryFields>(
  'PharmacyMedicineInventory',
  inventorySchema,
);
export const PharmacyMedicineBatchModel = mongoose.model<PharmacyMedicineBatchFields>(
  'PharmacyMedicineBatch',
  batchSchema,
);
export const PharmacyMedicineStockMovementModel = mongoose.model<PharmacyMedicineStockMovementFields>(
  'PharmacyMedicineStockMovement',
  movementSchema,
);

