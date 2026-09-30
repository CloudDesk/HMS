import { useEffect, useMemo, useState } from 'react';
import type { DispensingQueueStatus, DispensingStatus } from '../api/pharmacy-dispensing';
import { useCurrencyFormatter } from '../api/useSettings';
import { Modal } from '../components/ui/Modal';
import { MedicalLoader, MedicalSpinner } from '../components/ui/MedicalLoader';
import { usePharmacyDispensingFeature } from '../hooks/pharmacy/usePharmacyDispensingFeature';
import { navigate, useAppLocation } from '../routing/navigation';
import { dispensingSourceLabel } from '../utils/pharmacy-dispensing';

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

const formatDate = (value: string) => new Intl.DateTimeFormat('en', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(value));

const statusLabel = (status: DispensingStatus) => status === 'DRAFT' ? 'PENDING' : status;

const dispensingStatusClass = (status: DispensingStatus) => {
  if (status === 'DRAFT') return 'waiting';
  if (status === 'CONFIRMED') return 'completed';
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'REVERSED') return 'blocked';
  return 'waiting';
};

type PrescriptionSortField =
  | 'patient'
  | 'source'
  | 'doctor'
  | 'items'
  | 'submitted'
  | 'status'
  | 'invoice'
  | null;

type PrescriptionSortDir = 'asc' | 'desc';

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: PrescriptionSortField;
  sortField: PrescriptionSortField;
  sortDir: PrescriptionSortDir;
}) {
  if (sortField !== field) {
    return <i className="ph ph-arrows-down-up th-sort-icon" aria-hidden="true" />;
  }
  return sortDir === 'asc' ? (
    <i className="ph ph-arrow-up th-sort-icon" aria-hidden="true" />
  ) : (
    <i className="ph ph-arrow-down th-sort-icon" aria-hidden="true" />
  );
}

/** Build pagination page-number array with ellipsis markers matching global tables */
function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

type PrescriptionQueuePageProps = {
  embedded?: boolean;
};

export function PrescriptionQueuePage({ embedded = false }: PrescriptionQueuePageProps) {
  const formatMoney = useCurrencyFormatter();
  const { pathname, search } = useAppLocation();
  const initialParams = new URLSearchParams(search);
  const initialStatus = initialParams.get('status');
  const initialPrescriptionId = initialParams.get('prescription') ?? '';
  const [branchId, setBranchId] = useState(initialParams.get('branch') ?? '');
  const [searchTerm, setSearchTerm] = useState(initialParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState<DispensingQueueStatus>(
    isQueueStatus(initialStatus) ? initialStatus : 'PENDING',
  );
  const [page, setPage] = useState(positiveInteger(initialParams.get('page'), 1));
  const [limit, setLimit] = useState(positiveInteger(initialParams.get('limit'), 10));
  const [actionReason, setActionReason] = useState('');
  const queue = usePharmacyDispensingFeature({
    requestedBranch: branchId,
    search: searchTerm,
    status: statusFilter,
    page,
    limit,
    initialPrescriptionId,
  });

  useEffect(() => {
    if (queue.activeBranchId && queue.activeBranchId !== branchId) setBranchId(queue.activeBranchId);
  }, [branchId, queue.activeBranchId]);


  useEffect(() => {
    if (embedded || pathname !== '/pharmacy/queue') return;

    const params = new URLSearchParams();
    if (queue.activeBranchId) params.set('branch', queue.activeBranchId);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    params.set('status', statusFilter);
    if (page > 1) params.set('page', String(page));
    if (limit !== 10) params.set('limit', String(limit));
    if (queue.selectedPrescriptionId) params.set('prescription', queue.selectedPrescriptionId);
    const query = params.toString();
    const nextUrl = `/pharmacy/queue${query ? `?${query}` : ''}`;
    if (window.location.pathname + window.location.search !== nextUrl) navigate(nextUrl, { replace: true });
  }, [embedded, limit, page, pathname, queue.activeBranchId, queue.selectedPrescriptionId, searchTerm, statusFilter]);

  useEffect(() => setActionReason(''), [queue.selectedPrescriptionId, queue.detail?.status]);

  const [sortField, setSortField] = useState<PrescriptionSortField>(null);
  const [sortDir, setSortDir] = useState<PrescriptionSortDir>('asc');

  const handleSort = (field: PrescriptionSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedDispensings = useMemo(() => {
    if (!sortField) return queue.dispensings;
    return [...queue.dispensings].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'patient':
          cmp = (a.patient_name || '').localeCompare(b.patient_name || '');
          break;
        case 'source':
          cmp = (a.source_type || '').localeCompare(b.source_type || '');
          break;
        case 'doctor':
          cmp = (a.doctor_name || '').localeCompare(b.doctor_name || '');
          break;
        case 'items':
          cmp = (a.items?.length ?? 0) - (b.items?.length ?? 0);
          break;
        case 'submitted':
          cmp = new Date(a.submitted_at || 0).getTime() - new Date(b.submitted_at || 0).getTime();
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
        case 'invoice':
          cmp = (a.invoice_number || '').localeCompare(b.invoice_number || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [queue.dispensings, sortDir, sortField]);

  const meta = queue.meta ?? { page, limit, total: 0, totalPages: 1 };
  const pageNumbers = buildPageNumbers(meta.page, meta.totalPages);
  const detail = queue.detail;
  const draftDisabled = queue.isMutating || queue.batchesLoading || !queue.permissions.canEdit;
  const hasLineError = queue.lines.some((line) => line.insufficientStock || line.invalidQuantity);

  return (
    <div className="pharmacy-queue-page">
      {!embedded ? (
        <header className="appointment-page-header">
          <div className="appointment-page-title">
            <h2>Prescription Queue</h2>
            <p>Review outpatient and inpatient prescriptions, allocate batches, and dispense medicines</p>
          </div>
        </header>
      ) : null}
      <div className="um-grid">
        <div className="um-kpi-row dispensing-kpi-row">
          <div className="kpi-card">
            <div className="kpi-info">
              <span className="kpi-label">Total Prescriptions</span>
              <span className="kpi-value">{queue.summaryLoading || queue.summaryError || queue.pendingCount == null || queue.confirmedCount == null ? '—' : ((queue.pendingCount ?? 0) + (queue.confirmedCount ?? 0))}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-info">
              <span className="kpi-label">Pending</span>
              <span className="kpi-value">{queue.summaryLoading || queue.summaryError ? '—' : (queue.pendingCount ?? '—')}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-info">
              <span className="kpi-label">Dispensed</span>
              <span className="kpi-value">{queue.summaryLoading || queue.summaryError ? '—' : (queue.confirmedCount ?? '—')}</span>
            </div>
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
          <div className="table-responsive pharmacy-queue-table-wrap">
            <table className="data-table pharmacy-queue-table">
              <colgroup>
                <col className="col-patient" style={{ width: '21%' }} />
                <col className="col-source" style={{ width: '11%' }} />
                <col className="col-doctor" style={{ width: '14%' }} />
                <col className="col-items" style={{ width: '8%' }} />
                <col className="col-submitted" style={{ width: '13%' }} />
                <col className="col-status" style={{ width: '9%' }} />
                <col className="col-invoice" style={{ width: '6%' }} />
                <col className="col-actions" style={{ width: '18%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th
                    className={`sortable${sortField === 'patient' ? ` sort-${sortDir}` : ''}`}
                    onClick={() => handleSort('patient')}
                    aria-sort={sortField === 'patient' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Patient <SortIcon field="patient" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th
                    className={`sortable${sortField === 'source' ? ` sort-${sortDir}` : ''}`}
                    onClick={() => handleSort('source')}
                    aria-sort={sortField === 'source' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Source <SortIcon field="source" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th
                    className={`sortable${sortField === 'doctor' ? ` sort-${sortDir}` : ''}`}
                    onClick={() => handleSort('doctor')}
                    aria-sort={sortField === 'doctor' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Doctor <SortIcon field="doctor" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th
                    className={`sortable${sortField === 'items' ? ` sort-${sortDir}` : ''}`}
                    onClick={() => handleSort('items')}
                    aria-sort={sortField === 'items' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Items <SortIcon field="items" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th
                    className={`sortable${sortField === 'submitted' ? ` sort-${sortDir}` : ''}`}
                    onClick={() => handleSort('submitted')}
                    aria-sort={sortField === 'submitted' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Submitted <SortIcon field="submitted" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th
                    className={`sortable${sortField === 'status' ? ` sort-${sortDir}` : ''}`}
                    onClick={() => handleSort('status')}
                    aria-sort={sortField === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th
                    className={`sortable${sortField === 'invoice' ? ` sort-${sortDir}` : ''}`}
                    onClick={() => handleSort('invoice')}
                    aria-sort={sortField === 'invoice' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    Invoice <SortIcon field="invoice" sortField={sortField} sortDir={sortDir} />
                  </th>
                  <th className="align-right" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.listLoading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                      <MedicalLoader
                        text="Loading dispensing queue..."
                        subtext="Retrieving outpatient and inpatient pharmacy orders"
                      />
                    </td>
                  </tr>
                ) : sortedDispensings.length === 0 ? (
                  <tr>
                    <td className="um-state-cell" colSpan={8}>
                      <i className="ph ph-inbox" aria-hidden="true" /> No dispensings found.
                    </td>
                  </tr>
                ) : (
                  sortedDispensings.map((dispensing) => (
                    <tr key={dispensing.prescription_id}>
                      <td className="col-patient-cell">
                        <div className="prescription-queue-patient">
                          <strong className="prescription-queue-patient-name" title={dispensing.patient_name}>
                            {dispensing.patient_name}
                          </strong>
                          <span className="prescription-queue-patient-mrn">{dispensing.patient_number}</span>
                        </div>
                      </td>
                      <td className="col-source-cell">
                        <span className={`dispensing-source source-${dispensing.source_type.toLowerCase().replaceAll('_', '-')}`}>
                          {dispensingSourceLabel(dispensing.source_type)}
                        </span>
                      </td>
                      <td className="col-doctor-cell">
                        <span className="prescription-queue-doctor-name" title={dispensing.doctor_name}>
                          {dispensing.doctor_name}
                        </span>
                      </td>
                      <td className="col-items-cell">
                        {dispensing.items.length ? (
                          <strong className="prescription-queue-items-count">{dispensing.items.length} meds</strong>
                        ) : (
                          <span className="prescription-queue-items-muted">Open to review</span>
                        )}
                      </td>
                      <td className="col-submitted-cell">
                        <span className="prescription-queue-submitted-date">
                          {formatDateTime(dispensing.submitted_at)}
                        </span>
                      </td>
                      <td className="col-status-cell">
                        <span className={`doc-status ${dispensingStatusClass(dispensing.status)}`}>
                          {statusLabel(dispensing.status)}
                        </span>
                      </td>
                      <td className="col-invoice-cell">
                        <span className="prescription-queue-invoice">{dispensing.invoice_number ?? '—'}</span>
                      </td>
                      <td className="col-actions-cell align-right">
                        <button
                          className={dispensing.status === 'DRAFT' && queue.permissions.canEdit ? 'btn-primary compact' : 'btn-secondary compact'}
                          onClick={() => queue.actions.openDispensing(dispensing.prescription_id)}
                          type="button"
                        >
                          <i className={`ph ${dispensing.status === 'DRAFT' ? 'ph-prescription' : 'ph-eye'}`} aria-hidden="true" />{' '}
                          {dispensing.status === 'DRAFT' ? 'Open Dispensing' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="um-pagination prescription-queue-pagination">
            <span aria-live="polite">
              {queue.listLoading
                ? 'Loading prescriptions...'
                : queue.listError
                ? 'Results unavailable'
                : meta.total === 0
                ? 'No prescriptions'
                : <>
                    Showing {(meta.page - 1) * meta.limit + 1}–
                    {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} prescriptions
                  </>
              }
            </span>
            <div className="um-page-controls" role="navigation" aria-label="Prescription pagination">
              <button
                className="pg-btn"
                aria-label="Previous page"
                disabled={meta.page <= 1 || queue.listLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                type="button"
              >
                <i className="ph ph-caret-left" aria-hidden="true" />
              </button>

              {meta.totalPages > 1
                ? pageNumbers.map((p, idx) =>
                    p === '…' ? (
                      <span key={`ellipsis-${idx}`} className="pg-btn pg-ellipsis">…</span>
                    ) : (
                      <button
                        key={p}
                        className={`pg-btn${p === meta.page ? ' active' : ''}`}
                        aria-label={`Page ${p}`}
                        aria-current={p === meta.page ? 'page' : undefined}
                        disabled={queue.listLoading}
                        onClick={() => setPage(p as number)}
                        type="button"
                      >
                        {p}
                      </button>
                    )
                  )
                : <span className="pg-btn active" aria-current="page" aria-label={`Page ${meta.page}`}>{meta.page}</span>
              }

              <button
                className="pg-btn"
                aria-label="Next page"
                disabled={meta.page >= meta.totalPages || queue.listLoading || Boolean(queue.listError)}
                onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
                type="button"
              >
                <i className="ph ph-caret-right" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </div>

      <Modal
        footer={<>
          {detail?.status === 'DRAFT' && queue.permissions.canCancel ? <button className="secondary-action danger" disabled={queue.isMutating} onClick={() => void queue.actions.cancelDispensing(actionReason)} type="button">Cancel Dispensing</button> : null}
          {detail?.status === 'DRAFT' && queue.permissions.canEdit ? <button className="secondary-action" disabled={draftDisabled || !queue.isDirty} onClick={() => void queue.actions.saveDraft()} type="button">{queue.isMutating ? <><MedicalSpinner size="sm" /><span>Saving...</span></> : 'Save Draft'}</button> : null}
          {detail?.status === 'DRAFT' && queue.permissions.canDispense ? <button className="primary-action" disabled={queue.isMutating || queue.batchesLoading || hasLineError} onClick={() => void queue.actions.confirmDispensing()} type="button">{queue.isMutating ? <><MedicalSpinner size="sm" /><span>Confirming...</span></> : 'Confirm Dispensing'}</button> : null}
          {detail?.status === 'CONFIRMED' && queue.permissions.canReverse ? <button className="secondary-action danger" disabled={queue.isMutating || actionReason.trim().length < 3} onClick={() => void queue.actions.reverseDispensing(actionReason)} type="button">Reverse Dispensing</button> : null}
        </>}
        icon="ph-prescription"
        onClose={queue.actions.closeDispensing}
        open={Boolean(queue.selectedPrescriptionId)}
        size="large"
        title={detail ? `Dispensing — ${detail.patient_name}` : 'Dispensing'}
      >
        {queue.detailLoading ? (
          <div style={{ padding: '2.5rem 1rem' }}>
            <MedicalLoader text="Loading dispensing draft..." subtext="Allocating batches and checking stock availability" />
          </div>
        ) : null}
        {queue.detailError ? <div className="form-error-banner">{queue.detailError}</div> : null}
        {detail ? (
          <div className="dispensing-detail">
            <div className="dispensing-summary" aria-label="Prescription summary">
              <div className="dispensing-summary-patient"><span>Patient</span><strong>{detail.patient_name}</strong><small>{detail.patient_number}</small></div>
              <div><span>Doctor</span><strong>{detail.doctor_name}</strong></div>
              <div><span>Source</span><strong>{dispensingSourceLabel(detail.source_type)}</strong></div>
              <div><span>Status</span><strong>{statusLabel(detail.status)}</strong></div>
              <div><span>Submitted</span><strong>{formatDateTime(detail.submitted_at)}</strong></div>
            </div>
            {detail.invoice_id ? <div className="dispensing-invoice"><i className="ph ph-receipt" aria-hidden="true" /><span>Pharmacy invoice</span><strong>{detail.invoice_number ?? 'Reference unavailable'}</strong></div> : null}
            {detail.reversal_reason ? <div className="dispensing-reversal-note"><i className="ph ph-arrow-counter-clockwise" aria-hidden="true" /><div><span>Reversal reason</span><strong>{detail.reversal_reason}</strong>{detail.reversed_at ? <small>Reversed {formatDateTime(detail.reversed_at)}</small> : null}</div></div> : null}

            <section className="dispensing-medicines" aria-labelledby="dispensing-medicines-title">
              <div className="dispensing-section-heading">
                <div><span>Dispensing items</span><h4 id="dispensing-medicines-title">{detail.status === 'DRAFT' ? 'Medicines to dispense' : 'Dispensed medicines'}</h4></div>
                <span className="dispensing-item-count">{queue.lines.length} {queue.lines.length === 1 ? 'item' : 'items'}</span>
              </div>
              <div className="dispensing-medicine-list">
                {queue.lines.map((line) => {
                  const batchSelectId = `dispensing-batch-${line.id}`;
                  const quantityInputId = `dispensing-quantity-${line.id}`;
                  return (
                    <article className="dispensing-medicine-card" key={line.id}>
                      {detail.status === 'DRAFT' ? <>
                        <div className="dispensing-medicine-name">
                          <span>Prescribed medicine</span>
                          <strong>{line.prescribedMedicineName}</strong>
                        </div>
                        <div className="dispensing-line-grid">
                          <div className="dispensing-line-fact"><span>Requested quantity</span><strong>{line.requestedQuantity ?? 'Not specified'}</strong></div>
                          <div className="dispensing-line-field"><span>Selected medicine</span><div className="dispensing-readonly-value">{line.selectedMedicineName || line.prescribedMedicineName}</div></div>
                          <div className="dispensing-line-field">
                            {line.medicineId && line.batchOptions.length === 0 && !queue.batchesLoading ? (
                              <><span>Batch</span><span className="diagnostic-status status-cancelled">No batch available</span></>
                            ) : (
                              <><label htmlFor={batchSelectId}>Batch</label><select className="um-filter dispensing-control" disabled={draftDisabled || !line.medicineId} id={batchSelectId} onChange={(event) => queue.actions.selectBatch(line.id, event.target.value)} value={line.batchId ?? ''}>
                                <option value="">Select batch</option>
                                {line.batchOptions.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_number} — {batch.quantity_on_hand} available — exp {formatDate(batch.expiry_date)}</option>)}
                              </select></>
                            )}
                          </div>
                          <div className="dispensing-line-fact"><span>Available stock</span><strong>{line.availableQuantity}</strong>{line.insufficientStock ? <small className="field-error">Insufficient stock</small> : <small>Selected batch</small>}</div>
                          <div className="dispensing-line-field"><label htmlFor={quantityInputId}>Final quantity</label><input className="dispensing-quantity" disabled={draftDisabled} id={quantityInputId} min="1" onChange={(event) => queue.actions.setConfirmedQuantity(line.id, event.target.value ? Number(event.target.value) : null)} onWheel={(event) => event.currentTarget.blur()} step="1" type="number" value={line.confirmedQuantity ?? ''} />{line.invalidQuantity ? <small className="field-error">Enter a whole number greater than zero</small> : null}</div>
                          <div className="dispensing-line-fact"><span>Unit price</span><strong>{formatMoney(line.unitPrice)}</strong><small>Selected batch rate</small></div>
                          <div className="dispensing-line-fact"><span>Total</span><strong>{formatMoney(line.lineTotal)}</strong><small>Final quantity × unit price</small></div>
                        </div>
                      </> : <>
                        <div className="dispensing-medicine-name">
                          <span>Dispensed medicine</span>
                          <strong>{line.selectedMedicineName || line.prescribedMedicineName}</strong>
                        </div>
                        <div className="dispensing-line-grid dispensing-line-grid-summary">
                          <div className="dispensing-line-fact"><span>Requested quantity</span><strong>{line.requestedQuantity ?? 'Not specified'}</strong></div>
                          <div className="dispensing-line-fact"><span>Dispensed quantity</span><strong>{line.confirmedQuantity ?? '—'}</strong></div>
                          <div className="dispensing-line-fact"><span>Batch</span><strong>{line.batchNumber || '—'}</strong></div>
                          <div className="dispensing-line-fact"><span>Unit price</span><strong>{formatMoney(line.unitPrice)}</strong></div>
                          <div className="dispensing-line-fact"><span>Total</span><strong>{formatMoney(line.lineTotal)}</strong></div>
                          <div className="dispensing-line-fact"><span>Dispensing status</span><strong>{statusLabel(detail.status)}</strong></div>
                        </div>
                      </>}
                    </article>
                  );
                })}
              </div>
              <div className="dispensing-total"><span>Dispensing total</span><strong>{formatMoney(queue.dispensingTotal)}</strong></div>
            </section>

            {detail.status === 'DRAFT' && queue.permissions.canEdit ? queue.lines.map((line) => <label className="form-field dispensing-instructions" key={`${line.id}-instructions`}><span>Pharmacist instructions — {line.prescribedMedicineName}</span><input disabled={draftDisabled} maxLength={500} onChange={(event) => queue.actions.setInstructions(line.id, event.target.value)} placeholder="Optional dispensing instructions" value={line.pharmacistInstructions} /></label>) : null}
            {(detail.status === 'DRAFT' && queue.permissions.canCancel) || (detail.status === 'CONFIRMED' && queue.permissions.canReverse) ? <label className="form-field dispensing-reason"><span>{detail.status === 'DRAFT' ? 'Cancellation reason' : 'Reversal reason'}</span><textarea disabled={queue.isMutating} maxLength={500} onChange={(event) => setActionReason(event.target.value)} placeholder={detail.status === 'DRAFT' ? 'Enter reason for cancelling this dispensing...' : 'Enter reason for reversing this dispensing...'} rows={2} value={actionReason} />{detail.status === 'CONFIRMED' ? <small>Minimum 3 characters.</small> : null}</label> : null}
            {queue.actionError ? <div className="form-error-banner">{queue.actionError}</div> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
