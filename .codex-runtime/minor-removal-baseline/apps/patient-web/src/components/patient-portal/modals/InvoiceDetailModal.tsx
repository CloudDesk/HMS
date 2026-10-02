import type { UseQueryResult } from '@tanstack/react-query';
import { Modal } from '../../ui/Modal';
import type { PatientPortalOverview, PortalInvoiceDetails } from '../../../api/patient-portal';
import { date, label, money } from '../../../utils/formatters';
import { downloadInvoicePdf } from '../../../services/invoice-pdf.service';

type InvoiceDetailModalProps = {
  selectedInvoice: PatientPortalOverview['invoices'][number] | null;
  onClose: () => void;
  invoiceQuery: UseQueryResult<PortalInvoiceDetails, Error>;
};

export function InvoiceDetailModal({
  selectedInvoice,
  onClose,
  invoiceQuery,
}: InvoiceDetailModalProps) {
  return (
    <Modal
      icon="ph-receipt"
      onClose={onClose}
      open={Boolean(selectedInvoice)}
      size="large"
      title="Invoice details"
    >
      {invoiceQuery.isLoading ? (
        <div className="portal-empty" style={{ padding: '3rem' }}>
          <div className="portal-spinner" />
          <strong>Loading hospital invoice…</strong>
        </div>
      ) : invoiceQuery.isError ? (
        <div className="portal-empty portal-empty--error" style={{ padding: '3rem' }}>
          <i className="ph ph-warning-circle" />
          <strong>Invoice details could not be loaded</strong>
          <button onClick={() => void invoiceQuery.refetch()} type="button">
            Try again
          </button>
        </div>
      ) : invoiceQuery.data ? (
        <div className="portal-invoice-details">
          {/* Header Summary */}
          <div className="portal-invoice-header-summary">
            <div>
              <small>{invoiceQuery.data.branch?.name || 'HMS Hospital'}</small>
              <h2>{invoiceQuery.data.invoice_number}</h2>
              <span>
                <i className="ph ph-calendar-blank" /> Issued on {date(invoiceQuery.data.invoice_date)} · MRN:{' '}
                <strong>{invoiceQuery.data.patient?.patient_number || '-'}</strong>
              </span>
            </div>
            <span className={`portal-status ${invoiceQuery.data.status.toLowerCase()}`}>
              {label(invoiceQuery.data.status)}
            </span>
          </div>

          {/* Patient Details */}
          <div className="portal-invoice-patient">
            <i className="ph ph-user-circle" />
            <div>
              <small>Patient name</small>
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

          {/* Line Items Table */}
          <div className="portal-invoice-table-wrap">
            <table className="portal-invoice-table">
              <thead>
                <tr>
                  <th>Service / Item</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Unit Rate</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoiceQuery.data.items.length ? (
                  invoiceQuery.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.service_name}</strong>
                      </td>
                      <td>
                        <span className="portal-item-type-badge">{label(item.service_type)}</span>
                      </td>
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

          {/* Financial Breakdown Receipt */}
          <div className="portal-invoice-financials-container">
            <div className="portal-invoice-receipt-card">
              <div className="portal-receipt-row">
                <span>Subtotal</span>
                <strong>{money(invoiceQuery.data.subtotal)}</strong>
              </div>
              <div className="portal-receipt-row">
                <span>Discount</span>
                <span>{money(invoiceQuery.data.discount_amount)}</span>
              </div>
              <div className="portal-receipt-row">
                <span>Tax</span>
                <span>{money(invoiceQuery.data.tax_amount)}</span>
              </div>
              <div className="portal-receipt-row portal-receipt-total">
                <span>Total Amount</span>
                <strong>{money(invoiceQuery.data.total_amount)}</strong>
              </div>
              <div className="portal-receipt-row">
                <span>Amount Paid</span>
                <strong>{money(invoiceQuery.data.paid_amount)}</strong>
              </div>
              <div className="portal-receipt-row portal-receipt-balance">
                <span>{invoiceQuery.data.balance_amount > 0 ? 'Amount Due' : 'Account Status'}</span>
                <strong className={invoiceQuery.data.balance_amount > 0 ? 'due' : 'settled'}>
                  {invoiceQuery.data.balance_amount > 0
                    ? money(invoiceQuery.data.balance_amount)
                    : 'Paid in full'}
                </strong>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {invoiceQuery.data.payments.length ? (
            <div className="portal-invoice-payments">
              <h3>
                <i className="ph ph-credit-card" /> Payment History
              </h3>
              {invoiceQuery.data.payments.map((payment) => (
                <div className="portal-invoice-payment-item" key={payment.id}>
                  <div className="portal-payment-meta">
                    <strong>{payment.payment_number}</strong>
                    <small>
                      <i className="ph ph-calendar" /> {date(payment.payment_date)} · <i className="ph ph-wallet" /> {label(payment.payment_method)}
                    </small>
                  </div>
                  <strong className="portal-payment-amount">{money(payment.amount)}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {/* Status Message */}
          <div
            className={`portal-invoice-message ${
              invoiceQuery.data.balance_amount > 0 ? 'due' : 'paid'
            }`}
          >
            <i
              className={`ph ${
                invoiceQuery.data.balance_amount > 0
                  ? 'ph-warning-circle'
                  : 'ph-shield-check'
              }`}
            />
            <span>
              {invoiceQuery.data.balance_amount > 0
                ? `${money(invoiceQuery.data.balance_amount)} remains outstanding for this invoice.`
                : 'This invoice is fully paid. No payment is currently required.'}
            </span>
          </div>

          {/* Footer Actions */}
          <div className="portal-form-actions">
            <button onClick={onClose} type="button">
              Close
            </button>
            <button
              className="primary"
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
