import { useMemo, useState } from 'react';
import { type BillingInvoiceStatus } from '../api/billing';
import { useCurrencyFormatter } from '../api/useSettings';
import { navigate } from '../routing/navigation';
import { billingSourceLabel, billingStatusClass, billingStatusLabel, formatBillingDate } from './billing-utils';
import { useBillingHistoryFeature } from '../hooks/billing/useBillingHistoryFeature';
import { MedicalLoader } from '../components/ui/MedicalLoader';

const statuses: BillingInvoiceStatus[] = ['DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];

type BillingSortField =
  | 'invoice_number'
  | 'patient'
  | 'source'
  | 'invoice_date'
  | 'total'
  | 'paid'
  | 'balance'
  | 'status'
  | null;

type BillingSortDir = 'asc' | 'desc';

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: Exclude<BillingSortField, null>;
  sortField: BillingSortField;
  sortDir: BillingSortDir;
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

export function BillingHistoryPage() {
  const formatBillingMoney = useCurrencyFormatter();
  
  const {
    state: { page, patientId, status, dateFrom, dateTo, branchId, invoiceInput, meta },
    capabilities: { canCreate },
    queries: { branches, patientsQuery, invoicesQuery },
    actions: { setInvoiceInput, updateFilters: update, clearFilters },
  } = useBillingHistoryFeature();

  const [sortField, setSortField] = useState<BillingSortField>(null);
  const [sortDir, setSortDir] = useState<BillingSortDir>('asc');

  const handleSort = (field: Exclude<BillingSortField, null>) => {
    if (sortField === field) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedInvoices = useMemo(() => {
    const list = invoicesQuery.data?.data ?? [];
    if (!sortField) return list;

    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'invoice_number':
          cmp = (a.invoice_number || '').localeCompare(b.invoice_number || '');
          break;
        case 'patient':
          cmp = (a.patient_name || '').localeCompare(b.patient_name || '');
          break;
        case 'source':
          cmp = (billingSourceLabel[a.source_type] || '').localeCompare(billingSourceLabel[b.source_type] || '');
          break;
        case 'invoice_date': {
          const dateA = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
          const dateB = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
          cmp = dateA - dateB;
          break;
        }
        case 'total':
          cmp = (Number(a.total_amount) || 0) - (Number(b.total_amount) || 0);
          break;
        case 'paid':
          cmp = (Number(a.paid_amount) || 0) - (Number(b.paid_amount) || 0);
          break;
        case 'balance':
          cmp = (Number(a.balance_amount) || 0) - (Number(b.balance_amount) || 0);
          break;
        case 'status':
          cmp = (billingStatusLabel[a.status] || '').localeCompare(billingStatusLabel[b.status] || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [invoicesQuery.data?.data, sortField, sortDir]);

  return <div className="billing-page">
    <section className="appointment-page-header">
      <div className="appointment-page-title">
        <h2>Billing History</h2>
        <p>Search invoices, track settlement, and review patient billing accounts</p>
      </div>
      <div className="appointment-page-actions billing-head-actions">
        <button className="btn-secondary" onClick={() => navigate('/billing')} type="button"><i className="ph ph-gauge" /> Dashboard</button>
        {canCreate ? <button className="btn-primary" onClick={() => navigate('/billing/workspace?mode=create')} type="button"><i className="ph ph-plus" /> New Invoice</button> : null}
      </div>
    </section>

    <section className="billing-card billing-filter-card">
      <form onSubmit={(event) => { event.preventDefault(); update({ invoice_number: invoiceInput.trim(), page: 1 }); }}>
        <label className="billing-filter-field col-invoice">
          <span>Invoice Number</span>
          <input onChange={(event) => setInvoiceInput(event.target.value)} placeholder="Search invoice" value={invoiceInput} />
        </label>
        <label className="billing-filter-field col-patient">
          <span>Patient</span>
          <select onChange={(event) => update({ patient_id: event.target.value, page: 1 })} value={patientId}>
            <option value="">All patients</option>
            {patientsQuery.data?.data.map((patient) => (
              <option key={patient.id} value={patient.id}>{patient.patient_number} · {patient.first_name} {patient.last_name}</option>
            ))}
          </select>
        </label>
        <label className="billing-filter-field col-branch">
          <span>Branch</span>
          <select onChange={(event) => update({ branch_id: event.target.value, page: 1 })} value={branchId}>
            <option value="">All accessible branches</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </label>
        <label className="billing-filter-field col-status">
          <span>Status</span>
          <select onChange={(event) => update({ status: event.target.value, page: 1 })} value={status}>
            <option value="">All statuses</option>
            {statuses.map((item) => <option key={item} value={item}>{billingStatusLabel[item]}</option>)}
          </select>
        </label>
        <label className="billing-filter-field col-date-from">
          <span>From</span>
          <input max={dateTo || undefined} onChange={(event) => update({ date_from: event.target.value, page: 1 })} type="date" value={dateFrom} />
        </label>
        <label className="billing-filter-field col-date-to">
          <span>To</span>
          <input min={dateFrom || undefined} onChange={(event) => update({ date_to: event.target.value, page: 1 })} type="date" value={dateTo} />
        </label>
        <div className="billing-filter-actions">
          <button className="btn-primary" type="submit"><i className="ph ph-magnifying-glass" /> Search</button>
          <button className="btn-secondary" onClick={clearFilters} type="button">Clear</button>
        </div>
      </form>
    </section>

    <section className="billing-card">
      {invoicesQuery.isError ? (
        <div className="billing-state error">
          <i className="ph ph-warning-circle" />
          <strong>Invoice history could not be loaded.</strong>
          <button onClick={() => void invoicesQuery.refetch()} type="button">Retry</button>
        </div>
      ) : null}
      <div className="table-responsive billing-table-wrap">
        <table className="data-table billing-table billing-history-table">
          <colgroup>
            <col className="col-invoice" style={{ width: '13.5%' }} />
            <col className="col-patient" style={{ width: '15%' }} />
            <col className="col-source" style={{ width: '10.5%' }} />
            <col className="col-date" style={{ width: '8.5%' }} />
            <col className="col-total" style={{ width: '10.5%' }} />
            <col className="col-paid" style={{ width: '10.5%' }} />
            <col className="col-balance" style={{ width: '12%' }} />
            <col className="col-status" style={{ width: '12.5%' }} />
            <col className="col-actions" style={{ width: '7%' }} />
          </colgroup>
          <thead>
            <tr>
              <th
                className={`col-invoice-th sortable${sortField === 'invoice_number' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('invoice_number')}
                aria-sort={sortField === 'invoice_number' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span>Invoice Number</span>
                <SortIcon field="invoice_number" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-patient-th sortable${sortField === 'patient' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('patient')}
                aria-sort={sortField === 'patient' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span>Patient</span>
                <SortIcon field="patient" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-source-th sortable${sortField === 'source' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('source')}
                aria-sort={sortField === 'source' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span>Source</span>
                <SortIcon field="source" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-date-th sortable${sortField === 'invoice_date' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('invoice_date')}
                aria-sort={sortField === 'invoice_date' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span>Invoice Date</span>
                <SortIcon field="invoice_date" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-total-th align-right sortable${sortField === 'total' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('total')}
                aria-sort={sortField === 'total' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span>Total</span>
                <SortIcon field="total" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-paid-th align-right sortable${sortField === 'paid' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('paid')}
                aria-sort={sortField === 'paid' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span>Paid</span>
                <SortIcon field="paid" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-balance-th align-right sortable${sortField === 'balance' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('balance')}
                aria-sort={sortField === 'balance' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span>Balance</span>
                <SortIcon field="balance" sortField={sortField} sortDir={sortDir} />
              </th>
              <th
                className={`col-status-th align-center sortable${sortField === 'status' ? ` sort-${sortDir}` : ''}`}
                onClick={() => handleSort('status')}
                aria-sort={sortField === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
              >
                <span>Status</span>
                <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
              </th>
              <th className="col-actions-th align-center" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {invoicesQuery.isLoading ? (
              <tr>
                <td colSpan={9} style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                  <MedicalLoader
                    text="Loading billing history..."
                    subtext="Retrieving patient invoices, payments, and balances"
                  />
                </td>
              </tr>
            ) : null}
            {!invoicesQuery.isLoading && (sortedInvoices.length === 0) ? (
              <tr>
                <td className="um-state-cell" colSpan={9}>
                  <i className="ph ph-receipt" /> No invoices match the selected filters.
                </td>
              </tr>
            ) : null}
            {!invoicesQuery.isLoading && sortedInvoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="col-invoice-cell">
                  <div className="billing-invoice-cell">
                    <strong className="billing-invoice-code" title={invoice.invoice_number}>
                      {invoice.invoice_number}
                    </strong>
                    <small className="billing-invoice-branch">{invoice.branch_name ?? 'Branch'}</small>
                  </div>
                </td>
                <td className="col-patient-cell">
                  <div className="billing-patient-cell">
                    <strong className="billing-patient-name" title={invoice.patient_name ?? 'Patient'}>
                      {invoice.patient_name ?? 'Patient'}
                    </strong>
                    <small className="billing-patient-mrn">{invoice.patient_number ?? invoice.patient_id}</small>
                  </div>
                </td>
                <td className="col-source-cell">
                  <span className={`billing-source-badge source-${invoice.source_type.toLowerCase().replaceAll('_', '-')}`}>
                    {billingSourceLabel[invoice.source_type]}
                  </span>
                </td>
                <td className="col-date-cell">
                  <span className="billing-date-text">{formatBillingDate(invoice.invoice_date)}</span>
                </td>
                <td className="col-total-cell align-right">
                  <span className="billing-amount billing-total-amount">{formatBillingMoney(invoice.total_amount)}</span>
                </td>
                <td className="col-paid-cell align-right">
                  <span className="billing-amount billing-paid-amount">{formatBillingMoney(invoice.paid_amount)}</span>
                </td>
                <td className="col-balance-cell align-right">
                  <strong className={`billing-amount ${invoice.balance_amount > 0 ? 'billing-balance-due' : 'billing-balance-clear'}`}>
                    {formatBillingMoney(invoice.balance_amount)}
                  </strong>
                </td>
                <td className="col-status-cell align-center">
                  <span className={`billing-status ${billingStatusClass(invoice.status)}`}>
                    {billingStatusLabel[invoice.status]}
                  </span>
                </td>
                <td className="col-actions-cell align-center">
                  <button
                    aria-label={`View ${invoice.invoice_number}`}
                    className="billing-action-btn"
                    onClick={() => navigate(`/billing/workspace?id=${invoice.id}`)}
                    type="button"
                    title="View invoice workspace"
                  >
                    <i className="ph ph-eye" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="um-pagination">
        <div className="um-showing">{meta.total ? `Showing ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}` : 'No invoices'}</div>
        <div className="um-page-size">
          <span>Rows:</span>
          <select onChange={(event) => update({ limit: Number(event.target.value), page: 1 })} value={meta.limit}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
          </select>
        </div>
        <div className="um-page-controls">
          <button className="pg-btn" disabled={page <= 1} onClick={() => update({ page: page - 1 })} type="button"><i className="ph ph-caret-left" /></button>
          <span className="pg-btn active">{page}</span>
          <button className="pg-btn" disabled={page >= meta.totalPages} onClick={() => update({ page: page + 1 })} type="button"><i className="ph ph-caret-right" /></button>
        </div>
      </div>
    </section>
  </div>;
}
