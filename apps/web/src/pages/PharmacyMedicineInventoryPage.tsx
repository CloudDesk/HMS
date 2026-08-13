import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError } from '../api/api-error';
import { branchesApi } from '../api/branches';
import { medicinesApi } from '../api/medicines';
import {
  pharmacyInventoryApi,
  type ExpiryState,
  type InventoryItem,
  type InventoryListParams,
  type MedicineBatch,
  type StockMovementType,
  type StockState,
} from '../api/pharmacy-inventory';
import { useAuth } from '../auth/useAuth';
import { Modal } from '../components/ui/Modal';
import { navigate, useAppLocation } from '../routing/navigation';

const batchSchema = z.object({
  medicine_id: z.string().min(1, 'Select a medicine.'),
  batch_number: z.string().trim().min(1, 'Batch number is required.').max(100),
  expiry_date: z.string().min(1, 'Expiry date is required.'),
  opening_quantity: z.number().int().min(0, 'Quantity cannot be negative.'),
  barcode: z.string().trim().max(100),
  reason: z.string().trim().max(500),
});

const movementSchema = z.object({
  batch_id: z.string().min(1, 'Select a batch.'),
  movement_type: z.enum(['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
  quantity: z.number().int().min(1, 'Quantity must be at least 1.'),
  reason: z.string().trim().min(1, 'Reason is required.').max(500),
  reference: z.string().trim().max(100),
});

const thresholdSchema = z.object({
  low_stock_threshold: z.number().int().min(0, 'Threshold cannot be negative.'),
  reason: z.string().trim().min(1, 'Reason is required.').max(500),
});

type BatchForm = z.infer<typeof batchSchema>;
type MovementForm = z.infer<typeof movementSchema>;
type ThresholdForm = z.infer<typeof thresholdSchema>;
type ModalMode = 'batch' | 'movement' | 'threshold' | 'detail';

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';
const formatDateTime = (value: string) => new Intl.DateTimeFormat('en', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

const errorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'You do not have access to this branch or action.';
    return error.message;
  }
  return 'Unable to complete the inventory request.';
};

const stateLabel: Record<StockState, string> = {
  AVAILABLE: 'Available', LOW_STOCK: 'Low Stock', OUT_OF_STOCK: 'Out of Stock',
};
const movementLabel: Record<StockMovementType, string> = {
  OPENING_STOCK: 'Opening Stock', STOCK_IN: 'Stock In', STOCK_OUT: 'Stock Out',
  ADJUSTMENT_IN: 'Adjustment In', ADJUSTMENT_OUT: 'Adjustment Out',
};

export function PharmacyMedicineInventoryPage() {
  const { user } = useAuth();
  const location = useAppLocation();
  const queryClient = useQueryClient();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isSuperAdmin = Boolean(user?.roles.some((role) => role.code === 'SUPER_ADMIN'));
  const allBranchesQuery = useQuery({
    queryKey: ['branches', 'pharmacy-inventory-options'],
    queryFn: () => branchesApi.list({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    enabled: isSuperAdmin,
  });
  const branches = useMemo(() => isSuperAdmin
    ? (allBranchesQuery.data?.data ?? []).map((branch) => ({ id: branch.id, code: branch.code, name: branch.name }))
    : (user?.branches ?? []), [allBranchesQuery.data?.data, isSuperAdmin, user?.branches]);
  const requestedBranch = query.get('branch_id') ?? '';
  const branchId = branches.some((branch) => branch.id === requestedBranch) ? requestedBranch : (branches[0]?.id ?? '');
  const search = query.get('search') ?? '';
  const stockState = (query.get('stock_state') ?? '') as StockState | '';
  const expiryState = (query.get('expiry_state') ?? '') as ExpiryState | '';
  const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(5, Number(query.get('limit') ?? 10) || 10));
  const sortBy = (query.get('sortBy') ?? 'updated_at') as NonNullable<InventoryListParams['sortBy']>;
  const sortOrder = (query.get('sortOrder') ?? 'desc') as 'asc' | 'desc';
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [detailTab, setDetailTab] = useState<'batches' | 'movements'>('batches');

  const hasAction = useCallback((action: string) => Boolean(
    isSuperAdmin ||
    user?.permissions.some((permission) =>
      permission.module.toLowerCase() === 'pharmacy' &&
      permission.screen.toLowerCase() === 'medicine inventory' &&
      permission.action.toLowerCase() === action.toLowerCase()),
  ), [isSuperAdmin, user]);

  const updateQuery = useCallback((updates: Record<string, string | number | null>) => {
    const next = new URLSearchParams(location.search);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    const suffix = next.toString();
    navigate(`/pharmacy/inventory${suffix ? `?${suffix}` : ''}`, { replace: true });
  }, [location.search]);

  useEffect(() => {
    if (branchId && requestedBranch !== branchId) updateQuery({ branch_id: branchId, page: 1 });
  }, [branchId, requestedBranch, updateQuery]);

  const listParams = useMemo<InventoryListParams>(() => ({
    branch_id: branchId,
    search: search.trim() || undefined,
    stock_state: stockState || undefined,
    expiry_state: expiryState || undefined,
    page,
    limit,
    sortBy,
    sortOrder,
  }), [branchId, expiryState, limit, page, search, sortBy, sortOrder, stockState]);

  const listQuery = useQuery({
    queryKey: ['pharmacy-inventory', 'list', listParams],
    queryFn: () => pharmacyInventoryApi.list(listParams),
    enabled: Boolean(branchId),
  });
  const summaryQuery = useQuery({
    queryKey: ['pharmacy-inventory', 'summary', branchId],
    queryFn: () => pharmacyInventoryApi.summary(branchId),
    enabled: Boolean(branchId),
  });
  const medicineOptionsQuery = useQuery({
    queryKey: ['medicines', 'inventory-options'],
    queryFn: () => medicinesApi.list({ status: 'ACTIVE', page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }),
    enabled: modalMode === 'batch',
  });
  const batchesQuery = useQuery({
    queryKey: ['pharmacy-inventory', 'batches', selected?.medicine_id, branchId],
    queryFn: () => pharmacyInventoryApi.batches(selected!.medicine_id, {
      branch_id: branchId, page: 1, limit: 100, sortBy: 'expiry_date', sortOrder: 'asc',
    }),
    enabled: Boolean(selected && branchId && (modalMode === 'detail' || modalMode === 'movement')),
  });
  const movementsQuery = useQuery({
    queryKey: ['pharmacy-inventory', 'movements', selected?.medicine_id, branchId],
    queryFn: () => pharmacyInventoryApi.movements({
      branch_id: branchId, medicine_id: selected!.medicine_id, page: 1, limit: 50,
    }),
    enabled: Boolean(selected && branchId && modalMode === 'detail' && detailTab === 'movements'),
  });

  const batchForm = useForm<BatchForm>({
    resolver: zodResolver(batchSchema),
    defaultValues: { medicine_id: '', batch_number: '', expiry_date: '', opening_quantity: 0, barcode: '', reason: '' },
  });
  const movementForm = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: { batch_id: '', movement_type: 'STOCK_IN', quantity: 1, reason: '', reference: '' },
  });
  const thresholdForm = useForm<ThresholdForm>({
    resolver: zodResolver(thresholdSchema),
    defaultValues: { low_stock_threshold: 0, reason: '' },
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['pharmacy-inventory'] });
  };

  const batchMutation = useMutation({
    mutationFn: (values: BatchForm) => pharmacyInventoryApi.registerBatch(values.medicine_id, {
      branch_id: branchId,
      batch_number: values.batch_number,
      expiry_date: values.expiry_date,
      opening_quantity: values.opening_quantity,
      barcode: values.barcode.trim() || null,
      reason: values.reason.trim() || null,
    }),
    onSuccess: async () => {
      toast.success('Medicine batch registered successfully.');
      setModalMode(null);
      batchForm.reset();
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const movementMutation = useMutation({
    mutationFn: (values: MovementForm) => pharmacyInventoryApi.recordMovement({
      branch_id: branchId,
      batch_id: values.batch_id,
      movement_type: values.movement_type,
      quantity: values.quantity,
      reason: values.reason,
      reference: values.reference.trim() || null,
      idempotency_key: crypto.randomUUID(),
    }),
    onSuccess: async (result) => {
      toast.success(result.replayed ? 'Stock movement was already recorded.' : 'Stock movement recorded successfully.');
      setModalMode(null);
      movementForm.reset();
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const thresholdMutation = useMutation({
    mutationFn: (values: ThresholdForm) => pharmacyInventoryApi.updateThreshold(selected!.medicine_id, {
      branch_id: branchId,
      low_stock_threshold: values.low_stock_threshold,
      reason: values.reason,
    }),
    onSuccess: async () => {
      toast.success('Low-stock threshold updated.');
      setModalMode(null);
      await invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const openBatch = () => {
    setSelected(null);
    batchForm.reset({ medicine_id: '', batch_number: '', expiry_date: '', opening_quantity: 0, barcode: '', reason: '' });
    setModalMode('batch');
  };
  const openMovement = (item: InventoryItem) => {
    setSelected(item);
    movementForm.reset({ batch_id: '', movement_type: 'STOCK_IN', quantity: 1, reason: '', reference: '' });
    setModalMode('movement');
  };
  const openThreshold = (item: InventoryItem) => {
    setSelected(item);
    thresholdForm.reset({ low_stock_threshold: item.low_stock_threshold, reason: '' });
    setModalMode('threshold');
  };
  const openDetail = (item: InventoryItem) => {
    setSelected(item);
    setDetailTab('batches');
    setModalMode('detail');
  };

  const records = listQuery.data?.data ?? [];
  const meta = listQuery.data?.meta ?? { page, limit, total: 0, totalPages: 1 };
  const summary = summaryQuery.data ?? {
    total_medicines: 0, stocked_medicines: 0, total_available_quantity: 0,
    low_stock_medicines: 0, out_of_stock_medicines: 0, expiring_soon_medicines: 0,
    expired_medicines: 0, expiry_warning_days: 30,
  };
  const selectedMovementType = movementForm.watch('movement_type');
  const availableBatches = (batchesQuery.data?.data ?? []).filter((batch) =>
    selectedMovementType === 'ADJUSTMENT_OUT'
      ? batch.quantity_on_hand > 0
      : batch.status !== 'EXPIRED',
  );
  const canSubmitMovement = selectedMovementType.startsWith('ADJUSTMENT')
    ? hasAction('AdjustStock')
    : hasAction('RecordMovement');

  return (
    <div className="pharmacy-inventory-page">
      <div className="inventory-alert-strip">
        <i className="ph ph-shield-check" aria-hidden="true" />
        <span>Available quantity excludes expired batches. Expiry warnings cover the next {summary.expiry_warning_days} days.</span>
      </div>

      <div className="um-kpi-row inventory-kpis" aria-label="Medicine inventory KPIs">
        {[
          ['ph-pill', 'blue', 'Stocked Medicines', summary.stocked_medicines],
          ['ph-stack', 'green', 'Available Units', summary.total_available_quantity],
          ['ph-warning', 'orange', 'Low Stock', summary.low_stock_medicines],
          ['ph-x-circle', 'red', 'Out of Stock', summary.out_of_stock_medicines],
          ['ph-calendar-warning', 'purple', 'Expiring Soon', summary.expiring_soon_medicines],
          ['ph-calendar-x', 'red', 'Expired', summary.expired_medicines],
        ].map(([icon, tone, label, value]) => (
          <div className="kpi-card" key={String(label)}>
            <div className={`kpi-icon ${tone}`}><i className={`ph ${icon}`} aria-hidden="true" /></div>
            <div className="kpi-info"><span className="kpi-label">{label}</span><span className="kpi-value">{summaryQuery.isLoading ? '—' : value}</span></div>
          </div>
        ))}
      </div>

      <section className="um-table-section card">
        <div className="um-toolbar">
          <div className="um-toolbar-row1 inventory-toolbar-row">
            <div className="um-search"><i className="ph ph-magnifying-glass" /><input onChange={(event) => updateQuery({ search: event.target.value, page: 1 })} placeholder="Search medicine code, name, or generic name..." type="search" value={search} /></div>
            <select className="um-filter inventory-branch-filter" disabled={branches.length <= 1} onChange={(event) => updateQuery({ branch_id: event.target.value, page: 1 })} value={branchId}>
              {branches.length === 0 ? <option value="">No assigned branch</option> : null}
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <button className="um-add-btn" disabled={!branchId || !hasAction('RegisterBatch')} onClick={openBatch} type="button"><i className="ph ph-plus" /> Register Batch</button>
            <button className="btn-secondary admin-table-action" disabled={listQuery.isFetching || !branchId} onClick={() => void invalidate()} type="button"><i className="ph ph-arrows-clockwise" /> Refresh</button>
          </div>
          <div className="um-toolbar-row2">
            <span className="filter-label">Filter by:</span>
            <select className="um-filter" onChange={(event) => updateQuery({ stock_state: event.target.value, page: 1 })} value={stockState}><option value="">All Stock States</option><option value="AVAILABLE">Available</option><option value="LOW_STOCK">Low Stock</option><option value="OUT_OF_STOCK">Out of Stock</option></select>
            <select className="um-filter" onChange={(event) => updateQuery({ expiry_state: event.target.value, page: 1 })} value={expiryState}><option value="">All Expiry States</option><option value="VALID">Valid</option><option value="EXPIRING_SOON">Expiring Soon</option><option value="EXPIRED">Has Expired Stock</option></select>
            <select className="um-filter" onChange={(event) => updateQuery({ sortBy: event.target.value, page: 1 })} value={sortBy}><option value="updated_at">Recently Updated</option><option value="medicine_name">Medicine Name</option><option value="available_quantity">Available Quantity</option><option value="next_expiry_date">Nearest Expiry</option></select>
            <button className="um-clear-btn" onClick={() => navigate(`/pharmacy/inventory${branchId ? `?branch_id=${branchId}` : ''}`, { replace: true })} type="button"><i className="ph ph-x" /> Clear Filters</button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table inventory-table">
            <thead><tr><th>Medicine</th><th>Available</th><th>Batches</th><th>Nearest Expiry</th><th>Threshold</th><th>Stock State</th><th>Expiry</th><th>Actions</th></tr></thead>
            <tbody>
              {!branchId ? <tr><td className="um-state-cell" colSpan={8}><i className="ph ph-buildings" /> No active branch is assigned to your account.</td></tr> : null}
              {listQuery.isLoading ? <tr><td className="um-state-cell" colSpan={8}><span className="loading-spinner" /> Loading medicine inventory...</td></tr> : null}
              {listQuery.isError ? <tr><td className="um-state-cell" colSpan={8}><i className="ph ph-warning" /> {errorMessage(listQuery.error)}</td></tr> : null}
              {branchId && !listQuery.isLoading && !listQuery.isError && records.length === 0 ? <tr><td className="um-state-cell" colSpan={8}><i className="ph ph-package" /> No inventory records found. Register a medicine batch to begin tracking stock.</td></tr> : null}
              {records.map((item) => (
                <tr key={item.id}>
                  <td><div className="user-cell-info"><span className="user-cell-name">{item.medicine.name}</span><span className="muted-cell">{item.medicine.code}{item.medicine.strength ? ` · ${item.medicine.strength}` : ''}{item.medicine.dosage_form ? ` · ${item.medicine.dosage_form}` : ''}</span></div></td>
                  <td><strong className="inventory-quantity">{item.available_quantity.toLocaleString()}</strong><span className="muted-cell inventory-unit">{item.medicine.unit ?? 'units'}</span></td>
                  <td><span className="inventory-batch-chip"><i className="ph ph-stack" /> {item.active_batch_count} active</span>{item.expired_batch_count > 0 ? <span className="inventory-batch-chip danger">{item.expired_batch_count} expired</span> : null}</td>
                  <td>{formatDate(item.next_expiry_date)}</td>
                  <td>{item.low_stock_threshold.toLocaleString()}</td>
                  <td><span className={`inventory-state state-${item.stock_state.toLowerCase().replaceAll('_', '-')}`}>{stateLabel[item.stock_state]}</span></td>
                  <td><span className={`inventory-expiry expiry-${item.expiry_state.toLowerCase().replaceAll('_', '-')}`}>{item.expiry_state === 'EXPIRING_SOON' ? 'Expiring Soon' : item.expiry_state === 'EXPIRED' ? 'Expired Stock' : 'Valid'}</span></td>
                  <td><div className="action-icons">
                    <button className="action-icon-btn" onClick={() => openDetail(item)} title="View batches and movements" type="button"><i className="ph ph-eye" /></button>
                    <button className="action-icon-btn" disabled={!hasAction('RecordMovement') && !hasAction('AdjustStock')} onClick={() => openMovement(item)} title="Record stock movement" type="button"><i className="ph ph-arrows-down-up" /></button>
                    <button className="action-icon-btn" disabled={!hasAction('ConfigureLowStock')} onClick={() => openThreshold(item)} title="Configure low-stock threshold" type="button"><i className="ph ph-gauge" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="um-pagination"><div className="um-showing">{meta.total === 0 ? 'No inventory records' : `Showing ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`}</div><div className="um-page-size"><span>Rows:</span><select onChange={(event) => updateQuery({ limit: event.target.value, page: 1 })} value={limit}><option value="5">5</option><option value="10">10</option><option value="25">25</option></select></div><div className="um-page-controls"><button className="pg-btn" disabled={page <= 1} onClick={() => updateQuery({ page: page - 1 })} type="button"><i className="ph ph-caret-left" /></button><span className="pg-btn active">{page}</span><button className="pg-btn" disabled={page >= meta.totalPages} onClick={() => updateQuery({ page: page + 1 })} type="button"><i className="ph ph-caret-right" /></button></div></div>
      </section>

      <Modal footer={<><button className="btn-secondary" onClick={() => setModalMode(null)} type="button">Cancel</button><button className="btn-primary" disabled={batchMutation.isPending} form="register-batch-form" type="submit">{batchMutation.isPending ? 'Registering...' : 'Register Batch'}</button></>} icon="ph-stack" onClose={() => setModalMode(null)} open={modalMode === 'batch'} size="large" title="Register Medicine Batch">
        <form id="register-batch-form" onSubmit={(event) => void batchForm.handleSubmit((values) => batchMutation.mutate(values))(event)}>
          <div className="form-section-title">Batch and Opening Stock</div>
          <div className="form-grid-3">
            <label className="form-field"><span>Medicine <span className="required">*</span></span><select {...batchForm.register('medicine_id')} disabled={medicineOptionsQuery.isLoading}><option value="">Select medicine</option>{(medicineOptionsQuery.data?.data ?? []).map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.code} — {medicine.name}{medicine.strength ? ` ${medicine.strength}` : ''}</option>)}</select>{batchForm.formState.errors.medicine_id ? <small className="field-error">{batchForm.formState.errors.medicine_id.message}</small> : null}</label>
            <label className="form-field"><span>Batch Number <span className="required">*</span></span><input {...batchForm.register('batch_number')} />{batchForm.formState.errors.batch_number ? <small className="field-error">{batchForm.formState.errors.batch_number.message}</small> : null}</label>
            <label className="form-field"><span>Expiry Date <span className="required">*</span></span><input {...batchForm.register('expiry_date')} min={new Date().toISOString().slice(0, 10)} type="date" />{batchForm.formState.errors.expiry_date ? <small className="field-error">{batchForm.formState.errors.expiry_date.message}</small> : null}</label>
            <label className="form-field"><span>Opening Quantity</span><input {...batchForm.register('opening_quantity', { valueAsNumber: true })} min={0} step={1} type="number" />{batchForm.formState.errors.opening_quantity ? <small className="field-error">{batchForm.formState.errors.opening_quantity.message}</small> : null}</label>
            <label className="form-field"><span>Barcode</span><input {...batchForm.register('barcode')} placeholder="Optional batch/product barcode" /></label>
            <label className="form-field"><span>Reason / Note</span><input {...batchForm.register('reason')} placeholder="Optional for opening stock" /></label>
          </div>
          {!medicineOptionsQuery.isLoading && (medicineOptionsQuery.data?.data.length ?? 0) === 0 ? <div className="inventory-inline-warning"><i className="ph ph-warning" /> No active medicines exist. Create Medicine Master records before registering stock.</div> : null}
        </form>
      </Modal>

      <Modal footer={<><button className="btn-secondary" onClick={() => setModalMode(null)} type="button">Cancel</button><button className="btn-primary" disabled={movementMutation.isPending || !canSubmitMovement} form="stock-movement-form" type="submit">{movementMutation.isPending ? 'Posting...' : 'Post Movement'}</button></>} icon="ph-arrows-down-up" onClose={() => setModalMode(null)} open={modalMode === 'movement'} size="large" title={selected ? `Stock Movement · ${selected.medicine.name}` : 'Stock Movement'}>
        <form id="stock-movement-form" onSubmit={(event) => void movementForm.handleSubmit((values) => movementMutation.mutate(values))(event)}>
          <div className="form-grid-3">
            <label className="form-field"><span>Movement Type <span className="required">*</span></span><select {...movementForm.register('movement_type')}><option value="STOCK_IN">Stock In</option><option value="STOCK_OUT">Stock Out</option><option value="ADJUSTMENT_IN">Adjustment In</option><option value="ADJUSTMENT_OUT">Adjustment Out</option></select></label>
            <label className="form-field"><span>Batch <span className="required">*</span></span><select {...movementForm.register('batch_id')} disabled={batchesQuery.isLoading}><option value="">Select batch</option>{availableBatches.map((batch: MedicineBatch) => <option key={batch.id} value={batch.id}>{batch.batch_number} · {batch.quantity_on_hand} available · exp {formatDate(batch.expiry_date)}</option>)}</select>{movementForm.formState.errors.batch_id ? <small className="field-error">{movementForm.formState.errors.batch_id.message}</small> : null}</label>
            <label className="form-field"><span>Quantity <span className="required">*</span></span><input {...movementForm.register('quantity', { valueAsNumber: true })} min={1} step={1} type="number" />{movementForm.formState.errors.quantity ? <small className="field-error">{movementForm.formState.errors.quantity.message}</small> : null}</label>
            <label className="form-field"><span>Reference</span><input {...movementForm.register('reference')} placeholder="Optional internal reference" /></label>
            <label className="form-field" style={{ gridColumn: 'span 2' }}><span>Reason <span className="required">*</span></span><input {...movementForm.register('reason')} />{movementForm.formState.errors.reason ? <small className="field-error">{movementForm.formState.errors.reason.message}</small> : null}</label>
          </div>
          {!canSubmitMovement ? <div className="inventory-inline-warning"><i className="ph ph-lock" /> You do not have permission for the selected movement type.</div> : null}
          {!batchesQuery.isLoading && availableBatches.length === 0 ? <div className="inventory-inline-warning"><i className="ph ph-warning" /> No eligible batches are available for the selected movement type.</div> : null}
        </form>
      </Modal>

      <Modal footer={<><button className="btn-secondary" onClick={() => setModalMode(null)} type="button">Cancel</button><button className="btn-primary" disabled={thresholdMutation.isPending} form="threshold-form" type="submit">{thresholdMutation.isPending ? 'Saving...' : 'Save Threshold'}</button></>} icon="ph-gauge" onClose={() => setModalMode(null)} open={modalMode === 'threshold'} title={selected ? `Low-Stock Threshold · ${selected.medicine.name}` : 'Low-Stock Threshold'}>
        <form id="threshold-form" onSubmit={(event) => void thresholdForm.handleSubmit((values) => thresholdMutation.mutate(values))(event)}>
          <div className="form-grid-2">
            <label className="form-field"><span>Threshold <span className="required">*</span></span><input {...thresholdForm.register('low_stock_threshold', { valueAsNumber: true })} min={0} step={1} type="number" />{thresholdForm.formState.errors.low_stock_threshold ? <small className="field-error">{thresholdForm.formState.errors.low_stock_threshold.message}</small> : null}</label>
            <label className="form-field"><span>Reason <span className="required">*</span></span><input {...thresholdForm.register('reason')} />{thresholdForm.formState.errors.reason ? <small className="field-error">{thresholdForm.formState.errors.reason.message}</small> : null}</label>
          </div>
        </form>
      </Modal>

      <Modal footer={<button className="btn-secondary" onClick={() => setModalMode(null)} type="button">Close</button>} icon="ph-clipboard-text" onClose={() => setModalMode(null)} open={modalMode === 'detail'} size="large" title={selected ? `${selected.medicine.name} Inventory` : 'Medicine Inventory'}>
        {selected ? <>
          <div className="inventory-detail-summary"><div><span>Available</span><strong>{selected.available_quantity.toLocaleString()} {selected.medicine.unit ?? 'units'}</strong></div><div><span>Threshold</span><strong>{selected.low_stock_threshold.toLocaleString()}</strong></div><div><span>Active Batches</span><strong>{selected.active_batch_count}</strong></div><div><span>Nearest Expiry</span><strong>{formatDate(selected.next_expiry_date)}</strong></div></div>
          <div className="inventory-detail-tabs"><button className={detailTab === 'batches' ? 'active' : ''} onClick={() => setDetailTab('batches')} type="button">Batches</button><button className={detailTab === 'movements' ? 'active' : ''} onClick={() => setDetailTab('movements')} type="button">Movement Ledger</button></div>
          {detailTab === 'batches' ? <div className="table-responsive"><table className="data-table compact-table"><thead><tr><th>Batch</th><th>Barcode</th><th>Expiry</th><th>On Hand</th><th>Status</th></tr></thead><tbody>{batchesQuery.isLoading ? <tr><td colSpan={5}>Loading batches...</td></tr> : null}{!batchesQuery.isLoading && (batchesQuery.data?.data.length ?? 0) === 0 ? <tr><td colSpan={5}>No batches found.</td></tr> : null}{(batchesQuery.data?.data ?? []).map((batch) => <tr key={batch.id}><td><strong>{batch.batch_number}</strong></td><td>{batch.barcode ? <span className="inventory-barcode-chip"><i className="ph ph-barcode" /> {batch.barcode}</span> : '—'}</td><td>{formatDate(batch.expiry_date)}</td><td>{batch.quantity_on_hand.toLocaleString()}</td><td><span className={`inventory-expiry expiry-${(batch.expiry_state ?? 'VALID').toLowerCase().replaceAll('_', '-')}`}>{batch.status}</span></td></tr>)}</tbody></table></div> : null}
          {detailTab === 'movements' ? <div className="table-responsive"><table className="data-table compact-table"><thead><tr><th>Date</th><th>Movement</th><th>Batch</th><th>Quantity</th><th>Available After</th><th>Reason</th></tr></thead><tbody>{movementsQuery.isLoading ? <tr><td colSpan={6}>Loading movement ledger...</td></tr> : null}{!movementsQuery.isLoading && (movementsQuery.data?.data.length ?? 0) === 0 ? <tr><td colSpan={6}>No stock movements found.</td></tr> : null}{(movementsQuery.data?.data ?? []).map((movement) => <tr key={movement.id}><td>{formatDateTime(movement.created_at)}</td><td><strong>{movementLabel[movement.movement_type]}</strong></td><td>{movement.batch_number ?? '—'}</td><td>{movement.quantity.toLocaleString()}</td><td>{movement.available_quantity_after.toLocaleString()}</td><td>{movement.reason}</td></tr>)}</tbody></table></div> : null}
        </> : null}
      </Modal>
    </div>
  );
}
