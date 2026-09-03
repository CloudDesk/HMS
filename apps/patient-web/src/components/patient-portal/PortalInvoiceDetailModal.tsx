import type { UseQueryResult } from '@tanstack/react-query';
import type { PortalInvoiceDetails } from '../../api/patient-portal';
import { Modal } from '../ui/Modal';
import { date, downloadInvoicePdf, label, money } from '../../utils/portal-invoice-pdf';

type PortalInvoiceDetailModalProps = {
  invoiceQuery: UseQueryResult<PortalInvoiceDetails>;
  open: boolean;
  onClose: () => void;
};

export function PortalInvoiceDetailModal({
  invoiceQuery,
  open,
  onClose,
}: PortalInvoiceDetailModalProps) {
  return (
    <Modal
      icon="ph-receipt"
      onClose={onClose}
      open={open}
      size="large"
      title="Invoice details"
    >
      {invoiceQuery.isLoading ? (
        <div className="portal-empty">
          <div className="portal-spinner" />
          <strong>Loading hospital invoice…</strong>
        </div>
      ) : invoiceQuery.isError ? (
        <div className="portal-empty">
          <i className="ph ph-warning-circle" />
          <strong>Invoice details could not be loaded</strong>
          <button onClick={() => void invoiceQuery.refetch()} type="button">
            Try again
          </button>
        </div>
      ) : invoiceQuery.data ? (
        <div className="portal-invoice-details">
          <header>
            <div>
              <small>{invoiceQuery.data.branch?.name || 'HMS Hospital'}</small>
              <h2>{invoiceQuery.data.invoice_number}</h2>
              <span>
                Issued {date(invoiceQuery.data.invoice_date)} ·{' '}
                {invoiceQuery.data.patient?.patient_number || '-'}
              </span>
            </div>
            <span className={`portal-status ${invoiceQuery.data.status.toLowerCase()}`}>
              {label(invoiceQuery.data.status)}
            </span>
          </header>
          <div className="portal-invoice-patient">
            <i className="ph ph-user-circle" />
            <div>
              <small>Patient</small>
              <strong>{invoiceQuery.data.patient?.name || 'Patient'}</strong>
            </div>
            <div>
              <small>Contact</small>
              <strong>
                {invoiceQuery.data.patient?.phone ||
                  invoiceQuery.data.patient?.email ||
                  'Not recorded'}
              </strong>
            </div>
          </div>
          <div className="portal-invoice-table-wrap">
            <table className="portal-invoice-table">
              <thead>
                <tr>
                  <th>Service or item</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Unit rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoiceQuery.data.items.length ? (
                  invoiceQuery.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.service_name}</strong>
                      </td>
                      <td>{label(item.service_type)}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unit_price)}</td>
                      <td>
                        <strong>{money(item.line_total)}</strong>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>No billed service lines recorded.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="portal-invoice-financials">
            <dl>
              <div>
                <dt>Subtotal</dt>
                <dd>{money(invoiceQuery.data.subtotal)}</dd>
              </div>
              <div>
                <dt>Discount</dt>
                <dd>{money(invoiceQuery.data.discount_amount)}</dd>
              </div>
              <div>
                <dt>Tax</dt>
                <dd>{money(invoiceQuery.data.tax_amount)}</dd>
              </div>
              <div>
                <dt>Invoice total</dt>
                <dd>{money(invoiceQuery.data.total_amount)}</dd>
              </div>
              <div>
                <dt>Amount paid</dt>
                <dd>{money(invoiceQuery.data.paid_amount)}</dd>
              </div>
              <div className={invoiceQuery.data.balance_amount > 0 ? 'due' : 'paid'}>
                <dt>
                  {invoiceQuery.data.balance_amount > 0 ? 'Amount due' : 'Payment status'}
                </dt>
                <dd>
                  {invoiceQuery.data.balance_amount > 0
                    ? money(invoiceQuery.data.balance_amount)
                    : 'Paid in full'}
                </dd>
              </div>
            </dl>
          </div>
          {invoiceQuery.data.payments.length ? (
            <div className="portal-invoice-payments">
              <h3>Payment history</h3>
              {invoiceQuery.data.payments.map((payment) => (
                <div key={payment.id}>
                  <span>
                    <strong>{payment.payment_number}</strong>
                    <small>
                      {date(payment.payment_date)} · {label(payment.payment_method)}
                    </small>
                  </span>
                  <strong>{money(payment.amount)}</strong>
                </div>
              ))}
            </div>
          ) : null}
          <div
            className={`portal-invoice-message ${invoiceQuery.data.balance_amount > 0 ? 'due' : 'paid'}`}
          >
            <i
              className={`ph ${invoiceQuery.data.balance_amount > 0 ? 'ph-warning-circle' : 'ph-check-circle'}`}
            />
            <span>
              {invoiceQuery.data.balance_amount > 0
                ? `${money(invoiceQuery.data.balance_amount)} remains to be paid for this invoice.`
                : 'This invoice is fully paid. No payment is currently required.'}
            </span>
          </div>
          <div className="portal-invoice-actions">
            <button onClick={onClose} type="button">
              Close
            </button>
            <button
              className="portal-invoice-download"
              onClick={() => void downloadInvoicePdf(invoiceQuery.data!)}
              type="button"
            >
              <i className="ph ph-download-simple" /> Download PDF
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
