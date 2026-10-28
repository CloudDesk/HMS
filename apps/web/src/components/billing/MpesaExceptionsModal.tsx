import { useState } from 'react';
import type { MpesaAttemptView } from '../../api/mpesa';
import { useCurrencyFormatter } from '../../api/useSettings';
import { useMpesaExceptions } from '../../hooks/billing/useMpesa';
import { maskMpesaPhone } from '../../utils/mpesa-phone';
import { formatBillingDateTime } from '../../pages/billing-utils';
import { MedicalLoader } from '../ui/MedicalLoader';
import { Modal } from '../ui/Modal';
import { navigate } from '../../routing/navigation';

type MpesaExceptionsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function MpesaExceptionsModal({ open, onClose }: MpesaExceptionsModalProps) {
  const [page, setPage] = useState(1);
  const limit = 10;
  const formatMoney = useCurrencyFormatter();

  const exceptionsQuery = useMpesaExceptions(page, limit, open);
  const data = exceptionsQuery.data?.data ?? [];
  const pagination = exceptionsQuery.data?.pagination;

  const handleOpenInvoice = (invoiceId: string) => {
    onClose();
    navigate(`/billing/workspace?id=${invoiceId}`);
  };

  return (
    <Modal
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {pagination ? (
              <span>
                Showing page {pagination.page} of {Math.max(1, pagination.totalPages)} ({pagination.total} exceptions)
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-secondary"
              disabled={page <= 1 || exceptionsQuery.isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className="btn-secondary"
              disabled={!pagination || page >= pagination.totalPages || exceptionsQuery.isLoading}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              Next
            </button>
            <button className="btn-primary" onClick={onClose} type="button">
              Close
            </button>
          </div>
        </div>
      }
      icon="ph-warning-octagon"
      onClose={onClose}
      open={open}
      size="large"
      title="M-Pesa Payment Exceptions & Manual Review"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#475569' }}>
          Payment attempts where verified funds could not be automatically applied to an invoice (e.g. invoice cancelled, already paid, or amount mismatch). Staff intervention is required for audit and reconciliation.
        </p>

        {exceptionsQuery.isLoading ? (
          <div style={{ padding: '2rem 1rem' }}>
            <MedicalLoader size="medium" text="Loading unresolved exceptions..." subtext="Retrieving pending audit items" />
          </div>
        ) : exceptionsQuery.isError ? (
          <div className="billing-inline-alert error">
            <i className="ph ph-warning-circle" /> Failed to load M-Pesa exceptions.
            <button className="btn-secondary" onClick={() => void exceptionsQuery.refetch()} style={{ marginLeft: '1rem' }} type="button">
              Retry
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="um-state-cell" style={{ padding: '2.5rem 1rem', textAlign: 'center', background: '#f8fafc', borderRadius: '6px' }}>
            <i className="ph ph-check-circle" style={{ fontSize: '2rem', color: '#16a34a', display: 'block', marginBottom: '0.5rem' }} />
            <strong style={{ color: '#0f172a' }}>No Unresolved M-Pesa Exceptions</strong>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
              All verified transactions have either posted successfully or resolved through audit workflows.
            </p>
          </div>
        ) : (
          <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto' }}>
            <table className="data-table billing-table">
              <thead>
                <tr>
                  <th>Attempt / Invoice</th>
                  <th>Amount</th>
                  <th>Phone</th>
                  <th>Receipt</th>
                  <th>Verification</th>
                  <th>Reason / Conflict</th>
                  <th>Date</th>
                  <th aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {data.map((item: MpesaAttemptView) => (
                  <tr key={item.id}>
                    <td>
                      <strong title={item.id}>{item.id.slice(0, 10)}...</strong>
                      <small style={{ display: 'block', color: '#64748b' }}>
                        Inv: {item.invoiceId.slice(0, 10)}...
                      </small>
                    </td>
                    <td>
                      <strong>{formatMoney(item.amount)}</strong>
                    </td>
                    <td>
                      <span>{maskMpesaPhone(item.payerPhoneMasked)}</span>
                    </td>
                    <td>
                      <span>{item.receiptNumber ?? 'Pending'}</span>
                    </td>
                    <td>
                      <span className="billing-status" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>
                        {item.verificationStatus}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 500 }}>
                        {item.conflictingEvidence || item.postingError || item.recoveryStatus}
                      </span>
                    </td>
                    <td>
                      <small>{formatBillingDateTime(item.createdAt)}</small>
                    </td>
                    <td>
                      <button
                        className="btn-secondary"
                        onClick={() => handleOpenInvoice(item.invoiceId)}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                        type="button"
                      >
                        <i className="ph ph-arrow-square-out" /> View Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
