import { toast } from 'sonner';
import type { WorkspaceTab } from './types';

export type EmergencyTreatmentSectionProps = {
  setActiveTab: (tab: WorkspaceTab) => void;
};

export function EmergencyTreatmentSection({ setActiveTab }: EmergencyTreatmentSectionProps) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); setActiveTab('Medication'); }}>
      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Medication Administration</h3>
            <p>Record emergency medicines administered immediately</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Medication</label>
            <input defaultValue="Aspirin 300 mg" />
          </div>
          <div className="doc-field">
            <label>Dose</label>
            <input defaultValue="300 mg" />
          </div>
          <div className="doc-field">
            <label>Route</label>
            <select defaultValue="Oral">
              <option>Oral</option>
              <option>IV</option>
              <option>IM</option>
              <option>SC</option>
              <option>Nebulization</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Administration Time</label>
            <input defaultValue="10:45" type="time" />
          </div>
        </div>
      </section>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Procedures & Interventions</h3>
            <p>Emergency procedures and continuous monitoring plan</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Procedure</label>
            <select defaultValue="IV Cannulation">
              <option>IV Cannulation</option>
              <option>ECG</option>
              <option>Oxygen Therapy</option>
              <option>Blood Sampling</option>
              <option>CPR</option>
              <option>Defibrillation</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Monitoring Frequency</label>
            <select defaultValue="Every 15 Minutes">
              <option>Continuous</option>
              <option>Every 15 Minutes</option>
              <option>Every 30 Minutes</option>
              <option>Hourly</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Procedure Outcome</label>
            <input defaultValue="Successful 18G IV cannula in right ACF" />
          </div>
        </div>
      </section>

      <div className="emergency-form-actions">
        <span className="emergency-autosave">
          <i className="ph ph-check-circle" /> Auto-save enabled
        </span>
        <div>
          <button className="btn-emergency-secondary" onClick={() => toast.success('Draft saved.')} type="button">
            Save Draft
          </button>
          <button className="btn-emergency-primary" type="submit">
            Next → Medication <i className="ph ph-arrow-right" />
          </button>
        </div>
      </div>
    </form>
  );
}
