import { navigate } from '../routing/navigation';
import { billingStatusClass, billingStatusLabel, formatBillingDate } from './billing-utils';
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

  return <div className="billing-page">
    <div className="billing-page-head">
      <div><h2>Billing Dashboard</h2><p>OPD invoices, collections, and outstanding balances</p></div>
      <div className="billing-head-actions">
        <select aria-label="Filter billing by branch" onChange={(event) => setSelectedBranchId(event.target.value)} value={effectiveBranchId}>
          <option value="">All accessible branches</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <button className="btn-secondary" style={{ cursor: 'default' }} type="button"><i className="ph ph-clock-counter-clockwise" /> History</button>
        {canCreate ? <button className="btn-primary" style={{ cursor: 'default' }} type="button"><i className="ph ph-plus" /> New Invoice</button> : null}
      </div>
    </div>

    {summaryQuery.isError || invoicesQuery.isError ? <div className="billing-state error"><i className="ph ph-warning-circle" /><strong>Billing data could not be loaded.</strong><button onClick={() => { void summaryQuery.refetch(); void invoicesQuery.refetch(); }} type="button">Retry</button></div> : null}

    <section className="billing-kpi-grid" aria-label="Billing summary">
      <article className="billing-kpi"><i className="ph ph-file-text" /><span>Total invoices</span><strong>{summaryQuery.isLoading ? '—' : summary.total_invoices}</strong><small>{summary.by_status.PENDING + summary.by_status.PARTIALLY_PAID} awaiting settlement</small></article>
      <article className="billing-kpi"><i className="ph ph-receipt" /><span>Total billed</span><strong>{summaryQuery.isLoading ? '—' : formatBillingMoney(summary.billed_amount)}</strong><small>Excludes cancelled invoices</small></article>
      <article className="billing-kpi success"><i className="ph ph-check-circle" /><span>Collected</span><strong>{summaryQuery.isLoading ? '—' : formatBillingMoney(summary.collected_amount)}</strong><small>{summary.by_status.PAID} fully paid</small></article>
      <article className="billing-kpi warning"><i className="ph ph-warning" /><span>Outstanding</span><strong>{summaryQuery.isLoading ? '—' : formatBillingMoney(summary.outstanding_amount)}</strong><small>Pending patient balance</small></article>
    </section>

    <section className="billing-card">
      <div className="billing-card-head"><div><h3>Recent Invoices</h3><p>Latest invoices across accessible branches</p></div><button className="btn-secondary" style={{ cursor: 'default' }} type="button">View all</button></div>
      <div className="table-responsive">
        <table className="data-table billing-table"><thead><tr><th>Invoice</th><th>Patient</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th aria-label="Actions" /></tr></thead>
          <tbody>
            {invoicesQuery.isLoading ? <tr><td className="um-state-cell" colSpan={8}>Loading invoices…</td></tr> : null}
            {!invoicesQuery.isLoading && (invoicesQuery.data?.data.length ?? 0) === 0 ? <tr><td className="um-state-cell" colSpan={8}><i className="ph ph-receipt" /> No invoices have been created.</td></tr> : null}
            {invoicesQuery.data?.data.map((invoice) => <tr key={invoice.id}>
              <td><strong>{invoice.invoice_number}</strong><small>{invoice.visit_number ?? 'OPD visit'}</small></td>
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
    </section>
  </div>;
}

