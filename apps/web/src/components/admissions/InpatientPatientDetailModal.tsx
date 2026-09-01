import type React from 'react';
import type {
  InpatientAdmission,
  InpatientBooking,
  InpatientDiagnosticOrder,
  InpatientRecommendation,
  InpatientRoundNote,
  InpatientVital,
} from '../../api/inpatient-admissions';
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
  loading: {
    admissions?: boolean;
    recommendations?: boolean;
    bookings?: boolean;
    roundNotes?: boolean;
    vitals?: boolean;
    diagnosticOrders?: boolean;
  };
  errors: {
    roundNotes?: string | null;
    vitals?: string | null;
    diagnosticOrders?: string | null;
  };
  recommendations: InpatientRecommendation[];
  bookings: InpatientBooking[];
  roundNotes: InpatientRoundNote[];
  vitals: InpatientVital[];
  diagnosticOrders: InpatientDiagnosticOrder[];
  onOpenScheduleSurgery: () => void;
  onOpenAddRoundNote: () => void;
  onOpenRecordVitals: () => void;
  onOpenAddOrder: () => void;
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
            <div className="inpatient-tab-pane">
              <div className="inpatient-tab-pane-header">
                <div>
                  <h3 className="pane-title">Discharge Planning & Summary</h3>
                  <p className="pane-sub">
                    Evaluate clinical discharge readiness, draft discharge summaries, and coordinate bed release
                  </p>
                </div>
              </div>

              <div className="discharge-grid">
                <div className="discharge-card">
                  <h4>Discharge Readiness Checklist</h4>
                  <div className="checklist-stack">
                    <label>
                      <input type="checkbox" defaultChecked />{' '}
                      <span>Clinical hemodynamic stability (24h afebrility)</span>
                    </label>
                    <label>
                      <input type="checkbox" defaultChecked />{' '}
                      <span>Post-op / procedure recovery cleared</span>
                    </label>
                    <label>
                      <input type="checkbox" defaultChecked />{' '}
                      <span>Home oral medication converted</span>
                    </label>
                    <label>
                      <input type="checkbox" />{' '}
                      <span>Discharge summary finalized by attending doctor</span>
                    </label>
                  </div>
                </div>

                <div className="discharge-card actions">
                  <h4>Actions</h4>
                  <p>
                    Discharge is finalized in Bed Management after clearance of pending pharmacy and diagnostic invoices.
                  </p>
                  <button
                    type="button"
                    className="adm-btn success"
                    onClick={() => toast.success('Discharge summary saved to patient EHR timeline.')}
                  >
                    <i className="ph ph-check" /> Save Discharge Summary
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
