import { toast } from 'sonner';
import { formatTime } from './utils';
import type { EmergencyWorkspaceProps, WorkspaceTab } from './types';

export type EmergencyRegistrationSectionProps = {
  state: EmergencyWorkspaceProps['state'];
  setActiveTab: (tab: WorkspaceTab) => void;
};

export function EmergencyRegistrationSection({ state, setActiveTab }: EmergencyRegistrationSectionProps) {
  const selected = state.selected || state.encounters[0] || null;
  if (!selected) return null;

  const canEditRegistration =
    state.capabilities.register &&
    !state.capabilities.editConsultation &&
    !state.capabilities.assessTriage;

  if (!canEditRegistration) {
    return (
      <div className="emergency-form-section">
        <div className="emergency-section-context-header">
          <div className="emergency-context-badge">
            <i className="ph ph-lock-key" /> Patient &amp; Registration Details (Read-Only Context)
          </div>
          <p className="emergency-context-desc">
            Completed by intake staff upon emergency arrival. Clinical and nursing staff can review demographic and arrival details.
          </p>
        </div>

        <div className="emergency-readonly-grid">
          <div className="emergency-readonly-card">
            <h4><i className="ph ph-user" /> Patient Demographics</h4>
            <div className="emergency-readonly-field">
              <label>Patient Name</label>
              <span>{selected.patient_name || selected.provisional_identity?.display_name || 'Emergency Patient'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>MRN / Identifier</label>
              <span>{selected.patient_number || selected.emergency_identifier || selected.encounter_number}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Age &amp; Gender</label>
              <span>
                {selected.provisional_identity?.estimated_age ? `${selected.provisional_identity.estimated_age} yrs` : '—'} • {selected.provisional_identity?.gender || '—'}
              </span>
            </div>
            <div className="emergency-readonly-field">
              <label>Contact Phone</label>
              <span>{selected.provisional_identity?.contact || '—'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Patient Record Status</label>
              <span>{selected.patient_id ? 'Registered Patient' : 'Provisional / Unidentified Record'}</span>
            </div>
          </div>

          <div className="emergency-readonly-card">
            <h4><i className="ph ph-ambulance" /> Arrival &amp; Intake Details</h4>
            <div className="emergency-readonly-field">
              <label>Mode of Arrival</label>
              <span>{selected.arrival_mode || 'Walk-in'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Arrival Time</label>
              <span>{formatTime(selected.arrival_at || selected.created_at)}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Assigned Physician</label>
              <span>{selected.assigned_doctor_name || 'Unassigned'}</span>
            </div>
            <div className="emergency-readonly-field">
              <label>Encounter Status</label>
              <span>{selected.status}</span>
            </div>
          </div>

          <div className="emergency-readonly-card" style={{ gridColumn: 'span 2' }}>
            <h4><i className="ph ph-heartbeat" /> Chief Complaint &amp; Arrival Notes</h4>
            <div className="emergency-readonly-field">
              <label>Presenting Chief Complaint</label>
              <span style={{ fontSize: '0.92rem', color: '#0f172a' }}>{selected.chief_complaint || '—'}</span>
            </div>
            <div className="emergency-readonly-field" style={{ marginTop: '0.5rem' }}>
              <label>Paramedic / Arrival Notes</label>
              <span>{selected.arrival_notes || 'No arrival notes recorded.'}</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          {state.capabilities.assessTriage && (
            <button className="btn-emergency-primary" onClick={() => setActiveTab('Triage')} type="button">
              Proceed to Triage <i className="ph ph-arrow-right" />
            </button>
          )}
          {state.capabilities.editConsultation && (
            <button className="btn-emergency-primary" onClick={() => setActiveTab('Consultation')} type="button">
              Proceed to Consultation <i className="ph ph-arrow-right" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); toast.success('Registration details verified.'); }}>
      <div className="emergency-section-active-header">
        <div className="emergency-active-badge">
          <i className="ph ph-user-plus" /> Primary Intake Duty – Emergency Registration
        </div>
        <p className="emergency-active-desc">
          Capture patient identification, arrival mode, chief complaint, and intake notes.
        </p>
      </div>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Patient Information</h3>
            <p>Confirm identity or create an emergency record</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Patient Name</label>
            <input readOnly value={selected.patient_name || selected.provisional_identity?.display_name || ''} />
          </div>
          <div className="doc-field">
            <label>MRN / Identifier</label>
            <input readOnly value={selected.patient_number || selected.emergency_identifier || selected.encounter_number} />
          </div>
          <div className="doc-field">
            <label>Gender</label>
            <input readOnly value={selected.provisional_identity?.gender || '—'} />
          </div>
          <div className="doc-field">
            <label>Phone</label>
            <input readOnly value={selected.provisional_identity?.contact || '—'} />
          </div>
          <div className="doc-field">
            <label>Patient Type</label>
            <input readOnly value={selected.patient_id ? 'Registered Patient' : 'Provisional Record'} />
          </div>
        </div>
      </section>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Arrival Information</h3>
            <p>Emergency arrival details</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Mode of Arrival</label>
            <input readOnly value={selected.arrival_mode || 'Walk-in'} />
          </div>
          <div className="doc-field">
            <label>Arrival Time</label>
            <input readOnly value={formatTime(selected.arrival_at || selected.created_at)} />
          </div>
          <div className="doc-field">
            <label>Assigned Doctor</label>
            <input readOnly value={selected.assigned_doctor_name || 'Unassigned'} />
          </div>
        </div>
      </section>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Chief Complaint &amp; Intake Notes</h3>
            <p>Presenting emergency condition</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Chief Complaint</label>
            <textarea readOnly rows={3} value={selected.chief_complaint || ''} />
          </div>
          <div className="doc-field">
            <label>Arrival Notes</label>
            <textarea readOnly placeholder="No arrival notes recorded." rows={3} value={selected.arrival_notes || ''} />
          </div>
        </div>
      </section>

      <div className="emergency-form-actions">
        <span className="emergency-autosave">
          <i className="ph ph-check-circle" /> Registration complete
        </span>
        <div>
          <button className="btn-emergency-secondary" onClick={() => toast.success('Registration details verified.')} type="button">
            <i className="ph ph-check" /> Verified
          </button>
        </div>
      </div>
    </form>
  );
}
