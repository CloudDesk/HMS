import { z } from 'zod';
import { AppError } from '../../shared/errors/app-error.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Object id is invalid');
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');
const pageFields = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};
const branchField = { branch_id: objectId };

const inventoryListSchema = z.object({
  ...branchField,
  search: z.string().trim().max(100).optional(),
  stock_state: z.enum(['AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK']).optional(),
  expiry_state: z.enum(['VALID', 'EXPIRING_SOON', 'EXPIRED']).optional(),
  ...pageFields,
  sortBy: z.enum(['medicine_name', 'available_quantity', 'next_expiry_date', 'updated_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}).strict();

const inventoryParamsSchema = z.object({ medicineId: objectId }).strict();
const batchParamsSchema = z.object({ batchId: objectId }).strict();

const batchListSchema = z.object({
  ...branchField,
  status: z.enum(['ACTIVE', 'DEPLETED', 'EXPIRED']).optional(),
  ...pageFields,
  sortBy: z.enum(['batch_number', 'expiry_date', 'quantity_on_hand', 'created_at']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}).strict();

const movementListSchema = z.object({
  ...branchField,
  medicine_id: objectId.optional(),
  batch_id: objectId.optional(),
  movement_type: z.enum(['OPENING_STOCK', 'STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']).optional(),
  date_from: dateOnly.optional(),
  date_to: dateOnly.optional(),
  ...pageFields,
}).strict();

const registerBatchSchema = z.object({
  ...branchField,
  batch_number: z.string().trim().min(1).max(100),
  expiry_date: dateOnly,
  unit_price: z.number().min(0),
  opening_quantity: z.number().int().min(0).max(1_000_000_000),
  barcode: z.string().trim().max(100).nullable().optional(),
  reason: z.string().trim().max(500).nullable().optional(),
}).strict();

const updateBatchSchema = z.object({
  ...branchField,
  expiry_date: dateOnly.optional(),
  unit_price: z.number().min(0).optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
  reason: z.string().trim().min(1).max(500),
}).strict().refine((value) => value.expiry_date !== undefined || value.unit_price !== undefined || value.barcode !== undefined, {
  message: 'Expiry date, unit price, or barcode is required',
});

const movementFields = {
  ...branchField,
  batch_id: objectId,
  quantity: z.number().int().min(1).max(1_000_000_000),
  reason: z.string().trim().min(1).max(500),
  reference: z.string().trim().max(100).nullable().optional(),
  idempotency_key: z.string().trim().min(8).max(100),
};

const movementSchema = z.object({
  ...movementFields,
  movement_type: z.enum(['STOCK_IN', 'STOCK_OUT']),
}).strict();

const adjustmentSchema = z.object({
  ...movementFields,
  movement_type: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
}).strict();

const thresholdSchema = z.object({
  ...branchField,
  low_stock_threshold: z.number().int().min(0).max(1_000_000_000),
  reason: z.string().trim().min(1).max(500),
}).strict();

const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('Request validation failed', 400, 'VALIDATION_ERROR', result.error.flatten());
  }
  return result.data;
};

export const parsePharmacyInventoryListQuery = (value: unknown) => parse(inventoryListSchema, value);
export const parsePharmacyInventoryParams = (value: unknown) => parse(inventoryParamsSchema, value);
export const parsePharmacyBatchParams = (value: unknown) => parse(batchParamsSchema, value);
export const parsePharmacyBatchListQuery = (value: unknown) => parse(batchListSchema, value);
export const parsePharmacyMovementListQuery = (value: unknown) => parse(movementListSchema, value);
export const parseRegisterMedicineBatchBody = (value: unknown) => parse(registerBatchSchema, value);
export const parseUpdateMedicineBatchBody = (value: unknown) => parse(updateBatchSchema, value);
export const parseRecordMedicineStockMovementBody = (value: unknown) => parse(movementSchema, value);
export const parseRecordMedicineStockAdjustmentBody = (value: unknown) => parse(adjustmentSchema, value);
export const parseUpdateLowStockThresholdBody = (value: unknown) => parse(thresholdSchema, value);
