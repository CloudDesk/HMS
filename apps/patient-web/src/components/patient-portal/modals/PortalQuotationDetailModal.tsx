import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '../../ui/Modal';
import {
  patientPortalApi,
  type PortalDentalQuotation,
  type PortalDentalQuotationOption,
} from '../../../api/patient-portal';
import { portalQueryKeys } from '../../../api/query-keys';
import { date, label, money } from '../../../utils/formatters';
import { downloadPortalDentalQuotationPdf } from '../../../utils/dental-pdf';

type PortalQuotationDetailModalProps = {
  quotation: PortalDentalQuotation | null;
  patientId: string;
  onClose: () => void;
};

function formatDoctorName(name?: string) {
  if (!name) return 'Dentist';
  const trimmed = name.trim();
  if (/^dr\.?\s+/i.test(trimmed)) {
    return trimmed;
  }
  return `Dr. ${trimmed}`;
}

export function PortalQuotationDetailModal({
  quotation,
  patientId,
  onClose,
}: PortalQuotationDetailModalProps) {
  const queryClient = useQueryClient();
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [decisionMode, setDecisionMode] = useState<'view' | 'reject' | 'postpone'>('view');
  const [reasonInput, setReasonInput] = useState<string>('');

  const activeQuotation = quotation;

  // Initialize selected option if not set
  const options = activeQuotation?.options ?? [];
  const defaultSelectedOptionId =
    selectedOptionId ||
    activeQuotation?.selected_option_id ||
    options[0]?.id ||
    '';

  const currentOptionId = selectedOptionId || defaultSelectedOptionId;

  const acceptMutation = useMutation({
    mutationFn: (selectedOptId: string) =>
      patientPortalApi.acceptDentalQuotation(activeQuotation!.id, {
        selected_option_id: selectedOptId,
      }),
    onSuccess: async (updated) => {
      toast.success(`Treatment Quotation ${updated.quotation_number} accepted successfully.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: portalQueryKeys.dentalQuotations(patientId) }),
        queryClient.invalidateQueries({ queryKey: ['patient-portal-overview'] }),
      ]);
      onClose();
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || 'Failed to accept quotation.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) =>
      patientPortalApi.rejectDentalQuotation(activeQuotation!.id, {
        reason: reason || undefined,
      }),
    onSuccess: async (updated) => {
      toast.success(`Treatment Quotation ${updated.quotation_number} declined.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: portalQueryKeys.dentalQuotations(patientId) }),
        queryClient.invalidateQueries({ queryKey: ['patient-portal-overview'] }),
      ]);
      onClose();
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || 'Failed to decline quotation.');
    },
  });

  const postponeMutation = useMutation({
    mutationFn: (reason: string) =>
      patientPortalApi.postponeDentalQuotation(activeQuotation!.id, {
        reason: reason || undefined,
      }),
    onSuccess: async (updated) => {
      toast.success(`Treatment Quotation ${updated.quotation_number} decision postponed.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: portalQueryKeys.dentalQuotations(patientId) }),
        queryClient.invalidateQueries({ queryKey: ['patient-portal-overview'] }),
      ]);
      onClose();
    },
    onError: (err: { message?: string }) => {
      toast.error(err.message || 'Failed to postpone quotation.');
    },
  });

  if (!activeQuotation) return null;

  const canRespond =
    activeQuotation.status === 'SENT' || activeQuotation.status === 'POSTPONED';

  const statusLabel =
    activeQuotation.status === 'SENT'
      ? 'Pending Your Decision'
      : activeQuotation.status === 'ACCEPTED'
        ? 'Accepted'
        : activeQuotation.status === 'REJECTED'
          ? 'Declined'
          : activeQuotation.status === 'POSTPONED'
            ? 'Decision Postponed'
            : label(activeQuotation.status);

  const statusClass =
    activeQuotation.status === 'SENT'
      ? 'blue'
      : activeQuotation.status === 'ACCEPTED'
        ? 'active'
        : activeQuotation.status === 'REJECTED'
          ? 'cancelled'
          : 'scheduled';

  const handleDownload = () => {
    if (!activeQuotation) return;
    downloadPortalDentalQuotationPdf({
      quotation: activeQuotation,
      patientId,
    });
  };

  const modalFooter = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        gap: '1rem',
      }}
    >
      <div>
        {canRespond && decisionMode === 'view' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => {
                setDecisionMode('postpone');
                setReasonInput('');
              }}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#475569',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <i className="ph ph-clock" /> Decide Later
            </button>
            <button
              type="button"
              onClick={() => {
                setDecisionMode('reject');
                setReasonInput('');
              }}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                background: '#fef2f2',
                color: '#dc2626',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <i className="ph ph-x-circle" /> Decline
            </button>
          </div>
        )}
        {decisionMode !== 'view' && (
          <button
            type="button"
            onClick={() => setDecisionMode('view')}
            style={{
              padding: '0.5rem 0.85rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={handleDownload}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.55rem 0.85rem',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Download quotation PDF"
        >
          <i className="ph ph-file-pdf" />
          Download PDF
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            color: '#334155',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Close
        </button>

        {canRespond && decisionMode === 'view' && (
          <button
            type="button"
            disabled={!currentOptionId || acceptMutation.isPending}
            onClick={() => {
              if (currentOptionId) {
                acceptMutation.mutate(currentOptionId);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.55rem 1.15rem',
              borderRadius: '6px',
              border: 'none',
              background: '#16a34a',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: currentOptionId && !acceptMutation.isPending ? 'pointer' : 'not-allowed',
              opacity: currentOptionId && !acceptMutation.isPending ? 1 : 0.6,
            }}
          >
            <i className="ph ph-check-circle" />
            {acceptMutation.isPending ? 'Accepting…' : 'Accept Selected Option'}
          </button>
        )}

        {decisionMode === 'reject' && (
          <button
            type="button"
            disabled={rejectMutation.isPending}
            onClick={() => rejectMutation.mutate(reasonInput.trim())}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.55rem 1.15rem',
              borderRadius: '6px',
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: !rejectMutation.isPending ? 'pointer' : 'not-allowed',
            }}
          >
            <i className="ph ph-x-circle" />
            {rejectMutation.isPending ? 'Declining…' : 'Confirm Decline'}
          </button>
        )}

        {decisionMode === 'postpone' && (
          <button
            type="button"
            disabled={postponeMutation.isPending}
            onClick={() => postponeMutation.mutate(reasonInput.trim())}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.55rem 1.15rem',
              borderRadius: '6px',
              border: 'none',
              background: '#475569',
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: !postponeMutation.isPending ? 'pointer' : 'not-allowed',
            }}
          >
            <i className="ph ph-clock" />
            {postponeMutation.isPending ? 'Saving…' : 'Confirm Postpone'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      footer={modalFooter}
      icon="ph-tooth"
      onClose={onClose}
      open={Boolean(activeQuotation)}
      size="large"
      title="Dental Treatment Quotation"
    >
      <div className="portal-invoice-details">
        {/* Header Summary */}
        <div className="portal-invoice-header-summary">
          <div>
            <small>{formatDoctorName(activeQuotation.doctor_name)} · Dental Department</small>
            <h2>{activeQuotation.quotation_number}</h2>
            <span>
              <i className="ph ph-calendar-blank" /> Date:{' '}
              {date(activeQuotation.sent_at || activeQuotation.created_at)} · Patient:{' '}
              <strong>{activeQuotation.patient_name}</strong> ({activeQuotation.patient_number})
            </span>
          </div>
          <span className={`portal-status ${statusClass}`}>{statusLabel}</span>
        </div>

        {/* Notes if any */}
        {activeQuotation.notes && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#334155',
            }}
          >
            <strong>Clinical Note:</strong> {activeQuotation.notes}
          </div>
        )}

        {/* Accepted Banner */}
        {activeQuotation.status === 'ACCEPTED' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.85rem 1.15rem',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              color: '#065f46',
            }}
          >
            <i className="ph ph-check-circle" style={{ fontSize: '1.4rem', color: '#059669' }} />
            <div>
              <strong style={{ display: 'block', fontSize: '0.92rem' }}>
                Quotation Accepted: {activeQuotation.selected_option_name || 'Selected Option'}
              </strong>
              <small style={{ color: '#047857' }}>
                Accepted on {date(activeQuotation.accepted_at || activeQuotation.updated_at)}. Your clinical treatment plan has been confirmed.
              </small>
            </div>
          </div>
        )}

        {/* Treatment Options Header */}
        <div style={{ marginTop: '0.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>
            {options.length > 1 ? `Available Treatment Options (${options.length})` : 'Treatment Plan Details'}
          </h3>
          {canRespond && options.length > 1 && (
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 1rem' }}>
              Please review the treatment options below and select the plan that best matches your healthcare preferences.
            </p>
          )}
        </div>

        {/* Treatment Options List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {options.map((option: PortalDentalQuotationOption) => {
            const isSelected = currentOptionId === option.id;
            const isAccepted =
              activeQuotation.status === 'ACCEPTED' &&
              activeQuotation.selected_option_id === option.id;

            return (
              <div
                key={option.id || option.name}
                onClick={() => {
                  if (canRespond && option.id) {
                    setSelectedOptionId(option.id);
                  }
                }}
                style={{
                  border: isAccepted
                    ? '2px solid #059669'
                    : isSelected && canRespond
                      ? '2px solid #2563eb'
                      : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  background: isAccepted
                    ? '#f0fdf4'
                    : isSelected && canRespond
                      ? '#eff6ff'
                      : '#ffffff',
                  padding: '1.15rem',
                  cursor: canRespond ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                {/* Option Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    {canRespond && (
                      <input
                        type="radio"
                        name="quotation-option-selection"
                        checked={isSelected}
                        onChange={() => {
                          if (option.id) setSelectedOptionId(option.id);
                        }}
                        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      />
                    )}
                    <div>
                      <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{option.name}</strong>
                      {option.description && (
                        <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                          {option.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {isAccepted ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '999px',
                          background: '#dcfce7',
                          color: '#15803d',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                        }}
                      >
                        <i className="ph ph-check" /> Accepted Option
                      </span>
                    ) : (
                      <strong style={{ fontSize: '1.15rem', color: '#0f172a' }}>
                        {money(option.total)}
                      </strong>
                    )}
                  </div>
                </div>

                {/* Items Table */}
                <div className="portal-invoice-table-wrap" style={{ margin: '0.5rem 0' }}>
                  <table className="portal-invoice-table">
                    <thead>
                      <tr>
                        <th>Procedure</th>
                        <th>Tooth / Site</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Unit Price</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {option.items.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td>
                            <strong>{item.procedure_name}</strong>
                            {item.notes && (
                              <small style={{ display: 'block', color: '#64748b' }}>
                                {item.notes}
                              </small>
                            )}
                          </td>
                          <td>
                            {item.tooth_number ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '6px',
                                  background: '#f1f5f9',
                                  color: '#334155',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                }}
                              >
                                Tooth #{item.tooth_number}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>General</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ textAlign: 'right' }}>{money(item.unit_price)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <strong>{money(item.line_total)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Option Financial Summary */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '1.5rem',
                    paddingTop: '0.5rem',
                    fontSize: '0.85rem',
                    borderTop: '1px dashed #e2e8f0',
                  }}
                >
                  {option.discount_amount > 0 && (
                    <span style={{ color: '#16a34a' }}>
                      Discount: -{money(option.discount_amount)}
                    </span>
                  )}
                  {option.tax_amount > 0 && (
                    <span style={{ color: '#64748b' }}>
                      Tax: +{money(option.tax_amount)}
                    </span>
                  )}
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    Option Total: {money(option.total)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Decline / Postpone Reason Inputs */}
        {decisionMode === 'reject' && (
          <div
            style={{
              padding: '1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              marginTop: '0.5rem',
            }}
          >
            <label style={{ display: 'block', color: '#991b1b', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
              Reason for declining (Optional)
            </label>
            <input
              type="text"
              className="portal-input"
              placeholder="e.g. Exploring alternative dental options or seeking second opinion"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #fca5a5',
                fontSize: '0.85rem',
              }}
            />
          </div>
        )}

        {decisionMode === 'postpone' && (
          <div
            style={{
              padding: '1rem',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              marginTop: '0.5rem',
            }}
          >
            <label style={{ display: 'block', color: '#334155', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
              Postponement Note (Optional)
            </label>
            <input
              type="text"
              className="portal-input"
              placeholder="e.g. Pending insurance pre-authorization or family discussion"
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
