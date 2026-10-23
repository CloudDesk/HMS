import { queueTime } from '../../hooks/ophthalmology/queue-actions';
import type { OphthalmologyCompletionFeature } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import { getOpdErrorMessage } from '../../pages/opd-utils';

export function OphthalmologyConsultationSummaryCard({ feature: f }: { feature: { summaryQuery: Pick<OphthalmologyCompletionFeature['summaryQuery'], 'data' | 'isLoading' | 'isError' | 'error' | 'refetch'> } }) {
  const data = f.summaryQuery.data;

  if (f.summaryQuery.isLoading) {
    return (
      <section className="doc-card oph-summary-card">
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <p role="status" style={{ margin: 0, color: '#64748b', fontWeight: 600 }}>
            Loading consolidated consultation summary…
          </p>
        </div>
      </section>
    );
  }

  if (f.summaryQuery.isError) {
    return (
      <section className="doc-card oph-summary-card">
        <div className="oph-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>Consolidated Consultation Summary</h4>
          <button type="button" className="doc-btn danger" onClick={() => void f.summaryQuery.refetch()}>
            Retry Summary
          </button>
        </div>
        <p className="doc-error-text form-error-banner" role="alert" style={{ marginTop: '12px' }}>
          Failed to load consolidated consultation summary. {getOpdErrorMessage(f.summaryQuery.error)}
        </p>
      </section>
    );
  }

  if (!data?.summary) {
    return (
      <section className="doc-card oph-summary-card">
        <div className="oph-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>Consolidated Consultation Summary</h4>
          <button type="button" className="doc-btn primary" onClick={() => void f.summaryQuery.refetch()}>
            Load Summary
          </button>
        </div>
        <p style={{ color: '#64748b', margin: '8px 0 0' }}>The summary report is ready to be fetched from the server.</p>
      </section>
    );
  }

  const s = data.summary as {
    emergency_source?: { emergency_encounter_id: string; encounter_number: string; appointment_id: string; visit_id: string; patient_id: string } | null;
    patient?: { patientNumber?: string; firstName?: string; lastName?: string; dateOfBirth?: string; gender?: string; allergies?: string[] };
    consultation?: { assessment?: string; diagnoses?: Array<{ code: string; display: string; laterality?: string; status?: string; type?: string }> };
    clinical_review?: { current?: { clinical_summary?: string; treatment_plans?: Array<{ diagnosis_code: string; diagnosis_laterality: string; treatment: string; action_type?: string | null; legacy_category?: string | null; priority: string; status: string }>; follow_up_decision?: string; patient_instructions?: string } };
    optical_prescription?: { status?: string; current?: { prescription_type?: string; lens_type?: string; material?: string; valid_until?: string; usage_instructions?: string; power?: { OD?: { sphere?: number; cylinder?: number; axis?: number; addition?: number }; OS?: { sphere?: number; cylinder?: number; axis?: number; addition?: number } }; pupillary_distance?: { format?: string; binocular?: number; OD?: number; OS?: number } } };
    tasks?: Array<{ id: string; test_name: string; laterality: string; status: string; priority: string; completed_at?: string }>;
    medication_prescriptions?: Array<{ id: string; status?: string; medications?: Array<{ medicine_name?: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }> }>;
    procedure_recommendations?: Array<{ id: string; status?: string; booking_id?: string | null; booking_status?: string | null; procedure_name?: string; urgency?: string | null; target_date?: string; reason?: string }>;
    referrals?: Array<{ id: string; status?: string; appointment_id?: string | null; target_department_name?: string; target_doctor_name?: string; reason?: string }>;
    follow_ups?: Array<{ id: string; status?: string; appointment_id?: string | null; follow_up_date?: string; instructions?: string }>;
    previous_results?: Array<{ id: string; current?: { form_type: string; performed_at: string; payload: Record<string, unknown> } }>;
    invoices?: Array<{ invoiceNumber: string; status: string; totalAmount: number; paidAmount: number; balanceAmount: number; invoiceDate?: string | null }>;
  };

  const finalization = data.finalization;
  const latestApproval = finalization?.completions?.at(-1);

  return (
    <section className="doc-card oph-summary-card oph-printable" id="oph-consultation-summary-card">
      {/* Report Header Bar */}
      <div className="oph-summary-top-bar oph-no-print">
        <div className="oph-summary-title-wrap">
          <div className="oph-summary-badge-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              Consolidated Consultation Summary Report
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>
              Official encounter record and clinical documentation overview
            </p>
          </div>
        </div>
        <div className="oph-toolbar" style={{ margin: 0 }}>
          <button type="button" className="doc-btn primary" onClick={() => window.print()}>
            Print Consultation Report
          </button>
          <button type="button" className="doc-btn" onClick={() => void f.summaryQuery.refetch()}>
            Refresh Summary
          </button>
        </div>
      </div>

      {/* Patient Profile & Clinical Sign-off Header Cards */}
      <div className="oph-summary-meta-grid">
        <div className="oph-summary-meta-card">
          <div className="oph-meta-title">Patient Demographics</div>
          <p style={{ margin: '4px 0' }}>
            <strong>Patient:</strong> {s.patient?.firstName} {s.patient?.lastName} · MRN: {s.patient?.patientNumber}
          </p>
          <p style={{ margin: '4px 0', color: '#64748b' }}>
            <strong>Gender / Age:</strong> {s.patient?.gender ?? 'Not recorded'} · DOB: {s.patient?.dateOfBirth ? new Date(s.patient.dateOfBirth).toLocaleDateString() : 'N/A'}
          </p>
        </div>
        <div className="oph-summary-meta-card">
          <div className="oph-meta-title">Encounter Governance</div>
          <p style={{ margin: '4px 0' }}>
            <strong>Clinical Sign-off Status:</strong>{' '}
            <span className={`oph-badge ${finalization?.status === 'COMPLETED' ? 'oph-badge-green' : 'oph-badge-blue'}`}>
              {finalization?.status ?? 'IN_PROGRESS'}
            </span>
          </p>
          {latestApproval ? (
            <p style={{ margin: '4px 0', color: '#047857', fontWeight: 600 }}>
              <strong>Doctor Approval:</strong> Approved {queueTime(latestApproval.approved_at)} by Doctor {latestApproval.approver_doctor_id}
            </p>
          ) : (
            <p style={{ margin: '4px 0', color: '#64748b' }}>
              Pending final doctor authentication and sign-off.
            </p>
          )}
        </div>
      </div>

      <div className="oph-clinical-notice">
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
          Clinical sign-off does not confirm downstream fulfillment or completion of the patient journey. Source statuses below reflect the latest retrieved records; submitted requests and scheduled appointments are not proof of care delivered.
        </p>
      </div>

      {s.emergency_source && (
        <div className="oph-emergency-source-banner" style={{ marginTop: '12px', padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.84rem' }}>
          <strong>Emergency referral source:</strong> {s.emergency_source.encounter_number} · Emergency encounter {s.emergency_source.emergency_encounter_id} · Appointment {s.emergency_source.appointment_id} · OPD encounter {s.emergency_source.visit_id}
        </div>
      )}

      {/* 1. Structured Assessment & Diagnoses */}
      <div className="oph-summary-section">
        <div className="oph-summary-section-header">
          <span className="oph-section-badge">1</span>
          <h5>Structured Assessment & Diagnoses</h5>
        </div>
        <p className="oph-assessment-text">{s.consultation?.assessment || 'No general assessment narrative recorded.'}</p>
        {s.consultation?.diagnoses && s.consultation.diagnoses.length > 0 ? (
          <div className="oph-table-scroll">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Diagnosis</th>
                  <th>Eye</th>
                  <th>Status / Certainty</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {s.consultation.diagnoses.map((d, index) => (
                  <tr key={index}>
                    <td><code>{d.code}</code></td>
                    <td style={{ fontWeight: 600 }}>{d.display}</td>
                    <td>
                      <span className={`oph-badge ${d.laterality === 'OD' ? 'oph-badge-blue' : d.laterality === 'OS' ? 'oph-badge-green' : 'oph-badge-purple'}`}>
                        {d.laterality ?? 'NOT_APPLICABLE'}
                      </span>
                    </td>
                    <td>{d.status ?? 'CONFIRMED'}</td>
                    <td>{d.type ?? 'PRIMARY'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>No diagnoses recorded for this visit.</p>
        )}
      </div>

      {/* 2. Clinical Review & Treatment Plans */}
      <div className="oph-summary-section">
        <div className="oph-summary-section-header">
          <span className="oph-section-badge">2</span>
          <h5>Clinical Review & Treatment Plan</h5>
        </div>
        <p className="oph-assessment-text">{s.clinical_review?.current?.clinical_summary || 'No clinical summary recorded.'}</p>
        {s.clinical_review?.current?.treatment_plans && s.clinical_review.current.treatment_plans.length > 0 && (
          <div className="oph-table-scroll">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Diagnosis & Eye</th>
                  <th>Treatment</th>
                  <th>Action</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {s.clinical_review.current.treatment_plans.map((tp, idx) => (
                  <tr key={idx}>
                    <td><strong>{tp.diagnosis_code}</strong> ({tp.diagnosis_laterality})</td>
                    <td>{tp.treatment}</td>
                    <td>{tp.action_type ?? (tp.legacy_category ? `Legacy: ${tp.legacy_category}` : 'Unclassified')}</td>
                    <td>
                      <span className={`oph-badge ${tp.priority === 'EMERGENCY' ? 'oph-badge-red' : tp.priority === 'URGENT' ? 'oph-badge-amber' : 'oph-badge-blue'}`}>
                        {tp.priority}
                      </span>
                    </td>
                    <td>{tp.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {s.clinical_review?.current?.patient_instructions && (
          <div style={{ marginTop: '10px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid #2563eb' }}>
            <strong style={{ color: '#1e293b' }}>Patient Instructions:</strong> {s.clinical_review.current.patient_instructions}
          </div>
        )}
      </div>

      {/* 3. Optical Prescription */}
      {s.optical_prescription?.current && (
        <div className="oph-summary-section">
          <div className="oph-summary-section-header">
            <span className="oph-section-badge">3</span>
            <h5>{s.optical_prescription?.status === 'APPROVED' ? 'Approved Optical Prescription' : 'Draft Optical Prescription (Pending Approval)'}</h5>
          </div>
          <p style={{ color: '#475569', margin: '0 0 10px', fontSize: '0.86rem' }}>
            Type: <strong>{s.optical_prescription.current.prescription_type}</strong> · Lens: <strong>{s.optical_prescription.current.lens_type}</strong> · Material: <strong>{s.optical_prescription.current.material}</strong> · Valid until: <strong>{s.optical_prescription.current.valid_until ? new Date(s.optical_prescription.current.valid_until).toLocaleDateString() : 'N/A'}</strong>
          </p>
          <div className="oph-table-scroll">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Eye</th>
                  <th>Sphere (SPH)</th>
                  <th>Cylinder (CYL)</th>
                  <th>Axis</th>
                  <th>Addition (ADD)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="oph-badge oph-badge-blue">OD (Right Eye)</span></td>
                  <td style={{ fontWeight: 600 }}>{s.optical_prescription.current.power?.OD?.sphere != null ? (s.optical_prescription.current.power.OD.sphere > 0 ? `+${s.optical_prescription.current.power.OD.sphere}` : s.optical_prescription.current.power.OD.sphere) : '—'}</td>
                  <td>{s.optical_prescription.current.power?.OD?.cylinder ?? '—'}</td>
                  <td>{s.optical_prescription.current.power?.OD?.axis ?? '—'}</td>
                  <td>{s.optical_prescription.current.power?.OD?.addition ?? '—'}</td>
                </tr>
                <tr>
                  <td><span className="oph-badge oph-badge-green">OS (Left Eye)</span></td>
                  <td style={{ fontWeight: 600 }}>{s.optical_prescription.current.power?.OS?.sphere != null ? (s.optical_prescription.current.power.OS.sphere > 0 ? `+${s.optical_prescription.current.power.OS.sphere}` : s.optical_prescription.current.power.OS.sphere) : '—'}</td>
                  <td>{s.optical_prescription.current.power?.OS?.cylinder ?? '—'}</td>
                  <td>{s.optical_prescription.current.power?.OS?.axis ?? '—'}</td>
                  <td>{s.optical_prescription.current.power?.OS?.addition ?? '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {s.optical_prescription.current.pupillary_distance && (
            <p style={{ margin: '8px 0 0', fontSize: '0.84rem', color: '#475569' }}>
              <strong>PD:</strong> {s.optical_prescription.current.pupillary_distance.format === 'BINOCULAR' ? `${s.optical_prescription.current.pupillary_distance.binocular} mm` : `OD: ${s.optical_prescription.current.pupillary_distance.OD} mm / OS: ${s.optical_prescription.current.pupillary_distance.OS} mm`}
            </p>
          )}
        </div>
      )}

      {/* 4. Diagnostic Tests */}
      <div className="oph-summary-section">
        <div className="oph-summary-section-header">
          <span className="oph-section-badge">4</span>
          <h5>Encounter Diagnostic Tests</h5>
        </div>
        {s.tasks && s.tasks.length > 0 ? (
          <div className="oph-table-scroll">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Eye</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {s.tasks.map((task) => {
                  const name = task.test_name ?? (task as Record<string, unknown>).testName ?? '';
                  const comp = task.completed_at ?? (task as Record<string, unknown>).completedAt;
                  return (
                    <tr key={task.id}>
                      <td style={{ fontWeight: 600 }}>{name}</td>
                      <td>{task.laterality}</td>
                      <td>
                        <span className={`oph-badge ${task.status === 'REVIEWED' ? 'oph-badge-green' : 'oph-badge-blue'}`}>
                          {task.status}
                        </span>
                      </td>
                      <td>{task.priority}</td>
                      <td>{comp ? queueTime(comp as string) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>No specialized test orders in this encounter.</p>
        )}
      </div>

      {/* 5. Medication Prescriptions */}
      <div className="oph-summary-section">
        <div className="oph-summary-section-header">
          <span className="oph-section-badge">5</span>
          <h5>Medication Requests</h5>
        </div>
        {s.medication_prescriptions?.length ? s.medication_prescriptions.map((prescription) => (
          <div key={prescription.id} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', marginBottom: '8px', fontSize: '0.86rem' }}>
            Prescription {prescription.id} · Source status: {prescription.status ?? 'Not recorded'}. Dispensing must be checked in Pharmacy.
          </div>
        )) : (
          <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>No medication requests recorded.</p>
        )}
      </div>

      {/* 6. Continuing Care & Recommendations */}
      {(s.procedure_recommendations?.length || s.referrals?.length || s.follow_ups?.length) ? (
        <div className="oph-summary-section">
          <div className="oph-summary-section-header">
            <span className="oph-section-badge">6</span>
            <h5>Continuing Care & Recommendations</h5>
          </div>
          {s.procedure_recommendations?.map((p) => (
            <div key={p.id} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', marginBottom: '8px', fontSize: '0.86rem' }}>
              <strong>Surgery/Procedure Recommended:</strong> {p.procedure_name} · Source status: {p.status ?? 'Not recorded'} · Booking: {p.booking_id ?? 'Not linked'} · Booking status: {p.booking_status ?? 'Not available'} · Reason: {p.reason || 'Not recorded'}
            </div>
          ))}
          {s.referrals?.map((r) => (
            <div key={r.id} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', marginBottom: '8px', fontSize: '0.86rem' }}>
              <strong>Referral:</strong> To {r.target_department_name} ({r.target_doctor_name ?? 'Any Specialist'}) · Source status: {r.status ?? 'Not recorded'} · Appointment: {r.appointment_id ?? 'Not linked'} · Reason: {r.reason}
            </div>
          ))}
          {s.follow_ups?.map((f) => (
            <div key={f.id} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', marginBottom: '8px', fontSize: '0.86rem' }}>
              <strong>Follow-up:</strong> Source status: {f.status ?? 'Not recorded'} · Appointment: {f.appointment_id ?? 'Not linked'} · Date: {f.follow_up_date ? new Date(f.follow_up_date).toLocaleDateString() : 'Not recorded'} · Instructions: {f.instructions || 'Not recorded'}
            </div>
          ))}
        </div>
      ) : null}

      {/* 7. Billing & Invoicing Notice */}
      <div className="oph-summary-section">
        <div className="oph-summary-section-header">
          <span className="oph-section-badge">7</span>
          <h5>Billing &amp; Invoicing</h5>
        </div>
        {s.invoices?.length ? (
          <div className="oph-table-scroll">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Status</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Balance Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.invoices.map((inv) => (
                  <tr key={inv.invoiceNumber}>
                    <td><strong>{inv.invoiceNumber}</strong></td>
                    <td><span className="oph-badge oph-badge-green">{inv.status}</span></td>
                    <td>{Number(inv.totalAmount).toFixed(2)}</td>
                    <td>{Number(inv.paidAmount).toFixed(2)}</td>
                    <td>{Number(inv.balanceAmount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '0.84rem', color: '#64748b' }}>
            Specialty clinical completion does not establish or finalize an invoice. Invoice generation, service charge mapping, and payment settlement must be managed in the Billing workspace; no automated charge mapping is confirmed for this specialty encounter.
          </p>
        )}
      </div>
    </section>
  );
}
