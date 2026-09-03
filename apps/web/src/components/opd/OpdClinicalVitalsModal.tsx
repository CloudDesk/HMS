import type { OpdVisitResponse } from '../../api/opd';
import { Modal } from '../ui/Modal';
import {
  ClinicalVitalCard,
  calculateBmi,
  calculateMap,
  evaluateDiastolicBp,
  evaluatePulse,
  evaluateRespiratoryRate,
  evaluateSpo2,
  evaluateSystolicBp,
  evaluateTemperature,
} from '../ui/ClinicalVitalCard';
import { patientInitials } from '../../pages/opd-utils';

export type VitalsFormState = {
  blood_pressure_systolic: string;
  blood_pressure_diastolic: string;
  weight_kg: string;
  height_cm: string;
  temperature_c: string;
  pulse_bpm: string;
  respiratory_rate_per_min: string;
  oxygen_saturation_percent: string;
  notes: string;
};

export type OpdClinicalVitalsModalProps = {
  open: boolean;
  onClose: () => void;
  visit: OpdVisitResponse | null;
  vitalsForm: VitalsFormState;
  setVitalsForm: React.Dispatch<React.SetStateAction<VitalsFormState>>;
  handleSaveVitalsModal: (e: React.FormEvent) => Promise<void>;
  updating: string;
};

export function OpdClinicalVitalsModal({
  open,
  onClose,
  visit,
  vitalsForm,
  setVitalsForm,
  handleSaveVitalsModal,
  updating,
}: OpdClinicalVitalsModalProps) {
  const visitBmiObj = calculateBmi(vitalsForm.weight_kg, vitalsForm.height_cm);
  const visitMapVal = calculateMap(
    vitalsForm.blood_pressure_systolic,
    vitalsForm.blood_pressure_diastolic
  );

  return (
    <Modal onClose={onClose} open={open} size="large" title="Record Clinical Vitals">
      <form className="clinical-vitals-modal-body" onSubmit={handleSaveVitalsModal}>
        {/* Clinical Patient Header Strip */}
        {visit ? (
          <div className="clinical-vitals-patient-strip">
            <div className="clinical-vitals-patient-info">
              <div className="clinical-vitals-avatar">
                {patientInitials(visit.patient_name || 'Patient')}
              </div>
              <div className="clinical-vitals-patient-meta">
                <h4>{visit.patient_name}</h4>
                <span>
                  Visit No: <strong>{visit.visit_number || 'OPD'}</strong> • Priority:{' '}
                  {visit.priority} • Type: {visit.visit_type}
                </span>
              </div>
            </div>
            <div className="clinical-vitals-summary-chips">
              <span className="clinical-vital-summary-pill">
                <i className="ph ph-stethoscope" /> Clinical Vitals
              </span>
              {visitMapVal !== null ? (
                <span className="clinical-vital-summary-pill success">
                  <i className="ph ph-heartbeat" /> MAP: {visitMapVal} mmHg
                </span>
              ) : null}
              {visitBmiObj ? (
                <span className={`clinical-vital-summary-pill ${visitBmiObj.tone}`}>
                  <i className="ph ph-scales" /> BMI: {visitBmiObj.bmi} ({visitBmiObj.category})
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Clinical Vital Cards Grid */}
        <div className="clinical-vitals-grid">
          <ClinicalVitalCard
            disabled={updating === 'vitals'}
            icon="ph-heartbeat"
            id="modal-vitals-sys"
            label="Systolic Blood Pressure"
            max={300}
            min={40}
            normalRange="90 – 120 mmHg"
            onChange={(val) => setVitalsForm({ ...vitalsForm, blood_pressure_systolic: val })}
            placeholder="120"
            required
            statusLabel={evaluateSystolicBp(vitalsForm.blood_pressure_systolic)?.label}
            statusTone={evaluateSystolicBp(vitalsForm.blood_pressure_systolic)?.tone}
            step={1}
            themeColor="red"
            unit="mmHg"
            value={vitalsForm.blood_pressure_systolic}
          />

          <ClinicalVitalCard
            disabled={updating === 'vitals'}
            icon="ph-heart-straight"
            id="modal-vitals-dia"
            label="Diastolic Blood Pressure"
            max={200}
            min={30}
            normalRange="60 – 80 mmHg"
            onChange={(val) => setVitalsForm({ ...vitalsForm, blood_pressure_diastolic: val })}
            placeholder="80"
            required
            statusLabel={evaluateDiastolicBp(vitalsForm.blood_pressure_diastolic)?.label}
            statusTone={evaluateDiastolicBp(vitalsForm.blood_pressure_diastolic)?.tone}
            step={1}
            themeColor="rose"
            unit="mmHg"
            value={vitalsForm.blood_pressure_diastolic}
          />

          <ClinicalVitalCard
            disabled={updating === 'vitals'}
            icon="ph-heart"
            id="modal-vitals-pulse"
            label="Heart / Pulse Rate"
            max={250}
            min={30}
            normalRange="60 – 100 bpm"
            onChange={(val) => setVitalsForm({ ...vitalsForm, pulse_bpm: val })}
            placeholder="72"
            statusLabel={evaluatePulse(vitalsForm.pulse_bpm)?.label}
            statusTone={evaluatePulse(vitalsForm.pulse_bpm)?.tone}
            step={1}
            themeColor="rose"
            unit="bpm"
            value={vitalsForm.pulse_bpm}
          />

          <ClinicalVitalCard
            disabled={updating === 'vitals'}
            icon="ph-thermometer-simple"
            id="modal-vitals-temp"
            label="Body Temperature"
            max={45}
            min={30}
            normalRange="36.5 – 37.5 °C"
            onChange={(val) => setVitalsForm({ ...vitalsForm, temperature_c: val })}
            placeholder="36.6"
            statusLabel={evaluateTemperature(vitalsForm.temperature_c)?.label}
            statusTone={evaluateTemperature(vitalsForm.temperature_c)?.tone}
            step={0.1}
            themeColor="amber"
            unit="°C"
            value={vitalsForm.temperature_c}
          />

          <ClinicalVitalCard
            disabled={updating === 'vitals'}
            icon="ph-drop"
            id="modal-vitals-spo2"
            label="Oxygen Saturation (SpO₂)"
            max={100}
            min={50}
            normalRange="95 – 100 %"
            onChange={(val) => setVitalsForm({ ...vitalsForm, oxygen_saturation_percent: val })}
            placeholder="98"
            statusLabel={evaluateSpo2(vitalsForm.oxygen_saturation_percent)?.label}
            statusTone={evaluateSpo2(vitalsForm.oxygen_saturation_percent)?.tone}
            step={1}
            themeColor="sky"
            unit="%"
            value={vitalsForm.oxygen_saturation_percent}
          />

          <ClinicalVitalCard
            disabled={updating === 'vitals'}
            icon="ph-wind"
            id="modal-vitals-rr"
            label="Respiratory Rate"
            max={60}
            min={6}
            normalRange="12 – 20 breaths/min"
            onChange={(val) => setVitalsForm({ ...vitalsForm, respiratory_rate_per_min: val })}
            placeholder="16"
            statusLabel={evaluateRespiratoryRate(vitalsForm.respiratory_rate_per_min)?.label}
            statusTone={evaluateRespiratoryRate(vitalsForm.respiratory_rate_per_min)?.tone}
            step={1}
            themeColor="teal"
            unit="/min"
            value={vitalsForm.respiratory_rate_per_min}
          />

          <ClinicalVitalCard
            disabled={updating === 'vitals'}
            icon="ph-scales"
            id="modal-vitals-weight"
            label="Body Weight"
            max={400}
            min={1}
            normalRange="Adult kg"
            onChange={(val) => setVitalsForm({ ...vitalsForm, weight_kg: val })}
            placeholder="70"
            step={0.5}
            themeColor="violet"
            unit="kg"
            value={vitalsForm.weight_kg}
          />

          <ClinicalVitalCard
            disabled={updating === 'vitals'}
            icon="ph-arrows-out-line-vertical"
            id="modal-vitals-height"
            label="Body Height"
            max={260}
            min={30}
            normalRange="Adult cm"
            onChange={(val) => setVitalsForm({ ...vitalsForm, height_cm: val })}
            placeholder="170"
            step={1}
            themeColor="indigo"
            unit="cm"
            value={vitalsForm.height_cm}
          />
        </div>

        {/* Derived Clinical Health Summary (BMI & MAP) */}
        {visitBmiObj || visitMapVal !== null ? (
          <div className="clinical-derived-metrics-card">
            {visitBmiObj ? (
              <div className="clinical-derived-metric-item">
                <i className="ph ph-scales" />
                <div className="clinical-derived-metric-text">
                  <span className="clinical-derived-metric-label">Body Mass Index (BMI)</span>
                  <span className="clinical-derived-metric-value">
                    {visitBmiObj.bmi} kg/m² • {visitBmiObj.category}
                  </span>
                </div>
              </div>
            ) : null}
            {visitMapVal !== null ? (
              <div className="clinical-derived-metric-item">
                <i className="ph ph-heartbeat" />
                <div className="clinical-derived-metric-text">
                  <span className="clinical-derived-metric-label">
                    Mean Arterial Pressure (MAP)
                  </span>
                  <span className="clinical-derived-metric-value">
                    {visitMapVal} mmHg (Normal: 70–105 mmHg)
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="doc-field" style={{ marginBottom: '0.5rem' }}>
          <label htmlFor="modal-vitals-notes">Clinical Observations / Triage Notes</label>
          <textarea
            id="modal-vitals-notes"
            onChange={(e) => setVitalsForm({ ...vitalsForm, notes: e.target.value })}
            placeholder="Clinical observation notes during vitals check"
            rows={2}
            value={vitalsForm.notes}
          />
        </div>

        <div className="modal-actions">
          <button className="doc-btn" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="doc-btn primary" disabled={updating === 'vitals'} type="submit">
            {updating === 'vitals' ? 'Saving Vitals...' : 'Save Vitals'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
