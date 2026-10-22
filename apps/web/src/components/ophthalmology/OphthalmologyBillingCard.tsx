import { useOphthalmologyBillingFeature } from '../../hooks/ophthalmology/useOphthalmologyBillingFeature';
import type { CompletionWorkspace } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import { getBillingErrorMessage } from '../../hooks/billing/useBilling';
import { billingStatusLabel } from '../../pages/billing-utils';

export function OphthalmologyBillingCard({ workspace }: { workspace: CompletionWorkspace }) {
  const f = useOphthalmologyBillingFeature(workspace);
  if (!f.canView) return <section className="doc-card"><h4>Billing status</h4><p>Billing Invoices View permission is required to view invoice and payment status.</p></section>;
  if (!f.active) return null;
  return <section className="doc-card"><div className="oph-toolbar"><h4>Patient billing — current branch</h4><button type="button" className="doc-btn" disabled={f.query.isFetching} onClick={() => void f.refresh()}>Refresh billing</button></div>
    <p>Patient invoices are paginated across encounters. Match the encounter below before opening Billing. Clinical approval does not create charges or confirm payment.</p>
    {f.query.isLoading && <p role="status">Loading invoices…</p>}
    {f.query.isError && <p role="alert">{getBillingErrorMessage(f.query.error)} Use Refresh billing to retry.</p>}
    {f.scopeError && <p role="alert">Billing records do not match this patient and branch. Refresh before continuing.</p>}
    {!f.query.isLoading && !f.query.isError && !f.scopeError && <>
      {!f.invoices.length ? <p>No patient invoices on this page.</p> : <div className="oph-table-scroll"><table className="doc-table"><thead><tr><th>Invoice</th><th>Encounter</th><th>Status</th><th>Total</th><th>Paid</th><th>Balance</th><th>Action</th></tr></thead><tbody>{f.invoices.map((invoice) => <tr key={invoice.id}>
        <td>{invoice.invoice_number}</td><td>{invoice.source_type} · {invoice.visit_number ?? invoice.visit_id}{invoice.source_type === 'OPD' && invoice.visit_id === f.visitId ? ' · Current encounter' : ' · Other encounter'}</td>
        <td>{billingStatusLabel[invoice.status]}</td><td>{invoice.total_amount.toFixed(2)}</td><td>{invoice.paid_amount.toFixed(2)}</td><td>{invoice.balance_amount.toFixed(2)}</td>
        <td><button type="button" className="doc-btn" onClick={() => f.openInvoice(invoice.id)}>Open invoice</button></td></tr>)}</tbody></table></div>}
      <div className="oph-toolbar"><button type="button" className="doc-btn" disabled={f.page <= 1 || f.query.isFetching} onClick={() => f.setPage(f.page - 1)}>Previous</button><span>Page {f.page} of {Math.max(1, f.query.data?.meta.totalPages ?? 1)}</span><button type="button" className="doc-btn" disabled={f.page >= (f.query.data?.meta.totalPages ?? 1) || f.query.isFetching} onClick={() => f.setPage(f.page + 1)}>Next</button></div>
    </>}
  </section>;
}
