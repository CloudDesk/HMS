import React, { useState, useEffect } from 'react';
import type {
  DentalLabOrderStatus,
  DentalTreatmentStageResponse,
  ProstheticType,
} from '../../../api/opd';
import {
  useCreateDentalLabOrder,
  useDentalLabOrder,
  useUpdateDentalLabOrderStatus,
} from '../../../hooks/opd/useOpd';
import styles from './DentalProstheticLab.module.css';

interface DentalProstheticLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  stage?: DentalTreatmentStageResponse | null;
  patientId?: string | null;
  existingOrderId?: string | null;
  readOnly?: boolean;
}

const ORDER_LIFECYCLE_STEPS: { status: DentalLabOrderStatus; label: string; icon: string }[] = [
  { status: 'ORDERED', label: 'Ordered', icon: 'ph-paper-plane-tilt' },
  { status: 'RECEIVED', label: 'Received', icon: 'ph-tray' },
  { status: 'IN_PROGRESS', label: 'In Progress', icon: 'ph-gear' },
  { status: 'QUALITY_CHECK', label: 'Quality Check', icon: 'ph-shield-check' },
  { status: 'READY', label: 'Ready', icon: 'ph-check-circle' },
];

export const DentalProstheticLabModal: React.FC<DentalProstheticLabModalProps> = ({
  isOpen,
  onClose,
  stage,
  patientId,
  existingOrderId,
  readOnly = false,
}) => {
  const isViewingExisting = Boolean(existingOrderId);
  const { data: existingOrder, isLoading: orderLoading } = useDentalLabOrder(
    existingOrderId,
    isOpen && isViewingExisting,
  );

  const [prostheticType, setProstheticType] = useState<ProstheticType>('CROWN');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<DentalLabOrderStatus>('ORDERED');
  const [toothNumber, setToothNumber] = useState<string>('');

  // Status transition state
  const [transitionRemarks, setTransitionRemarks] = useState('');
  const [showCancelBox, setShowCancelBox] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  const createOrderMutation = useCreateDentalLabOrder();
  const updateStatusMutation = useUpdateDentalLabOrderStatus();

  useEffect(() => {
    if (isOpen && !isViewingExisting && stage) {
      setToothNumber(stage.tooth_number ? String(stage.tooth_number) : '');
      setDescription(`Lab order for Stage ${stage.sequence}: ${stage.stage_name}`);
      setProstheticType('CROWN');
      setStatus('ORDERED');
    }
  }, [isOpen, isViewingExisting, stage]);

  useEffect(() => {
    if (!isOpen) {
      setShowCancelBox(false);
      setTransitionRemarks('');
      setCancellationReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stage || !stage.episode_id) return;

    const resolvedPatientId = stage.patient_id || patientId;
    if (!resolvedPatientId) return;

    const parsedTooth = toothNumber.trim() ? parseInt(toothNumber.trim(), 10) : stage.tooth_number ?? null;

    await createOrderMutation.mutateAsync({
      patient_id: resolvedPatientId,
      treatment_episode_id: stage.episode_id,
      treatment_stage_id: stage.id,
      treatment_plan_item_id: stage.plan_item_id || null,
      tooth_number: parsedTooth && Number.isFinite(parsedTooth) ? parsedTooth : null,
      prosthetic_type: prostheticType,
      description: description.trim(),
      status,
    });

    onClose();
  };

  const handleAdvanceStatus = async (nextStatus: DentalLabOrderStatus) => {
    if (!existingOrder) return;
    await updateStatusMutation.mutateAsync({
      orderId: existingOrder.id,
      payload: {
        status: nextStatus,
        remarks: transitionRemarks.trim() || undefined,
      },
    });
    setTransitionRemarks('');
  };

  const handleConfirmCancel = async () => {
    if (!existingOrder || !cancellationReason.trim()) return;
    await updateStatusMutation.mutateAsync({
      orderId: existingOrder.id,
      payload: {
        status: 'CANCELLED',
        cancellation_reason: cancellationReason.trim(),
        remarks: transitionRemarks.trim() || undefined,
      },
    });
    setShowCancelBox(false);
    setCancellationReason('');
    setTransitionRemarks('');
  };

  const getStatusBadgeClass = (s: DentalLabOrderStatus) => {
    switch (s) {
      case 'ORDERED':
        return styles.badgeOrdered;
      case 'RECEIVED':
        return styles.badgeReceived;
      case 'IN_PROGRESS':
        return styles.badgeInProgress;
      case 'QUALITY_CHECK':
        return styles.badgeQualityCheck;
      case 'READY':
        return styles.badgeReady;
      case 'CANCELLED':
        return styles.badgeCancelled;
      case 'DRAFT':
      default:
        return styles.badgeDraft;
    }
  };

  const getTypeBadgeClass = (t: ProstheticType) => {
    switch (t) {
      case 'CROWN':
        return styles.badgeCrown;
      case 'BRIDGE':
        return styles.badgeBridge;
      case 'OTHER':
      default:
        return styles.badgeOther;
    }
  };

  const getCurrentStepIndex = (currentStatus?: DentalLabOrderStatus) => {
    if (!currentStatus || currentStatus === 'CANCELLED' || currentStatus === 'DRAFT') return -1;
    return ORDER_LIFECYCLE_STEPS.findIndex((step) => step.status === currentStatus);
  };

  const currentStepIdx = existingOrder ? getCurrentStepIndex(existingOrder.status) : -1;

  const getNextActionConfig = (s: DentalLabOrderStatus) => {
    switch (s) {
      case 'ORDERED':
        return { nextStatus: 'RECEIVED' as DentalLabOrderStatus, label: 'Mark Received at Lab', icon: 'ph-tray' };
      case 'RECEIVED':
        return { nextStatus: 'IN_PROGRESS' as DentalLabOrderStatus, label: 'Start Production', icon: 'ph-gear' };
      case 'IN_PROGRESS':
        return { nextStatus: 'QUALITY_CHECK' as DentalLabOrderStatus, label: 'Send to Quality Check', icon: 'ph-shield-check' };
      case 'QUALITY_CHECK':
        return { nextStatus: 'READY' as DentalLabOrderStatus, label: 'Mark as Ready', icon: 'ph-check-circle' };
      default:
        return null;
    }
  };

  const nextAction = existingOrder ? getNextActionConfig(existingOrder.status) : null;
  const isTerminal = existingOrder?.status === 'READY' || existingOrder?.status === 'CANCELLED';

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="lab-modal-title">
      <div className={styles.modalContent}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderTitle}>
            <div className={styles.modalHeaderIcon}>
              <i className="ph ph-wrench" />
            </div>
            <span id="lab-modal-title">
              {isViewingExisting ? `Dental Prosthetic Lab Order ${existingOrder ? `• ${existingOrder.order_number}` : ''}` : 'Create Dental Lab Order'}
            </span>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="Close modal"
          >
            <i className="ph ph-x" />
          </button>
        </div>

        {/* Body */}
        {isViewingExisting ? (
          <div className={styles.modalBody}>
            {orderLoading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                <i className="ph ph-spinner ph-spin" style={{ fontSize: '1.5rem', marginBottom: '8px' }} />
                <p>Loading lab order details…</p>
              </div>
            ) : existingOrder ? (
              <>
                {/* Stepper Pipeline for manufacturing */}
                {existingOrder.status !== 'CANCELLED' && existingOrder.status !== 'DRAFT' && (
                  <div className={styles.stepperContainer}>
                    <ol className={styles.stepperList}>
                      {ORDER_LIFECYCLE_STEPS.map((step, idx) => {
                        const isCompleted = currentStepIdx > idx;
                        const isActive = currentStepIdx === idx;
                        return (
                          <li key={step.status} className={styles.stepItem}>
                            {idx < ORDER_LIFECYCLE_STEPS.length - 1 && (
                              <div
                                className={`${styles.stepConnector} ${
                                  currentStepIdx > idx ? styles.stepConnectorCompleted : ''
                                }`}
                              />
                            )}
                            <div
                              className={`${styles.stepBubble} ${
                                isCompleted
                                  ? styles.stepBubbleCompleted
                                  : isActive
                                  ? styles.stepBubbleActive
                                  : ''
                              }`}
                            >
                              {isCompleted ? <i className="ph ph-check" /> : <i className={`ph ${step.icon}`} />}
                            </div>
                            <span
                              className={`${styles.stepLabel} ${
                                isCompleted
                                  ? styles.stepLabelCompleted
                                  : isActive
                                  ? styles.stepLabelActive
                                  : ''
                              }`}
                            >
                              {step.label}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}

                {/* Status Banners */}
                {existingOrder.status === 'READY' && (
                  <div className={styles.readyBanner}>
                    <i className="ph ph-check-circle" style={{ fontSize: '1.4rem' }} />
                    <div>
                      <div><strong>Order Ready:</strong> Prosthesis manufactured, QC verified, and ready for fitting.</div>
                      {existingOrder.ready_at && (
                        <div style={{ fontSize: '0.75rem', opacity: 0.85, marginTop: 2 }}>
                          Ready on {new Date(existingOrder.ready_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {existingOrder.status === 'CANCELLED' && (
                  <div className={styles.cancelledBanner}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                      <i className="ph ph-x-circle" style={{ fontSize: '1.2rem' }} />
                      <span>Order Cancelled</span>
                    </div>
                    {existingOrder.cancellation_reason && (
                      <div style={{ fontSize: '0.8rem', marginTop: 2 }}>
                        <strong>Reason:</strong> {existingOrder.cancellation_reason}
                      </div>
                    )}
                    {existingOrder.cancelled_at && (
                      <div style={{ fontSize: '0.725rem', color: '#b91c1c' }}>
                        Cancelled on {new Date(existingOrder.cancelled_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Status Advancement & Cancellation Action Box */}
                {!readOnly && !isTerminal && (
                  <div className={styles.actionBox}>
                    <div className={styles.actionBoxTitle}>
                      <i className="ph ph-arrows-clockwise" style={{ color: '#2563eb' }} />
                      <span>Workflow Progression</span>
                    </div>

                    {!showCancelBox ? (
                      <>
                        <div className={styles.formGroup}>
                          <label htmlFor="transition-remarks" className={styles.label}>
                            Status Notes / Remarks (Optional)
                          </label>
                          <input
                            id="transition-remarks"
                            type="text"
                            className={styles.input}
                            placeholder="e.g. Impression accepted, sintering started, margin fit ok"
                            value={transitionRemarks}
                            onChange={(e) => setTransitionRemarks(e.target.value)}
                            disabled={updateStatusMutation.isPending}
                          />
                        </div>

                        <div className={styles.actionRow} style={{ justifyContent: 'space-between' }}>
                          {nextAction && (
                            <button
                              type="button"
                              className={styles.btnAdvance}
                              disabled={updateStatusMutation.isPending}
                              onClick={() => handleAdvanceStatus(nextAction.nextStatus)}
                            >
                              {updateStatusMutation.isPending ? (
                                <>
                                  <i className="ph ph-spinner ph-spin" /> Updating…
                                </>
                              ) : (
                                <>
                                  <i className={`ph ${nextAction.icon}`} /> {nextAction.label}
                                </>
                              )}
                            </button>
                          )}

                          <button
                            type="button"
                            className={styles.btnCancelTrigger}
                            disabled={updateStatusMutation.isPending}
                            onClick={() => setShowCancelBox(true)}
                          >
                            <i className="ph ph-x" /> Cancel Order
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className={styles.cancelContainer}>
                        <label htmlFor="cancel-reason" className={styles.label} style={{ color: '#991b1b' }}>
                          Cancellation Reason <span className={styles.requiredAsterisk}>*</span>
                        </label>
                        <textarea
                          id="cancel-reason"
                          className={styles.textarea}
                          style={{ minHeight: '60px' }}
                          placeholder="State why this lab order is being cancelled (required)"
                          value={cancellationReason}
                          onChange={(e) => setCancellationReason(e.target.value)}
                          required
                          disabled={updateStatusMutation.isPending}
                        />

                        <div className={styles.actionRow} style={{ justifyContent: 'flex-end', marginTop: 4 }}>
                          <button
                            type="button"
                            className={styles.btnSecondary}
                            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                            onClick={() => setShowCancelBox(false)}
                            disabled={updateStatusMutation.isPending}
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            className={styles.btnConfirmCancel}
                            disabled={updateStatusMutation.isPending || !cancellationReason.trim()}
                            onClick={handleConfirmCancel}
                          >
                            {updateStatusMutation.isPending ? (
                              <>
                                <i className="ph ph-spinner ph-spin" /> Cancelling…
                              </>
                            ) : (
                              <>
                                <i className="ph ph-check" /> Confirm Cancellation
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Details Card */}
                <div className={styles.detailsCard}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Order Number</span>
                    <span className={styles.detailValue} style={{ fontFamily: 'monospace', color: '#1d4ed8' }}>
                      {existingOrder.order_number}
                    </span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Status</span>
                    <span className={`${styles.badge} ${getStatusBadgeClass(existingOrder.status)}`}>
                      {existingOrder.status}
                    </span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Prosthetic Type</span>
                    <span className={`${styles.badge} ${getTypeBadgeClass(existingOrder.prosthetic_type)}`}>
                      {existingOrder.prosthetic_type}
                    </span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Tooth Number (FDI)</span>
                    <span className={styles.detailValue}>
                      {existingOrder.tooth_number ? `Tooth #${existingOrder.tooth_number}` : '—'}
                    </span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Requested By</span>
                    <span className={styles.detailValue}>
                      {existingOrder.requested_by_name ? `Dr. ${existingOrder.requested_by_name}` : 'Clinician'}
                    </span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Requested Date</span>
                    <span className={styles.detailValue}>
                      {existingOrder.requested_at
                        ? new Date(existingOrder.requested_at).toLocaleString()
                        : '—'}
                    </span>
                  </div>

                  {existingOrder.status_remarks && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Latest Remarks</span>
                      <span className={styles.detailValue} style={{ fontStyle: 'italic', fontWeight: 500 }}>
                        {existingOrder.status_remarks}
                      </span>
                    </div>
                  )}

                  <div className={styles.formGroup} style={{ marginTop: '8px' }}>
                    <span className={styles.detailLabel}>Manufacturing / Lab Instructions</span>
                    <div className={styles.readOnlyBox} style={{ whiteSpace: 'pre-wrap', marginTop: '4px' }}>
                      {existingOrder.description || 'No instructions provided.'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#dc2626' }}>
                Lab order could not be loaded.
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className={styles.modalBody}>
              {/* Context Summary */}
              {stage && (
                <div className={styles.detailsCard} style={{ padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ph ph-git-commit" style={{ color: '#2563eb' }} />
                    <strong>Stage {stage.sequence}:</strong> {stage.stage_name}
                    {stage.tooth_number && <span>(Tooth #{stage.tooth_number})</span>}
                  </div>
                </div>
              )}

              {/* Prosthetic Type */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  Prosthetic Type <span className={styles.requiredAsterisk}>*</span>
                </label>
                <div className={styles.typePicker}>
                  {(['CROWN', 'BRIDGE', 'OTHER'] as ProstheticType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`${styles.typeChip} ${prostheticType === type ? styles.typeChipActive : ''}`}
                      onClick={() => setProstheticType(type)}
                      disabled={readOnly}
                    >
                      <i className={type === 'CROWN' ? 'ph ph-crown' : type === 'BRIDGE' ? 'ph ph-bridge' : 'ph ph-wrench'} />
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tooth Number & Status Grid */}
              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label htmlFor="lab-tooth-number" className={styles.label}>
                    Tooth Number (FDI)
                  </label>
                  <input
                    id="lab-tooth-number"
                    type="number"
                    min="11"
                    max="85"
                    className={styles.input}
                    placeholder="e.g. 16, 21"
                    value={toothNumber}
                    onChange={(e) => setToothNumber(e.target.value)}
                    disabled={readOnly}
                  />
                  <span className={styles.hint}>Optional if full arch</span>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="lab-status" className={styles.label}>
                    Initial Status
                  </label>
                  <select
                    id="lab-status"
                    className={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as DentalLabOrderStatus)}
                    disabled={readOnly}
                  >
                    <option value="ORDERED">ORDERED</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </div>
              </div>

              {/* Description / Instructions */}
              <div className={styles.formGroup}>
                <label htmlFor="lab-description" className={styles.label}>
                  Lab Specifications &amp; Instructions <span className={styles.requiredAsterisk}>*</span>
                </label>
                <textarea
                  id="lab-description"
                  className={styles.textarea}
                  rows={3}
                  placeholder="e.g. Zirconia Crown, Shade A2, high translucency, anatomical margin."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* Footer */}
            <div className={styles.modalFooter}>
              <div className={styles.modalFooterActions}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={onClose}
                  disabled={createOrderMutation.isPending}
                >
                  Cancel
                </button>
                {!readOnly && (
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    disabled={createOrderMutation.isPending || !description.trim()}
                  >
                    {createOrderMutation.isPending ? (
                      <>
                        <i className="ph ph-spinner ph-spin" /> Submitting…
                      </>
                    ) : (
                      <>
                        <i className="ph ph-paper-plane-tilt" /> Create Lab Order
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

        {/* Existing order footer */}
        {isViewingExisting && (
          <div className={styles.modalFooter}>
            <div className={styles.modalFooterActions} style={{ marginLeft: 'auto' }}>
              <button type="button" className={styles.btnSecondary} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

