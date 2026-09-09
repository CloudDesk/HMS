import React, { useMemo, useState } from 'react';
import type {
  DentalTreatmentPlanItem,
  DentalTreatmentPriority,
  DentalTreatmentStatus,
  ToothFinding,
} from '../../../api/opd';
import type { ServiceResponse } from '../../../api/services';
import type {
  BillingInvoiceStatus,
  DentalTreatmentBillingState,
} from '../../../api/billing';
import { useCurrencyFormatter } from '../../../api/useSettings';
import {
  COMMON_DENTAL_PROCEDURES,
  PERMANENT_QUADRANTS,
  PRIMARY_QUADRANTS,
  TOOTH_NAMES,
  getToothName,
} from '../../../pages/dental-utils';
import styles from './DentalExamination.module.css';

interface DentalTreatmentPlanSectionProps {
  items: DentalTreatmentPlanItem[];
  teeth: ToothFinding[];
  onChange: (items: DentalTreatmentPlanItem[]) => void;
  disabled?: boolean;
  /** PROCEDURE-type services from HMS Service Catalogue for the dental department */
  departmentServices?: ServiceResponse[];
  billingStates?: DentalTreatmentBillingState[];
  billingStateLoading?: boolean;
  billingStateError?: string;
  canCreateInvoice?: boolean;
  billingBlockedByUnsavedChanges?: boolean;
  billingTreatmentItemPending?: string | null;
  onCreateInvoice?: (treatmentItemId: string) => Promise<void>;
  onOpenInvoice?: (invoiceId: string) => void;
}

export const DentalTreatmentPlanSection: React.FC<DentalTreatmentPlanSectionProps> = ({
  items,
  teeth,
  onChange,
  disabled = false,
  departmentServices = [],
  billingStates = [],
  billingStateLoading = false,
  billingStateError = '',
  canCreateInvoice = false,
  billingBlockedByUnsavedChanges = false,
  billingTreatmentItemPending = null,
  onCreateInvoice,
  onOpenInvoice,
}) => {
  const formatCurrency = useCurrencyFormatter();
  const [toothNumber, setToothNumber] = useState<string>('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [procedureName, setProcedureName] = useState<string>('');
  const [priority, setPriority] = useState<DentalTreatmentPriority>('ROUTINE');
  const [estimatedCost, setEstimatedCost] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const examinedTeethNumbers = useMemo(() => {
    return teeth
      .map((t) => t.tooth_number);
  }, [teeth]);

  const handleSelectService = (service: ServiceResponse) => {
    if (disabled) return;
    setSelectedServiceId(service.id);
    setProcedureName(service.name);
    if (service.standard_price >= 0) {
      setEstimatedCost(service.standard_price.toString());
    }
  };

  const handleCatalogueDropdownChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    if (!serviceId) return;
    const svc = departmentServices.find((s) => s.id === serviceId);
    if (svc) {
      setProcedureName(svc.name);
      if (svc.standard_price >= 0) {
        setEstimatedCost(svc.standard_price.toString());
      }
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || !procedureName.trim()) return;

    const newItem: DentalTreatmentPlanItem = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      service_id: selectedServiceId || null,
      tooth_number: toothNumber ? Number(toothNumber) : null,
      procedure_name: procedureName.trim(),
      surfaces: [],
      priority,
      estimated_cost: estimatedCost !== '' && !isNaN(Number(estimatedCost)) ? Number(estimatedCost) : null,
      notes: notes.trim() || null,
      status: 'PROPOSED',
    };

    onChange([...items, newItem]);

    // Reset inputs
    setToothNumber('');
    setSelectedServiceId('');
    setProcedureName('');
    setPriority('ROUTINE');
    setEstimatedCost('');
    setNotes('');
  };

  const handleRemoveItem = (index: number) => {
    if (disabled) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const handleStatusChange = (index: number, newStatus: DentalTreatmentStatus) => {
    if (disabled) return;
    const updated = items.map((item, i) => (i === index ? { ...item, status: newStatus } : item));
    onChange(updated);
  };

  // Financial summary calculations
  const totalCost = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.estimated_cost ?? 0), 0);
  }, [items]);

  const acceptedOrActiveCost = useMemo(() => {
    return items
      .filter((it) => it.status === 'ACCEPTED' || it.status === 'IN_PROGRESS' || it.status === 'COMPLETED')
      .reduce((acc, it) => acc + (it.estimated_cost ?? 0), 0);
  }, [items]);

  const billingStateByTreatmentItem = useMemo(
    () => new Map(billingStates.map((state) => [state.treatment_item_id, state])),
    [billingStates],
  );

  const billingLabel = (status: BillingInvoiceStatus) => {
    if (status === 'DRAFT') return 'Invoice draft';
    if (status === 'PENDING') return 'Invoice pending';
    if (status === 'PARTIALLY_PAID') return 'Partially paid';
    if (status === 'PAID') return 'Paid';
    return 'Invoice cancelled';
  };

  const getStatusBadgeStyle = (status: string | undefined) => {
    switch (status) {
      case 'ACCEPTED':
        return { background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe' };
      case 'IN_PROGRESS':
        return { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' };
      case 'COMPLETED':
        return { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
      case 'DECLINED':
        return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
      case 'CANCELLED':
        return { background: '#ffe4e6', color: '#9f1239', border: '1px solid #fecdd3' };
      case 'PROPOSED':
      default:
        return { background: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' };
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 className={styles.cardTitle}>
            <i className="ph ph-calendar-check" style={{ color: '#7c3aed' }} />
            Proposed Dental Treatment Plan &amp; Procedures
          </h3>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            ({items.length} Procedure{items.length === 1 ? '' : 's'})
          </span>
        </div>

        {items.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem' }}>
            <span style={{ color: '#475569' }}>
              Active/Accepted Value: <strong style={{ color: '#166534' }}>{formatCurrency(acceptedOrActiveCost)}</strong>
            </span>
            <span style={{ color: '#475569' }}>
              Total Plan Value: <strong style={{ color: '#1e40af' }}>{formatCurrency(totalCost)}</strong>
            </span>
          </div>
        )}
      </div>

      <div className={styles.cardContent}>
        {billingStateError ? (
          <div className={styles.billingError} role="alert">
            <i className="ph ph-warning-circle" /> {billingStateError}
          </div>
        ) : null}
        {/* Planned Items Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.treatmentTable}>
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Site / Tooth</th>
                <th>Procedure Name</th>
                <th style={{ width: '100px' }}>Priority</th>
                <th style={{ width: '110px' }}>Est. Cost</th>
                <th style={{ width: '140px' }}>Status</th>
                <th>Clinical Notes</th>
                <th style={{ minWidth: '170px' }}>Billing</th>
                {!disabled && <th style={{ width: '60px', textAlign: 'center' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={disabled ? 7 : 8} className={styles.emptyStateText}>
                    No planned dental procedures recorded. Select procedures from the Service Catalogue or enter custom treatment items below.
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const billingState = item.id
                    ? billingStateByTreatmentItem.get(item.id)
                    : undefined;
                  const cataloguePrice = item.service_id
                    ? departmentServices.find((service) => service.id === item.service_id)
                        ?.standard_price
                    : undefined;
                  const isPersisted = Boolean(
                    item.id && /^[a-f\d]{24}$/i.test(item.id),
                  );
                  const isStatusBillable =
                    item.status !== 'DECLINED' && item.status !== 'CANCELLED';
                  const isBillingThisItem = billingTreatmentItemPending === item.id;
                  return (
                  <tr key={item.id ?? `plan-item-${idx}`}>
                    <td style={{ fontWeight: 700, color: '#1e40af' }}>
                      {item.tooth_number ? (
                        <span
                          style={{
                            background: '#dbeafe',
                            color: '#1e40af',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          <i className="ph-fill ph-tooth" style={{ fontSize: '0.8rem' }} /> #{item.tooth_number}
                        </span>
                      ) : (
                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '0.75rem',
                          }}
                        >
                          General
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {item.procedure_name}
                      {item.service_id && (
                        <span
                          style={{
                            marginLeft: '6px',
                            fontSize: '0.675rem',
                            color: '#0284c7',
                            background: '#e0f2fe',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            fontWeight: 600,
                          }}
                        >
                          Catalogue
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          background:
                            item.priority === 'URGENT' || item.priority === 'HIGH'
                              ? '#fee2e2'
                              : item.priority === 'ELECTIVE' || item.priority === 'LOW'
                              ? '#f3e8ff'
                              : '#dbeafe',
                          color:
                            item.priority === 'URGENT' || item.priority === 'HIGH'
                              ? '#dc2626'
                              : item.priority === 'ELECTIVE' || item.priority === 'LOW'
                              ? '#7e22ce'
                              : '#1d4ed8',
                        }}
                      >
                        {item.priority ?? 'ROUTINE'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {cataloguePrice != null
                        ? formatCurrency(cataloguePrice)
                        : item.estimated_cost != null
                          ? formatCurrency(item.estimated_cost)
                          : '—'}
                    </td>
                    <td>
                      {disabled ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            ...getStatusBadgeStyle(item.status),
                          }}
                        >
                          {item.status ?? 'PROPOSED'}
                        </span>
                      ) : (
                        <select
                          className={styles.select}
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.775rem',
                            fontWeight: 600,
                            borderRadius: '4px',
                            ...getStatusBadgeStyle(item.status),
                          }}
                          value={item.status ?? 'PROPOSED'}
                          onChange={(e) => handleStatusChange(idx, e.target.value as DentalTreatmentStatus)}
                        >
                          <option value="PROPOSED">Proposed</option>
                          <option value="ACCEPTED">Accepted</option>
                          <option value="IN_PROGRESS">In-Progress</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="DECLINED">Declined</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.notes ?? '—'}</td>
                    <td>
                      {billingState ? (
                        <div className={styles.billingCell}>
                          <span
                            className={`${styles.billingBadge} ${
                              billingState.invoice_status === 'PAID'
                                ? styles.billingBadgePaid
                                : billingState.invoice_status === 'CANCELLED'
                                  ? styles.billingBadgeCancelled
                                  : styles.billingBadgePending
                            }`}
                          >
                            {billingLabel(billingState.invoice_status)}
                          </span>
                          <button
                            type="button"
                            className={styles.billingLink}
                            onClick={() => onOpenInvoice?.(billingState.invoice_id)}
                          >
                            {billingState.invoice_number}
                          </button>
                          <small>{formatCurrency(billingState.unit_price)}</small>
                        </div>
                      ) : billingStateLoading ? (
                        <span className={styles.billingMuted}>Checking billing…</span>
                      ) : !item.service_id ? (
                        <span className={styles.billingMuted}>Clinical plan only</span>
                      ) : !isStatusBillable ? (
                        <span className={styles.billingMuted}>Not billable</span>
                      ) : billingBlockedByUnsavedChanges || !isPersisted ? (
                        <span className={styles.billingMuted}>Save before billing</span>
                      ) : canCreateInvoice && onCreateInvoice ? (
                        <button
                          type="button"
                          className={styles.btnBilling}
                          disabled={Boolean(billingTreatmentItemPending)}
                          onClick={() => {
                            if (!item.id) return;
                            void onCreateInvoice(item.id).catch(() => undefined);
                          }}
                        >
                          <i className="ph ph-receipt" />
                          {isBillingThisItem ? 'Creating…' : 'Create Invoice'}
                        </button>
                      ) : (
                        <span className={styles.billingMuted}>Not billed</span>
                      )}
                    </td>
                    {!disabled && (
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ padding: '2px 6px', color: '#dc2626', borderColor: '#fecaca' }}
                          onClick={() => handleRemoveItem(idx)}
                          title="Remove procedure"
                        >
                          <i className="ph ph-trash" />
                        </button>
                      </td>
                    )}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Add Treatment Item Form */}
        {!disabled && (
          <>
            {/* Service Catalogue Quick-Add — shown when department has PROCEDURE services */}
            {departmentServices.length > 0 && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0369a1', marginBottom: '8px' }}>
                  <i className="ph ph-lightning" /> Quick-Add from Service Catalogue
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {departmentServices.map((svc) => (
                    <button
                      key={svc.id}
                      type="button"
                      className={styles.chip}
                      style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#7dd3fc' }}
                      onClick={() => handleSelectService(svc)}
                      title={svc.standard_price > 0 ? `Standard price: ${formatCurrency(svc.standard_price)}` : undefined}
                    >
                      {svc.name}
                      {svc.standard_price > 0 && (
                        <span style={{ fontSize: '0.7rem', opacity: 0.85, fontWeight: 600 }}>
                          {' '}· {formatCurrency(svc.standard_price)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={handleAddItem}
              style={{
                marginTop: '16px',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', marginBottom: '12px' }}>
                Add Planned Dental Procedure
              </div>

              <div className={styles.treatmentFormGrid}>
                {/* Tooth Selector */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Tooth # (Optional)</label>
                  <select
                    className={styles.select}
                    value={toothNumber}
                    onChange={(e) => setToothNumber(e.target.value)}
                  >
                    <option value="">General / Full Mouth</option>
                    {examinedTeethNumbers.length > 0 && (
                      <optgroup label="Teeth with Examination Findings">
                        {examinedTeethNumbers.map((num) => (
                          <option key={num} value={num}>
                            Tooth #{num} - {TOOTH_NAMES[num] ?? getToothName(num)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Permanent Upper Right (Q1: 18 – 11)">
                      {PERMANENT_QUADRANTS.Q1_UPPER_RIGHT.map((num) => (
                        <option key={num} value={num}>
                          Tooth #{num} - {TOOTH_NAMES[num]}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Permanent Upper Left (Q2: 21 – 28)">
                      {PERMANENT_QUADRANTS.Q2_UPPER_LEFT.map((num) => (
                        <option key={num} value={num}>
                          Tooth #{num} - {TOOTH_NAMES[num]}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Permanent Lower Left (Q3: 31 – 38)">
                      {PERMANENT_QUADRANTS.Q3_LOWER_LEFT.map((num) => (
                        <option key={num} value={num}>
                          Tooth #{num} - {TOOTH_NAMES[num]}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Permanent Lower Right (Q4: 41 – 48)">
                      {PERMANENT_QUADRANTS.Q4_LOWER_RIGHT.map((num) => (
                        <option key={num} value={num}>
                          Tooth #{num} - {TOOTH_NAMES[num]}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Primary / Pediatric Teeth (51 – 85)">
                      {[
                        ...PRIMARY_QUADRANTS.Q5_UPPER_RIGHT,
                        ...PRIMARY_QUADRANTS.Q6_UPPER_LEFT,
                        ...PRIMARY_QUADRANTS.Q7_LOWER_LEFT,
                        ...PRIMARY_QUADRANTS.Q8_LOWER_RIGHT,
                      ].map((num) => (
                        <option key={num} value={num}>
                          Tooth #{num} - {TOOTH_NAMES[num] || `Primary Tooth ${num}`}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Service Catalogue Picker */}
                {departmentServices.length > 0 && (
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Service Catalogue</label>
                    <select
                      className={styles.select}
                      value={selectedServiceId}
                      onChange={(e) => handleCatalogueDropdownChange(e.target.value)}
                    >
                      <option value="">-- Select from Catalogue --</option>
                      {departmentServices.map((svc) => (
                        <option key={svc.id} value={svc.id}>
                          {svc.name} {svc.standard_price > 0 ? `(${formatCurrency(svc.standard_price)})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Procedure Name Input */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Procedure Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    list="dental-procedure-suggestions"
                    placeholder="e.g. Composite Restoration, Root Canal Treatment, Scaling..."
                    className={styles.input}
                    value={procedureName}
                    onChange={(e) => {
                      setProcedureName(e.target.value);
                      const matchedSvc = departmentServices.find(
                        (s) => s.name.toLowerCase() === e.target.value.trim().toLowerCase(),
                      );
                      if (matchedSvc) {
                        setSelectedServiceId(matchedSvc.id);
                        if (matchedSvc.standard_price >= 0) {
                          setEstimatedCost(matchedSvc.standard_price.toString());
                        }
                      } else {
                        setSelectedServiceId('');
                      }
                    }}
                    required
                  />
                  <datalist id="dental-procedure-suggestions">
                    {departmentServices.map((svc) => (
                      <option key={svc.id} value={svc.name} />
                    ))}
                    {COMMON_DENTAL_PROCEDURES.map((p: string) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>

                {/* Priority */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Priority</label>
                  <select
                    className={styles.select}
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as DentalTreatmentPriority)}
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="URGENT">Urgent</option>
                    <option value="ELECTIVE">Elective</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                {/* Est. Cost */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Est. Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className={styles.input}
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                  />
                </div>

                {/* Clinical Treatment Notes */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Treatment Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Shade A2, post & core, subgingival margins..."
                    className={styles.input}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {/* Submit Button */}
                <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingTop: '18px' }}>
                  <button
                    type="submit"
                    className={styles.btnPrimary}
                    style={{ height: '36px', whiteSpace: 'nowrap', padding: '0 16px' }}
                  >
                    <i className="ph ph-plus" /> Add to Plan
                  </button>
                </div>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
