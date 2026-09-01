import { useMemo, useState } from 'react';
import { navigate } from '../routing/navigation';
import { billingSourceLabel, billingStatusClass, billingStatusLabel, formatBillingDate } from './billing-utils';
import { useCurrencyFormatter } from '../api/useSettings';
import { useBillingDashboardFeature } from '../hooks/billing/useBillingDashboardFeature';

export function BillingDashboardPage() {
  const formatBillingMoney = useCurrencyFormatter();
  
  const {
    state: { effectiveBranchId, summary },
    capabilities: { canCreate },
    queries: { branches, summaryQuery, invoicesQuery },
    actions: { setSelectedBranchId },
  } = useBillingDashboardFeature();

  const invoices = invoicesQuery.data?.data ?? [];
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(invoices.length / pageSize));
  const paginatedInvoices = useMemo(() => {
    const start = (page - 1) * pageSize;
    return invoices.slice(start, start + pageSize);
  }, [invoices, page, pageSize]);

  return <div className="billing-page">
    <div className="billing-page-head">
      <div><h2>Billing Dashboard</h2><p>Encounter-linked invoices, collections, and outstanding balances</p></div>
      <div className="billing-head-actions">
        <select aria-label="Filter billing by branch" onChange={(event) => { setSelectedBranchId(event.target.value); setPage(1); }} value={effectiveBranchId}>
          <option value="">All accessible branches</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <button className="btn-secondary" onClick={() => navigate('/billing/history')} type="button"><i className="ph ph-clock-counter-clockwise" /> History</button>
        {canCreate ? <button className="btn-primary" onClick={() => navigate('/billing/workspace?mode=create')} type="button"><i className="ph ph-plus" /> New Invoice</button> : null}
      </div>
    </div>

    {summaryQuery.isError || invoicesQuery.isError ? <div className="billing-state error"><i className="ph ph-warning-circle" /><strong>Billing data could not be loaded.</strong><button onClick={() => { void summaryQuery.refetch(); void invoicesQuery.refetch(); }} type="button">Retry</button></div> : null}

    <section className="billing-kpi-grid" aria-label="Billing summary">
      <article className="billing-kpi"><i className="ph ph-file-text" /><span>Total invoices</span><strong>{summaryQuery.isLoading ? '—' : summary.total_invoices}</strong><small>{summary.by_status.PENDING + summary.by_status.PARTIALLY_PAID} awaiting settlement</small></article>
      <article className="billing-kpi"><i className="ph ph-receipt" /><span>Total billed</span><strong>{summaryQuery.isLoading ? '—' : formatBillingMoney(summary.billed_amount)}</strong><small>Excludes cancelled invoices</small></article>
      <article className="billing-kpi success"><i className="ph ph-check-circle" /><span>Collected</span><strong>{summaryQuery.isLoading ? '—' : formatBillingMoney(summary.collected_amount)}</strong><small>{summary.by_status.PAID} fully paid</small></article>
      <article className="billing-kpi warning"><i className="ph ph-warning" /><span>Outstanding</span><strong>{summaryQuery.isLoading ? '—' : formatBillingMoney(summary.outstanding_amount)}</strong><small>Pending patient balance</small></article>
    </section>

    <section className="billing-card" style={{ overflow: 'hidden' }}>
      <div className="billing-card-head"><div><h3>Recent Invoices</h3><p>Latest invoices across accessible branches</p></div><button className="btn-secondary" onClick={() => navigate('/billing/history')} type="button">View all</button></div>
      <div className="table-responsive">
        <table className="data-table billing-table"><thead><tr><th>Invoice</th><th>Patient</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {invoicesQuery.isLoading ? <tr><td className="um-state-cell" colSpan={8}>Loading invoices…</td></tr> : null}
            {!invoicesQuery.isLoading && invoices.length === 0 ? <tr><td className="um-state-cell" colSpan={8}><i className="ph ph-receipt" /> No invoices have been created.</td></tr> : null}
            {paginatedInvoices.map((invoice) => <tr key={invoice.id}>
              <td><strong>{invoice.invoice_number}</strong><small>{billingSourceLabel[invoice.source_type]} · {invoice.visit_number ?? invoice.encounter_id}</small></td>
              <td><strong>{invoice.patient_name ?? 'Patient'}</strong><small>{invoice.patient_number ?? invoice.patient_id}</small></td>
              <td>{formatBillingDate(invoice.invoice_date)}</td>
              <td>{formatBillingMoney(invoice.total_amount)}</td>
              <td>{formatBillingMoney(invoice.paid_amount)}</td>
              <td><strong className={invoice.balance_amount > 0 ? 'billing-balance-due' : 'billing-balance-clear'}>{formatBillingMoney(invoice.balance_amount)}</strong></td>
              <td><span className={`billing-status ${billingStatusClass(invoice.status)}`}>{billingStatusLabel[invoice.status]}</span></td>
              <td><button aria-label={`Open ${invoice.invoice_number}`} className="icon-btn" onClick={() => navigate(`/billing/workspace?id=${invoice.id}`)} type="button"><i className="ph ph-arrow-square-out" /></button></td>
            </tr>)}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {invoices.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderTop: '1px solid #f1f5f9',
            fontSize: '0.82rem',
            color: '#64748b',
            background: '#ffffff',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px',
          }}
        >
          <div>
            Showing <strong>{Math.min((page - 1) * pageSize + 1, invoices.length)}</strong> to{' '}
            <strong>{Math.min(page * pageSize, invoices.length)}</strong> of{' '}
            <strong>{invoices.length}</strong> invoices
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-secondary compact"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
            >
              <i className="ph ph-caret-left" /> Previous
            </button>
            <span style={{ padding: '0 8px', fontWeight: 600, color: '#1e293b' }}>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary compact"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
            >
              Next <i className="ph ph-caret-right" />
            </button>
          </div>
        </div>
      )}
    </section>
  </div>;
}


