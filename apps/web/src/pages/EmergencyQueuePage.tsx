import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { EmergencyEncounter, EmergencyStatus, EmergencyTriageLevel } from '../api/emergency';
import { useEmergencyWorkspaceFeature } from '../hooks/emergency/useEmergencyWorkspaceFeature';
import { navigate } from '../routing/navigation';
import { MedicalLoader } from '../components/ui/MedicalLoader';

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
    case 'REGISTERED': return 'Waiting';
    case 'WAITING_FOR_TRIAGE': return 'Waiting';
    case 'TRIAGED': return 'Waiting';
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

const getWaitMinutes = (arrivalAt?: string, createdAt?: string) => {
  const timeStr = arrivalAt || createdAt;
  if (!timeStr) return 5;
  try {
    const d = new Date(timeStr);
    const diff = Math.max(1, Math.floor((Date.now() - d.getTime()) / (1000 * 60)));
    return diff > 1000 ? 12 : diff;
  } catch {
    return 10;
  }
};

const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Action could not be completed.';

export function EmergencyQueuePage() {
  const { state, actions, mutations } = useEmergencyWorkspaceFeature();
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState('');
  const [callingId, setCallingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const allEncounters = state.encounters;

  const waitingList = allEncounters.filter((item) =>
    ['REGISTERED', 'WAITING_FOR_TRIAGE', 'TRIAGED', 'WAITING_FOR_DOCTOR'].includes(item.status),
  );
  const criticalList = allEncounters.filter(
    (item) => item.triage?.effective_level === 'LEVEL_1_CRITICAL',
  );
  const consultationList = allEncounters.filter((item) => item.status === 'IN_CONSULTATION');
  const treatmentList = allEncounters.filter((item) => item.status === 'IN_TREATMENT');
  const admissionList = allEncounters.filter((item) => item.status === 'READY_FOR_DISPOSITION');

  // Active serving patient
  const currentlyServing =
    allEncounters.find((item) => item.id === callingId) ||
    consultationList[0] ||
    treatmentList[0] ||
    null;

  // Filtered queue items
  const filteredQueue = useMemo(() => {
    return allEncounters.filter((item) => {
      if (selectedDoctorFilter && item.assigned_doctor_id !== selectedDoctorFilter) return false;
      return true;
    });
  }, [allEncounters, selectedDoctorFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredQueue.length / pageSize));
  const paginatedQueue = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredQueue.slice(start, start + pageSize);
  }, [filteredQueue, page, pageSize]);

  const handleCallPatient = async (encounter: EmergencyEncounter) => {
    try {
      setCallingId(encounter.id);
      await mutations.call.mutateAsync(encounter.id);
      toast.success(`Patient ${encounter.patient_name || 'ER Patient'} called for doctor evaluation.`);
    } catch (error) {
      toast.error(message(error));
    }
  };

  const handleCallNext = async () => {
    const nextPatient = waitingList[0];
    if (!nextPatient) {
      toast.info('No emergency patients are currently waiting.');
      return;
    }
    await handleCallPatient(nextPatient);
  };

  const handleRecall = async () => {
    if (!currentlyServing) return;
    try {
      await mutations.call.mutateAsync(currentlyServing.id);
      toast.success(`Patient ${currentlyServing.patient_name} recalled.`);
    } catch (error) {
      toast.error(message(error));
    }
  };

  const handleSkip = async () => {
    if (!currentlyServing) return;
    try {
      await mutations.reasonAction.mutateAsync({
        id: currentlyServing.id,
        action: 'skip',
        reason: 'Patient not responsive at call',
      });
      toast.info(`Patient ${currentlyServing.patient_name} skipped.`);
    } catch (error) {
      toast.error(message(error));
    }
  };

  const handleMarkNoShow = async () => {
    if (!currentlyServing) return;
    try {
      await mutations.reasonAction.mutateAsync({
        id: currentlyServing.id,
        action: 'no-show',
        reason: 'Did not report after repeated calls',
      });
      toast.warning(`Patient ${currentlyServing.patient_name} marked as No Show.`);
    } catch (error) {
      toast.error(message(error));
    }
  };

  return (
    <div className="emergency-page emergency-theme">
      {/* Page Header */}
      <div className="emergency-page-header">
        <div className="emergency-page-title">
          <h2>Emergency Queue</h2>
          <p>Prioritize, call and coordinate waiting emergency patients</p>
        </div>
        <div className="emergency-page-actions">
          <button
            className="btn-emergency-secondary"
            onClick={() => void state.listQuery.refetch()}
            type="button"
          >
            <i className="ph ph-arrows-clockwise" /> Refresh
          </button>
          <button
            className="btn-emergency-primary"
            disabled={waitingList.length === 0}
            onClick={() => void handleCallNext()}
            type="button"
          >
            <i className="ph ph-megaphone" /> Call Next
          </button>
        </div>
      </div>

      {/* 5 Top KPI Cards */}
      <section className="emergency-queue-kpis">
        <div className="doc-kpi">
          <div className="doc-kpi-icon orange">
            <i className="ph ph-users" style={{ fontSize: '1.4rem' }} />
          </div>
          <div className="doc-kpi-copy">
            <span>Waiting</span>
            <strong>{waitingList.length}</strong>
          </div>
        </div>

        <div className="doc-kpi">
          <div className="doc-kpi-icon red">
            <i className="ph ph-warning-circle" style={{ fontSize: '1.4rem' }} />
          </div>
          <div className="doc-kpi-copy">
            <span>Critical</span>
            <strong>{criticalList.length}</strong>
          </div>
        </div>

        <div className="doc-kpi">
          <div className="doc-kpi-icon blue">
            <i className="ph ph-stethoscope" style={{ fontSize: '1.4rem' }} />
          </div>
          <div className="doc-kpi-copy">
            <span>In Consultation</span>
            <strong>{consultationList.length}</strong>
          </div>
        </div>

        <div className="doc-kpi">
          <div className="doc-kpi-icon cyan">
            <i className="ph ph-heartbeat" style={{ fontSize: '1.4rem' }} />
          </div>
          <div className="doc-kpi-copy">
            <span>In Treatment</span>
            <strong>{treatmentList.length}</strong>
          </div>
        </div>

        <div className="doc-kpi">
          <div className="doc-kpi-icon purple">
            <i className="ph ph-bed" style={{ fontSize: '1.4rem' }} />
          </div>
          <div className="doc-kpi-copy">
            <span>Ready for Admission</span>
            <strong>{admissionList.length}</strong>
          </div>
        </div>
      </section>

      {/* Filter Toolbar */}
      <div className="doc-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
        <div className="doc-field">
          <label htmlFor="er-dept-filter">Department</label>
          <select
            id="er-dept-filter"
            onChange={(e) => actions.setDepartmentId(e.target.value)}
            value={state.departmentId}
          >
            <option value="">All Departments</option>
            {state.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="doc-field">
          <label htmlFor="er-doc-filter">Doctor</label>
          <select
            id="er-doc-filter"
            onChange={(e) => setSelectedDoctorFilter(e.target.value)}
            value={selectedDoctorFilter}
          >
            <option value="">All Doctors</option>
            {state.doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.display_name}
              </option>
            ))}
          </select>
        </div>

        <div className="doc-field">
          <label htmlFor="er-priority-filter">Priority</label>
          <select
            id="er-priority-filter"
            onChange={(e) => actions.setTriageLevel(e.target.value)}
            value={state.triageLevel}
          >
            <option value="">All Priorities</option>
            <option value="LEVEL_1_CRITICAL">Level 1 Critical</option>
            <option value="LEVEL_2_HIGH">Level 2 High</option>
            <option value="LEVEL_3_MEDIUM">Level 3 Medium</option>
            <option value="LEVEL_4_LOW">Level 4 Low</option>
            <option value="LEVEL_5_NON_URGENT">Level 5 Non-Urgent</option>
          </select>
        </div>

        <div className="doc-field">
          <label htmlFor="er-status-filter">Status</label>
          <select
            id="er-status-filter"
            onChange={(e) => actions.setStatus(e.target.value)}
            value={state.status}
          >
            <option value="">All Statuses</option>
            <option value="WAITING_FOR_DOCTOR">Waiting</option>
            <option value="IN_CONSULTATION">In Consultation</option>
            <option value="IN_TREATMENT">In Treatment</option>
            <option value="READY_FOR_DISPOSITION">Ready for Admission</option>
            <option value="DISCHARGED">Discharged</option>
          </select>
        </div>

        <div className="doc-field grow doc-search">
          <label htmlFor="er-search-input">Search Patient</label>
          <i className="ph ph-magnifying-glass" />
          <input
            id="er-search-input"
            onChange={(e) => actions.setSearch(e.target.value)}
            placeholder="Patient, MRN or token"
            value={state.search}
          />
        </div>
      </div>

      {/* 2-Column Queue Layout */}
      <div className="emergency-queue-layout">
        {/* Left Column: Emergency Queue Table */}
        <div className="doc-card">
          <div className="doc-card-header">
            <div>
              <h3>Emergency Queue</h3>
              <p>{filteredQueue.length} emergency patients</p>
            </div>
          </div>

          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Priority</th>
                  <th>Doctor</th>
                  <th>Wait Time</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {state.listQuery.isLoading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '2.5rem 1rem' }}>
                      <MedicalLoader
                        text="Loading emergency queue..."
                        subtext="Prioritizing critical triage and acute emergency patients"
                      />
                    </td>
                  </tr>
                ) : filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                      No emergency patients match the filters.
                    </td>
                  </tr>
                ) : (
                  paginatedQueue.map((item: EmergencyEncounter) => {
                    const level = item.triage?.effective_level ?? item.triage?.level;
                    const initials = (item.patient_name || 'ER')
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();
                    const waitMins = getWaitMinutes(item.arrival_at, item.created_at);

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
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: '#2563eb',
                                color: '#ffffff',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.84rem' }}>
                                {item.patient_name || item.provisional_identity?.display_name || 'Unknown Patient'}
                              </strong>
                              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
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
                        <td style={{ fontSize: '0.82rem', color: '#334155' }}>
                          {item.assigned_doctor_name || 'Unassigned'}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                          {waitMins} min
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
                              onClick={() => void handleCallPatient(item)}
                              title="Call Patient"
                              type="button"
                            >
                              <i className="ph ph-megaphone" />
                            </button>
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

          {/* Pagination Controls */}
          {filteredQueue.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderTop: '1px solid #f1f5f9',
                fontSize: '0.82rem',
                color: '#64748b',
                background: '#ffffff',
                borderBottomLeftRadius: '12px',
                borderBottomRightRadius: '12px',
              }}
            >
              <div>
                Showing <strong>{Math.min((page - 1) * pageSize + 1, filteredQueue.length)}</strong> to{' '}
                <strong>{Math.min(page * pageSize, filteredQueue.length)}</strong> of{' '}
                <strong>{filteredQueue.length}</strong> emergency patients
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-secondary compact"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  <i className="ph ph-caret-left" /> Previous
                </button>
                <span style={{ padding: '0 8px', fontWeight: 600, color: '#1e293b' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn-secondary compact"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                >
                  Next <i className="ph ph-caret-right" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Current Token & Emergency Calling Controls */}
        <aside className="emergency-panel-card">
          <div className="doc-card-header" style={{ marginBottom: '0.75rem' }}>
            <div>
              <h3>Current Token</h3>
              <p>Emergency calling controls</p>
            </div>
          </div>

          <div className="emergency-current-token">
            <span>Now Serving</span>
            <strong>
              {currentlyServing
                ? currentlyServing.emergency_identifier || currentlyServing.encounter_number
                : '—'}
            </strong>
            <p>
              {currentlyServing
                ? currentlyServing.patient_name || currentlyServing.provisional_identity?.display_name
                : 'No active call'}
            </p>
          </div>

          <div className="emergency-queue-stats">
            <div className="emergency-queue-stat">
              <span>Next Token</span>
              <strong>{waitingList[0] ? waitingList[0].emergency_identifier || waitingList[0].encounter_number : '—'}</strong>
            </div>
            <div className="emergency-queue-stat">
              <span>Waiting</span>
              <strong>{waitingList.length}</strong>
            </div>
            <div className="emergency-queue-stat">
              <span>Critical</span>
              <strong>{criticalList.length}</strong>
            </div>
            <div className="emergency-queue-stat">
              <span>In Treatment</span>
              <strong>{treatmentList.length}</strong>
            </div>
          </div>

          <div className="emergency-call-controls">
            <button
              className="btn-emergency-primary"
              disabled={waitingList.length === 0}
              onClick={() => void handleCallNext()}
              style={{ justifyContent: 'center' }}
              type="button"
            >
              <i className="ph ph-megaphone" /> Call Next
            </button>
            <button
              className="btn-emergency-secondary"
              disabled={!currentlyServing}
              onClick={() => void handleRecall()}
              style={{ justifyContent: 'center' }}
              type="button"
            >
              <i className="ph ph-arrow-counter-clockwise" /> Recall
            </button>
            <button
              className="btn-emergency-secondary"
              disabled={!currentlyServing}
              onClick={() => void handleSkip()}
              style={{ justifyContent: 'center' }}
              type="button"
            >
              <i className="ph ph-skip-forward" /> Skip
            </button>
            <button
              className="doc-btn danger"
              disabled={!currentlyServing}
              onClick={() => void handleMarkNoShow()}
              style={{ justifyContent: 'center' }}
              type="button"
            >
              <i className="ph ph-user-minus" /> Mark No Show
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
