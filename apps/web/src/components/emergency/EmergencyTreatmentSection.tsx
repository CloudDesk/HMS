import { toast } from 'sonner';
import type { WorkspaceTab } from './types';

export type EmergencyTreatmentSectionProps = {
  setActiveTab: (tab: WorkspaceTab) => void;
};

export function EmergencyTreatmentSection({ setActiveTab }: EmergencyTreatmentSectionProps) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); setActiveTab('Medication'); }}>
      <div className="emergency-section-active-header">
        <div className="emergency-active-badge">
          <i className="ph ph-first-aid" /> Primary Physician Duty – Immediate Treatment &amp; Procedures
        </div>
        <p className="emergency-active-desc">
          Document bedside interventions, emergency resuscitation, and continuous clinical monitoring.
        </p>
      </div>

      <section className="emergency-form-section">
        <div className="emergency-form-head">
          <div>
            <h3>Emergency Interventions &amp; Procedures</h3>
            <p>Bedside clinical procedures and monitoring plan</p>
          </div>
        </div>
        <div className="doc-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="doc-field">
            <label>Emergency Procedure</label>
            <select defaultValue="IV Cannulation">
              <option>IV Cannulation &amp; Fluid Access</option>
              <option>12-Lead ECG</option>
              <option>High-Flow Oxygen Therapy</option>
              <option>Wound Debridement &amp; Suturing</option>
              <option>Endotracheal Intubation</option>
              <option>Cardiopulmonary Resuscitation (CPR)</option>
              <option>Defibrillation / Cardioversion</option>
              <option>Chest Tube Insertion</option>
              <option>Nasogastric Tube Placement</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Monitoring Frequency</label>
            <select defaultValue="Every 15 Minutes">
              <option>Continuous ECG &amp; SpO₂ Monitoring</option>
              <option>Every 15 Minutes</option>
              <option>Every 30 Minutes</option>
              <option>Hourly</option>
            </select>
          </div>
          <div className="doc-field">
            <label>Intervention Notes / Findings</label>
            <input placeholder="e.g. 18G IV cannula inserted in right ACF, 0.9% Normal Saline started" />
          </div>
        </div>
      </section>

      <div className="emergency-form-actions">
        <span className="emergency-autosave">
          <i className="ph ph-check-circle" /> Auto-save enabled
        </span>
        <div>
          <button className="btn-emergency-secondary" onClick={() => toast.success('Treatment notes saved.')} type="button">
            Save Draft
          </button>
          <button className="btn-emergency-primary" type="submit">
            Next → Medication Orders <i className="ph ph-arrow-right" />
          </button>
        </div>
      </div>
    </form>
  );
}
