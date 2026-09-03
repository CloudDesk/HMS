import type { OpdVisitResponse } from '../../api/opd';
import type { VitalsFormState } from './OpdClinicalVitalsModal';

export type OpdSummaryPanelProps = {
  vitalsForm: VitalsFormState;
  visit: OpdVisitResponse | null;
  consultationForm: { allergies?: string };
  prescriptionForm: {
    items: Array<{
      local_id: string;
      medicine_name: string;
      strength?: string;
      dosage?: string;
      frequency?: string;
    }>;
  };
};

export function OpdSummaryPanel({
  vitalsForm,
  visit,
  consultationForm,
  prescriptionForm,
}: OpdSummaryPanelProps) {
  return (
    <aside className="opd-summary-panel">
      {/* Patient Summary / Vitals Card */}
      <div className="doc-card opd-summary-card">
        <div className="doc-card-header">
          <div>
            <h3>Patient Summary</h3>
          </div>
        </div>
        <div className="opd-summary-list">
          <div className="opd-summary-row">
            <span>Blood Pressure</span>
            <strong>
              {vitalsForm.blood_pressure_systolic && vitalsForm.blood_pressure_diastolic
                ? `${vitalsForm.blood_pressure_systolic}/${vitalsForm.blood_pressure_diastolic} mmHg`
                : 'Not recorded'}
            </strong>
          </div>
          <div className="opd-summary-row">
            <span>Pulse</span>
            <strong>{vitalsForm.pulse_bpm ? `${vitalsForm.pulse_bpm} bpm` : 'Not recorded'}</strong>
          </div>
          <div className="opd-summary-row">
            <span>Temperature</span>
            <strong>
              {vitalsForm.temperature_c ? `${vitalsForm.temperature_c} °C` : 'Not recorded'}
            </strong>
          </div>
          <div className="opd-summary-row">
            <span>SpO₂</span>
            <strong>
              {vitalsForm.oxygen_saturation_percent
                ? `${vitalsForm.oxygen_saturation_percent}%`
                : 'Not recorded'}
            </strong>
          </div>
          <div className="opd-summary-row">
            <span>Blood Group</span>
            <strong>{visit ? 'O+' : 'Not available in visit record'}</strong>
          </div>
          <div className="opd-summary-row">
            <span>Allergies</span>
            <strong style={{ color: '#dc2626' }}>
              {consultationForm.allergies || 'None recorded'}
            </strong>
          </div>
        </div>
      </div>

      {/* Current Medications */}
      <div className="doc-card opd-summary-card">
        <div className="doc-card-header">
          <div>
            <h3>Current Medications</h3>
          </div>
        </div>
        <div className="opd-summary-list">
          {prescriptionForm.items.length === 0 ? (
            <div className="opd-summary-empty-text">No medications recorded for this visit.</div>
          ) : (
            prescriptionForm.items.map((item) => (
              <div className="opd-medication-chip-item" key={item.local_id}>
                <div>
                  <strong>{item.medicine_name}</strong>
                  <span>{[item.strength, item.dosage, item.frequency].filter(Boolean).join(' ')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Previous Diagnoses */}
      <div className="doc-card opd-summary-card">
        <div className="doc-card-header">
          <div>
            <h3>Previous Diagnoses</h3>
          </div>
        </div>
        <div className="opd-summary-empty-text">No previous diagnoses recorded.</div>
      </div>

      {/* Recent Lab Results */}
      <div className="doc-card opd-summary-card">
        <div className="doc-card-header">
          <div>
            <h3>Recent Lab Results</h3>
          </div>
        </div>
        <div className="opd-summary-empty-text">No laboratory results are available in this visit.</div>
      </div>

      {/* Clinical Alerts */}
      <div className="doc-card opd-summary-card">
        <div className="doc-card-header">
          <div>
            <h3>Clinical Alerts</h3>
          </div>
        </div>
        {consultationForm.allergies ? (
          <div className="opd-clinical-alert warning">
            <i aria-hidden="true" className="ph ph-warning-circle" />
            <div>
              <strong>Allergy Alert</strong>
              <span>{consultationForm.allergies}</span>
            </div>
          </div>
        ) : (
          <div className="opd-summary-empty-text">No clinical alerts recorded.</div>
        )}
      </div>
    </aside>
  );
}
