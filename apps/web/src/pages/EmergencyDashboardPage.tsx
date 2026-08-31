import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import type { EmergencyEncounter, EmergencyStatus, EmergencyTriageLevel } from '../api/emergency';
import { Modal } from '../components/ui/Modal';
import { useEmergencyWorkspaceFeature } from '../hooks/emergency/useEmergencyWorkspaceFeature';
import { navigate } from '../routing/navigation';

const id = z.string().min(1, 'Required');
const optionalNumber = z.number().optional();
const numericInput = { setValueAs: (value: string) => (value === '' ? undefined : Number(value)) };

const registrationSchema = z
  .object({
    department_id: id,
    patient_id: z.string().optional(),
    display_name: z.string().optional(),
    estimated_age: optionalNumber,
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']),
    contact: z.string().optional(),
    identity_notes: z.string().optional(),
    arrival_mode: z.string().min(2),
    chief_complaint: z.string().min(3, 'Chief emergency complaint is required'),
    arrival_notes: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.patient_id && (!value.display_name || value.display_name.trim().length < 2)) {
      ctx.addIssue({
        code: 'custom',
        path: ['patient_id'],
        message: 'Select a registered patient OR enter a patient name / unknown tag',
      });
    }
  });

type RegistrationForm = z.infer<typeof registrationSchema>;

const triageLabel = (value?: EmergencyTriageLevel | null) => {
  if (!value) return 'Not triaged';
  switch (value) {
    case 'LEVEL_1_CRITICAL': return 'Level 1 Critical';
    case 'LEVEL_2_HIGH': return 'Level 2 High';
    case 'LEVEL_3_MEDIUM': return 'Level 3 Medium';
    case 'LEVEL_4_LOW': return 'Level 4 Low';
    case 'LEVEL_5_NON_URGENT': return 'Level 5 Non-Urgent';
    default: return value;
  }
};

const triageSlug = (value?: EmergencyTriageLevel | null) => {
  if (!value) return 'not-triaged';
  return value.toLowerCase().replace(/_/g, '-');
};

const statusLabel = (status: EmergencyStatus) => {
  switch (status) {
    case 'REGISTERED': return 'Registered';
    case 'WAITING_FOR_TRIAGE': return 'Waiting';
    case 'TRIAGED': return 'Triaged';
    case 'WAITING_FOR_DOCTOR': return 'Waiting';
    case 'IN_CONSULTATION': return 'In Consultation';
    case 'IN_TREATMENT': return 'In Treatment';
    case 'READY_FOR_DISPOSITION': return 'Ready for Admission';
    case 'DISCHARGED': return 'Discharged';
    case 'TRANSFERRED': return 'Transferred';
    case 'CONVERTED_TO_IP': return 'Admitted';
    case 'LEFT': return 'Left';
    case 'NO_SHOW': return 'No Show';
    case 'CANCELLED': return 'Cancelled';
    default: return status;
  }
};

const statusSlug = (status: EmergencyStatus) => {
  switch (status) {
    case 'IN_TREATMENT': return 'in-treatment';
    case 'READY_FOR_DISPOSITION': return 'ready-for-admission';
    case 'IN_CONSULTATION': return 'called';
    case 'DISCHARGED':
    case 'TRANSFERRED':
    case 'CONVERTED_TO_IP': return 'discharged';
    default: return 'waiting';
  }
};

const formatTime = (timeStr?: string) => {
  if (!timeStr) return '—';
  try {
    const d = new Date(timeStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
  } catch {
    // fallback
  }
  return timeStr.slice(11, 16) || timeStr;
};

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Action could not be completed.';

export function EmergencyDashboardPage() {
  const { state, actions, mutations } = useEmergencyWorkspaceFeature();
  const [registrationOpen, setRegistrationOpen] = useState(false);

  const registration = useForm<RegistrationForm>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      department_id: '',
      patient_id: '',
      display_name: '',
      gender: 'UNKNOWN',
      contact: '',
      identity_notes: '',
      arrival_mode: 'Walk-in',
      chief_complaint: '',
      arrival_notes: '',
    },
  });

  const selectedPatientId = registration.watch('patient_id');
  const selectedPatient = state.patients.find((p) => p.id === selectedPatientId);

  const emergencyComplaintPresets = [
    '⚡ Acute Chest Pain',
    '🫁 Severe Dyspnea / SOB',
    '🚗 Polytrauma / RTA',
    '🩸 Major Hemorrhage',
    '🧠 Stroke / Altered Consciousness',
    '🔥 Burn Injury',
    '⚠️ Acute Abdominal Pain',
    '😵 Syncope / Unresponsive',
  ];

  const quickTraumaTags = [
    'Unknown Male #1',
    'Unknown Female #1',
    'Trauma Victim #1',
    'Pediatric Trauma #1',
    'Unconscious Patient #1',
  ];

  const handleSelectPresetComplaint = (presetText: string) => {
    const cleanText = presetText.replace(/^[\p{Emoji}\s]+/gu, '').trim();
    const current = registration.getValues('chief_complaint') || '';
    if (!current.trim()) {
      registration.setValue('chief_complaint', cleanText, { shouldValidate: true });
    } else if (!current.includes(cleanText)) {
      registration.setValue('chief_complaint', `${current}, ${cleanText}`, { shouldValidate: true });
    }
  };

  const createEncounter = registration.handleSubmit(async (values) => {
    try {
      const isKnown = Boolean(values.patient_id);
      const created = await mutations.create.mutateAsync({
        branch_id: state.branchId,
        department_id: values.department_id,
        patient_id: isKnown ? values.patient_id : null,
        provisional_identity: !isKnown
          ? {
              display_name: values.display_name || 'Unknown Patient',
              estimated_age: values.estimated_age ?? null,
              gender: values.gender || 'UNKNOWN',
              contact: values.contact || null,
              identity_notes: values.identity_notes || null,
            }
          : null,
        arrival_mode: values.arrival_mode,
        chief_complaint: values.chief_complaint,
        arrival_notes: values.arrival_notes || null,
      });
      setRegistrationOpen(false);
      registration.reset();
      toast.success(`Encounter ${created.emergency_identifier || created.encounter_number} registered.`);
      navigate(`/emergency/workspace?branch_id=${state.branchId}&encounter_id=${created.id}`);
    } catch (error) {
      toast.error(message(error));
    }
  });

  const encounters = state.encounters;
  const activeEncounters = encounters.filter(
    (item) =>
      !['DISCHARGED', 'TRANSFERRED', 'CONVERTED_TO_IP', 'LEFT', 'NO_SHOW', 'CANCELLED'].includes(
        item.status,
      ),
  );

  const visitsCount = encounters.length;
  const criticalCount = activeEncounters.filter(
    (item) => item.triage?.effective_level === 'LEVEL_1_CRITICAL',
  ).length;
  const waitingCount = activeEncounters.filter((item) =>
    ['REGISTERED', 'WAITING_FOR_TRIAGE', 'TRIAGED', 'WAITING_FOR_DOCTOR'].includes(item.status),
  ).length;
  const inTreatmentCount = activeEncounters.filter((item) => item.status === 'IN_TREATMENT').length;
  const readyAdmissionCount = activeEncounters.filter(
    (item) => item.status === 'READY_FOR_DISPOSITION',
  ).length;

  const beds = [
    { name: 'Resuscitation', available: 2, total: 4 },
    { name: 'Trauma Bay', available: 1, total: 3 },
    { name: 'Observation', available: 5, total: 12 },
    { name: 'Pediatric ER', available: 2, total: 4 },
  ];
  const totalBedsAvailable = beds.reduce((sum, item) => sum + item.available, 0);

  return (
    <div className="emergency-page emergency-theme">
      {/* Page Header */}
      <div className="emergency-page-header">
        <div className="emergency-page-title">
          <h2>Emergency Dashboard</h2>
          <p>Live emergency operations, triage and bed readiness</p>
        </div>
        <div className="emergency-page-actions">
          {state.branches.length > 1 ? (
            <select
              aria-label="Branch"
              className="doc-field"
              onChange={(e) => actions.setBranchId(e.target.value)}
              style={{ minWidth: '160px', height: '38px', borderRadius: '8px', padding: '0 10px' }}
              value={state.branchId}
            >
              {state.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            className="btn-emergency-secondary"
            onClick={() => navigate(`/emergency/queue?branch_id=${state.branchId}`)}
            type="button"
          >
            <i className="ph ph-queue" /> Open Queue
          </button>
          {state.capabilities.register ? (
            <button
              className="btn-emergency-primary"
              onClick={() => {
                registration.setValue('department_id', state.departments[0]?.id ?? '');
                setRegistrationOpen(true);
              }}
              type="button"
            >
              <i className="ph ph-plus" /> Register Patient
            </button>
          ) : null}
        </div>
      </div>

      {/* Top 6 KPI Metric Cards */}
      <section className="emergency-kpi-grid">
        <div className="doc-kpi">
          <div className="doc-kpi-icon blue">
            <i className="ph-fill ph-plus" />
          </div>
          <div className="doc-kpi-copy">
            <span>Today's ER Visits</span>
            <strong>{visitsCount}</strong>
            <small>Live emergency census</small>
          </div>
        </div>

        <div className="doc-kpi">
          <div className="doc-kpi-icon red">
            <i className="ph-fill ph-warning-circle" />
          </div>
          <div className="doc-kpi-copy">
            <span>Critical Patients</span>
            <strong>{criticalCount}</strong>
            <small>Immediate attention</small>
          </div>
        </div>

        <div className="doc-kpi">
          <div className="doc-kpi-icon orange">
            <i className="ph-fill ph-hourglass" />
          </div>
          <div className="doc-kpi-copy">
            <span>Waiting Patients</span>
            <strong>{waitingCount}</strong>
            <small>Triage completed</small>
          </div>
        </div>

        <div className="doc-kpi">
          <div className="doc-kpi-icon cyan">
            <i className="ph-fill ph-heartbeat" />
          </div>
          <div className="doc-kpi-copy">
            <span>Patients In Treatment</span>
            <strong>{inTreatmentCount}</strong>
            <small>Active care</small>
          </div>
        </div>

        <div className="doc-kpi">
          <div className="doc-kpi-icon purple">
            <i className="ph-fill ph-bed" />
          </div>
          <div className="doc-kpi-copy">
            <span>Ready for Admission</span>
            <strong>{readyAdmissionCount}</strong>
            <small>Bed assignment needed</small>
          </div>
        </div>

        <div className="doc-kpi">
          <div className="doc-kpi-icon green">
            <i className="ph-fill ph-door-open" />
          </div>
          <div className="doc-kpi-copy">
            <span>Available Emergency Beds</span>
            <strong>{totalBedsAvailable}</strong>
            <small>Across ER zones</small>
          </div>
        </div>
      </section>

      {/* Main 2-Column Operational Grid */}
      <div className="emergency-dashboard-layout">
        {/* Left Column: Live Emergency Queue Table */}
        <div className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Live Emergency Queue</h3>
              <p>Prioritized by triage acuity and arrival time</p>
            </div>
            <button
              className="doc-btn"
              onClick={() => void state.listQuery.refetch()}
              type="button"
            >
              <i className="ph ph-arrows-clockwise" /> Refresh
            </button>
          </div>

          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Triage Level</th>
                  <th>Chief Complaint</th>
                  <th>Assigned Doctor</th>
                  <th>Arrival Time</th>
                  <th>Current Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.listQuery.isLoading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '2.5rem', textAlign: 'center', color: '#64748b' }}>
                      <i className="ph ph-circle-notch" style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} />
                      Loading live emergency queue...
                    </td>
                  </tr>
                ) : encounters.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      <i className="ph ph-first-aid" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }} />
                      No active emergency patients in queue.
                    </td>
                  </tr>
                ) : (
                  encounters.map((item: EmergencyEncounter) => {
                    const level = item.triage?.effective_level ?? item.triage?.level;
                    const initials = (item.patient_name || 'ER')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <tr key={item.id}>
                        <td>
                          <strong className="patient-mrn">
                            {item.emergency_identifier || item.encounter_number}
                          </strong>
                        </td>
                        <td>
                          <div className="doc-person" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                background: '#2563eb',
                                color: '#ffffff',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.85rem' }}>
                                {item.patient_name || item.provisional_identity?.display_name || 'Unknown Patient'}
                              </strong>
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                {item.patient_number || 'Provisional Identity'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`emergency-triage ${triageSlug(level)}`}>
                            {triageLabel(level)}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'normal', minWidth: '160px', maxWidth: '240px', fontSize: '0.82rem' }}>
                          {item.chief_complaint}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#334155' }}>
                          {item.assigned_doctor_name || 'Unassigned'}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                          {formatTime(item.arrival_at || item.created_at)}
                        </td>
                        <td>
                          <span className={`doc-status ${statusSlug(item.status)}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="doc-actions" style={{ justifyContent: 'flex-end' }}>
                            <button
                              className="doc-action"
                              onClick={() =>
                                navigate(
                                  `/emergency/workspace?branch_id=${state.branchId}&encounter_id=${item.id}`,
                                )
                              }
                              title="Open Workspace"
                              type="button"
                            >
                              <i className="ph ph-arrow-square-out" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: ER Alerts, Bed Availability & Quick Actions */}
        <aside className="emergency-side-panel">
          {/* ER Alerts Card */}
          <div className="emergency-panel-card">
            <h3>ER Alerts</h3>
            <div className="emergency-alert-list">
              <div className="emergency-alert-item">
                <i className="ph ph-warning-circle" />
                <div>
                  <strong>Critical Arrival</strong>
                  <span>Level 1 cardiac patient arriving by ambulance in 4 minutes.</span>
                </div>
              </div>
              <div className="emergency-alert-item warning">
                <i className="ph ph-clock" />
                <div>
                  <strong>Extended Wait</strong>
                  <span>ER-005 has exceeded the target triage waiting time.</span>
                </div>
              </div>
              <div className="emergency-alert-item info">
                <i className="ph ph-flask" />
                <div>
                  <strong>STAT Results Ready</strong>
                  <span>Troponin and ABG results are now available.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bed Availability Card */}
          <div className="emergency-panel-card">
            <h3>Bed Availability</h3>
            <div className="emergency-bed-grid">
              {beds.map((b) => (
                <div className={`emergency-bed ${b.available > 0 ? 'available' : 'occupied'}`} key={b.name}>
                  <span>{b.name}</span>
                  <strong>
                    {b.available}/{b.total}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="emergency-panel-card">
            <h3>Quick Actions</h3>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              <button
                className="doc-btn"
                onClick={() => {
                  registration.setValue('department_id', state.departments[0]?.id ?? '');
                  setRegistrationOpen(true);
                }}
                style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', width: '100%' }}
                type="button"
              >
                <i className="ph ph-user-plus" style={{ color: '#dc2626', fontSize: '1.2rem', marginRight: '8px' }} />
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ display: 'block', fontSize: '0.84rem' }}>Register Patient</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Start emergency intake</span>
                </div>
              </button>

              <button
                className="doc-btn"
                onClick={() => navigate(`/emergency/queue?branch_id=${state.branchId}`)}
                style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', width: '100%' }}
                type="button"
              >
                <i className="ph ph-queue" style={{ color: '#2563eb', fontSize: '1.2rem', marginRight: '8px' }} />
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ display: 'block', fontSize: '0.84rem' }}>Open Queue</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Manage waiting patients</span>
                </div>
              </button>

              <button
                className="doc-btn"
                onClick={() => {
                  if (activeEncounters[0]) {
                    navigate(
                      `/emergency/workspace?branch_id=${state.branchId}&encounter_id=${activeEncounters[0].id}&tab=Disposition`,
                    );
                  } else {
                    toast.info('No active emergency patient to admit.');
                  }
                }}
                style={{ justifyContent: 'flex-start', padding: '0.75rem 1rem', width: '100%' }}
                type="button"
              >
                <i className="ph ph-bed" style={{ color: '#9333ea', fontSize: '1.2rem', marginRight: '8px' }} />
                <div style={{ textAlign: 'left' }}>
                  <strong style={{ display: 'block', fontSize: '0.84rem' }}>Admit Patient</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Open disposition decision</span>
                </div>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Registration Modal */}
      <Modal
        onClose={() => setRegistrationOpen(false)}
        open={registrationOpen}
        size="large"
        title="Register Emergency Encounter"
        icon="ph-first-aid"
      >
        <form onSubmit={createEncounter} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '560px' }}>
          {/* Department & Arrival Mode Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Emergency Department <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                {...registration.register('department_id')}
                style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
              >
                <option value="">Select department</option>
                {state.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {registration.formState.errors.department_id?.message && (
                <span style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                  {registration.formState.errors.department_id.message}
                </span>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Arrival Mode <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                {...registration.register('arrival_mode')}
                style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
              >
                <option value="Ambulance">🚑 Ambulance</option>
                <option value="Walk-in">🚶 Walk-in</option>
                <option value="Police">🚓 Police</option>
                <option value="Referral">📋 Referral</option>
                <option value="Air Ambulance">🚁 Air Ambulance</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Unified Patient Identification & Intake Section */}
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <i className="ph ph-user-circle" style={{ color: '#2563eb', fontSize: '1.15rem' }} />
                Patient Identification &amp; Intake
              </span>
              {selectedPatient && (
                <button
                  type="button"
                  onClick={() => {
                    registration.setValue('patient_id', '');
                    actions.setPatientSearch('');
                  }}
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <i className="ph ph-x" /> Deselect Patient
                </button>
              )}
            </div>

            {selectedPatient ? (
              /* State A: Existing Patient Selected */
              <div className="emergency-patient-selected-card">
                <div className="emergency-patient-selected-info">
                  <div className="emergency-patient-avatar-badge">
                    {(selectedPatient.first_name?.[0] || '') + (selectedPatient.last_name?.[0] || 'P')}
                  </div>
                  <div className="emergency-patient-details-stack">
                    <span className="emergency-patient-name-title">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </span>
                    <div className="emergency-patient-meta-row">
                      <span className="emergency-patient-meta-tag">MRN: {selectedPatient.patient_number}</span>
                      <span>Gender: {selectedPatient.gender}</span>
                      {selectedPatient.phone ? <span>Phone: {selectedPatient.phone}</span> : null}
                      {selectedPatient.blood_group ? (
                        <span className="emergency-patient-meta-tag" style={{ background: '#fee2e2', color: '#991b1b' }}>
                          Blood: {selectedPatient.blood_group}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    registration.setValue('patient_id', '');
                    actions.setPatientSearch('');
                  }}
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 600, color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <i className="ph ph-arrows-clockwise" /> Search Other
                </button>
              </div>
            ) : (
              /* State B: Unified Search-or-Create Flow */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    1. Search Existing Registered Patient (MRN, Name, Phone)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <i className="ph ph-magnifying-glass" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      onChange={(event) => actions.setPatientSearch(event.target.value)}
                      placeholder="Type patient MRN, name, or phone number..."
                      value={state.patientSearch}
                      style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px 0 28px', fontSize: '0.82rem', background: '#fff' }}
                    />
                    {state.patientSearch && (
                      <button
                        type="button"
                        onClick={() => actions.setPatientSearch('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                      >
                        <i className="ph ph-x" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Search Candidate Results */}
                {state.patientSearch.trim().length >= 2 ? (
                  state.patients.length > 0 ? (
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                        Matching Registered Patients ({state.patients.length}):
                      </span>
                      <div className="emergency-candidate-list">
                        {state.patients.map((p) => (
                          <div
                            key={p.id}
                            className="emergency-candidate-item"
                            onClick={() => {
                              registration.setValue('patient_id', p.id, { shouldValidate: true });
                              registration.setValue('display_name', '');
                              actions.setPatientSearch('');
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <i className="ph ph-user" style={{ color: '#2563eb' }} />
                              <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>{p.first_name} {p.last_name}</strong>
                              <span style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'monospace' }}>{p.patient_number}</span>
                              <span style={{ fontSize: '0.72rem', background: '#e2e8f0', padding: '1px 5px', borderRadius: '3px' }}>{p.gender}</span>
                              {p.phone ? <span style={{ fontSize: '0.72rem', color: '#64748b' }}>📞 {p.phone}</span> : null}
                            </div>
                            <button
                              type="button"
                              className="doc-btn compact primary"
                              style={{ padding: '3px 10px', fontSize: '0.74rem' }}
                            >
                              Select Patient
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '8px 12px', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '6px', fontSize: '0.78rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>No registered patient found matching "<strong>{state.patientSearch}</strong>"</span>
                      <button
                        type="button"
                        className="doc-btn compact primary"
                        onClick={() => registration.setValue('display_name', state.patientSearch, { shouldValidate: true })}
                        style={{ fontSize: '0.74rem' }}
                      >
                        <i className="ph ph-plus" /> Use as Patient Name
                      </button>
                    </div>
                  )
                ) : null}

                {/* Inline New / Unknown Patient Entry */}
                <div style={{ paddingTop: '0.75rem', borderTop: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      2. If not registered or unidentified, provide emergency intake details:
                    </div>
                    <div className="emergency-quick-chips-wrap">
                      {quickTraumaTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className="emergency-quick-chip"
                          onClick={() => registration.setValue('display_name', tag, { shouldValidate: true })}
                        >
                          <i className="ph ph-plus" /> {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '0.65rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                        Patient Name / Unknown Tag <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        {...registration.register('display_name')}
                        placeholder="e.g. John Doe or Unknown Trauma #1"
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#fff' }}
                      />
                      {registration.formState.errors.display_name?.message && (
                        <span style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                          {registration.formState.errors.display_name.message}
                        </span>
                      )}
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                        Estimated Age
                      </label>
                      <input
                        type="number"
                        {...registration.register('estimated_age', numericInput)}
                        placeholder="e.g. 45"
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                        Gender
                      </label>
                      <select
                        {...registration.register('gender')}
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#fff' }}
                      >
                        <option value="UNKNOWN">UNKNOWN</option>
                        <option value="MALE">MALE</option>
                        <option value="FEMALE">FEMALE</option>
                        <option value="OTHER">OTHER</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.65rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                        Contact / Phone / Bystander <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                      </label>
                      <input
                        {...registration.register('contact')}
                        placeholder="Phone or bystander/EMS contact"
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#fff' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '3px' }}>
                        Physical Description / Location Found <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                      </label>
                      <input
                        {...registration.register('identity_notes')}
                        placeholder="Clothing, location found, markings..."
                        style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem', background: '#fff' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {registration.formState.errors.patient_id?.message && (
              <span style={{ color: '#dc2626', fontSize: '0.72rem' }}>
                {registration.formState.errors.patient_id.message}
              </span>
            )}
          </div>

          {/* Chief Complaint Section with Presets */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                Chief Emergency Complaint <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Click presets to quick-fill</span>
            </div>

            <div className="emergency-quick-chips-wrap" style={{ marginBottom: '6px' }}>
              {emergencyComplaintPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="emergency-quick-chip danger-chip"
                  onClick={() => handleSelectPresetComplaint(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>

            <textarea
              {...registration.register('chief_complaint')}
              placeholder="Primary presenting emergency (e.g. Acute chest pain radiating to left arm, severe SOB, polytrauma)..."
              rows={2}
              style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px', fontSize: '0.82rem' }}
            />
            {registration.formState.errors.chief_complaint?.message && (
              <span style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                {registration.formState.errors.chief_complaint.message}
              </span>
            )}
          </div>

          {/* Arrival Notes */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Paramedic / Intake Notes <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              {...registration.register('arrival_notes')}
              placeholder="Initial paramedic observations, on-scene vitals, intake details..."
              rows={2}
              style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px', fontSize: '0.82rem' }}
            />
          </div>

          {/* Modal Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
            <button
              className="btn-emergency-secondary"
              onClick={() => setRegistrationOpen(false)}
              type="button"
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              disabled={mutations.create.isPending}
              type="submit"
              style={{ padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none', background: '#dc2626', color: '#ffffff', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="ph ph-plus-circle" /> {mutations.create.isPending ? 'Registering...' : 'Register Encounter'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}