import { useEffect, useMemo, useState } from 'react';
import type { BillingInvoice, BillingReceipt } from '../../api/billing';
import type { MpesaAttemptView } from '../../api/mpesa';
import { useCurrencyFormatter } from '../../api/useSettings';
import {
  useCreateMpesaAttempt,
  useMpesaAttempt,
  useMpesaInvoiceAttempts,
  useMpesaReceipt,
  usePostMpesaPayment,
  useSubmitMpesaAttempt,
  useVerifyMpesaAttempt,
} from '../../hooks/billing/useMpesa';
import { maskMpesaPhone, normalizeMpesaPhone } from '../../utils/mpesa-phone';
import { mpesaRecovery } from '../../utils/mpesa-recovery';
import { mpesaAmountError, mpesaPaymentSummary } from '../../utils/mpesa-presentation';
import { formatBillingDateTime } from '../../pages/billing-utils';
import { MedicalLoader, MedicalSpinner } from '../ui/MedicalLoader';
import { Modal } from '../ui/Modal';

type MpesaPaymentModalProps = {
  open: boolean;
  onClose: () => void;
  invoice: BillingInvoice;
  initialAmount?: number;
  initialPhone?: string;
  autoSubmit?: boolean;
  onReceiptReady?: (receipt: BillingReceipt) => void;
  canCollectPayment: boolean;
  initialAttemptId?: string;
};

export function MpesaPaymentModal({
  open,
  onClose,
  invoice,
  initialAmount,
  initialPhone,
  autoSubmit,
  onReceiptReady,
  canCollectPayment,
  initialAttemptId,
}: MpesaPaymentModalProps) {
  const formatMoney = useCurrencyFormatter();
  const balanceAmount = invoice.balance_amount;

  // Form State
  const [phoneInput, setPhoneInput] = useState(() => initialPhone ?? '');
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    try {
      await attemptQuery.refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  };
  const [amountInput, setAmountInput] = useState<number>(() => {
    const defaultAmount = initialAmount && initialAmount > 0 ? initialAmount : balanceAmount;
    return defaultAmount;
  });
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(initialAttemptId ?? null);
  const [dismissedAttemptId, setDismissedAttemptId] = useState<string | null>(null);
  const invoiceAttempts = useMpesaInvoiceAttempts(invoice.id, open);
  const latestAttempt = invoiceAttempts.data?.items[0];
  const activeAttemptId = selectedAttemptId ?? (latestAttempt?.id !== dismissedAttemptId ? latestAttempt?.id ?? null : null);
  const historyReady = invoiceAttempts.isSuccess && !invoiceAttempts.isFetching;

  // Idempotency key preserved per payment session
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  // Phone validation
  const phoneValidation = useMemo(() => normalizeMpesaPhone(phoneInput), [phoneInput]);
  const amountError = mpesaAmountError(amountInput, balanceAmount);
  const isAmountValid = amountError === null;

  // Attempt Query with bounded polling
  const attemptQuery = useMpesaAttempt(activeAttemptId, { enabled: Boolean(activeAttemptId) && open });
  const attempt: MpesaAttemptView | undefined = attemptQuery.data?.invoiceId === invoice.id ? attemptQuery.data : undefined;
  const recovery = attempt ? mpesaRecovery(attempt) : null;

  // Mutations
  const createMutation = useCreateMpesaAttempt();
  const submitMutation = useSubmitMpesaAttempt();
  const verifyMutation = useVerifyMpesaAttempt();
  const postMutation = usePostMpesaPayment();
  const receiptMutation = useMpesaReceipt();

  // Reset form when modal opens with fresh invoice
  useEffect(() => {
    if (open && !activeAttemptId) {
      const defaultAmount = initialAmount && initialAmount > 0 ? initialAmount : balanceAmount;
      setAmountInput(defaultAmount);
      setPhoneInput(initialPhone ?? '');
      setPhoneTouched(Boolean(initialPhone));
      setIdempotencyKey(crypto.randomUUID());
      setAutoSubmitted(false);
    }
  }, [open, balanceAmount, activeAttemptId, initialAmount, initialPhone]);

  // Handle STK Push Submission
  const handleInitiate = async () => {
    if (!canCollectPayment || !historyReady || activeAttemptId || !phoneValidation.valid || !phoneValidation.normalized || !isAmountValid) return;

    try {
      // 1. Create Attempt
      const created = await createMutation.mutateAsync({
        invoiceId: invoice.id,
        payload: {
          amount: amountInput,
          payerPhone: phoneValidation.normalized,
          idempotencyKey,
        },
      });

      setSelectedAttemptId(created.id);

      // 2. Submit STK Push
      await submitMutation.mutateAsync({
        attemptId: created.id,
        payload: { expectedVersion: created.version },
      });
    } catch {
      // Errors handled by mutation onError toasts
    }
  };

  // Auto-dispatch STK Push if triggered directly from Collect Payment with valid phone
  useEffect(() => {
    if (
      open &&
      autoSubmit &&
      !autoSubmitted &&
      !activeAttemptId &&
      historyReady &&
      canCollectPayment &&
      phoneValidation.valid &&
      phoneValidation.normalized &&
      isAmountValid &&
      !createMutation.isPending &&
      !submitMutation.isPending
    ) {
      setAutoSubmitted(true);
      void handleInitiate();
    }
  }, [open, autoSubmit, autoSubmitted, activeAttemptId, historyReady, canCollectPayment, phoneValidation, isAmountValid, createMutation.isPending, submitMutation.isPending]);

  // Handle Manual Check / Verify
  const handleVerify = () => {
    if (!activeAttemptId || !canCollectPayment || !recovery?.canVerify) return;
    verifyMutation.mutate(activeAttemptId);
  };

  const handleSubmitSaved = () => {
    if (!attempt || !canCollectPayment || attemptQuery.isError || attempt.submissionState !== 'CREATED' || recovery?.review) return;
    submitMutation.mutate({ attemptId: attempt.id, payload: { expectedVersion: attempt.version } });
  };

  // Handle Financial Posting
  const handlePost = async () => {
    if (!activeAttemptId || !canCollectPayment || !recovery?.canPost) return;
    try {
      await postMutation.mutateAsync(activeAttemptId);
    } catch {
      // Handled by mutation onError toast
    }
  };

  // Handle View Receipt
  const handleViewReceipt = async () => {
    if (!activeAttemptId) return;
    try {
      const rec = await receiptMutation.mutateAsync(activeAttemptId);
      if (onReceiptReady) {
        onReceiptReady(rec);
      }
    } catch {
      // Handled by mutation onError toast
    }
  };

  // Handle Reset / Retry
  const handleReset = () => {
    if ((!recovery?.canRetry && !(recovery?.posted && !recovery.review && balanceAmount > 0)) || !canCollectPayment) return;
    setDismissedAttemptId(activeAttemptId);
    setSelectedAttemptId(null);
    setIdempotencyKey(crypto.randomUUID());
    setPhoneTouched(false);
  };

  // Computed visual status
  const isSubmitting = createMutation.isPending || submitMutation.isPending;
  const isPosting = postMutation.isPending;
  const isVerifying = verifyMutation.isPending;

  // Determine stage and UI feedback
  const renderStatusCard = () => {
    if (attemptQuery.data && !attempt) {
      return <div className="billing-inline-alert error">This attempt does not belong to the displayed invoice. No payment action is available.</div>;
    }
    if (attemptQuery.isError) {
      return <div className="billing-inline-alert error">Could not refresh payment status. Do not send another payment request.
        <button className="btn-secondary" onClick={() => void attemptQuery.refetch()} type="button">Refresh Status</button>
      </div>;
    }
    if (!attempt) {
      return (
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <MedicalLoader size="medium" text="Initializing M-Pesa session..." subtext="Setting up payment contract" />
        </div>
      );
    }

    const summary = mpesaPaymentSummary(attempt);
    return (
      <div className={`billing-inline-alert mpesa-outcome mpesa-outcome-${summary.tone}`} role="status" aria-live="polite">
        <strong>{summary.title}</strong>
        <p>{summary.message}</p>
      </div>
    );
  };

  return (
    <Modal
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} type="button">
            Close
          </button>

          {!activeAttemptId ? (
            <button
              className="btn-primary"
              disabled={!canCollectPayment || !historyReady || isSubmitting || !phoneValidation.valid || !isAmountValid}
              onClick={handleInitiate}
              type="button"
            >
              {isSubmitting ? (
                <>
                  <MedicalSpinner size="sm" />
                  <span>Sending payment request...</span>
                </>
              ) : (
                <>
                  <i className="ph ph-device-mobile" />
                  <span>Send payment request</span>
                </>
              )}
            </button>
          ) : (
            <>
              {canCollectPayment && !attemptQuery.isError && attempt?.submissionState === 'CREATED' && !recovery?.review && (
                <button className="btn-primary" disabled={isSubmitting || attemptQuery.isFetching} onClick={handleSubmitSaved} type="button">Send saved payment request</button>
              )}
              {/* If verified and ready to post */}
              {canCollectPayment && recovery?.canPost && (
                <button
                  className="btn-primary"
                  disabled={isPosting || attemptQuery.isError || isManualRefreshing}
                  onClick={handlePost}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  type="button"
                >
                  {isPosting ? (
                    <>
                      <MedicalSpinner size="sm" />
                      <span>Applying payment...</span>
                    </>
                  ) : (
                    <>
                      <i className="ph ph-check" />
                      <span>Apply confirmed payment</span>
                    </>
                  )}
                </button>
              )}

              {/* If posted, offer Receipt */}
              {attempt?.postingStatus === 'POSTED' && (
                <button
                  className="btn-primary"
                  disabled={receiptMutation.isPending}
                  onClick={handleViewReceipt}
                  type="button"
                >
                  <i className="ph ph-receipt" />
                  <span>View Official Receipt</span>
                </button>
              )}

              {/* If in progress or uncertain, allow manual verify check */}
              {canCollectPayment && recovery?.canVerify && (
                  <button
                    className="btn-secondary"
                    disabled={isVerifying || isManualRefreshing}
                    onClick={handleVerify}
                    type="button"
                  >
                    {isVerifying ? (
                      <>
                        <MedicalSpinner size="sm" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <i className="ph ph-arrows-clockwise" />
                        <span>Check with Safaricom</span>
                      </>
                    )}
                  </button>
                )}

              {/* If failed or cancelled, offer retry */}
              {canCollectPayment && recovery?.canRetry && (
                <button className="btn-secondary" onClick={handleReset} type="button">
                  <i className="ph ph-arrow-counter-clockwise" />
                  <span>Start new payment request</span>
                </button>
              )}
              {canCollectPayment && recovery?.posted && !recovery.review && balanceAmount > 0 && (
                <button className="btn-secondary" onClick={handleReset} type="button">New Payment for Remaining Balance</button>
              )}
            </>
          )}
        </>
      }
      icon="ph-device-mobile"
      className="mpesa-payment-modal"
      onClose={onClose}
      open={open}
      size="default"
      title={activeAttemptId ? 'M-Pesa Payment Status' : 'Request M-Pesa payment'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {invoiceAttempts.isError && <div className="billing-inline-alert error">Could not load existing payment attempts. Creating another attempt is disabled.
          <button className="btn-secondary" onClick={() => void invoiceAttempts.refetch()} type="button">Reload Attempts</button>
        </div>}
        {invoiceAttempts.isLoading && <MedicalLoader size="medium" text="Checking existing payment attempts..." />}
        {!canCollectPayment && <div className="billing-inline-alert">You do not have permission to collect payments.</div>}
        {/* Invoice Summary Banner */}
        <div className="billing-payment-summary" style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '6px' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Invoice Number</span>
            <strong style={{ display: 'block', fontSize: '1rem' }}>{invoice.invoice_number}</strong>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Outstanding Balance</span>
            <strong style={{ display: 'block', fontSize: '1rem', color: '#0f172a' }}>
              {formatMoney(balanceAmount)}
            </strong>
          </div>
        </div>

        {!activeAttemptId ? (
          /* Form Entry Mode */
          <div className="billing-modal-form">
            <div
              className="billing-mpesa-info-banner"
              style={{
                gridColumn: '1 / -1',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                color: '#166534',
                marginBottom: '0.25rem',
              }}
            >
              <i className="ph-fill ph-device-mobile" style={{ fontSize: '1.4rem', color: '#16a34a', marginTop: '1px', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', lineHeight: '1.45' }}>
                <strong style={{ display: 'block', color: '#14532d', marginBottom: '0.15rem' }}>
                  Pay using M-Pesa
                </strong>
                <span>
                  We will request payment from this number. If the Safaricom prompt appears, the customer checks the merchant and amount and enters their PIN on their own phone. Never enter or share the PIN in HMS.
                </span>
              </div>
            </div>

            <label>
              <span>Amount (KES) <span className="mpesa-required">*</span></span>
              <input
                disabled={isSubmitting}
                max={Math.min(balanceAmount, 250000)}
                min={1}
                onChange={(e) => setAmountInput(e.target.value === '' ? Number.NaN : Number(e.target.value))}
                placeholder="Enter whole KES amount"
                step={1}
                type="number"
                value={Number.isNaN(amountInput) ? '' : amountInput}
                aria-invalid={!isAmountValid}
                aria-describedby="mpesa-amount-error"
              />
              {!isAmountValid && (
                <small id="mpesa-amount-error" role="alert" style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {amountError}
                </small>
              )}
            </label>

            <label>
              <span>Customer Mobile Number <span className="mpesa-required">*</span></span>
              <input
                disabled={isSubmitting}
                onBlur={() => setPhoneTouched(true)}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="e.g. 0712 345 678 or 0112 345 678"
                type="tel"
                value={phoneInput}
              />
              {phoneValidation.valid && phoneValidation.normalized ? (
                <span style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: '0.25rem', display: 'block' }}>
                  ✓ Standardized format: <strong>{phoneValidation.normalized}</strong>
                </span>
              ) : phoneTouched && phoneValidation.error ? (
                <small style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {phoneValidation.error}
                </small>
              ) : (
                <small style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  Accepts 07..., 01..., 2547..., or +254... formats.
                </small>
              )}
            </label>
          </div>
        ) : (
          /* Active Transaction Tracking Mode */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {renderStatusCard()}

            {attempt && <div className="mpesa-request-summary">
              <div><span>Requested amount</span><strong>{formatMoney(attempt.amount)}</strong></div>
              <div><span>Customer phone</span><strong>{maskMpesaPhone(attempt.payerPhoneMasked)}</strong></div>
            </div>}

            {attempt && (
              <details className="mpesa-transaction-details">
                <summary>Transaction details</summary>
                <div className="mpesa-details-grid">
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Amount</span>
                    <strong>{formatMoney(attempt.amount)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Phone</span>
                    <strong>{maskMpesaPhone(attempt.payerPhoneMasked)}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Submission</span>
                    <span className="billing-status" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>
                      {attempt.submissionState}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Verification</span>
                    <span className="billing-status" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>
                      {attempt.verificationStatus}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Posting Status</span>
                    <span className="billing-status" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>
                      {attempt.postingStatus}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Safaricom Receipt</span>
                    <strong>{attempt.receiptNumber ?? '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Recovery</span>
                    <strong>{attempt.recoveryStatus.replaceAll('_', ' ')}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block' }}>Next Reconciliation Due</span>
                    <strong>{attempt.nextReconciliationAt ? formatBillingDateTime(attempt.nextReconciliationAt) : '—'}</strong>
                  </div>
                </div>
                {attempt.conflictingEvidence && <p>Support code: <code>{attempt.conflictingEvidence}</code></p>}
                <p>Refresh reloads HMS’s saved record. “Check with Safaricom” requests an updated provider result.</p>
                <button className="btn-secondary" disabled={isManualRefreshing || isVerifying} onClick={() => void handleManualRefresh()} type="button">
                  {isManualRefreshing ? 'Refreshing saved record...' : 'Refresh HMS record'}
                </button>
              </details>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
