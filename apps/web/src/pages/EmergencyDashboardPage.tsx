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
    identity_mode: z.enum(['KNOWN', 'PROVISIONAL']),
    patient_id: z.string(),
    display_name: z.string(),
    estimated_age: optionalNumber,
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']),
    contact: z.string(),
    identity_notes: z.string(),
    arrival_mode: z.string().min(2),
    chief_complaint: z.string().min(3),
    arrival_notes: z.string(),
  })
  .superRefine((value, ctx) => {
    if (value.identity_mode === 'KNOWN' && !value.patient_id)
      ctx.addIssue({ code: 'custom', path: ['patient_id'], message: 'Select a patient' });
    if (value.identity_mode === 'PROVISIONAL' && value.display_name.trim().length < 2)
      ctx.addIssue({
        code: 'custom',
        path: ['display_name'],
        message: 'Provisional display name is required',
      });
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
      identity_mode: 'KNOWN',
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

  const identityMode = registration.watch('identity_mode');

  const createEncounter = registration.handleSubmit(async (values) => {
    try {
      const created = await mutations.create.mutateAsync({
        branch_id: state.branchId,
        department_id: values.department_id,
        patient_id: values.identity_mode === 'KNOWN' ? values.patient_id : null,
        provisional_identity:
          values.identity_mode === 'PROVISIONAL'
            ? {
                display_name: values.display_name,
                estimated_age: values.estimated_age ?? null,
                gender: values.gender,
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
        <form onSubmit={createEncounter} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '520px' }}>
          {/* Identity Mode Pill Selector */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
            <button
              type="button"
              onClick={() => registration.setValue('identity_mode', 'KNOWN')}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: identityMode === 'KNOWN' ? '#ffffff' : 'transparent',
                color: identityMode === 'KNOWN' ? '#dc2626' : '#64748b',
                boxShadow: identityMode === 'KNOWN' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <i className="ph ph-user" /> Existing Patient (MRN Lookup)
            </button>
            <button
              type="button"
              onClick={() => registration.setValue('identity_mode', 'PROVISIONAL')}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: identityMode === 'PROVISIONAL' ? '#ffffff' : 'transparent',
                color: identityMode === 'PROVISIONAL' ? '#dc2626' : '#64748b',
                boxShadow: identityMode === 'PROVISIONAL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <i className="ph ph-warning-circle" /> Unknown / Trauma Provisional
            </button>
          </div>

          {/* Department & Arrival Mode Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Department <span style={{ color: '#dc2626' }}>*</span>
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

          {/* Patient Selection vs Provisional Identity */}
          {identityMode === 'KNOWN' ? (
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Search Patient (MRN, Name, Phone)
                </label>
                <input
                  onChange={(event) => actions.setPatientSearch(event.target.value)}
                  placeholder="Type MRN or name to filter registered patients..."
                  value={state.patientSearch}
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
                  Select Patient <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  {...registration.register('patient_id')}
                  style={{ width: '100%', height: '38px', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '0.82rem' }}
                >
                  <option value="">Select patient record</option>
                  {state.patients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.patient_number} - {item.first_name} {item.last_name} ({item.gender}, {item.date_of_birth?.slice(0, 10) || 'N/A'})
                    </option>
                  ))}
                </select>
                {registration.formState.errors.patient_id?.message && (
                  <span style={{ color: '#dc2626', fontSize: '0.72rem', display: 'block', marginTop: '2px' }}>
                    {registration.formState.errors.patient_id.message}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: '#fef2f2', padding: '0.85rem', borderRadius: '8px', border: '1px solid #fecaca', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b', display: 'block', marginBottom: '3px' }}>
                    Provisional Identifier / Tag <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    {...registration.register('display_name')}
                    placeholder="e.g. Unknown Trauma Male #1"
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #fca5a5', padding: '0 8px', fontSize: '0.82rem' }}
                  />
                  {registration.formState.errors.display_name?.message && (
                    <span style={{ color: '#dc2626', fontSize: '0.72rem' }}>{registration.formState.errors.display_name.message}</span>
                  )}
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b', display: 'block', marginBottom: '3px' }}>
                    Estimated Age
                  </label>
                  <input
                    type="number"
                    {...registration.register('estimated_age', numericInput)}
                    placeholder="e.g. 45"
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #fca5a5', padding: '0 8px', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b', display: 'block', marginBottom: '3px' }}>
                    Gender
                  </label>
                  <select
                    {...registration.register('gender')}
                    style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #fca5a5', padding: '0 8px', fontSize: '0.82rem' }}
                  >
                    <option value="UNKNOWN">UNKNOWN</option>
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b', display: 'block', marginBottom: '3px' }}>
                  Bystander / EMS Contact
                </label>
                <input
                  {...registration.register('contact')}
                  placeholder="Phone, paramedic badge # or bystander info"
                  style={{ width: '100%', height: '36px', borderRadius: '6px', border: '1px solid #fca5a5', padding: '0 8px', fontSize: '0.82rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b', display: 'block', marginBottom: '3px' }}>
                  Physical Description / Triage Notes
                </label>
                <textarea
                  {...registration.register('identity_notes')}
                  placeholder="Physical description, tattoos, clothing, found location..."
                  rows={2}
                  style={{ width: '100%', borderRadius: '6px', border: '1px solid #fca5a5', padding: '6px 8px', fontSize: '0.82rem' }}
                />
              </div>
            </div>
          )}

          {/* Chief Complaint */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Chief Emergency Complaint <span style={{ color: '#dc2626' }}>*</span>
            </label>
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