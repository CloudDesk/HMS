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
  const { capabilities, dashboardProfile, currentUserId, currentDoctorId } = state;

  const canFilterOtherDoctors =
    capabilities.register ||
    capabilities.linkPatient ||
    capabilities.assessTriage ||
    capabilities.overridePriority;

  const isAssignedToMe = useMemo(() => {
    return (docId: string | null) =>
      Boolean(
        docId &&
          ((currentDoctorId && docId === currentDoctorId) ||
            (currentUserId && docId === currentUserId)),
      );
  }, [currentDoctorId, currentUserId]);

  const allEncounters = state.encounters;

  const waitingList = allEncounters.filter((item) =>
    ['REGISTERED', 'WAITING_FOR_TRIAGE', 'TRIAGED', 'WAITING_FOR_DOCTOR'].includes(item.status),
  );
  const criticalList = allEncounters.filter(
    (item) => item.triage?.effective_level === 'LEVEL_1_CRITICAL',
  );
  const consultationList = allEncounters.filter((item) => item.status === 'IN_CONSULTATION');
  const treatmentList = allEncounters.filter((item) => item.status === 'IN_TREATMENT');

  // Active serving patient
  const currentlyServing =
    allEncounters.find((item) => item.id === callingId) ||
    consultationList[0] ||
    treatmentList[0] ||
    null;

  // Doctor scope: normal doctor sees ONLY their assigned cases + unassigned cases.
  // Doctors cannot browse other doctors' cases unless they have administrative/triage oversight permissions.
  const filteredQueue = useMemo(() => {
    return allEncounters.filter((item) => {
      if (dashboardProfile === 'doctor' && !canFilterOtherDoctors) {
        if (item.assigned_doctor_id !== null && !isAssignedToMe(item.assigned_doctor_id)) {
          return false;
        }
        return true;
      }

      if (selectedDoctorFilter && item.assigned_doctor_id !== selectedDoctorFilter) {
        return false;
      }

      return true;
    });
  }, [allEncounters, selectedDoctorFilter, dashboardProfile, canFilterOtherDoctors, isAssignedToMe]);

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

  const canCall = capabilities.editConsultation || capabilities.assessTriage;

  return (
    <div className="emergency-page emergency-theme">
      {/* Filter Toolbar - Search First + Refresh Button */}
      <div className="emergency-queue-toolbar">
        <div className="doc-field doc-field--search">
          <label htmlFor="er-search-input">Search Patient</label>
          <i className="ph ph-magnifying-glass" />
          <input
            id="er-search-input"
            onChange={(e) => actions.setSearch(e.target.value)}
            placeholder="Patient, MRN or token"
            value={state.search}
          />
        </div>

        <div className="doc-field doc-field--dept">
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

        {dashboardProfile === 'doctor' && !canFilterOtherDoctors ? (
          <div className="doc-field doc-field--doctor">
            <label htmlFor="er-doc-filter">Doctor Scope</label>
            <div
              id="er-doc-filter"
              style={{
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '0.82rem',
                color: '#334155',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title="My Assigned Cases + Unassigned"
            >
              My Assigned Cases + Unassigned
            </div>
          </div>
        ) : (
          <div className="doc-field doc-field--doctor">
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
        )}

        <div className="doc-field doc-field--priority">
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

        <div className="doc-field doc-field--status">
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

        <div className="doc-field doc-field--refresh">
          <label style={{ visibility: 'hidden' }}>Refresh</label>
          <button
            aria-label="Refresh"
            className="btn-emergency-secondary emergency-refresh-btn"
            onClick={() => void state.listQuery.refetch()}
            title="Refresh"
            type="button"
          >
            <i className="ph ph-arrows-clockwise" />
          </button>
        </div>
      </div>

      {/* Compact Horizontal Operational Banner */}
      <section className="emergency-token-bar">
        {/* Left: Now Serving Badge & Patient Info */}
        <div className="emergency-token-bar__left">
          <span className="emergency-token-bar__now-serving">
            <i className="ph ph-broadcast" /> NOW SERVING
          </span>
          <div className="emergency-token-bar__serving-info">
            <strong
              className="emergency-token-bar__token-id"
              title={
                currentlyServing
                  ? currentlyServing.emergency_identifier || currentlyServing.encounter_number
                  : undefined
              }
            >
              {currentlyServing
                ? currentlyServing.emergency_identifier || currentlyServing.encounter_number
                : '—'}
            </strong>
            <span
              className="emergency-token-bar__patient-name"
              title={
                currentlyServing
                  ? currentlyServing.patient_name || currentlyServing.provisional_identity?.display_name
                  : undefined
              }
            >
              {currentlyServing
                ? currentlyServing.patient_name || currentlyServing.provisional_identity?.display_name
                : 'No active call'}
            </span>
          </div>
        </div>

        {/* Center: Operational Metrics */}
        <div className="emergency-token-bar__center">
          <div className="emergency-token-bar__metric">
            <span className="emergency-token-bar__metric-label">Next</span>
            <strong
              className="emergency-token-bar__metric-val"
              title={
                waitingList[0]
                  ? waitingList[0].emergency_identifier || waitingList[0].encounter_number
                  : undefined
              }
            >
              {waitingList[0]
                ? waitingList[0].emergency_identifier || waitingList[0].encounter_number
                : '—'}
            </strong>
          </div>
          <div className="emergency-token-bar__metric">
            <span className="emergency-token-bar__metric-label">Waiting</span>
            <strong className="emergency-token-bar__metric-val">{waitingList.length}</strong>
          </div>
          <div className="emergency-token-bar__metric">
            <span className="emergency-token-bar__metric-label">Critical</span>
            <strong className="emergency-token-bar__metric-val text-danger">{criticalList.length}</strong>
          </div>
          <div className="emergency-token-bar__metric">
            <span className="emergency-token-bar__metric-label">In Treatment</span>
            <strong className="emergency-token-bar__metric-val">{treatmentList.length}</strong>
          </div>
        </div>

        {/* Right: Calling Controls */}
        <div className="emergency-token-bar__right">
          {canCall && (
            <>
              <button
                className="btn-emergency-primary compact"
                disabled={waitingList.length === 0}
                onClick={() => void handleCallNext()}
                type="button"
              >
                <i className="ph ph-megaphone" /> Call Next
              </button>
              <button
                className="btn-emergency-secondary compact"
                disabled={!currentlyServing}
                onClick={() => void handleRecall()}
                type="button"
              >
                <i className="ph ph-arrow-counter-clockwise" /> Recall
              </button>
              <button
                className="btn-emergency-secondary compact"
                disabled={!currentlyServing}
                onClick={() => void handleSkip()}
                type="button"
              >
                <i className="ph ph-skip-forward" /> Skip
              </button>
            </>
          )}
          {capabilities.markNoShow && (
            <button
              className="doc-btn danger compact"
              disabled={!currentlyServing}
              onClick={() => void handleMarkNoShow()}
              type="button"
            >
              <i className="ph ph-user-minus" /> Mark No Show
            </button>
          )}
        </div>
      </section>

      {/* Unified Emergency Queue Table Component with Attached Pagination */}
      <div className="emergency-queue-table-card">
        <div className="emergency-table-container">
          <table className="emergency-queue-table">
            <colgroup>
              <col style={{ width: '16%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
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
                  const token = item.emergency_identifier || item.encounter_number;
                  const patName = item.patient_name || item.provisional_identity?.display_name || 'Unknown Patient';
                  const docName = item.assigned_doctor_name || 'Unassigned';
                  const initials = patName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();
                  const waitMins = getWaitMinutes(item.arrival_at, item.created_at);
                  const isCallable =
                    canCall &&
                    ['REGISTERED', 'WAITING_FOR_TRIAGE', 'TRIAGED', 'WAITING_FOR_DOCTOR'].includes(
                      item.status,
                    );

                  return (
                    <tr key={item.id}>
                      <td>
                        <strong className="cell-token" title={token}>
                          {token}
                        </strong>
                      </td>
                      <td>
                        <div className="cell-patient">
                          <div className="cell-patient-avatar">
                            {initials}
                          </div>
                          <div className="cell-patient-info">
                            <strong className="cell-patient-name" title={patName}>
                              {patName}
                            </strong>
                            <span className="cell-patient-meta" title={item.patient_number || 'Provisional Identity'}>
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
                      <td>
                        <span className="cell-doctor" title={docName}>
                          {docName}
                        </span>
                      </td>
                      <td>
                        <span className="cell-wait">
                          {waitMins} min
                        </span>
                      </td>
                      <td>
                        <span className={`doc-status ${statusSlug(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="cell-actions">
                          {isCallable && (
                            <button
                              className="doc-action"
                              onClick={() => void handleCallPatient(item)}
                              title="Call Patient"
                              type="button"
                            >
                              <i className="ph ph-megaphone" />
                            </button>
                          )}
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

        {/* Pagination Controls attached directly to table bottom */}
        {filteredQueue.length > 0 && (
          <div className="emergency-table-pagination">
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
    </div>
  );
}
