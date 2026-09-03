import { useState, useEffect } from 'react';
import type {
  InpatientAdmission,
  InpatientRoundNote,
  InpatientVital,
} from '../../api/inpatient-admissions';
import type { ProcedureBooking, ProcedureRecommendation } from '../../api/surgery';
import { useBillingInvoices } from '../../hooks/billing/useBilling';
import { Modal } from '../ui/Modal';
import { toast } from 'sonner';

type WorkspaceTab = 'orders' | 'rounds' | 'vitals' | 'surgeries' | 'discharge';

type InpatientPatientDetailModalProps = {
  open: boolean;
  onClose: () => void;
  admission: InpatientAdmission | null;
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  calculateLOS: (dateStr?: string | null) => string;
  loading: Record<string, boolean | undefined>;
  errors: Record<string, unknown>;
  recommendations: ProcedureRecommendation[];
  bookings: ProcedureBooking[];
  roundNotes: InpatientRoundNote[];
  vitals: InpatientVital[];
  diagnosticOrders: Array<{ id: string; order_type: 'LAB' | 'IMAGING'; item_name: string; instructions: string; status: string; ordered_at: string }>;
  onOpenScheduleSurgery: () => void;
  onOpenAddRoundNote: () => void;
  onOpenRecordVitals: () => void;
  onOpenAddOrder: () => void;
  onSaveDischargeSummary?: (data: { hemodynamic_stability_24h: boolean; post_op_recovery_cleared: boolean; home_oral_med_converted: boolean; summary_finalized: boolean; notes?: string | null }) => Promise<void>;
  onFinalizeDischarge?: () => Promise<void>;
  isDischarging?: boolean;
};

export function InpatientPatientDetailModal({
  open,
  onClose,
  admission,
  activeTab,
  setActiveTab,
  calculateLOS,
  loading,
  errors,
  recommendations,
  bookings,
  roundNotes,
  vitals,
  diagnosticOrders,
  onOpenScheduleSurgery,
  onOpenAddRoundNote,
  onOpenRecordVitals,
  onOpenAddOrder,
  onSaveDischargeSummary,
  onFinalizeDischarge,
  isDischarging,
}: InpatientPatientDetailModalProps) {
  if (!admission) return null;

  const initials = (admission.patient_name || 'PT')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const los = calculateLOS(admission.admission_date);

  const headerTitle = (
    <div className="inpatient-detail-modal-header">
      <div className="inpatient-detail-avatar">{initials}</div>
      <div className="inpatient-detail-head-info">
        <div className="inpatient-detail-head-top">
          <h2 className="inpatient-detail-name">{admission.patient_name}</h2>
          <span className="admission-status-pill CONFIRMED">● ADMITTED</span>
        </div>
        <div className="inpatient-detail-head-meta">
          <span className="meta-mrn">{admission.patient_number}</span>
          <span className="meta-dot">·</span>
          <span>
            Ward <strong>{admission.ward_name}</strong>
          </span>
          <span className="meta-dot">·</span>
          <span>
            Bed <strong className="highlight-bed">{admission.bed_number}</strong>
          </span>
          <span className="meta-dot">·</span>
          <span>
            Admitted{' '}
            <strong>
              {admission.admission_date
                ? new Date(admission.admission_date).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Not recorded'}
            </strong>
          </span>
          <span className="meta-dot">·</span>
          <span>
            LOS <strong className="highlight-los">{los}</strong>
          </span>
        </div>
      </div>
    </div>
  );

  const footerContent = (
    <div className="inpatient-detail-modal-footer">
      <div className="inpatient-detail-footer-meta">
        <span>
          Attending Doctor: <strong>{admission.admitting_doctor_name}</strong>
        </span>
      </div>
      <button className="adm-btn" onClick={onClose} type="button">
        Close
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xlarge"
      title={headerTitle}
      footer={footerContent}
      className="inpatient-patient-modal"
    >
      <div className="inpatient-detail-modal-body">
        {/* Compact Admitting Diagnosis Banner */}
        <div className="inpatient-diag-banner">
          <span className="diag-label">ADMITTING DIAGNOSIS / INDICATION</span>
          <span className="diag-text">
            {admission.reason?.trim() || 'No admitting diagnosis recorded.'}
          </span>
        </div>

        {/* Compact Clinical Navigation Tabs */}
        <div className="inpatient-tabs-bar" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'orders'}
            className={`inpatient-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <i className="ph ph-flask" /> Orders & Investigations ({diagnosticOrders.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'rounds'}
            className={`inpatient-tab-btn ${activeTab === 'rounds' ? 'active' : ''}`}
            onClick={() => setActiveTab('rounds')}
          >
            <i className="ph ph-note-pencil" /> Daily Doctor Rounds ({roundNotes.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'vitals'}
            className={`inpatient-tab-btn ${activeTab === 'vitals' ? 'active' : ''}`}
            onClick={() => setActiveTab('vitals')}
          >
            <i className="ph ph-heartbeat" /> Bedside Vitals ({vitals.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'surgeries'}
            className={`inpatient-tab-btn ${activeTab === 'surgeries' ? 'active' : ''}`}
            onClick={() => setActiveTab('surgeries')}
          >
            <i className="ph ph-scissors" /> Surgeries & Procedures (
            {recommendations.length + bookings.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'discharge'}
            className={`inpatient-tab-btn ${activeTab === 'discharge' ? 'active' : ''}`}
            onClick={() => setActiveTab('discharge')}
          >
            <i className="ph ph-sign-out" /> Discharge Planning
          </button>
        </div>

        {/* Active Tab Content Area */}
        <div className="inpatient-tab-content">
          {/* TAB 1: Orders & Investigations */}
          {activeTab === 'orders' && (
            <div className="inpatient-tab-pane">
              <div className="inpatient-tab-pane-header">
                <div>
                  <h3 className="pane-title">Inpatient Diagnostic Orders</h3>
                  <p className="pane-sub">
                    Laboratory and radiology investigations from the authoritative clinical-order record
                  </p>
                </div>
                <button type="button" className="adm-btn primary" onClick={onOpenAddOrder}>
                  <i className="ph ph-plus" /> Add Inpatient Order
                </button>
              </div>

              {loading.diagnosticOrders ? (
                <div className="inpatient-pane-loading">Loading authoritative diagnostic orders...</div>
              ) : errors.diagnosticOrders ? (
                <div className="inpatient-compact-error">
                  <span>Unable to load diagnostic orders.</span>
                  <button type="button" className="adm-btn" onClick={onOpenAddOrder}>
                    Retry
                  </button>
                </div>
              ) : diagnosticOrders.length === 0 ? (
                <div className="inpatient-compact-empty">
                  <i className="ph ph-flask" />
                  <div className="empty-copy">
                    <strong>No diagnostic orders found</strong>
                    <span>No laboratory or radiology orders placed for this stay.</span>
                  </div>
                  <button type="button" className="adm-btn" onClick={onOpenAddOrder}>
                    <i className="ph ph-plus" /> Place Diagnostic Order
                  </button>
                </div>
              ) : (
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Order Type</th>
                        <th>Investigation</th>
                        <th>Clinical Instructions</th>
                        <th>Status</th>
                        <th>Ordered At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnosticOrders.map((o) => (
                        <tr key={o.id}>
                          <td>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                background:
                                  o.order_type === 'LAB'
                                    ? '#eff6ff'
                                    : o.order_type === 'IMAGING'
                                      ? '#fdf4ff'
                                      : '#f0fdf4',
                                color:
                                  o.order_type === 'LAB'
                                    ? '#2563eb'
                                    : o.order_type === 'IMAGING'
                                      ? '#9333ea'
                                      : '#16a34a',
                              }}
                            >
                              {o.order_type}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: '#0f172a' }}>{o.item_name}</strong>
                          </td>
                          <td style={{ maxWidth: '280px', whiteSpace: 'normal', fontSize: '0.78rem' }}>
                            {o.instructions || 'Routine inpatient order'}
                          </td>
                          <td>
                            <span className="admission-status-pill Pending">{o.status}</span>
                          </td>
                          <td style={{ fontSize: '0.76rem', color: '#64748b' }}>
                            {new Date(o.ordered_at).toLocaleString([], {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Daily Doctor Rounds */}
          {activeTab === 'rounds' && (
            <div className="inpatient-tab-pane">
              <div className="inpatient-tab-pane-header">
                <div>
                  <h3 className="pane-title">Daily Doctor Ward Rounds (SOAP)</h3>
                  <p className="pane-sub">
                    Clinical progress notes recorded by attending physicians during inpatient ward rounds
                  </p>
                </div>
                <button type="button" className="adm-btn primary" onClick={onOpenAddRoundNote}>
                  <i className="ph ph-plus" /> Add Round Note
                </button>
              </div>

              {loading.roundNotes ? (
                <div className="inpatient-pane-loading">Loading authoritative ward-round notes...</div>
              ) : errors.roundNotes ? (
                <div className="inpatient-compact-error">
                  <span>Unable to load ward-round notes.</span>
                  <button type="button" className="adm-btn" onClick={onOpenAddRoundNote}>
                    Retry
                  </button>
                </div>
              ) : roundNotes.length === 0 ? (
                <div className="inpatient-compact-empty">
                  <i className="ph ph-note-pencil" />
                  <div className="empty-copy">
                    <strong>No doctor rounds recorded</strong>
                    <span>No ward round progress notes recorded yet for this stay.</span>
                  </div>
                  <button type="button" className="adm-btn" onClick={onOpenAddRoundNote}>
                    <i className="ph ph-plus" /> Record First Round Note
                  </button>
                </div>
              ) : (
                <div className="round-notes-list">
                  {roundNotes.map((note) => (
                    <div key={note.id} className="round-note-card">
                      <div className="round-note-header">
                        <span className="doctor-badge">
                          <i className="ph ph-user-md" /> Dr. {note.doctor_name}
                        </span>
                        <span className="timestamp-badge">
                          <i className="ph ph-clock" />{' '}
                          {new Date(note.date).toLocaleString([], {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      </div>
                      <div className="round-note-soap-grid">
                        <div>
                          <span className="soap-label">Subjective:</span>
                          <p className="soap-val">{note.subjective}</p>
                        </div>
                        <div>
                          <span className="soap-label">Objective:</span>
                          <p className="soap-val">{note.objective}</p>
                        </div>
                        <div>
                          <span className="soap-label">Assessment:</span>
                          <p className="soap-val">{note.assessment}</p>
                        </div>
                        <div>
                          <span className="soap-label plan">Plan:</span>
                          <p className="soap-val plan">{note.plan}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Bedside Vitals */}
          {activeTab === 'vitals' && (
            <div className="inpatient-tab-pane">
              <div className="inpatient-tab-pane-header">
                <div>
                  <h3 className="pane-title">Bedside Vital Signs Flowsheet</h3>
                  <p className="pane-sub">
                    Nursing vital charts, temperature, hemodynamics, and oxygenation tracking
                  </p>
                </div>
                <button type="button" className="adm-btn primary" onClick={onOpenRecordVitals}>
                  <i className="ph ph-plus" /> Record Bedside Vitals
                </button>
              </div>

              {loading.vitals ? (
                <div className="inpatient-pane-loading">Loading authoritative bedside vitals...</div>
              ) : errors.vitals ? (
                <div className="inpatient-compact-error">
                  <span>Unable to load bedside vitals.</span>
                  <button type="button" className="adm-btn" onClick={onOpenRecordVitals}>
                    Retry
                  </button>
                </div>
              ) : vitals.length === 0 ? (
                <div className="inpatient-compact-empty">
                  <i className="ph ph-heartbeat" />
                  <div className="empty-copy">
                    <strong>No bedside vitals recorded</strong>
                    <span>No nursing vital signs logged yet for this stay.</span>
                  </div>
                  <button type="button" className="adm-btn" onClick={onOpenRecordVitals}>
                    <i className="ph ph-plus" /> Take Vitals Now
                  </button>
                </div>
              ) : (
                <div className="adm-table-wrap">
                  <table className="adm-table">
                    <thead>
                      <tr>
                        <th>Recorded Time</th>
                        <th>BP (mmHg)</th>
                        <th>Pulse (bpm)</th>
                        <th>Temp (°C)</th>
                        <th>SpO2 (%)</th>
                        <th>Resp Rate (/min)</th>
                        <th>Pain (0-10)</th>
                        <th>Recorded By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vitals.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <strong>
                              {new Date(v.recorded_at).toLocaleString([], {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </strong>
                          </td>
                          <td>
                            <span
                              style={{
                                fontWeight: 700,
                                color:
                                  v.bp_systolic > 140 || v.bp_systolic < 90 ? '#dc2626' : '#0f172a',
                              }}
                            >
                              {v.bp_systolic}/{v.bp_diastolic}
                            </span>
                          </td>
                          <td>{v.heart_rate}</td>
                          <td>{v.temperature} °C</td>
                          <td>
                            <span style={{ fontWeight: 700, color: v.spo2 < 95 ? '#dc2626' : '#059669' }}>
                              {v.spo2}%
                            </span>
                          </td>
                          <td>{v.respiratory_rate}</td>
                          <td>{v.pain_score}</td>
                          <td style={{ fontSize: '0.76rem', color: '#64748b' }}>{v.recorded_by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Surgeries & Procedures */}
          {activeTab === 'surgeries' && (
            <div className="inpatient-tab-pane">
              <div className="inpatient-tab-pane-header">
                <div>
                  <h3 className="pane-title">Inpatient Surgical & Procedural Management</h3>
                  <p className="pane-sub">
                    Recommended procedures, operating theater bookings, and pre-op clearance
                  </p>
                </div>
                <button type="button" className="adm-btn primary" onClick={onOpenScheduleSurgery}>
                  <i className="ph ph-plus" /> Schedule Surgery / Procedure
                </button>
              </div>

              {/* Procedure Recommendations */}
              <div className="inpatient-sub-section">
                <h4 className="inpatient-sub-heading">
                  Active Procedure Recommendations
                </h4>
                {loading.recommendations ? (
                  <div className="inpatient-pane-loading">Loading surgery recommendations...</div>
                ) : recommendations.length === 0 ? (
                  <div className="inpatient-compact-sub-empty">
                    <p>No procedure recommendations recorded for this inpatient stay.</p>
                  </div>
                ) : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Rec ID</th>
                          <th>Procedure / Surgery</th>
                          <th>Recommending Doctor</th>
                          <th>Clinical Indication</th>
                          <th>Status</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recommendations.map((rec) => (
                          <tr key={rec.id}>
                            <td>
                              <strong>{rec.recommendation_number}</strong>
                            </td>
                            <td>
                              <strong style={{ color: '#2563eb' }}>{rec.service_name}</strong>
                            </td>
                            <td>{rec.recommending_doctor_name}</td>
                            <td style={{ maxWidth: '240px', whiteSpace: 'normal' }}>
                              {rec.clinical_reason}
                            </td>
                            <td>
                              <span className={`admission-status-pill ${rec.status}`}>{rec.status}</span>
                            </td>
                            <td style={{ fontSize: '0.76rem', color: '#64748b' }}>
                              {new Date(rec.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* OT Slot Bookings */}
              <div className="inpatient-sub-section">
                <h4 className="inpatient-sub-heading">
                  Scheduled OT Slots & Confirmed Bookings
                </h4>
                {loading.bookings ? (
                  <div className="inpatient-pane-loading">Loading OT bookings...</div>
                ) : bookings.length === 0 ? (
                  <div className="inpatient-compact-sub-empty">
                    <p>
                      No active OT slot booking confirmed yet. Bookings are processed via the Surgery & Procedures workspace.
                    </p>
                  </div>
                ) : (
                  <div className="adm-table-wrap">
                    <table className="adm-table">
                      <thead>
                        <tr>
                          <th>Booking #</th>
                          <th>Procedure</th>
                          <th>Operating Surgeon</th>
                          <th>Scheduled Slot</th>
                          <th>Duration</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((b) => (
                          <tr key={b.id}>
                            <td>
                              <strong>{b.booking_number}</strong>
                            </td>
                            <td>
                              <strong style={{ color: '#7c3aed' }}>{b.service_name}</strong>
                            </td>
                            <td>{b.doctor_name}</td>
                            <td>
                              <strong style={{ color: '#0f172a' }}>
                                {new Date(b.scheduled_start).toLocaleString([], {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}
                              </strong>
                            </td>
                            <td>{b.duration_minutes} mins</td>
                            <td>
                              <span className={`admission-status-pill ${b.status}`}>{b.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Discharge Planning */}
          {activeTab === 'discharge' && (
            <DischargePlanningTab
              admission={admission}
              onSaveDischargeSummary={onSaveDischargeSummary}
              onFinalizeDischarge={onFinalizeDischarge}
              isDischarging={isDischarging}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

function DischargePlanningTab({
  admission,
  onSaveDischargeSummary,
  onFinalizeDischarge,
  isDischarging,
}: {
  admission: InpatientAdmission;
  onSaveDischargeSummary?: (data: { hemodynamic_stability_24h: boolean; post_op_recovery_cleared: boolean; home_oral_med_converted: boolean; summary_finalized: boolean; notes?: string | null }) => Promise<void>;
  onFinalizeDischarge?: () => Promise<void>;
  isDischarging?: boolean;
}) {
  const existingSummary = admission.discharge_summary;

  const [hemo, setHemo] = useState(existingSummary?.hemodynamic_stability_24h ?? true);
  const [postOp, setPostOp] = useState(existingSummary?.post_op_recovery_cleared ?? true);
  const [homeMed, setHomeMed] = useState(existingSummary?.home_oral_med_converted ?? true);
  const [docFinal, setDocFinal] = useState(existingSummary?.summary_finalized ?? false);
  const [summaryNotes, setSummaryNotes] = useState(existingSummary?.notes ?? '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (admission.discharge_summary) {
      setHemo(admission.discharge_summary.hemodynamic_stability_24h);
      setPostOp(admission.discharge_summary.post_op_recovery_cleared);
      setHomeMed(admission.discharge_summary.home_oral_med_converted);
      setDocFinal(admission.discharge_summary.summary_finalized);
      setSummaryNotes(admission.discharge_summary.notes ?? '');
    }
  }, [admission.discharge_summary]);

  const { data: billingData, isLoading: billingLoading } = useBillingInvoices({
    admission_id: admission.id,
    branch_id: admission.branch_id,
  }, Boolean(admission.id));

  const activeInvoices = (billingData?.data ?? []).filter((inv) => inv.status !== 'CANCELLED');
  const totalBilled = activeInvoices.reduce((acc, inv) => acc + inv.total_amount, 0);
  const totalBalance = activeInvoices.reduce((acc, inv) => acc + inv.balance_amount, 0);
  const isFinanciallyCleared = activeInvoices.length > 0 ? totalBalance <= 0 : true;

  const isDischarged = admission.status === 'DISCHARGED';

  const handleSave = async () => {
    try {
      setIsSaving(true);
      if (onSaveDischargeSummary) {
        await onSaveDischargeSummary({
          hemodynamic_stability_24h: hemo,
          post_op_recovery_cleared: postOp,
          home_oral_med_converted: homeMed,
          summary_finalized: docFinal,
          notes: summaryNotes,
        });
      }
      toast.success('Discharge readiness checklist and summary saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save discharge summary');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    try {
      if (onFinalizeDischarge) {
        await onFinalizeDischarge();
      }
      toast.success('Patient discharged successfully. Bed released.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to finalize patient discharge');
    }
  };

  const clinicalReady = hemo && postOp && homeMed;
  const docFinalized = docFinal;
  const canFinalize = clinicalReady && docFinalized && isFinanciallyCleared && !isDischarged;

  if (isDischarged) {
    return (
      <div className="inpatient-tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#16a34a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              <i className="ph ph-check" style={{ fontSize: '1.2rem' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#14532d' }}>Patient Discharged</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#166534' }}>
                Operational discharge process has been completed. Workspace is read-only.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', background: '#ffffff', padding: '1rem', borderRadius: '6px', border: '1px solid #dcfce7' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Discharge Date & Time</span>
              <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>
                {admission.discharged_at ? new Date(admission.discharged_at).toLocaleString() : 'Recently Discharged'}
              </strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Discharging Doctor</span>
              <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>{admission.discharged_by_name ?? admission.admitting_doctor_name}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Released Bed</span>
              <strong style={{ color: '#2563eb', fontSize: '0.9rem' }}>Ward {admission.ward_name} / Bed {admission.bed_number}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Final Inpatient Status</span>
              <span className="admission-status-pill CONFIRMED" style={{ background: '#dcfce7', color: '#15803d' }}>DISCHARGED</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inpatient-tab-pane" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="inpatient-tab-pane-header">
        <div>
          <h3 className="pane-title">Discharge Planning & Operational Clearance</h3>
          <p className="pane-sub">
            Evaluate clinical readiness, persist attending doctor documentation, and finalize bed release
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
        {/* Card 1: Clinical Readiness Checklist */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>Discharge Readiness Checklist</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem' }}>
              <input type="checkbox" checked={hemo} onChange={(e) => setHemo(e.target.checked)} />
              <span>Clinical hemodynamic stability (24h afebrility)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem' }}>
              <input type="checkbox" checked={postOp} onChange={(e) => setPostOp(e.target.checked)} />
              <span>Post-op / procedure recovery cleared</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem' }}>
              <input type="checkbox" checked={homeMed} onChange={(e) => setHomeMed(e.target.checked)} />
              <span>Home oral medication converted</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem', color: '#2563eb', fontWeight: 600 }}>
              <input type="checkbox" checked={docFinal} onChange={(e) => setDocFinal(e.target.checked)} />
              <span>Discharge summary finalized by attending doctor</span>
            </label>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>Attending Doctor Notes / Summary</span>
            <textarea
              value={summaryNotes}
              onChange={(e) => setSummaryNotes(e.target.value)}
              placeholder="Clinical summary findings, instructions upon discharge..."
              rows={2}
              style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '6px 8px', fontSize: '0.8rem' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="adm-btn success"
              onClick={handleSave}
              disabled={isSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="ph ph-floppy-disk" /> {isSaving ? 'Saving...' : 'Save Discharge Summary'}
            </button>
          </div>
        </div>

        {/* Card 2: Live Discharge Clearance Summary & Finalize Action */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 600 }}>Operational Discharge Clearance</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem', background: '#ffffff', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Clinical Readiness</span>
              <strong style={{ color: clinicalReady ? '#16a34a' : '#dc2626' }}>{clinicalReady ? '✓ Cleared' : '✕ Pending'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Doctor Summary Finalized</span>
              <strong style={{ color: docFinalized ? '#16a34a' : '#dc2626' }}>{docFinalized ? '✓ Finalized' : '✕ Required'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Financial Clearance</span>
              {billingLoading ? (
                <span style={{ color: '#64748b' }}>Checking...</span>
              ) : isFinanciallyCleared ? (
                <strong style={{ color: '#16a34a' }}>✓ Cleared ({activeInvoices.length > 0 ? `KES ${totalBilled.toLocaleString()}` : 'No billing'})</strong>
              ) : (
                <strong style={{ color: '#d97706' }}>⚠ Outstanding: KES {totalBalance.toLocaleString()}</strong>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Bed Allocation ({admission.bed_number})</span>
              <strong style={{ color: '#2563eb' }}>✓ Will be released</strong>
            </div>
          </div>

          {!canFinalize && (
            <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', padding: '8px 12px', borderRadius: '6px', fontSize: '0.78rem', color: '#d48806', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ph ph-warning" />
              <span>
                Discharge cannot be finalized. {!clinicalReady ? 'Complete the readiness checklist.' : !docFinalized ? 'Check "Discharge summary finalized by attending doctor" and click Save.' : 'Please clear all outstanding bills first.'}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
            <p style={{ margin: 0, fontSize: '0.74rem', color: '#64748b' }}>
              Finalizing discharge marks the patient as DISCHARGED and automatically frees Bed <strong>{admission.bed_number}</strong> for future allotments.
            </p>
            <button
              type="button"
              className="adm-btn primary"
              onClick={handleFinalize}
              disabled={!canFinalize || isDischarging}
              style={{ width: '100%', height: '38px', fontSize: '0.88rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: canFinalize ? '#2563eb' : '#94a3b8' }}
            >
              <i className="ph ph-sign-out" /> {isDischarging ? 'Finalizing Discharge...' : 'Finalize Discharge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
