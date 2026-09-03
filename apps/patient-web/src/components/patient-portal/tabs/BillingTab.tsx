import { useState } from 'react';
import type { PatientPortalOverview } from '../../../api/patient-portal';
import { Empty } from '../Empty';
import { Pagination } from '../Pagination';
import { date, label, money } from '../../../utils/formatters';

type BillingTabProps = {
  data: PatientPortalOverview;
  setSelectedInvoice: (invoice: PatientPortalOverview['invoices'][number]) => void;
};

const PAGE_SIZE = 5;

export function BillingTab({ data, setSelectedInvoice }: BillingTabProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const billingTotals = data.invoices.reduce(
    (totals, invoice) => ({
      billed: totals.billed + invoice.total_amount,
      paid: totals.paid + invoice.paid_amount,
      due: totals.due + invoice.balance_amount,
    }),
    { billed: 0, paid: 0, due: 0 },
  );

  const paginatedInvoices = data.invoices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
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

      {data.invoices.length ? (
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
            {paginatedInvoices.map((item) => {
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
                    <button onClick={() => setSelectedInvoice(item)} type="button">
                      View invoice <i className="ph ph-arrow-right" />
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>

          <Pagination
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            pageSize={PAGE_SIZE}
            totalItems={data.invoices.length}
          />
        </>
      ) : (
        <div className="portal-list-panel">
          <Empty
            icon="ph-receipt"
            title="No issued invoices"
            message="Hospital invoices will appear here after they are issued."
          />
        </div>
      )}
    </section>
  );
}
