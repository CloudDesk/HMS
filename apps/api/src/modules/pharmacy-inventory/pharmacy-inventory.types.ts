export type MedicineStockState = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type MedicineBatchStatus = 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
export type MedicineExpiryState = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
export type MedicineStockMovementType = 'OPENING_STOCK' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

export type PharmacyInventoryListQuery = {
  branch_id: string;
  search?: string;
  stock_state?: MedicineStockState;
  expiry_state?: MedicineExpiryState;
  page?: number;
  limit?: number;
  sortBy?: 'medicine_name' | 'available_quantity' | 'next_expiry_date' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type PharmacyBatchListQuery = {
  branch_id: string;
  status?: MedicineBatchStatus;
  page?: number;
  limit?: number;
  sortBy?: 'batch_number' | 'expiry_date' | 'quantity_on_hand' | 'created_at';
  sortOrder?: 'asc' | 'desc';
};

export type PharmacyMovementListQuery = {
  branch_id: string;
  medicine_id?: string;
  batch_id?: string;
  movement_type?: MedicineStockMovementType;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
};

export type RegisterMedicineBatchDTO = {
  branch_id: string;
  batch_number: string;
  expiry_date: string;
  unit_price: number;
  opening_quantity: number;
  barcode?: string | null;
  reason?: string | null;
};

export type UpdateMedicineBatchDTO = {
  branch_id: string;
  expiry_date?: string;
  unit_price?: number;
  barcode?: string | null;
  reason: string;
};

export type RecordMedicineStockMovementDTO = {
  branch_id: string;
  batch_id: string;
  movement_type: Exclude<MedicineStockMovementType, 'OPENING_STOCK'>;
  quantity: number;
  reason: string;
  reference?: string | null;
  idempotency_key: string;
};

export type UpdateLowStockThresholdDTO = {
  branch_id: string;
  low_stock_threshold: number;
  reason: string;
};

export type PharmacyInventoryRequestMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

