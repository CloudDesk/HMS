import { type BillingInvoiceStatus } from '../api/billing';
import { useCurrencyFormatter } from '../api/useSettings';
import { navigate } from '../routing/navigation';
import { billingStatusClass, billingStatusLabel, formatBillingDate } from './billing-utils';
import { useBillingHistoryFeature } from '../hooks/billing/useBillingHistoryFeature';

const statuses: BillingInvoiceStatus[] = ['DRAFT', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];

export function BillingHistoryPage() {
  const formatBillingMoney = useCurrencyFormatter();
  
  const {
    state: { page, patientId, status, dateFrom, dateTo, branchId, invoiceInput, meta },
    capabilities: { canCreate },
    queries: { branches, patientsQuery, invoicesQuery },
    actions: { setInvoiceInput, updateFilters: update, clearFilters },
  } = useBillingHistoryFeature();

  return <div className="billing-page">
    <div className="billing-page-head">
      <div><h2>Billing History</h2><p>Search invoices and review payment status</p></div>
      <div className="billing-head-actions"><button className="btn-secondary" onClick={() => navigate('/billing')} type="button"><i className="ph ph-gauge" /> Dashboard</button>{canCreate ? <button className="btn-primary" onClick={() => navigate('/billing/workspace?mode=create')} type="button"><i className="ph ph-plus" /> New Invoice</button> : null}</div>
    </div>

    <section className="billing-card billing-filter-card">
      <form onSubmit={(event) => { event.preventDefault(); update({ invoice_number: invoiceInput.trim(), page: 1 }); }}>
        <label><span>Invoice Number</span><input onChange={(event) => setInvoiceInput(event.target.value)} placeholder="Search invoice" value={invoiceInput} /></label>
        <label><span>Patient</span><select onChange={(event) => update({ patient_id: event.target.value, page: 1 })} value={patientId}><option value="">All patients</option>{patientsQuery.data?.data.map((patient) => <option key={patient.id} value={patient.id}>{patient.patient_number} · {patient.first_name} {patient.last_name}</option>)}</select></label>
        <label><span>Status</span><select onChange={(event) => update({ status: event.target.value, page: 1 })} value={status}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{billingStatusLabel[item]}</option>)}</select></label>
        <label><span>From</span><input max={dateTo || undefined} onChange={(event) => update({ date_from: event.target.value, page: 1 })} type="date" value={dateFrom} /></label>
        <label><span>To</span><input min={dateFrom || undefined} onChange={(event) => update({ date_to: event.target.value, page: 1 })} type="date" value={dateTo} /></label>
        <label><span>Branch</span><select onChange={(event) => update({ branch_id: event.target.value, page: 1 })} value={branchId}><option value="">All accessible branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <div className="billing-filter-actions"><button className="btn-primary" type="submit"><i className="ph ph-magnifying-glass" /> Search</button><button className="btn-secondary" onClick={clearFilters} type="button">Clear</button></div>
      </form>
    </section>

    <section className="billing-card">
      {invoicesQuery.isError ? <div className="billing-state error"><i className="ph ph-warning-circle" /><strong>Invoice history could not be loaded.</strong><button onClick={() => void invoicesQuery.refetch()} type="button">Retry</button></div> : null}
      <div className="table-responsive"><table className="data-table billing-table"><thead><tr><th>Invoice Number</th><th>Patient</th><th>Visit</th><th>Invoice Date</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>
        {invoicesQuery.isLoading ? <tr><td className="um-state-cell" colSpan={9}>Loading billing history…</td></tr> : null}
        {!invoicesQuery.isLoading && (invoicesQuery.data?.data.length ?? 0) === 0 ? <tr><td className="um-state-cell" colSpan={9}><i className="ph ph-receipt" /> No invoices match the selected filters.</td></tr> : null}
        {invoicesQuery.data?.data.map((invoice) => <tr key={invoice.id}>
          <td><strong>{invoice.invoice_number}</strong><small>{invoice.branch_name ?? 'Branch'}</small></td>
          <td><strong>{invoice.patient_name ?? 'Patient'}</strong><small>{invoice.patient_number ?? invoice.patient_id}</small></td>
          <td>{invoice.visit_number ?? invoice.visit_id}</td>
          <td>{formatBillingDate(invoice.invoice_date)}</td>
          <td>{formatBillingMoney(invoice.total_amount)}</td><td>{formatBillingMoney(invoice.paid_amount)}</td>
          <td><strong className={invoice.balance_amount > 0 ? 'billing-balance-due' : 'billing-balance-clear'}>{formatBillingMoney(invoice.balance_amount)}</strong></td>
          <td><span className={`billing-status ${billingStatusClass(invoice.status)}`}>{billingStatusLabel[invoice.status]}</span></td>
          <td><button aria-label={`View ${invoice.invoice_number}`} className="icon-btn" onClick={() => navigate(`/billing/workspace?id=${invoice.id}`)} type="button"><i className="ph ph-eye" /></button></td>
        </tr>)}
      </tbody></table></div>
      <div className="um-pagination"><span>{meta.total ? `Showing ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total}` : 'No invoices'}</span><div className="um-page-controls"><button className="pg-btn" disabled={page <= 1} onClick={() => update({ page: page - 1 })} type="button"><i className="ph ph-caret-left" /></button><span className="pg-btn active">{page}</span><button className="pg-btn" disabled={page >= meta.totalPages} onClick={() => update({ page: page + 1 })} type="button"><i className="ph ph-caret-right" /></button></div></div>
    </section>
  </div>;
}
