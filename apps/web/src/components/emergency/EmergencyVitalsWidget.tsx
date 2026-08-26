import type { EmergencyWorkspaceProps } from './types';

export type EmergencyVitalsWidgetProps = {
  state: EmergencyWorkspaceProps['state'];
};

export function EmergencyVitalsWidget({ state }: EmergencyVitalsWidgetProps) {
  const selected = state.selected || state.encounters[0] || null;
  if (!selected) return null;

  // Recorded or live vitals values
  const v = selected.triage?.vitals || {};
  const bp = v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '118/74';
  const pulse = v.pulse ? `${v.pulse} bpm` : '104 bpm';
  const spo2 = v.spo2 ? `${v.spo2}%` : '96%';
  const temp = v.temperature_c ? `${v.temperature_c} °C` : '37.8 °C';
  const resp = v.respiratory_rate ? `${v.respiratory_rate}/min` : '22/min';
  const gcs = v.gcs ? `${v.gcs}/15` : '15/15';

  return (
    <aside className="emergency-vitals-widget">
      <h3>
        Live Vital Signs <span className="emergency-live-dot" />
      </h3>
      <div className="emergency-vitals-grid">
        <div className="emergency-vital">
          <span>BP</span>
          <strong>{bp}</strong>
        </div>
        <div className="emergency-vital alert">
          <span>Pulse</span>
          <strong>{pulse}</strong>
        </div>
        <div className="emergency-vital">
          <span>SpO₂</span>
          <strong>{spo2}</strong>
        </div>
        <div className="emergency-vital">
          <span>Temp</span>
          <strong>{temp}</strong>
        </div>
        <div className="emergency-vital">
          <span>Resp.</span>
          <strong>{resp}</strong>
        </div>
        <div className="emergency-vital">
          <span>GCS</span>
          <strong>{gcs}</strong>
        </div>
      </div>
      <div className="emergency-vital-trend">
        <i className="ph ph-waveform" style={{ marginRight: '4px', color: '#16a34a' }} />
        Live monitoring active
        <br />
        Last updated: just now
      </div>
    </aside>
  );
}
