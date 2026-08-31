import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { type SaveMedicinePayload } from '../api/medicines';
import {
  type ExpiryState,
  type InventoryItem,
  type InventoryListParams,
  type MedicineBatch,
  type StockMovementType,
  type StockState,
} from '../api/pharmacy-inventory';
import { useCurrencyFormatter } from '../api/useSettings';
import { Modal } from '../components/ui/Modal';
import { MedicalLoader, MedicalSpinner } from '../components/ui/MedicalLoader';
import { usePharmacyInventoryFeature } from '../hooks/pharmacy/usePharmacyInventoryFeature';
import { navigate, useAppLocation } from '../routing/navigation';
import { formatDate, formatDateTime } from './patient-utils';

// --- Validation Schemas ---

const batchSchema = z.object({
  medicine_id: z.string().min(1, 'Select a medicine.'),
  batch_number: z.string().trim().min(1, 'Batch number is required.').max(100),
  expiry_date: z.string().min(1, 'Expiry date is required.'),
  unit_price: z.number().min(0, 'Unit price cannot be negative.'),
  opening_quantity: z.number().int().min(0, 'Quantity cannot be negative.'),
  barcode: z.string().trim().max(100),
  reason: z.string().trim().max(500),
});
type BatchForm = z.infer<typeof batchSchema>;

const editBatchSchema = z.object({
  expiry_date: z.string().min(1, 'Expiry date is required.'),
  unit_price: z.number().min(0, 'Unit price cannot be negative.'),
  barcode: z.string().trim().max(100),
  reason: z.string().trim().min(1, 'Reason for edit is required.').max(500),
});
type EditBatchForm = z.infer<typeof editBatchSchema>;

const movementSchema = z.object({
  batch_id: z.string().min(1, 'Select a batch.'),
  movement_type: z.enum(['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
  quantity: z.number().int().min(1, 'Quantity must be at least 1.'),
  reason: z.string().trim().min(1, 'Reason is required.').max(500),
  reference: z.string().trim().max(100),
});
type MovementForm = z.infer<typeof movementSchema>;

const thresholdSchema = z.object({
  low_stock_threshold: z.number().int().min(0, 'Threshold cannot be negative.'),
  reason: z.string().trim().min(1, 'Reason is required.').max(500),
});
type ThresholdForm = z.infer<typeof thresholdSchema>;

const medicineFormSchema = z.object({
  code: z.string().trim().min(1, 'Medicine code is required.').max(50),
  name: z.string().trim().min(1, 'Medicine name is required.').max(200),
  generic_name: z.string().trim().max(200),
  strength: z.string().trim().max(100),
  dosage_form: z.string().trim().max(100),
  unit: z.string().trim().max(50),
  description: z.string().trim().max(1000),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});
type MedicineFormValues = z.infer<typeof medicineFormSchema>;

type ModalMode = 'batch' | 'movement' | 'threshold' | 'detail' | 'edit-batch' | 'add-medicine-master';

const movementLabel: Record<StockMovementType, string> = {
  OPENING_STOCK: 'Opening Stock', STOCK_IN: 'Stock In', STOCK_OUT: 'Stock Out',
  ADJUSTMENT_IN: 'Adjustment In', ADJUSTMENT_OUT: 'Adjustment Out',
};

export function PharmacyMedicineInventoryPage() {
  const formatMoney = useCurrencyFormatter();
  const location = useAppLocation();
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const requestedBranch = query.get('branch_id') ?? '';
  const search = query.get('search') ?? '';
  const stockState = (query.get('stock_state') ?? '') as StockState | '';
  const expiryState = (query.get('expiry_state') ?? '') as ExpiryState | '';
  const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
  const limit = Math.min(100, Math.max(5, Number(query.get('limit') ?? 10) || 10));
  const sortBy = (query.get('sortBy') ?? 'updated_at') as NonNullable<InventoryListParams['sortBy']>;
  const sortOrder = (query.get('sortOrder') ?? 'desc') as 'asc' | 'desc';
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [selected, setSelected] = useState<InventoryItem | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<MedicineBatch | null>(null);
  const [detailTab, setDetailTab] = useState<'batches' | 'movements'>('batches');

  const feature = usePharmacyInventoryFeature({
    requestedBranch,
    search,
    stockState,
    expiryState,
    page,
    limit,
    sortBy,
    sortOrder,
    selectedMedicineId: selected?.medicine_id ?? null,
    detailTab,
    modalMode,
  });

  const {
    branches,
    activeBranchId,
    inventory,
    meta,
    summary,
    medicinesOptions,
    batches,
    movements,
    isLoading,
    isDetailLoading,
    isUpdating,
    permissions: { canRegisterBatch, canRecordMovement, canAdjustStock, canConfigureLowStock },
    actions
  } = feature;

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
    if (activeBranchId && requestedBranch !== activeBranchId) updateQuery({ branch_id: activeBranchId, page: 1 });
  }, [activeBranchId, requestedBranch, updateQuery]);

  const batchForm = useForm<BatchForm>({
    resolver: zodResolver(batchSchema),
    defaultValues: { medicine_id: '', batch_number: '', expiry_date: '', unit_price: 0, opening_quantity: 0, barcode: '', reason: '' },
  });
  const editBatchForm = useForm<EditBatchForm>({
    resolver: zodResolver(editBatchSchema),
    defaultValues: { expiry_date: '', unit_price: 0, barcode: '', reason: '' },
  });
  const movementForm = useForm<MovementForm>({
    resolver: zodResolver(movementSchema),
    defaultValues: { batch_id: '', movement_type: 'STOCK_IN', quantity: 1, reason: '', reference: '' },
  });
  const thresholdForm = useForm<ThresholdForm>({
    resolver: zodResolver(thresholdSchema),
    defaultValues: { low_stock_threshold: 0, reason: '' },
  });
  const medicineForm = useForm<MedicineFormValues>({
    resolver: zodResolver(medicineFormSchema),
    defaultValues: { code: '', name: '', generic_name: '', strength: '', dosage_form: '', unit: '', description: '', status: 'ACTIVE' },
  });

  const openBatch = useCallback(() => {
    setModalMode('batch');
    batchForm.reset();
  }, [batchForm]);

  const openMovement = useCallback((item: InventoryItem) => {
    setSelected(item);
    setModalMode('movement');
    movementForm.reset();
  }, [movementForm]);

  const openThreshold = useCallback((item: InventoryItem) => {
    setSelected(item);
    setModalMode('threshold');
    thresholdForm.reset({ low_stock_threshold: item.low_stock_threshold, reason: '' });
  }, [thresholdForm]);

  const openDetail = useCallback((item: InventoryItem) => {
    setSelected(item);
    setDetailTab('batches');
    setModalMode('detail');
  }, []);

  const openEditBatch = (batch: MedicineBatch) => {
    setSelectedBatch(batch);
    setModalMode('edit-batch');
    editBatchForm.reset({
      expiry_date: batch.expiry_date.split('T')[0],
      unit_price: batch.unit_price,
      barcode: batch.barcode ?? '',
      reason: '',
    });
  };

  const onSubmitBatch = async (values: BatchForm) => {
    await actions.addBatch({
      medicineId: values.medicine_id,
      payload: {
        branch_id: activeBranchId,
        batch_number: values.batch_number,
        expiry_date: values.expiry_date,
        unit_price: values.unit_price,
        opening_quantity: values.opening_quantity,
        barcode: values.barcode.trim() || null,
        reason: values.reason.trim() || null,
      }
    });
    setModalMode(null);
    batchForm.reset();
  };

  const onSubmitMovement = async (values: MovementForm) => {
    await actions.recordMovement({
      branch_id: activeBranchId,
      batch_id: values.batch_id,
      movement_type: values.movement_type as Exclude<StockMovementType, 'OPENING_STOCK'>,
      quantity: values.quantity,
      reason: values.reason,
      reference: values.reference.trim() || null,
      idempotency_key: crypto.randomUUID(),
    });
    setModalMode(null);
    movementForm.reset();
  };

  const onSubmitThreshold = async (values: ThresholdForm) => {
    await actions.updateThreshold({
      medicineId: selected!.medicine_id,
      payload: {
        branch_id: activeBranchId,
        low_stock_threshold: values.low_stock_threshold,
        reason: values.reason,
      }
    });
    setModalMode(null);
  };

  return (
    <div className="opd-queue-page">
      <header className="page-header">
        <div className="header-title">
          <h1>Medicine Inventory</h1>
          <div className="branch-selector">
            <select
              disabled={branches.length <= 1}
              onChange={(e) => updateQuery({ branch_id: e.target.value, page: 1 })}
              value={activeBranchId}
            >
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </div>
        </div>
      </header>

      {summary ? (
        <div className="stat-cards-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="stat-card">
            <div className="stat-icon stat-blue" style={{ color: '#2563eb', backgroundColor: '#eff6ff' }}><i className="ph-fill ph-pill" aria-hidden="true" /></div>
            <div className="stat-info"><p>Medicines Stocked</p><h3>{summary.stocked_medicines}</h3><span className="text-muted">/ {summary.total_medicines} total</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-green" style={{ color: '#16a34a', backgroundColor: '#f0fdf4' }}><i className="ph-fill ph-stack" aria-hidden="true" /></div>
            <div className="stat-info"><p>Total Units</p><h3>{summary.total_available_quantity.toLocaleString()}</h3><span className="text-muted">In inventory</span></div>
          </div>
          <div className="stat-card" style={summary.low_stock_medicines > 0 ? { border: '1px solid var(--warning)' } : {}}>
            <div className="stat-icon stat-yellow" style={{ color: '#ea580c', backgroundColor: '#fff7ed' }}><i className="ph-fill ph-warning" aria-hidden="true" /></div>
            <div className="stat-info"><p>Low Stock</p><h3 style={summary.low_stock_medicines > 0 ? { color: 'var(--warning)' } : {}}>{summary.low_stock_medicines}</h3><span className="text-muted">Needs review</span></div>
          </div>
          <div className="stat-card" style={summary.out_of_stock_medicines > 0 ? { border: '1px solid var(--danger)' } : {}}>
            <div className="stat-icon stat-red" style={{ color: '#dc2626', backgroundColor: '#fef2f2' }}><i className="ph-fill ph-warning-octagon" aria-hidden="true" /></div>
            <div className="stat-info"><p>Out of Stock</p><h3 style={summary.out_of_stock_medicines > 0 ? { color: 'var(--danger)' } : {}}>{summary.out_of_stock_medicines}</h3><span className="text-muted">Needs restocking</span></div>
          </div>
          <div className="stat-card" style={summary.expiring_soon_medicines > 0 || summary.expired_medicines > 0 ? { border: '1px solid var(--danger)' } : {}}>
            <div className="stat-icon stat-red" style={{ color: '#dc2626', backgroundColor: '#fef2f2' }}><i className="ph-fill ph-calendar-x" aria-hidden="true" /></div>
            <div className="stat-info"><p>Expiring &lt;{summary.expiry_warning_days}d</p><h3 style={summary.expiring_soon_medicines > 0 || summary.expired_medicines > 0 ? { color: 'var(--danger)' } : {}}>{summary.expiring_soon_medicines}</h3><span className="text-muted">{summary.expired_medicines} expired</span></div>
          </div>
        </div>
      ) : null}

      <div className="um-table-section card">
        <div className="um-toolbar">
          <div className="um-toolbar-row1">
            <div className="um-search">
              <i className="ph ph-magnifying-glass" aria-hidden="true" />
              <input onChange={(e) => updateQuery({ search: e.target.value, page: 1 })} placeholder="Search medicine name or code..." type="search" value={search} />
            </div>
            <button className="um-add-btn" disabled={!activeBranchId || !canRegisterBatch} onClick={openBatch} type="button">
              <i className="ph ph-plus" aria-hidden="true" /> Register Batch
            </button>
          </div>
          <div className="um-toolbar-row2">
            <span className="filter-label">Filter by:</span>
            <select className="um-filter" onChange={(e) => updateQuery({ stock_state: e.target.value, page: 1 })} value={stockState}>
              <option value="">All Stock States</option>
              <option value="AVAILABLE">Available</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>
            <select className="um-filter" onChange={(e) => updateQuery({ expiry_state: e.target.value, page: 1 })} value={expiryState}>
              <option value="">All Expiry States</option>
              <option value="VALID">Valid</option>
              <option value="EXPIRING_SOON">Expiring Soon</option>
              <option value="EXPIRED">Expired</option>
            </select>
            <button className="um-clear-btn" onClick={() => navigate('/pharmacy/inventory', { replace: true })} type="button">
              <i className="ph ph-x" aria-hidden="true" /> Clear Filters
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Medicine</th>
                <th>Unit</th>
                <th>Stock</th>
                <th>Nearest Expiry</th>
                <th>Batches</th>
                <th className="action-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2.5rem 1rem' }}>
                    <MedicalLoader
                      text="Loading pharmacy inventory..."
                      subtext="Retrieving stock levels, batch numbers and expiration dates"
                    />
                  </td>
                </tr>
              ) : null}
              {!isLoading && inventory.length === 0 ? (
                <tr><td className="um-state-cell" colSpan={7}><i className="ph ph-pill" aria-hidden="true" /> No inventory matches your filters.</td></tr>
              ) : null}
              {inventory.map((item) => (
                <tr key={item.id}>
                  <td><span className="emp-id">{item.medicine.code}</span></td>
                  <td>
                    <div className="user-cell-info">
                      <span className="user-cell-name cursor-pointer" onClick={() => openDetail(item)} onKeyDown={(e) => e.key === 'Enter' && openDetail(item)} role="button" tabIndex={0}>
                        {item.medicine.name}
                      </span>
                      {item.medicine.generic_name ? (
                        <span className="muted-cell">{item.medicine.generic_name} {item.medicine.strength}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{item.medicine.unit ?? '-'}</td>
                  <td>
                    <div className="inventory-stock-amount">
                      <strong className={`stock-${item.stock_state.toLowerCase().replaceAll('_', '-')}`}>{item.available_quantity.toLocaleString()}</strong>
                      {item.low_stock_threshold > 0 ? <span className="text-xs text-muted" style={{ display: 'block', fontSize: '0.75rem', marginTop: '2px' }}>Min: {item.low_stock_threshold}</span> : null}
                    </div>
                  </td>
                  <td>
                    {item.next_expiry_date ? (
                      <span className={`inventory-expiry expiry-${item.expiry_state.toLowerCase().replaceAll('_', '-')}`}>
                        <i className="ph ph-calendar" /> {formatDate(item.next_expiry_date)}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {item.active_batch_count > 0 ? (
                      <span className="inventory-batch-count cursor-pointer" onClick={() => openDetail(item)} onKeyDown={(e) => e.key === 'Enter' && openDetail(item)} role="button" tabIndex={0}>
                        {item.active_batch_count} Active
                      </span>
                    ) : null}
                    {item.expired_batch_count > 0 ? (
                      <span className="inventory-batch-count expiry-expired ms-2" onClick={() => openDetail(item)} onKeyDown={(e) => e.key === 'Enter' && openDetail(item)} role="button" tabIndex={0}>
                        {item.expired_batch_count} Expired
                      </span>
                    ) : null}
                    {item.active_batch_count === 0 && item.expired_batch_count === 0 ? '-' : null}
                  </td>
                  <td className="action-col">
                    <div className="action-icons">
                      <button className="action-icon-btn" disabled={!canRecordMovement && !canAdjustStock} onClick={() => openMovement(item)} title="Record stock movement" type="button"><i className="ph ph-arrows-down-up" /></button>
                      <button className="action-icon-btn" disabled={!canConfigureLowStock} onClick={() => openThreshold(item)} title="Configure low-stock threshold" type="button"><i className="ph ph-gauge" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {meta ? (
          <div className="um-pagination">
            <div className="um-showing">{meta.total === 0 ? 'No inventory' : `Showing ${(meta.page - 1) * meta.limit + 1}—${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}`}</div>
            <div className="um-page-size">
              <span>Rows:</span>
              <select onChange={(event) => updateQuery({ limit: event.target.value, page: 1 })} value={limit}>
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="um-page-controls">
              <button className="pg-btn" disabled={page <= 1} onClick={() => updateQuery({ page: page - 1 })} type="button"><i className="ph ph-caret-left" /></button>
              <span className="pg-btn active">{page}</span>
              <button className="pg-btn" disabled={page >= meta.totalPages} onClick={() => updateQuery({ page: page + 1 })} type="button"><i className="ph ph-caret-right" /></button>
            </div>
          </div>
        ) : null}
      </div>

      <Modal footer={<><button className="btn-secondary" onClick={() => setModalMode(null)} type="button">Cancel</button><button className="btn-primary" disabled={isUpdating} form="register-batch-form" type="submit">{isUpdating ? 'Saving...' : 'Register Batch'}</button></>} icon="ph-plus-circle" onClose={() => setModalMode(null)} open={modalMode === 'batch'} size="large" title="Register New Batch">
        <form id="register-batch-form" onSubmit={(event) => void batchForm.handleSubmit(onSubmitBatch)(event)}>
          <div className="form-section-title">Select Medicine</div>
          <div className="form-grid-2">
            <label className="form-field" style={{ gridColumn: '1 / -1' }}>
              <span>Medicine <span className="required">*</span></span>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select {...batchForm.register('medicine_id')} style={{ flex: 1 }}>
                  <option value="">-- Select Medicine --</option>
                  {isDetailLoading ? <option disabled value="">Loading master list...</option> : null}
                  {medicinesOptions.map((medicine) => (
                    <option key={medicine.id} value={medicine.id}>{medicine.name} {medicine.strength ? `(${medicine.strength})` : ''} [{medicine.code}]</option>
                  ))}
                </select>
                <button className="btn-secondary btn-sm" onClick={() => setModalMode('add-medicine-master')} type="button" style={{ whiteSpace: 'nowrap' }}><i className="ph ph-plus" /> Add to Master</button>
              </div>
              {batchForm.formState.errors.medicine_id ? <small className="field-error">{batchForm.formState.errors.medicine_id.message}</small> : null}
            </label>
          </div>
          <div className="form-section-title">Batch Details</div>
          <div className="form-grid-2">
            <label className="form-field"><span>Batch Number <span className="required">*</span></span><input {...batchForm.register('batch_number')} />{batchForm.formState.errors.batch_number ? <small className="field-error">{batchForm.formState.errors.batch_number.message}</small> : null}</label>
            <label className="form-field"><span>Expiry Date <span className="required">*</span></span><input {...batchForm.register('expiry_date')} type="date" />{batchForm.formState.errors.expiry_date ? <small className="field-error">{batchForm.formState.errors.expiry_date.message}</small> : null}</label>
            <label className="form-field"><span>Unit Price <span className="required">*</span></span><input {...batchForm.register('unit_price', { valueAsNumber: true })} min={0} step={0.01} type="number" />{batchForm.formState.errors.unit_price ? <small className="field-error">{batchForm.formState.errors.unit_price.message}</small> : null}</label>
            <label className="form-field"><span>Opening Quantity <span className="required">*</span></span><input {...batchForm.register('opening_quantity', { valueAsNumber: true })} min={0} type="number" />{batchForm.formState.errors.opening_quantity ? <small className="field-error">{batchForm.formState.errors.opening_quantity.message}</small> : null}</label>
            <label className="form-field"><span>Barcode</span><input {...batchForm.register('barcode')} placeholder="Optional scan" /></label>
            <label className="form-field"><span>Reason</span><input {...batchForm.register('reason')} placeholder="e.g. Supplier invoice 123" /></label>
          </div>
        </form>
      </Modal>

      <Modal footer={<><button className="btn-secondary" onClick={() => setModalMode(null)} type="button">Cancel</button><button className="btn-primary" disabled={isUpdating} form="record-movement-form" type="submit">{isUpdating ? 'Saving...' : 'Record Movement'}</button></>} icon="ph-arrows-down-up" onClose={() => setModalMode(null)} open={modalMode === 'movement'} title={selected ? `Stock Movement: ${selected.medicine.name}` : 'Stock Movement'}>
        <form id="record-movement-form" onSubmit={(event) => void movementForm.handleSubmit(onSubmitMovement)(event)}>
          <div className="form-grid-2">
            <label className="form-field" style={{ gridColumn: '1 / -1' }}>
              <span>Target Batch <span className="required">*</span></span>
              <select {...movementForm.register('batch_id')}>
                <option value="">-- Select Batch --</option>
                {isDetailLoading ? <option disabled value="">Loading batches...</option> : null}
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_number} (Exp: {formatDate(batch.expiry_date)}) - {batch.quantity_on_hand} available
                  </option>
                ))}
              </select>
              {movementForm.formState.errors.batch_id ? <small className="field-error">{movementForm.formState.errors.batch_id.message}</small> : null}
            </label>
            <label className="form-field">
              <span>Movement Type <span className="required">*</span></span>
              <select {...movementForm.register('movement_type')}>
                {canRecordMovement ? <><option value="STOCK_IN">Stock In (Receive)</option><option value="STOCK_OUT">Stock Out (Dispense/Return)</option></> : null}
                {canAdjustStock ? <><option value="ADJUSTMENT_IN">Adjustment In (Found)</option><option value="ADJUSTMENT_OUT">Adjustment Out (Loss/Damage)</option></> : null}
              </select>
            </label>
            <label className="form-field"><span>Quantity <span className="required">*</span></span><input {...movementForm.register('quantity', { valueAsNumber: true })} min={1} type="number" />{movementForm.formState.errors.quantity ? <small className="field-error">{movementForm.formState.errors.quantity.message}</small> : null}</label>
            <label className="form-field" style={{ gridColumn: '1 / -1' }}><span>Reason / Notes <span className="required">*</span></span><input {...movementForm.register('reason')} placeholder="Required explanation" />{movementForm.formState.errors.reason ? <small className="field-error">{movementForm.formState.errors.reason.message}</small> : null}</label>
            <label className="form-field" style={{ gridColumn: '1 / -1' }}><span>Reference</span><input {...movementForm.register('reference')} placeholder="Optional invoice or ticket ID" /></label>
          </div>
        </form>
      </Modal>

      <Modal footer={<><button className="btn-secondary" onClick={() => setModalMode(null)} type="button">Cancel</button><button className="btn-primary" disabled={isUpdating} form="threshold-form" type="submit">{isUpdating ? 'Saving...' : 'Save Threshold'}</button></>} icon="ph-gauge" onClose={() => setModalMode(null)} open={modalMode === 'threshold'} title={selected ? `Low-Stock Threshold: ${selected.medicine.name}` : 'Configure Threshold'}>
        <form id="threshold-form" onSubmit={(event) => void thresholdForm.handleSubmit(onSubmitThreshold)(event)}>
          <div className="alert alert-info mb-4">
            <i className="ph-info" />
            <div>You will receive warnings when the total available quantity across all active batches falls below this threshold.</div>
          </div>
          <div className="form-grid-1">
            <label className="form-field"><span>Minimum Required Quantity <span className="required">*</span></span><input {...thresholdForm.register('low_stock_threshold', { valueAsNumber: true })} min={0} type="number" />{thresholdForm.formState.errors.low_stock_threshold ? <small className="field-error">{thresholdForm.formState.errors.low_stock_threshold.message}</small> : null}</label>
            <label className="form-field"><span>Reason <span className="required">*</span></span><input {...thresholdForm.register('reason')} />{thresholdForm.formState.errors.reason ? <small className="field-error">{thresholdForm.formState.errors.reason.message}</small> : null}</label>
          </div>
        </form>
      </Modal>

      <Modal footer={<button className="btn-secondary" onClick={() => setModalMode(null)} type="button">Close</button>} icon="ph-clipboard-text" onClose={() => setModalMode(null)} open={modalMode === 'detail'} size="large" title={selected ? `${selected.medicine.name} Inventory` : 'Medicine Inventory'}>
        {selected ? <>
          <div className="inventory-detail-summary"><div><span>Available</span><strong>{selected.available_quantity.toLocaleString()} {selected.medicine.unit ?? 'units'}</strong></div><div><span>Threshold</span><strong>{selected.low_stock_threshold.toLocaleString()}</strong></div><div><span>Active Batches</span><strong>{selected.active_batch_count}</strong></div><div><span>Nearest Expiry</span><strong>{formatDate(selected.next_expiry_date)}</strong></div></div>
          <div className="inventory-detail-tabs"><button className={detailTab === 'batches' ? 'active' : ''} onClick={() => setDetailTab('batches')} type="button">Batches</button><button className={detailTab === 'movements' ? 'active' : ''} onClick={() => setDetailTab('movements')} type="button">Movement Ledger</button></div>
          {detailTab === 'batches' ? <div className="table-responsive"><table className="data-table compact-table"><thead><tr><th>Batch</th><th>Barcode</th><th>Expiry</th><th>On Hand</th><th>Unit Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{isDetailLoading ? <tr><td colSpan={7} style={{ padding: '2rem 1rem' }}><MedicalLoader size="small" text="Loading batches..." /></td></tr> : null}{!isDetailLoading && batches.length === 0 ? <tr><td colSpan={7} className="um-state-cell">No batches found.</td></tr> : null}{batches.map((batch) => <tr key={batch.id}><td><strong>{batch.batch_number}</strong></td><td>{batch.barcode ? <span className="inventory-barcode-chip"><i className="ph ph-barcode" /> {batch.barcode}</span> : '---'}</td><td>{formatDate(batch.expiry_date)}</td><td>{batch.quantity_on_hand.toLocaleString()}</td><td>{formatMoney(batch.unit_price)}</td><td><span className={`inventory-expiry expiry-${(batch.expiry_state ?? 'VALID').toLowerCase().replaceAll('_', '-')}`}>{batch.status}</span></td><td><button className="action-icon-btn" onClick={() => openEditBatch(batch)} title="Edit batch" type="button"><i className="ph ph-pencil-simple" /></button></td></tr>)}</tbody></table></div> : null}
          {detailTab === 'movements' ? <div className="table-responsive"><table className="data-table compact-table"><thead><tr><th>Date</th><th>Movement</th><th>Batch</th><th>Quantity</th><th>Available After</th><th>Reason</th></tr></thead><tbody>{isDetailLoading ? <tr><td colSpan={6} style={{ padding: '2rem 1rem' }}><MedicalLoader size="small" text="Loading movement ledger..." /></td></tr> : null}{!isDetailLoading && movements.length === 0 ? <tr><td colSpan={6} className="um-state-cell">No stock movements found.</td></tr> : null}{movements.map((movement) => <tr key={movement.id}><td>{formatDateTime(movement.created_at)}</td><td><strong>{movementLabel[movement.movement_type]}</strong></td><td>{movement.batch_number ?? '---'}</td><td>{movement.quantity.toLocaleString()}</td><td>{movement.available_quantity_after.toLocaleString()}</td><td>{movement.reason}</td></tr>)}</tbody></table></div> : null}
        </> : null}
      </Modal>

      <Modal footer={<><button className="btn-secondary" onClick={() => setModalMode('batch')} type="button">Back to Batch</button><button className="btn-primary" disabled={isUpdating} form="add-medicine-master-form" type="submit">{isUpdating ? <><MedicalSpinner size="sm" /><span>Saving...</span></> : 'Save Medicine'}</button></>} icon="ph-pill" onClose={() => setModalMode('batch')} open={modalMode === 'add-medicine-master'} title="Add Medicine to Master">
        <form id="add-medicine-master-form" onSubmit={(event) => void medicineForm.handleSubmit(async (values) => {
    const payload: SaveMedicinePayload = {
      code: values.code,
      name: values.name,
      generic_name: values.generic_name.trim() || null,
      strength: values.strength.trim() || null,
      dosage_form: values.dosage_form.trim() || null,
      unit: values.unit.trim() || null,
      description: values.description.trim() || null,
      status: values.status,
    };
    await actions.saveMedicine({ payload });
    setModalMode('batch');
    medicineForm.reset();
  })(event)}>
          <div className="form-section-title">Medicine Information</div>
          <div className="form-grid-2">
            <label className="form-field"><span>Medicine Code <span className="required">*</span></span><input {...medicineForm.register('code')} disabled={isUpdating} />{medicineForm.formState.errors.code ? <small className="field-error">{medicineForm.formState.errors.code.message}</small> : null}</label>
            <label className="form-field"><span>Medicine Name <span className="required">*</span></span><input {...medicineForm.register('name')} disabled={isUpdating} />{medicineForm.formState.errors.name ? <small className="field-error">{medicineForm.formState.errors.name.message}</small> : null}</label>
            <label className="form-field"><span>Generic Name</span><input {...medicineForm.register('generic_name')} disabled={isUpdating} /></label>
            <label className="form-field"><span>Strength</span><input {...medicineForm.register('strength')} disabled={isUpdating} placeholder="e.g. 500 mg" /></label>
            <label className="form-field"><span>Dosage Form</span><input {...medicineForm.register('dosage_form')} disabled={isUpdating} placeholder="e.g. Tablet" /></label>
            <label className="form-field"><span>Unit</span><input {...medicineForm.register('unit')} disabled={isUpdating} placeholder="e.g. Tablet" /></label>
            <label className="form-field"><span>Status</span><select {...medicineForm.register('status')} disabled={isUpdating}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
            <label className="form-field" style={{ gridColumn: '1 / -1' }}><span>Description</span><textarea {...medicineForm.register('description')} disabled={isUpdating} rows={3} /></label>
          </div>
        </form>
      </Modal>

      <Modal footer={<><button className="btn-secondary" onClick={() => { setModalMode('detail'); setSelectedBatch(null); }} type="button">Cancel</button><button className="btn-primary" disabled={isUpdating} form="edit-batch-form" type="submit">{isUpdating ? <><MedicalSpinner size="sm" /><span>Saving...</span></> : 'Save Changes'}</button></>} icon="ph-pencil-simple" onClose={() => { setModalMode('detail'); setSelectedBatch(null); }} open={modalMode === 'edit-batch'} title={`Edit Batch ${selectedBatch?.batch_number}`}>
        <form id="edit-batch-form" onSubmit={(event) => void editBatchForm.handleSubmit(async (values) => {
    await actions.editBatch({
      batchId: selectedBatch!.id,
      payload: {
        branch_id: activeBranchId,
        expiry_date: values.expiry_date,
        unit_price: values.unit_price,
        barcode: values.barcode.trim() || null,
        reason: values.reason.trim(),
      }
    });
    setModalMode('detail');
    setSelectedBatch(null);
    editBatchForm.reset();
  })(event)}>
          <div className="form-grid-2">
            <label className="form-field"><span>Expiry Date <span className="required">*</span></span><input {...editBatchForm.register('expiry_date')} type="date" />{editBatchForm.formState.errors.expiry_date ? <small className="field-error">{editBatchForm.formState.errors.expiry_date.message}</small> : null}</label>
            <label className="form-field"><span>Unit Price <span className="required">*</span></span><input {...editBatchForm.register('unit_price', { valueAsNumber: true })} min={0} step={0.01} type="number" />{editBatchForm.formState.errors.unit_price ? <small className="field-error">{editBatchForm.formState.errors.unit_price.message}</small> : null}</label>
            <label className="form-field"><span>Barcode</span><input {...editBatchForm.register('barcode')} placeholder="Optional batch/product barcode" /></label>
            <label className="form-field"><span>Reason for Edit <span className="required">*</span></span><input {...editBatchForm.register('reason')} placeholder="Required for audit logs" />{editBatchForm.formState.errors.reason ? <small className="field-error">{editBatchForm.formState.errors.reason.message}</small> : null}</label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
