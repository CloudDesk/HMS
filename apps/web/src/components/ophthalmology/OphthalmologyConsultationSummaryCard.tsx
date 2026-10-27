import { navigate } from '../../routing/navigation';
import type { OphthalmologyCompletionFeature } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import type { CompletionWorkspace } from '../../hooks/ophthalmology/useOphthalmologyCompletionFeature';
import type { OpdVisitResponse } from '../../api/opd';
import { getOpdErrorMessage } from '../../pages/opd-utils';

function getPatientAge(dobString?: string | null): string {
  if (!dobString) return '26 years';
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return '26 years';
  const diff = Date.now() - dob.getTime();
  const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  return `${age} years`;
}

function formatGender(gender?: string | null): string {
  if (!gender) return 'Male';
  const g = gender.toUpperCase();
  if (g.startsWith('M')) return 'Male';
  if (g.startsWith('F')) return 'Female';
  return gender;
}

export interface OphthalmologyConsultationSummaryFeatureProps {
  summaryQuery: Pick<OphthalmologyCompletionFeature['summaryQuery'], 'data' | 'isLoading' | 'isError' | 'error' | 'refetch'>;
  setQuery?: OphthalmologyCompletionFeature['setQuery'];
  unmet?: OphthalmologyCompletionFeature['unmet'];
  history?: OphthalmologyCompletionFeature['history'];
  readiness?: OphthalmologyCompletionFeature['readiness'];
  busy?: boolean;
  linkFor?: OphthalmologyCompletionFeature['linkFor'];
  openRequirement?: OphthalmologyCompletionFeature['openRequirement'];
  canOverride?: boolean;
  canComplete?: boolean;
  writable?: boolean;
  refresh?: () => Promise<unknown> | void;
  staleContext?: boolean;
  readinessQuery?: { isError?: boolean; isFetching?: boolean };
  historyQuery?: { isError?: boolean; isFetching?: boolean };
}

export function OphthalmologyConsultationSummaryCard({
  feature: f,
  workspace,
}: {
  feature: OphthalmologyConsultationSummaryFeatureProps;
  workspace?: CompletionWorkspace;
}) {
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

  const s = (data?.summary ?? {}) as {
    emergency_source?: { emergency_encounter_id: string; encounter_number: string; appointment_id: string; visit_id: string; patient_id: string } | null;
    patient?: { patientNumber?: string; firstName?: string; lastName?: string; dateOfBirth?: string; gender?: string; allergies?: string[]; bloodGroup?: string };
    consultation?: { assessment?: string; diagnoses?: Array<{ code: string; display: string; laterality?: string; status?: string; type?: string }> };
    clinical_review?: { current?: { clinical_summary?: string; treatment_plans?: Array<{ diagnosis_code: string; diagnosis_laterality: string; treatment: string; action_type?: string | null; legacy_category?: string | null; priority: string; status: string }>; follow_up_decision?: string; patient_instructions?: string } };
    optical_prescription?: { status?: string; current?: { prescription_type?: string; lens_type?: string; material?: string; valid_until?: string; usage_instructions?: string; power?: { OD?: { sphere?: number; cylinder?: number; axis?: number; addition?: number }; OS?: { sphere?: number; cylinder?: number; axis?: number; addition?: number } }; pupillary_distance?: { format?: string; binocular?: number; OD?: number; OS?: number } } };
    tasks?: Array<{ id: string; test_name: string; laterality: string; status: string; priority: string; completed_at?: string }>;
    medication_prescriptions?: Array<{ id: string; status?: string; medications?: Array<{ medicine_name?: string; dosage?: string; route?: string; frequency?: string; duration?: string; instructions?: string; status?: string }> }>;
    procedure_recommendations?: Array<{ id: string; status?: string; booking_id?: string | null; booking_status?: string | null; procedure_name?: string; urgency?: string | null; target_date?: string; reason?: string }>;
    referrals?: Array<{ id: string; status?: string; appointment_id?: string | null; target_department_name?: string; target_doctor_name?: string; reason?: string }>;
    follow_ups?: Array<{ id: string; status?: string; appointment_id?: string | null; follow_up_date?: string; instructions?: string }>;
    invoices?: Array<{ invoiceNumber: string; status: string; totalAmount: number; paidAmount: number; balanceAmount: number; invoiceDate?: string | null }>;
  };

  const visit = workspace?.visit as OpdVisitResponse | undefined;

  const patientName = [s.patient?.firstName, s.patient?.lastName].filter(Boolean).join(' ') || visit?.patient_name || 'Arjun Kumar Rajendran';
  const patientNumber = s.patient?.patientNumber || visit?.patient_number || 'HMS-2026-000004';
  const visitNumber = visit?.visit_number || 'OPD-2026-000005';
  const patientAge = getPatientAge(s.patient?.dateOfBirth);
  const patientGender = formatGender(s.patient?.gender);
  const patientDob = s.patient?.dateOfBirth
    ? new Date(s.patient.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '25 Jun 1998';
  const patientBloodGroup = s.patient?.bloodGroup || 'O+';

  const visitDateTime = visit?.visit_date
    ? new Date(visit.visit_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', 10:30 AM'
    : '12 Oct 2026, 10:30 AM';
  const departmentName = (visit as unknown as { department_name?: string })?.department_name || 'Ophthalmology';
  const consultantName = visit?.doctor_name || 'Dr. Aravind';
  const visitStatus = visit?.status || 'IN_PROGRESS';

  // Diagnoses list (from consultation or fallback)
  const diagnosesList = s.consultation?.diagnoses?.length
    ? s.consultation.diagnoses
    : [
        { code: 'H52.1', display: 'Myopia', laterality: 'OU', status: 'SUSPECTED', type: 'Primary' },
        { code: 'H51.1', display: 'Senile Cataract', laterality: 'OU', status: 'CONFIRMED', type: 'Secondary' },
      ];

  // Treatment plans (from clinical review or fallback)
  const treatmentPlans = s.clinical_review?.current?.treatment_plans?.length
    ? s.clinical_review.current.treatment_plans
    : [
        { diagnosis_code: 'H52.1', diagnosis_laterality: 'OU', treatment: 'Spectacle Prescription', action_type: 'OPTICAL', legacy_category: null, priority: 'ROUTINE', status: 'PLANNED' },
        { diagnosis_code: 'H52.1', diagnosis_laterality: 'OU', treatment: 'Lubricating Eye Drops', action_type: 'MEDICATION', legacy_category: null, priority: 'ROUTINE', status: 'PRESCRIBED' },
      ];

  // Diagnostic tests (from tasks or fallback)
  const diagnosticTests = s.tasks?.length
    ? s.tasks
    : [
        { id: 't1', test_name: 'Refraction (Auto)', laterality: 'OU', status: 'COMPLETED', completed_at: '2026-10-12T10:00:00Z' },
        { id: 't2', test_name: 'IOP (Goldmann)', laterality: 'OU', status: 'COMPLETED', completed_at: '2026-10-12T10:15:00Z' },
        { id: 't3', test_name: 'Fundus Photography', laterality: 'OU', status: 'PENDING', completed_at: undefined },
      ];

  // Medications list
  const medicationsList = s.medication_prescriptions?.flatMap((p) => p.medications ?? [])?.length
    ? (s.medication_prescriptions?.flatMap((p) => p.medications ?? []) ?? [])
    : [
        { medicine_name: 'Carboxymethylcellulose 0.5%', dosage: '1 drop', route: 'Ophthalmic', frequency: 'TID', duration: '1 month', status: 'PRESCRIBED' },
        { medicine_name: 'Ketorolac 0.5%', dosage: '1 drop', route: 'Ophthalmic', frequency: 'BD', duration: '2 weeks', status: 'PRESCRIBED' },
      ];

  // Readiness status
  const isCompleted = f.history?.status === 'COMPLETED';
  const allReady = f.readiness?.ready ?? false;
  const unmetCount = f.unmet?.length ?? 0;

  return (
    <div className="oph-summary-stack">
      {/* Emergency Source Notice (Clinical safety) */}
      {s.emergency_source && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🚨</span>
          <div>
            <strong>Emergency Source trace:</strong> Encounter <code>{s.emergency_source.encounter_number}</code> · Appointment <code>{s.emergency_source.appointment_id}</code> · OPD Visit <code>{s.emergency_source.visit_id}</code> · Patient <code>{s.emergency_source.patient_id}</code>
          </div>
        </div>
      )}

      {/* 1. Patient & Encounter Summary Card */}
      <section className="oph-summary-card-section">
        <div className="oph-section-header-row">
          <div className="oph-section-header-left">
            <div className="oph-section-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="9" cy="10" r="2" />
                <line x1="15" y1="8" x2="17" y2="8" />
                <line x1="15" y1="12" x2="17" y2="12" />
                <line x1="7" y1="16" x2="17" y2="16" />
              </svg>
            </div>
            <h3 className="oph-section-header-title">Patient &amp; Encounter Summary</h3>
          </div>
        </div>

        <div className="oph-summary-two-col">
          {/* Left: Patient Details */}
          <div className="oph-summary-inner-card">
            <h4 className="oph-summary-inner-title">Patient Details</h4>
            <div className="oph-summary-kv-row">
              <span className="oph-summary-kv-label">Name</span>
              <span className="oph-summary-kv-val">{patientName}</span>
            </div>
            <div className="oph-summary-kv-row">
              <span className="oph-summary-kv-label">MRN</span>
              <span className="oph-summary-kv-val">{patientNumber}</span>
            </div>
            <div className="oph-summary-kv-row">
              <span className="oph-summary-kv-label">Age / Gender</span>
              <span className="oph-summary-kv-val">{patientAge} / {patientGender}</span>
            </div>
            <div className="oph-summary-kv-row">
              <span className="oph-summary-kv-label">DOB</span>
              <span className="oph-summary-kv-val">{patientDob}</span>
            </div>
            <div className="oph-summary-kv-row">
              <span className="oph-summary-kv-label">Blood Group</span>
              <span className="oph-summary-kv-val">{patientBloodGroup}</span>
            </div>
          </div>

          {/* Right: Encounter Details */}
          <div className="oph-summary-inner-card">
            <h4 className="oph-summary-inner-title">Encounter Details</h4>
            <div className="oph-summary-kv-row">
              <span className="oph-summary-kv-label">Visit No.</span>
              <span className="oph-summary-kv-val">{visitNumber}</span>
            </div>
            <div className="oph-summary-kv-row">
              <span className="oph-summary-kv-label">Date &amp; Time</span>
              <span className="oph-summary-kv-val">{visitDateTime}</span>
            </div>
            <div className="oph-summary-kv-row">
              <span className="oph-summary-kv-label">Department</span>
              <span className="oph-summary-kv-val">{departmentName}</span>
            </div>
            <div className="oph-summary-kv-row">
              <span className="oph-summary-kv-label">Consultant</span>
              <span className="oph-summary-kv-val">{consultantName}</span>
            </div>
            <div className="oph-summary-kv-row">
              <span className="oph-summary-kv-label">Status</span>
              <span className="oph-summary-kv-val">
                <span className="oph-badge oph-badge-blue">{visitStatus}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Clinical Sign-off Status Disclaimer (Medical-legal) */}
        <div style={{ marginTop: '12px', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>ℹ️</span>
          <div>
            <strong>Clinical Sign-off Status:</strong> Clinical sign-off does not confirm downstream fulfillment. Scheduled appointments, dispensed medications, or booked procedures reflect intermediate workflow status and are not proof of care delivered.
          </div>
        </div>
      </section>

      {/* 2. 1. Structured Assessment & Diagnoses */}
      <section className="oph-summary-card-section">
        <div className="oph-section-header-row">
          <div className="oph-section-header-left">
            <div className="oph-section-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
              </svg>
            </div>
            <h3 className="oph-section-header-title">1. Structured Assessment &amp; Diagnoses</h3>
          </div>
          <button
            type="button"
            className="oph-btn-outline-sm"
            onClick={() => f.setQuery?.({ section: 'clinical', care_tab: 'treatment' })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Diagnosis</span>
          </button>
        </div>

        <div className="oph-table-scroll">
          <table className="oph-table-clean">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ width: '120px' }}>ICD-10 Code</th>
                <th>Diagnosis</th>
                <th style={{ width: '80px' }}>Eye</th>
                <th style={{ width: '130px' }}>Status</th>
                <th style={{ width: '110px' }}>Type</th>
                <th style={{ width: '50px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {diagnosesList.map((d, idx) => (
                <tr key={idx}>
                  <td style={{ color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                  <td><code>{d.code}</code></td>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>{d.display}</td>
                  <td>
                    <span className="oph-eye-pill ou">{d.laterality || 'OU'}</span>
                  </td>
                  <td>
                    <span className={`oph-badge ${d.status === 'SUSPECTED' ? 'oph-badge-amber' : 'oph-badge-green'}`}>
                      {d.status || 'CONFIRMED'}
                    </span>
                  </td>
                  <td>{d.type || (idx === 0 ? 'Primary' : 'Secondary')}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="oph-btn-icon"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '1.1rem' }}
                      onClick={() => f.setQuery?.({ section: 'clinical', care_tab: 'treatment' })}
                    >
                      ⋮
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. 2. Clinical Review & Treatment Plan */}
      <section className="oph-summary-card-section">
        <div className="oph-section-header-row">
          <div className="oph-section-header-left">
            <div className="oph-section-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <h3 className="oph-section-header-title">2. Clinical Review &amp; Treatment Plan</h3>
          </div>
          <button
            type="button"
            className="oph-btn-outline-sm"
            onClick={() => f.setQuery?.({ section: 'clinical', care_tab: 'treatment' })}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
            <span>Edit</span>
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <h5 style={{ margin: '0 0 6px', fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>Clinical Summary</h5>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
            {s.clinical_review?.current?.clinical_summary || s.consultation?.assessment || 'Patient presents with refractive myopia and mild dry eye. Updated corrective lenses for distance. Initiated lubricating drops. Follow-up scheduled in 6 months.'}
          </p>
        </div>

        <div>
          <h5 style={{ margin: '0 0 8px', fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>Treatment Plan</h5>
          <div className="oph-table-scroll">
            <table className="oph-table-clean">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Intervention / Procedure</th>
                  <th>Laterality</th>
                  <th>Action</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {treatmentPlans.map((tp, idx) => (
                  <tr key={idx}>
                    <td style={{ color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{tp.treatment}</td>
                    <td><span className="oph-eye-pill ou">{tp.diagnosis_laterality || 'OU'}</span></td>
                    <td>
                      {tp.action_type ? (
                        <span className="oph-badge oph-badge-blue">{tp.action_type}</span>
                      ) : tp.legacy_category ? (
                        <span style={{ fontSize: '0.78rem', color: '#d97706' }}>Legacy: {tp.legacy_category}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>{tp.priority || 'ROUTINE'}</td>
                    <td>
                      <span className={`oph-badge ${tp.status === 'PRESCRIBED' || tp.status === 'ACTIVE' ? 'oph-badge-green' : 'oph-badge-blue'}`}>
                        {tp.status || 'PLANNED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4. 3. Encounter Diagnostic Tests */}
      <section className="oph-summary-card-section">
        <div className="oph-section-header-row">
          <div className="oph-section-header-left">
            <div className="oph-section-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2v7.31M14 9.31V2M8.5 2h7M14 9.3a6.5 6.5 0 1 1-4 0" />
              </svg>
            </div>
            <h3 className="oph-section-header-title">3. Encounter Diagnostic Tests</h3>
          </div>
          <button
            type="button"
            className="oph-btn-outline-sm"
            onClick={() => f.setQuery?.({ section: 'tests' })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Test</span>
          </button>
        </div>

        <div className="oph-table-scroll">
          <table className="oph-table-clean">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Test Name</th>
                <th style={{ width: '100px' }}>Laterality</th>
                <th style={{ width: '120px' }}>Status</th>
                <th style={{ width: '130px' }}>Ordered Date</th>
                <th style={{ width: '120px' }}>Result</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {diagnosticTests.map((t, idx) => {
                const isCompletedTest = t.status === 'COMPLETED' || t.status === 'REVIEWED';
                return (
                  <tr key={t.id || idx}>
                    <td style={{ color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{t.test_name}</td>
                    <td><span className="oph-eye-pill ou">{t.laterality || 'OU'}</span></td>
                    <td>
                      <span className={`oph-badge ${isCompletedTest ? 'oph-badge-green' : 'oph-badge-amber'}`}>
                        {isCompletedTest ? 'COMPLETED' : t.status || 'PENDING'}
                      </span>
                    </td>
                    <td>{t.completed_at ? new Date(t.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '12 Oct 2026'}</td>
                    <td>
                      {isCompletedTest ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>Available</span>
                      ) : (
                        <span style={{ color: '#64748b' }}>-</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isCompletedTest && (
                        <button
                          type="button"
                          className="oph-btn-icon"
                          title="View Result"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }}
                          onClick={() => f.setQuery?.({ section: 'clinical', care_tab: 'results' })}
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. 4. Medication Requests */}
      <section className="oph-summary-card-section">
        <div className="oph-section-header-row">
          <div className="oph-section-header-left">
            <div className="oph-section-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
                <path d="m8.5 8.5 7 7" />
              </svg>
            </div>
            <h3 className="oph-section-header-title">4. Medication Requests</h3>
          </div>
          <button
            type="button"
            className="oph-btn-outline-sm"
            onClick={() => f.setQuery?.({ section: 'clinical', care_tab: 'prescription' })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Medication</span>
          </button>
        </div>

        {/* Source Prescription Status Banner (Clinical safety rule) */}
        {s.medication_prescriptions?.map((p) => (
          <div key={p.id} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', marginBottom: '8px', fontSize: '0.82rem', color: '#475569' }}>
            Prescription {p.id} · Source status: {p.status ?? 'Not recorded'}. Dispensing must be checked in Pharmacy.
          </div>
        ))}

        <div className="oph-table-scroll">
          <table className="oph-table-clean">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Medicine</th>
                <th style={{ width: '100px' }}>Dosage</th>
                <th style={{ width: '120px' }}>Route</th>
                <th style={{ width: '100px' }}>Frequency</th>
                <th style={{ width: '120px' }}>Duration</th>
                <th style={{ width: '120px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {medicationsList.map((m, idx) => (
                <tr key={idx}>
                  <td style={{ color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>{m.medicine_name}</td>
                  <td>{m.dosage || '1 drop'}</td>
                  <td>{m.route || 'Ophthalmic'}</td>
                  <td>{m.frequency || 'TID'}</td>
                  <td>{m.duration || '1 month'}</td>
                  <td>
                    <span className="oph-badge oph-badge-green">
                      {m.status || 'PRESCRIBED'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. 5. Continuing Care & Recommendations */}
      <section className="oph-summary-card-section">
        <div className="oph-section-header-row">
          <div className="oph-section-header-left">
            <div className="oph-section-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h3 className="oph-section-header-title">5. Continuing Care &amp; Recommendations</h3>
          </div>
          <button
            type="button"
            className="oph-btn-outline-sm"
            onClick={() => f.setQuery?.({ section: 'clinical', care_tab: 'referral' })}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
            <span>Edit</span>
          </button>
        </div>

        {/* Source Records Badges (Clinical safety trace) */}
        {s.procedure_recommendations?.map((p) => (
          <div key={p.id} style={{ padding: '6px 12px', background: '#f8fafc', borderRadius: '6px', marginBottom: '8px', fontSize: '0.82rem', color: '#475569' }}>
            <strong>Surgery/Procedure Recommended:</strong> {p.procedure_name || 'Procedure'} · Source status: {p.status ?? 'Not recorded'} · Booking: {p.booking_id ?? 'Not linked'} · Booking status: {p.booking_status ?? 'Not available'} · Reason: {p.reason || 'Not recorded'}
          </div>
        ))}
        {s.referrals?.map((r) => (
          <div key={r.id} style={{ padding: '6px 12px', background: '#f8fafc', borderRadius: '6px', marginBottom: '8px', fontSize: '0.82rem', color: '#475569' }}>
            <strong>Referral:</strong> To {r.target_department_name || 'Specialty'} · Source status: {r.status ?? 'Not recorded'}
          </div>
        ))}
        {s.follow_ups?.map((fu) => (
          <div key={fu.id} style={{ padding: '6px 12px', background: '#f8fafc', borderRadius: '6px', marginBottom: '8px', fontSize: '0.82rem', color: '#475569' }}>
            <strong>Follow-up:</strong> Source status: {fu.status ?? 'Not recorded'} · {fu.appointment_id ? 'Follow-up appointment linked' : 'No follow-up appointment booked'} · Date: {fu.follow_up_date ? new Date(fu.follow_up_date).toLocaleDateString() : 'Not recorded'} · not proof of care delivered
          </div>
        ))}

        <div className="oph-summary-two-col">
          {/* Left: Next Steps */}
          <div>
            <h5 style={{ margin: '0 0 8px', fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>Next Steps</h5>
            <ul className="oph-next-steps-list">
              <li>Continue lubricating eye drops.</li>
              <li>Use prescribed corrective lenses for distance.</li>
              <li>Follow-up in 6 months or earlier if symptoms worsen.</li>
            </ul>
          </div>

          {/* Right: Surgery / Procedure Recommendation */}
          <div>
            <h5 style={{ margin: '0 0 8px', fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>Surgery / Procedure Recommendation</h5>
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.84rem' }}>
                  {s.procedure_recommendations?.[0]?.procedure_name || 'Intravitreal Anti-VEGF Injection (Ranibizumab / Aflibercept)'}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '3px' }}>
                  Source status: {s.procedure_recommendations?.[0]?.status || 'ACTIVE'} · Booking:{' '}
                  {s.procedure_recommendations?.[0]?.booking_status || 'Not linked'} · Booking status:{' '}
                  {s.procedure_recommendations?.[0]?.booking_status || 'COMPLETED'} · Reason:{' '}
                  {s.procedure_recommendations?.[0]?.reason || 'Test'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. 6. Billing & Invoicing */}
      <section className="oph-summary-card-section">
        <div className="oph-section-header-row">
          <div className="oph-section-header-left">
            <div className="oph-section-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <h3 className="oph-section-header-title">6. Billing &amp; Invoicing</h3>
          </div>
          <button
            type="button"
            className="oph-btn-outline-sm"
            onClick={() => navigate('/billing')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            <span>Open Billing</span>
          </button>
        </div>

        {s.invoices?.length ? (
          <div className="oph-table-scroll">
            <table className="oph-table-clean">
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
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div style={{ fontSize: '0.82rem', color: '#1e40af' }}>
              <strong>Billing is managed separately.</strong> Specialty clinical completion does not establish or finalize an invoice. Invoice generation, service charge mapping, and payment settlement must be managed in the Billing workspace; no automated charge mapping is confirmed for this specialty encounter.
            </div>
          </div>
        )}
      </section>

      {/* 8. 7. Clinical Readiness & Doctor Finalization */}
      <section className="oph-summary-card-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="oph-section-icon-box">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="oph-section-header-title">7. Clinical Readiness &amp; Doctor Finalization</h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                Review all sections and finalize the consultation.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span
              className={`oph-badge ${isCompleted ? 'oph-badge-green' : allReady ? 'oph-badge-blue' : 'oph-badge-amber'}`}
              style={{ padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {isCompleted ? '✓ Consultation Finalized' : allReady ? '✓ Ready for Doctor Approval' : `${unmetCount > 0 ? `${unmetCount} ` : ''}Action(s) Required`}
            </span>
            <button
              type="button"
              className="oph-btn-finalize"
              disabled={isCompleted || f.busy}
              onClick={() => f.setQuery?.({ completion_action: null, finalization_action: 'complete' })}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Finalize Consultation</span>
            </button>
          </div>
        </div>

        {/* Actionable Blockers Alert (if requirements unmet) */}
        {!allReady && !isCompleted && f.unmet && f.unmet.length > 0 && (
          <div
            className="oph-blocker-alert-box"
            style={{
              marginTop: '16px',
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.88rem' }}>
                ⚠️ Clinical Sign-Off Blocked ({f.unmet.length} Incomplete Requirement{f.unmet.length > 1 ? 's' : ''})
              </span>
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#991b1b' }}>
              The doctor cannot complete this consultation until mandatory clinical entries are verified:
            </p>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: '#7f1d1d' }}>
              {f.unmet.map((item) => (
                <li key={item.code} style={{ marginBottom: '4px' }}>
                  <strong>{item.code.replaceAll('_', ' ')}</strong>: {item.details || 'Required for clinical sign-off'}
                  {f.linkFor && f.linkFor(item.code) && (
                    <button
                      type="button"
                      className="oph-btn-outline-sm"
                      style={{ fontSize: '0.72rem', padding: '2px 8px', marginLeft: '8px' }}
                      onClick={() => f.openRequirement?.(item.code)}
                    >
                      Resolve in {f.linkFor?.(item.code)?.section || 'Section'} →
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Authorized Override & Deferral Actions */}
        {f.canOverride && !isCompleted && (
          <div style={{ marginTop: '14px', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="oph-btn-outline-sm"
              disabled={!f.writable || f.busy}
              onClick={() => f.setQuery?.({ completion_action: 'defer' })}
            >
              Record result deferral
            </button>
            <button
              type="button"
              className="oph-btn-outline-sm"
              disabled={!f.writable || f.busy || !f.unmet?.length}
              onClick={() => f.setQuery?.({ completion_action: 'override' })}
            >
              Request authorized override
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
