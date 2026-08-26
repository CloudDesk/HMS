import { toast } from 'sonner';
import type { EmergencyWorkspaceProps, WorkspaceTab } from './types';

export type EmergencyRegistrationSectionProps = {
  state: EmergencyWorkspaceProps['state'];
  setActiveTab: (tab: WorkspaceTab) => void;
};

export function EmergencyRegistrationSection({ state, setActiveTab }: EmergencyRegistrationSectionProps) {
  const selected = state.selected || state.encounters[0] || null;
  if (!selected) return null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); setActiveTab('Triage'); }}>
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
            <label>MRN</label>
            <input readOnly value={selected.patient_number || selected.emergency_identifier || selected.encounter_number} />
          </div>
          <div className="doc-field">
            <label>Date of Birth</label>
            <input defaultValue="1981-05-14" type="date" />
          </div>
          <div className="doc-field">
            <label>Gender</label>
            <select defaultValue={selected.provisional_identity?.gender || 'Male'}>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
              <option>Unknown</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Phone</label>
            <input defaultValue={selected.provisional_identity?.contact || '+254 700 000 000'} />
          </div>
          <div className="doc-field">
            <label>National ID / Passport</label>
            <input defaultValue="ID-98765432" />
          </div>
        </div>
      </section>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Visit Information</h3>
            <p>Capture emergency arrival details</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Mode of Arrival</label>
            <select defaultValue={selected.arrival_mode || 'Ambulance'}>
              <option>Ambulance</option>
              <option>Walk-in</option>
              <option>Police</option>
              <option>Referral</option>
              <option>Air Ambulance</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Reason for Visit</label>
            <select defaultValue="Trauma">
              <option>Chest Pain</option>
              <option>Trauma</option>
              <option>Stroke</option>
              <option>Burns</option>
              <option>Bleeding</option>
              <option>Cardiac Arrest</option>
              <option>Poisoning</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Arrival Time</label>
            <input defaultValue="10:30" type="time" />
          </div>
          <div className="doc-field">
            <label>Assigned Doctor</label>
            <select defaultValue={selected.assigned_doctor_id || ''}>
              <option value="">Select Doctor</option>
              {state.doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Emergency Contact</h3>
            <p>Record the immediate contact person</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Contact Name</label>
            <input defaultValue="Jane Wanjiku" />
          </div>
          <div className="doc-field">
            <label>Relationship</label>
            <select defaultValue="Spouse">
              <option>Spouse</option>
              <option>Parent</option>
              <option>Child</option>
              <option>Guardian</option>
              <option>Relative</option>
              <option>Friend</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Phone Number</label>
            <input defaultValue="+254 711 223 344" />
          </div>
        </div>
      </section>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Chief Complaint</h3>
            <p>Document the presenting emergency</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Chief Complaint</label>
            <textarea defaultValue={selected.chief_complaint} rows={3} />
          </div>
          <div className="doc-field">
            <label>Arrival Notes</label>
            <textarea defaultValue={selected.arrival_notes || ''} placeholder="Paramedic observations..." rows={3} />
          </div>
        </div>
      </section>

      <div className="emergency-form-actions">
        <span className="emergency-autosave">
          <i className="ph ph-check-circle" /> Auto-save enabled
        </span>
        <div>
          <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
            <i className="ph ph-floppy-disk" /> Save Draft
          </button>
          <button className="btn-emergency-primary" type="submit">
            Next → Triage <i className="ph ph-arrow-right" />
          </button>
        </div>
      </div>
    </form>
  );
}
