import { useEffect, useState } from 'react';
import type { DispensingQueueStatus, DispensingSourceType, DispensingStatus } from '../api/pharmacy-dispensing';
import { Modal } from '../components/ui/Modal';
import { usePharmacyDispensingFeature } from '../hooks/pharmacy/usePharmacyDispensingFeature';
import { navigate, useAppLocation } from '../routing/navigation';
import { useCurrencyFormatter } from '../api/useSettings';

const isQueueStatus = (value: string | null): value is DispensingQueueStatus =>
  value === 'PENDING' || value === 'CONFIRMED' || value === 'CANCELLED' || value === 'REVERSED';

const positiveInteger = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const formatDateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat('en', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(value))
  : '—';

const statusLabel = (status: DispensingStatus) => status === 'DRAFT' ? 'PENDING' : status;
const sourceLabel = (source: DispensingSourceType) => ({
  OPD: 'OPD',
  EMERGENCY: 'Emergency',
  IP_ADMISSION: 'IP / Admission',
  PROCEDURE: 'Procedure',
  SURGERY: 'Surgery',
})[source];

export function PrescriptionQueuePage() {
  const { search } = useAppLocation();
  const initialParams = new URLSearchParams(search);
  const initialStatus = initialParams.get('status');
  const [branchId, setBranchId] = useState(initialParams.get('branch') ?? '');
  const [searchTerm, setSearchTerm] = useState(initialParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState<DispensingQueueStatus>(
    isQueueStatus(initialStatus) ? initialStatus : 'PENDING',
  );
  const [page, setPage] = useState(positiveInteger(initialParams.get('page'), 1));
  const [limit, setLimit] = useState(positiveInteger(initialParams.get('limit'), 20));
  const [actionReason, setActionReason] = useState('');
  const formatCurrency = useCurrencyFormatter();

  const queue = usePharmacyDispensingFeature({
    requestedBranch: branchId,
    search: searchTerm,
    status: statusFilter,
    page,
    limit,
  });

  useEffect(() => {
    if (queue.activeBranchId && queue.activeBranchId !== branchId) setBranchId(queue.activeBranchId);
  }, [branchId, queue.activeBranchId]);


  useEffect(() => {
    const params = new URLSearchParams();
    if (queue.activeBranchId) params.set('branch', queue.activeBranchId);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    params.set('status', statusFilter);
    if (page > 1) params.set('page', String(page));
    if (limit !== 20) params.set('limit', String(limit));
    const query = params.toString();
    const nextUrl = `/pharmacy/queue${query ? `?${query}` : ''}`;
    if (window.location.pathname + window.location.search !== nextUrl) navigate(nextUrl, { replace: true });
  }, [limit, page, queue.activeBranchId, searchTerm, statusFilter]);

  useEffect(() => setActionReason(''), [queue.selectedPrescriptionId, queue.detail?.status]);

  const meta = queue.meta ?? { page, limit, total: 0, totalPages: 1 };
  const detail = queue.detail;
  const draftDisabled = queue.isMutating || queue.batchesLoading || !queue.permissions.canEdit;
  const hasStockError = queue.lines.some((line) => line.insufficientStock);

  return (
    <>
      <div className="um-grid">
        <div className="um-kpi-row dispensing-kpi-row">
          <div className="kpi-card">
            <div className="kpi-icon blue"><i className="ph ph-pill" aria-hidden="true" /></div>
            <div className="kpi-info"><span className="kpi-label">Pending on this page</span><span className="kpi-value">{queue.listLoading ? '—' : queue.pendingCount}</span></div>
            <div className="kpi-info"><span className="kpi-label">Dispensed today on this page</span><span className="kpi-value">{queue.listLoading ? '—' : queue.dispensedTodayCount}</span></div>
          </div>
        </div>

        <section className="um-table-section card">
          <div className="um-toolbar">
            <div className="um-toolbar-row1">
              <div className="um-search"><i className="ph ph-magnifying-glass" aria-hidden="true" /><input onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }} placeholder="Search patient name or MRN" type="search" value={searchTerm} /></div>
              {queue.branches.length > 1 ? (
                <select className="um-filter" onChange={(event) => { setBranchId(event.target.value); setPage(1); }} value={queue.activeBranchId}>
                  {queue.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} — {branch.name}</option>)}
                </select>
              ) : null}
              <select className="um-filter" onChange={(event) => { setStatusFilter(isQueueStatus(event.target.value) ? event.target.value : 'PENDING'); setPage(1); }} value={statusFilter}>
                <option value="PENDING">Pending</option><option value="CONFIRMED">Confirmed</option><option value="CANCELLED">Cancelled</option><option value="REVERSED">Reversed</option>
              </select>
              <button className="btn-secondary admin-table-action" disabled={queue.listLoading} onClick={() => void queue.refetch()} type="button"><i className="ph ph-arrows-clockwise" aria-hidden="true" /> Refresh</button>
            </div>
          </div>

          {queue.listError ? <div className="form-error-banner dispensing-page-banner">{queue.listError}</div> : null}
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Patient</th><th>Source</th><th>Doctor</th><th>Items</th><th>Submitted</th><th>Status</th><th>Invoice</th><th>Actions</th></tr></thead>
              <tbody>
                {queue.listLoading ? <tr><td className="um-state-cell" colSpan={8}><span className="loading-spinner" /> Loading dispensing queue...</td></tr>
                  : queue.dispensings.length === 0 ? <tr><td className="um-state-cell" colSpan={8}><i className="ph ph-inbox" aria-hidden="true" /> No dispensings found.</td></tr>
                  : queue.dispensings.map((dispensing) => (
                    <tr key={dispensing.prescription_id}>
                      <td><div className="user-cell-info"><strong>{dispensing.patient_name}</strong><span className="muted-cell">{dispensing.patient_number}</span></div></td>
                      <td><span className={`dispensing-source source-${dispensing.source_type.toLowerCase().replaceAll('_', '-')}`}>{sourceLabel(dispensing.source_type)}</span></td>
                      <td>{dispensing.doctor_name}</td>
                      <td>{dispensing.items.length ? <strong>{dispensing.items.length} meds</strong> : <span className="muted-cell">Open to review</span>}</td>
                      <td>{formatDateTime(dispensing.submitted_at)}</td>
                      <td><span className={`diagnostic-status status-${statusLabel(dispensing.status).toLowerCase()}`}>{statusLabel(dispensing.status)}</span></td>
                      <td>{dispensing.invoice_id ? <code>{dispensing.invoice_id}</code> : '—'}</td>
                      <td><button className={dispensing.status === 'DRAFT' && queue.permissions.canEdit ? 'btn-primary compact' : 'btn-secondary compact'} onClick={() => queue.actions.openDispensing(dispensing.prescription_id)} type="button"><i className={`ph ${dispensing.status === 'DRAFT' ? 'ph-prescription' : 'ph-eye'}`} aria-hidden="true" /> {dispensing.status === 'DRAFT' ? 'Open Dispensing' : 'View'}</button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="um-pagination">
            <div className="um-showing">{meta.total ? `Showing ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}` : 'No dispensings'}</div>
            <div className="um-page-size"><span>Rows:</span><select onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} value={limit}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></div>
            <div className="um-page-controls"><button className="pg-btn" disabled={meta.page <= 1 || queue.listLoading} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button"><i className="ph ph-caret-left" aria-hidden="true" /></button><span className="pg-btn active">{meta.page}</span><button className="pg-btn" disabled={meta.page >= meta.totalPages || queue.listLoading} onClick={() => setPage((current) => current + 1)} type="button"><i className="ph ph-caret-right" aria-hidden="true" /></button></div>
          </div>
        </section>
      </div>

      <Modal
        footer={<>
          <button className="secondary-action" disabled={queue.isMutating} onClick={queue.actions.closeDispensing} type="button">Close</button>
          {detail?.status === 'DRAFT' && queue.permissions.canCancel ? <button className="secondary-action danger" disabled={queue.isMutating} onClick={() => void queue.actions.cancelDispensing(actionReason)} type="button">Cancel Dispensing</button> : null}
          {detail?.status === 'DRAFT' && queue.permissions.canEdit ? <button className="secondary-action" disabled={draftDisabled || !queue.isDirty} onClick={() => void queue.actions.saveDraft()} type="button">{queue.isMutating ? 'Saving...' : 'Save Draft'}</button> : null}
          {detail?.status === 'DRAFT' && queue.permissions.canDispense ? <button className="primary-action" disabled={queue.isMutating || queue.batchesLoading || hasStockError} onClick={() => void queue.actions.confirmDispensing()} type="button">{queue.isMutating ? 'Confirming...' : 'Confirm Dispensing'}</button> : null}
          {detail?.status === 'CONFIRMED' && queue.permissions.canReverse ? <button className="secondary-action danger" disabled={queue.isMutating} onClick={() => void queue.actions.reverseDispensing(actionReason)} type="button">Reverse Dispensing</button> : null}
        </>}
        icon="ph-prescription"
        onClose={queue.actions.closeDispensing}
        open={Boolean(queue.selectedPrescriptionId)}
        size="large"
        title={detail ? `Dispensing — ${detail.patient_name}` : 'Dispensing'}
      >
        {queue.detailLoading ? <div className="um-state-cell"><span className="loading-spinner" /> Loading or creating dispensing draft...</div> : null}
        {queue.detailError ? <div className="form-error-banner">{queue.detailError}</div> : null}
        {detail ? (
          <div className="dispensing-detail">
            <div className="inventory-detail-summary">
              <div><span>Patient</span><strong>{detail.patient_name}</strong><small>{detail.patient_number}</small></div><div><span>Source</span><strong>{sourceLabel(detail.source_type)}</strong><small>{detail.admission_id ?? detail.procedure_id ?? detail.encounter_id ?? 'Context unavailable'}</small></div><div><span>Doctor</span><strong>{detail.doctor_name}</strong></div><div><span>Status</span><strong>{statusLabel(detail.status)}</strong></div><div><span>Submitted</span><strong>{formatDateTime(detail.submitted_at)}</strong></div>
            </div>
            {detail.invoice_id ? <div className="dispensing-invoice"><i className="ph ph-receipt" aria-hidden="true" /><span>Pharmacy invoice</span><strong>{detail.invoice_id}</strong></div> : null}
            {detail.reversal_reason ? <div className="form-error-banner">Reversal reason: {detail.reversal_reason}</div> : null}

            <div className="doc-table-wrap dispensing-lines-wrap"><table className="doc-table dispensing-lines">
              <thead><tr><th>Prescribed medicine</th><th>Requested</th><th>Selected medicine</th><th>Batch</th><th>Available</th><th>Final quantity</th><th>Line total</th></tr></thead>
              <tbody>{queue.lines.map((line) => (
                <tr key={line.id}>
                  <td><strong>{line.prescribedMedicineName}</strong>{line.medicineId && line.selectedMedicineName !== line.prescribedMedicineName ? <span className="dispensing-substitution">Substituted</span> : null}</td>
                  <td><strong>{line.requestedQuantity ?? 'Not specified'}</strong></td>
                  <td>{detail.status === 'DRAFT' ? <select aria-label={`Selected medicine for ${line.prescribedMedicineName}`} className="um-filter dispensing-control" disabled={draftDisabled} onChange={(event) => queue.actions.selectMedicine(line.id, event.target.value)} value={line.medicineId ?? ''}><option value="">Select medicine</option>{queue.medicineOptions.map((medicine) => <option key={medicine.id} value={medicine.id}>{medicine.name}</option>)}</select> : line.selectedMedicineName}</td>
                  <td>{detail.status === 'DRAFT' ? <select aria-label={`Batch for ${line.prescribedMedicineName}`} className="um-filter dispensing-control" disabled={draftDisabled || !line.medicineId} onChange={(event) => queue.actions.selectBatch(line.id, event.target.value)} value={line.batchId ?? ''}><option value="">Select batch</option>{line.batchOptions.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_number} · {batch.quantity_on_hand} available · exp {new Date(batch.expiry_date).toLocaleDateString()}</option>)}</select> : line.batchNumber || '—'}</td>
                  <td><span className={line.insufficientStock ? 'diagnostic-status status-cancelled' : 'diagnostic-status status-confirmed'}>{line.availableQuantity}</span>{line.insufficientStock ? <div className="field-error">Insufficient stock</div> : null}</td>
                  <td>{detail.status === 'DRAFT' ? <input aria-label={`Final quantity for ${line.prescribedMedicineName}`} className="dispensing-quantity" disabled={draftDisabled} min="1" onChange={(event) => queue.actions.setConfirmedQuantity(line.id, event.target.value ? Number(event.target.value) : null)} step="1" type="number" value={line.confirmedQuantity ?? ''} /> : line.confirmedQuantity ?? '—'}</td>
                  <td>{formatCurrency(line.lineTotal)}</td>
                </tr>
              ))}</tbody>
            </table></div>

            {detail.status === 'DRAFT' && queue.permissions.canEdit ? queue.lines.map((line) => <label className="form-field dispensing-instructions" key={`${line.id}-instructions`}><span>Pharmacist instructions — {line.prescribedMedicineName}</span><input disabled={draftDisabled} maxLength={500} onChange={(event) => queue.actions.setInstructions(line.id, event.target.value)} placeholder="Optional dispensing instructions" value={line.pharmacistInstructions} /></label>) : null}
            {(detail.status === 'DRAFT' && queue.permissions.canCancel) || (detail.status === 'CONFIRMED' && queue.permissions.canReverse) ? <label className="form-field dispensing-reason"><span>{detail.status === 'DRAFT' ? 'Cancellation reason' : 'Reversal reason'}</span><textarea disabled={queue.isMutating} maxLength={500} onChange={(event) => setActionReason(event.target.value)} placeholder="Required when cancelling or reversing" rows={2} value={actionReason} /></label> : null}
            {queue.actionError ? <div className="form-error-banner">{queue.actionError}</div> : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
