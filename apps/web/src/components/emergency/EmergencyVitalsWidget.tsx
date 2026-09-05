import type { EmergencyWorkspaceProps } from './types';

export type EmergencyVitalsWidgetProps = {
  state: EmergencyWorkspaceProps['state'];
};

export function EmergencyVitalsWidget({ state }: EmergencyVitalsWidgetProps) {
  const selected = state.selected || state.encounters[0] || null;
  if (!selected) return null;

  // Recorded vitals values from triage assessment
  const v = selected.triage?.vitals || {};
  const hasVitals = Boolean(
    v.systolic_bp ||
    v.diastolic_bp ||
    v.pulse ||
    v.spo2 ||
    v.temperature_c ||
    v.respiratory_rate ||
    v.gcs
  );

  const bp = v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp}` : '—';
  const pulse = v.pulse ? `${v.pulse} bpm` : '—';
  const spo2 = v.spo2 ? `${v.spo2}%` : '—';
  const temp = v.temperature_c ? `${v.temperature_c} °C` : '—';
  const resp = v.respiratory_rate ? `${v.respiratory_rate}/min` : '—';
  const gcs = v.gcs ? `${v.gcs}/15` : '—';

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
        <div className={`emergency-vital ${v.pulse && v.pulse > 100 ? 'alert' : ''}`}>
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
        <i className="ph ph-waveform" style={{ marginRight: '4px', color: hasVitals ? '#16a34a' : '#94a3b8' }} />
        {hasVitals ? 'Triage vitals recorded' : 'Awaiting vital signs recording'}
      </div>
    </aside>
  );
}
