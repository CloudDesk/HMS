import { useEffect, useMemo, useState } from 'react';
import type { BillingInvoice, BillingReceipt } from '../../api/billing';
import type { MpesaAttemptView } from '../../api/mpesa';
import { useCurrencyFormatter } from '../../api/useSettings';
import {
  useCreateMpesaAttempt,
  useMpesaAttempt,
  useMpesaReceipt,
  usePostMpesaPayment,
  useSubmitMpesaAttempt,
  useVerifyMpesaAttempt,
} from '../../hooks/billing/useMpesa';
import { maskMpesaPhone, normalizeMpesaPhone } from '../../utils/mpesa-phone';
import { MedicalLoader, MedicalSpinner } from '../ui/MedicalLoader';
import { Modal } from '../ui/Modal';

type MpesaPaymentModalProps = {
  open: boolean;
  onClose: () => void;
  invoice: BillingInvoice;
  initialAmount?: number;
  onReceiptReady?: (receipt: BillingReceipt) => void;
};

export function MpesaPaymentModal({
  open,
  onClose,
  invoice,
  initialAmount,
  onReceiptReady,
}: MpesaPaymentModalProps) {
  const formatMoney = useCurrencyFormatter();
  const balanceAmount = invoice.balance_amount;

  // Form State
  const [phoneInput, setPhoneInput] = useState('');
  const [amountInput, setAmountInput] = useState<number>(() => {
    const defaultAmount = initialAmount && initialAmount > 0 ? initialAmount : balanceAmount;
    return Math.floor(defaultAmount);
  });
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);

  // Idempotency key preserved per payment session
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  // Phone validation
  const phoneValidation = useMemo(() => normalizeMpesaPhone(phoneInput), [phoneInput]);
  const isAmountValid =
    typeof amountInput === 'number' &&
    !Number.isNaN(amountInput) &&
    amountInput > 0 &&
    amountInput <= balanceAmount &&
    Number.isInteger(amountInput);

  // Attempt Query with bounded polling
  const attemptQuery = useMpesaAttempt(activeAttemptId, { enabled: Boolean(activeAttemptId) && open });
  const attempt: MpesaAttemptView | undefined = attemptQuery.data;

  // Mutations
  const createMutation = useCreateMpesaAttempt();
  const submitMutation = useSubmitMpesaAttempt();
  const verifyMutation = useVerifyMpesaAttempt();
  const postMutation = usePostMpesaPayment();
  const receiptMutation = useMpesaReceipt();

  // Reset form when modal opens with fresh invoice
  useEffect(() => {
    if (open && !activeAttemptId) {
      setAmountInput(Math.floor(balanceAmount));
      setPhoneInput('');
      setPhoneTouched(false);
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [open, balanceAmount, activeAttemptId]);

  // Handle STK Push Submission
  const handleInitiate = async () => {
    if (!phoneValidation.valid || !phoneValidation.normalized || !isAmountValid) return;

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

      setActiveAttemptId(created.id);

      // 2. Submit STK Push
      await submitMutation.mutateAsync({
        attemptId: created.id,
        payload: { expectedVersion: created.version },
      });
    } catch {
      // Errors handled by mutation onError toasts
    }
  };

  // Handle Manual Check / Verify
  const handleVerify = () => {
    if (!activeAttemptId) return;
    verifyMutation.mutate(activeAttemptId);
  };

  // Handle Financial Posting
  const handlePost = async () => {
    if (!activeAttemptId) return;
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
    setActiveAttemptId(null);
    setIdempotencyKey(crypto.randomUUID());
    setPhoneTouched(false);
  };

  // Computed visual status
  const isSubmitting = createMutation.isPending || submitMutation.isPending;
  const isPosting = postMutation.isPending;
  const isVerifying = verifyMutation.isPending;

  // Determine stage and UI feedback
  const renderStatusCard = () => {
    if (!attempt) {
      return (
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <MedicalLoader size="medium" text="Initializing M-Pesa session..." subtext="Setting up payment contract" />
        </div>
      );
    }

    const {
      submissionState,
      reportedOutcome,
      verificationStatus,
      postingStatus,
      receiptNumber,
      conflictingEvidence,
    } = attempt;

    // 1. Successfully Posted
    if (postingStatus === 'POSTED') {
      return (
        <div className="billing-inline-alert" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#166534', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <i className="ph-fill ph-check-circle" style={{ fontSize: '1.5rem', color: '#16a34a' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '1.05rem' }}>Payment Successful & Posted!</strong>
              <small style={{ color: '#15803d' }}>
                Transaction has been committed to the billing ledger. Official HMS receipt generated.
              </small>
            </div>
          </div>
          {receiptNumber && (
            <div style={{ background: '#dcfce7', padding: '0.4rem 0.75rem', borderRadius: '4px', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              <span>M-Pesa Receipt: <strong>{receiptNumber}</strong></span>
            </div>
          )}
        </div>
      );
    }

    // 2. Verified, Ready to Post
    if (verificationStatus === 'VERIFIED') {
      return (
        <div className="billing-inline-alert" style={{ background: '#eff6ff', borderColor: '#93c5fd', color: '#1e40af', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <i className="ph-fill ph-shield-check" style={{ fontSize: '1.5rem', color: '#2563eb' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '1.05rem' }}>Payment Verified with Safaricom</strong>
              <small style={{ color: '#1d4ed8' }}>
                Customer PIN was authorized. Commit the transaction to apply funds to the invoice.
              </small>
            </div>
          </div>
          {receiptNumber && (
            <div style={{ background: '#dbeafe', padding: '0.4rem 0.75rem', borderRadius: '4px', fontSize: '0.85rem' }}>
              <span>Verified Receipt Number: <strong>{receiptNumber}</strong></span>
            </div>
          )}
        </div>
      );
    }

    // 3. Manual Review Required / Conflicting Evidence
    if (
      postingStatus === 'MANUAL_REVIEW_REQUIRED' ||
      verificationStatus === 'CONFLICT' ||
      conflictingEvidence
    ) {
      return (
        <div className="billing-inline-alert error" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <i className="ph-fill ph-warning-circle" style={{ fontSize: '1.5rem', color: '#dc2626' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '1.05rem' }}>Manual Review Required</strong>
              <small>
                {conflictingEvidence === 'INVOICE_ALREADY_PAID'
                  ? 'Invoice was already paid before posting. Customer payment requires audit review or refund.'
                  : conflictingEvidence === 'INVOICE_CANCELLED_WHILE_PAYMENT_VERIFIED'
                  ? 'Invoice was cancelled. Payment requires supervisor review.'
                  : conflictingEvidence === 'PAYMENT_EXCEEDS_BALANCE'
                  ? 'Payment amount exceeds remaining invoice balance.'
                  : 'Transaction evidence requires manual staff review before ledger posting.'}
              </small>
            </div>
          </div>
        </div>
      );
    }

    // 4. Cancelled or Failed by Provider
    if (
      submissionState === 'REJECTED' ||
      reportedOutcome === 'FAILED' ||
      reportedOutcome === 'CANCELLED' ||
      verificationStatus === 'FAILED'
    ) {
      return (
        <div className="billing-inline-alert error" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <i className="ph-fill ph-x-circle" style={{ fontSize: '1.5rem', color: '#dc2626' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '1.05rem' }}>
                {reportedOutcome === 'CANCELLED'
                  ? 'Payment Cancelled by Customer'
                  : 'Payment Failed or Rejected'}
              </strong>
              <small>
                {reportedOutcome === 'CANCELLED'
                  ? 'The user cancelled the STK push prompt on their mobile device.'
                  : attempt.submissionError || 'The transaction could not be completed.'}
              </small>
            </div>
          </div>
        </div>
      );
    }

    // 5. Uncertain / Timeout
    if (reportedOutcome === 'TIMEOUT' || verificationStatus === 'UNRESOLVED' || submissionState === 'UNKNOWN') {
      return (
        <div className="billing-inline-alert" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <i className="ph-fill ph-clock-countdown" style={{ fontSize: '1.5rem', color: '#d97706' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '1.05rem' }}>Transaction Status Uncertain</strong>
              <small>
                The transaction timed out or provider status is still pending. Use "Check Status" to re-query Safaricom.
              </small>
            </div>
          </div>
        </div>
      );
    }

    // 6. Waiting for Customer PIN Entry / Callback
    return (
      <div className="billing-inline-alert" style={{ background: '#f8fafc', borderColor: '#cbd5e1', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <MedicalSpinner size="md" />
          <div>
            <strong style={{ display: 'block', fontSize: '1.05rem', color: '#0f172a' }}>
              STK Push Sent — Awaiting Customer PIN
            </strong>
            <small style={{ color: '#475569' }}>
              Please ask the customer to check their mobile phone (<strong>{maskMpesaPhone(phoneValidation.normalized || phoneInput)}</strong>) and enter their M-Pesa PIN.
            </small>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} type="button">
            {attempt?.postingStatus === 'POSTED' ? 'Close' : 'Dismiss'}
          </button>

          {!activeAttemptId ? (
            <button
              className="btn-primary"
              disabled={isSubmitting || !phoneValidation.valid || !isAmountValid}
              onClick={handleInitiate}
              type="button"
            >
              {isSubmitting ? (
                <>
                  <MedicalSpinner size="sm" />
                  <span>Sending STK Push...</span>
                </>
              ) : (
                <>
                  <i className="ph ph-device-mobile" />
                  <span>Send STK Push</span>
                </>
              )}
            </button>
          ) : (
            <>
              {/* If verified and ready to post */}
              {attempt?.verificationStatus === 'VERIFIED' && attempt?.postingStatus !== 'POSTED' && (
                <button
                  className="btn-primary"
                  disabled={isPosting}
                  onClick={handlePost}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                  type="button"
                >
                  {isPosting ? (
                    <>
                      <MedicalSpinner size="sm" />
                      <span>Posting to Ledger...</span>
                    </>
                  ) : (
                    <>
                      <i className="ph ph-check" />
                      <span>Post Payment to Invoice</span>
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
              {attempt?.postingStatus !== 'POSTED' &&
                attempt?.submissionState === 'PENDING' &&
                attempt?.verificationStatus !== 'VERIFIED' && (
                  <button
                    className="btn-secondary"
                    disabled={isVerifying || attemptQuery.isFetching}
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
                        <span>Check Status</span>
                      </>
                    )}
                  </button>
                )}

              {/* If failed or cancelled, offer retry */}
              {(attempt?.reportedOutcome === 'FAILED' ||
                attempt?.reportedOutcome === 'CANCELLED' ||
                attempt?.submissionState === 'REJECTED' ||
                attempt?.verificationStatus === 'FAILED') && (
                <button className="btn-secondary" onClick={handleReset} type="button">
                  <i className="ph ph-arrow-counter-clockwise" />
                  <span>Try Again</span>
                </button>
              )}
            </>
          )}
        </>
      }
      icon="ph-device-mobile"
      onClose={onClose}
      open={open}
      size="default"
      title={activeAttemptId ? 'M-Pesa Payment Status' : 'Initiate M-Pesa STK Push'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.75rem', fontSize: '0.85rem', color: '#166534' }}>
              <i className="ph-fill ph-info" style={{ marginRight: '0.4rem' }} />
              An STK Push prompt will be dispatched directly to the customer's Safaricom phone requesting them to authorize payment with their M-Pesa PIN.
            </div>

            <label>
              <span>Amount (KES) *</span>
              <input
                disabled={isSubmitting}
                max={balanceAmount}
                min={1}
                onChange={(e) => setAmountInput(Math.floor(Number(e.target.value)))}
                placeholder="Enter whole KES amount"
                step={1}
                type="number"
                value={amountInput || ''}
              />
              {!isAmountValid && (
                <small style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                  {amountInput > balanceAmount
                    ? `Amount cannot exceed outstanding balance of ${formatMoney(balanceAmount)}.`
                    : 'Enter a valid whole amount greater than zero.'}
                </small>
              )}
            </label>

            <label>
              <span>Customer Mobile Number *</span>
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

            {attempt && (
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.85rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Transaction Overview
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.85rem' }}>
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
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
