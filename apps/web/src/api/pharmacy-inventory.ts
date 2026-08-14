import { apiClient } from './client';

export type StockState = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type BatchStatus = 'ACTIVE' | 'DEPLETED' | 'EXPIRED';
export type ExpiryState = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
export type StockMovementType = 'OPENING_STOCK' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

export type InventoryMedicine = {
  code: string;
  name: string;
  generic_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  unit: string | null;
  status: 'ACTIVE' | 'INACTIVE';
};

export type InventoryItem = {
  id: string;
  medicine_id: string;
  branch_id: string;
  medicine: InventoryMedicine;
  branch: { code: string; name: string } | null;
  available_quantity: number;
  low_stock_threshold: number;
  stock_state: StockState;
  active_batch_count: number;
  expired_batch_count: number;
  next_expiry_date: string | null;
  expiry_state: ExpiryState;
  created_at: string;
  updated_at: string;
};

export type MedicineBatch = {
  id: string;
  medicine_id: string;
  branch_id: string;
  batch_number: string;
  expiry_date: string;
  unit_price: number;
  barcode: string | null;
  quantity_on_hand: number;
  status: BatchStatus;
  expiry_state?: ExpiryState;
  medicine?: { id: string; name: string };
  created_at: string;
  updated_at: string;
};

export type StockMovement = {
  id: string;
  medicine_id: string;
  branch_id: string;
  batch_id: string;
  medicine: { code: string; name: string } | null;
  batch_number: string | null;
  movement_type: StockMovementType;
  quantity: number;
  batch_quantity_before: number;
  batch_quantity_after: number;
  available_quantity_before: number;
  available_quantity_after: number;
  reason: string;
  reference: string | null;
  created_by: string;
  created_at: string;
};

type Page<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type InventoryListParams = {
  branch_id: string;
  search?: string;
  stock_state?: StockState;
  expiry_state?: ExpiryState;
  page?: number;
  limit?: number;
  sortBy?: 'medicine_name' | 'available_quantity' | 'next_expiry_date' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
};

export type BatchListParams = {
  branch_id: string;
  status?: BatchStatus;
  page?: number;
  limit?: number;
  sortBy?: 'batch_number' | 'expiry_date' | 'quantity_on_hand' | 'created_at';
  sortOrder?: 'asc' | 'desc';
};

export type MovementListParams = {
  branch_id: string;
  medicine_id?: string;
  batch_id?: string;
  movement_type?: StockMovementType;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
};

export type InventorySummary = {
  total_medicines: number;
  stocked_medicines: number;
  total_available_quantity: number;
  low_stock_medicines: number;
  out_of_stock_medicines: number;
  expiring_soon_medicines: number;
  expired_medicines: number;
  expiry_warning_days: number;
};

export type RegisterBatchPayload = {
  branch_id: string;
  batch_number: string;
  expiry_date: string;
  unit_price: number;
  opening_quantity: number;
  barcode?: string | null;
  reason?: string | null;
};

export type StockMovementPayload = {
  branch_id: string;
  batch_id: string;
  movement_type: Exclude<StockMovementType, 'OPENING_STOCK'>;
  quantity: number;
  reason: string;
  reference?: string | null;
  idempotency_key: string;
};

const queryString = (params: Record<string, unknown>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).length > 0) query.set(key, String(value));
  });
  return `?${query.toString()}`;
};

export const pharmacyInventoryApi = {
  list(params: InventoryListParams) {
    return apiClient.request<Page<InventoryItem>>(`/pharmacy/medicine-inventory${queryString(params)}`);
  },
  summary(branchId: string) {
    return apiClient.request<InventorySummary>(`/pharmacy/medicine-inventory/summary${queryString({ branch_id: branchId })}`);
  },
  detail(medicineId: string, branchId: string) {
    return apiClient.request<InventoryItem>(
      `/pharmacy/medicine-inventory/${encodeURIComponent(medicineId)}${queryString({ branch_id: branchId })}`,
    );
  },
  batches(medicineId: string, params: BatchListParams) {
    return apiClient.request<Page<MedicineBatch>>(
      `/pharmacy/medicine-inventory/${encodeURIComponent(medicineId)}/batches${queryString(params as any)}`,
    );
  },
  allBatches(params: BatchListParams) {
    return apiClient.request<Page<MedicineBatch>>(
      `/pharmacy/medicine-inventory/batches${queryString(params as any)}`,
    );
  },
  movements(params: MovementListParams) {
    return apiClient.request<Page<StockMovement>>(`/pharmacy/medicine-inventory/movements${queryString(params)}`);
  },
  registerBatch(medicineId: string, payload: RegisterBatchPayload) {
    return apiClient.request<{ batch: MedicineBatch; inventory: InventoryItem }>(
      `/pharmacy/medicine-inventory/${encodeURIComponent(medicineId)}/batches`,
      { method: 'POST', body: payload },
    );
  },
  updateBatch(batchId: string, payload: { branch_id: string; expiry_date?: string; unit_price?: number; barcode?: string | null; reason: string }) {
    return apiClient.request<MedicineBatch>(
      `/pharmacy/medicine-inventory/batches/${encodeURIComponent(batchId)}`,
      { method: 'PATCH', body: payload },
    );
  },
  recordMovement(payload: StockMovementPayload) {
    const adjustment = payload.movement_type === 'ADJUSTMENT_IN' || payload.movement_type === 'ADJUSTMENT_OUT';
    return apiClient.request<{ movement: StockMovement; replayed: boolean }>(
      `/pharmacy/medicine-inventory/${adjustment ? 'adjustments' : 'movements'}`,
      { method: 'POST', body: payload },
    );
  },
  updateThreshold(medicineId: string, payload: { branch_id: string; low_stock_threshold: number; reason: string }) {
    return apiClient.request<InventoryItem>(
      `/pharmacy/medicine-inventory/${encodeURIComponent(medicineId)}/low-stock-threshold`,
      { method: 'PATCH', body: payload },
    );
  },
};

