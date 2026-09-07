import { navigate } from '../../routing/navigation';
import { formatTime, statusLabel, statusSlug, triageLabel, triageSlug } from './utils';
import type { EmergencyWorkspaceProps, WorkspaceTab } from './types';

export type EmergencyHeaderProps = {
  state: EmergencyWorkspaceProps['state'];
  setActiveTab: (tab: WorkspaceTab) => void;
  onOpenLinkPatient: () => void;
};

export function EmergencyHeader({ state, setActiveTab, onOpenLinkPatient }: EmergencyHeaderProps) {
  const selected = state.selected || state.encounters[0] || null;
  if (!selected) return null;

  const triageLevel = selected.triage?.effective_level ?? selected.triage?.level ?? 'LEVEL_3_MEDIUM';
  const initials = (selected.patient_name || 'ER')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <>
      <div className="emergency-page-header">
        <div className="emergency-page-title">
          <h2>Emergency Workspace</h2>
          <p>Complete the emergency workflow in one continuous case</p>
        </div>
        <div className="emergency-page-actions">
          <span className="emergency-autosave">
            <i className="ph ph-check-circle" /> Draft saved
          </span>
          <button
            className="btn-emergency-secondary"
            onClick={() => navigate(`/emergency/queue?branch_id=${state.branchId}`)}
            type="button"
          >
            <i className="ph ph-arrow-left" /> Back to Queue
          </button>
        </div>
      </div>

      <section className="emergency-patient-header">
        <div className="emergency-patient-avatar">{initials}</div>
        <div className="emergency-patient-copy">
          <h2>{selected.patient_name || selected.provisional_identity?.display_name || 'Emergency Patient'}</h2>
          <div className="emergency-patient-id">
            <span className="patient-mrn">
              {selected.patient_number || selected.emergency_identifier || selected.encounter_number}
            </span>
            <span className={`emergency-triage ${triageSlug(triageLevel)}`}>
              {triageLabel(triageLevel)}
            </span>
            <span className={`doc-status ${statusSlug(selected.status)}`}>
              {statusLabel(selected.status)}
            </span>
          </div>
          <div className="emergency-patient-meta">
            <span>
              <i className="ph ph-cake" /> {selected.provisional_identity?.estimated_age ? `${selected.provisional_identity.estimated_age} yrs` : '—'}
            </span>
            <span>
              <i className="ph ph-gender-intersex" /> {selected.provisional_identity?.gender || 'Unknown'}
            </span>
            <span>
              <i className="ph ph-clock" /> {formatTime(selected.arrival_at || selected.created_at)}
            </span>
            <span>
              <i className="ph ph-stethoscope" /> {selected.assigned_doctor_name || 'Unassigned'}
            </span>
          </div>
        </div>
        <div className="emergency-patient-actions">
          {selected.patient_id ? (
            <button
              className="btn-emergency-secondary"
              onClick={() => navigate(`/patients/profile?patient_id=${selected.patient_id}`)}
              type="button"
            >
              <i className="ph ph-user" /> Patient Profile
            </button>
          ) : state.capabilities.linkPatient ? (
            <button className="btn-emergency-secondary" onClick={onOpenLinkPatient} type="button">
              <i className="ph ph-link" /> Link Patient
            </button>
          ) : null}
          {(state.capabilities.discharge ||
            state.capabilities.transfer ||
            state.capabilities.admit ||
            state.capabilities.markLeft) && (
            <button
              className="btn-emergency-primary"
              onClick={() => setActiveTab('Disposition')}
              type="button"
            >
              <i className="ph ph-door-open" /> Disposition
            </button>
          )}
        </div>
      </section>

      <div className="emergency-alert-banner">
        <i className="ph ph-warning-circle" />
        <div>
          <strong>{triageLabel(triageLevel)}:</strong>
          <span> {selected.chief_complaint || 'Emergency assessment in progress'}. Maintain continuous monitoring.</span>
        </div>
      </div>
    </>
  );
}
