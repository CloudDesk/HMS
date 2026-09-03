import type { PatientPortalOverview } from '../../api/patient-portal';
import { date, label, money } from '../../utils/portal-invoice-pdf';

type PortalBillingTabProps = {
  invoices: PatientPortalOverview['invoices'];
  onSelectInvoice: (invoice: PatientPortalOverview['invoices'][number]) => void;
};

export function PortalBillingTab({ invoices, onSelectInvoice }: PortalBillingTabProps) {
  const billingTotals = invoices.reduce(
    (acc, item) => ({
      billed: acc.billed + item.total_amount,
      paid: acc.paid + item.paid_amount,
      due: acc.due + Math.max(0, item.balance_amount),
    }),
    { billed: 0, paid: 0, due: 0 },
  );

  return (
    <section className="portal-page-section portal-billing-page">
      <header>
        <div>
          <p>Financial records</p>
          <h1>Billing</h1>
          <span>See what was billed, what has been paid, and whether anything remains due.</span>
        </div>
      </header>
      {invoices.length ? (
        <>
          <div className="portal-billing-summary">
            <article>
              <i className="ph ph-receipt" />
              <span>Total billed</span>
              <strong>{money(billingTotals.billed)}</strong>
            </article>
            <article>
              <i className="ph ph-check-circle" />
              <span>Total paid</span>
              <strong>{money(billingTotals.paid)}</strong>
            </article>
            <article className={billingTotals.due > 0 ? 'has-balance' : 'settled'}>
              <i
                className={`ph ${billingTotals.due > 0 ? 'ph-warning-circle' : 'ph-shield-check'}`}
              />
              <span>{billingTotals.due > 0 ? 'Amount due' : 'Account status'}</span>
              <strong>
                {billingTotals.due > 0 ? money(billingTotals.due) : 'Paid in full'}
              </strong>
            </article>
          </div>
          <div className="portal-billing-list">
            {invoices.map((item) => {
              const isPaid = item.balance_amount <= 0 || item.status === 'PAID';
              const progress =
                item.total_amount > 0
                  ? Math.min(100, Math.round((item.paid_amount / item.total_amount) * 100))
                  : 100;
              return (
                <article className="portal-billing-card" key={item.id}>
                  <div className="portal-billing-card-head">
                    <div className="portal-list-icon">
                      <i className="ph ph-receipt" />
                    </div>
                    <div>
                      <h2>{item.invoice_number}</h2>
                      <span>Issued {date(item.invoice_date)}</span>
                    </div>
                    <span className={`portal-status ${item.status.toLowerCase()}`}>
                      {label(item.status)}
                    </span>
                  </div>
                  <div className="portal-billing-amounts">
                    <div>
                      <span>Invoice total</span>
                      <strong>{money(item.total_amount)}</strong>
                    </div>
                    <div>
                      <span>Amount paid</span>
                      <strong>{money(item.paid_amount)}</strong>
                    </div>
                    <div className={isPaid ? 'paid' : 'due'}>
                      <span>{isPaid ? 'Payment status' : 'Amount due'}</span>
                      <strong>{isPaid ? 'Paid in full' : money(item.balance_amount)}</strong>
                    </div>
                  </div>
                  <div className="portal-payment-progress" aria-label={`${progress}% paid`}>
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <footer>
                    <small>
                      {isPaid
                        ? 'No payment is currently required.'
                        : `${money(item.balance_amount)} remains outstanding.`}
                    </small>
                    <button onClick={() => onSelectInvoice(item)} type="button">
                      View invoice <i className="ph ph-arrow-right" />
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="portal-list-panel">
          <div className="portal-empty">
            <i className="ph ph-receipt" />
            <strong>No issued invoices</strong>
            <span>Hospital invoices will appear here after they are issued.</span>
          </div>
        </div>
      )}
    </section>
  );
}
