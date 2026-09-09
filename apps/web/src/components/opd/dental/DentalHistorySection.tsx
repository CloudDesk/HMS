import React, { useState } from 'react';
import type { DentalHistory } from '../../../api/opd';
import {
  COMMON_DENTAL_HABITS,
  COMMON_MEDICAL_ALERTS,
  getPainScaleInfo,
} from '../../../pages/dental-utils';
import styles from './DentalExamination.module.css';

interface DentalHistorySectionProps {
  history: DentalHistory | null | undefined;
  onChange: (history: DentalHistory) => void;
  disabled?: boolean;
  /** Read-only general consultation chief complaint for dentist reference */
  consultationChiefComplaint?: string | null;
  /** Read-only general history of present illness for dentist reference */
  consultationHpi?: string | null;
  /** Read-only general consultation assessment / diagnoses for dentist reference */
  consultationAssessment?: string | null;
}

export const DentalHistorySection: React.FC<DentalHistorySectionProps> = ({
  history,
  onChange,
  disabled = false,
  consultationChiefComplaint,
  consultationHpi,
  consultationAssessment,
}) => {
  const [customHabit, setCustomHabit] = useState('');
  const [customAlert, setCustomAlert] = useState('');

  const current: DentalHistory = history ?? {
    chief_complaint: '',
    pain_scale: null,
    bleeding_gums: null,
    sensitivity_hot_cold_sweet: null,
    bruxism: null,
    habits: [],
    medical_alerts: [],
  };

  const updateField = <K extends keyof DentalHistory>(key: K, value: DentalHistory[K]) => {
    onChange({ ...current, [key]: value });
  };

  const toggleHabit = (habit: string) => {
    if (disabled) return;
    const habits = current.habits ?? [];
    if (habits.includes(habit)) {
      updateField('habits', habits.filter((h: string) => h !== habit));
    } else {
      updateField('habits', [...habits, habit]);
    }
  };

  const addCustomHabit = () => {
    if (disabled || !customHabit.trim()) return;
    const habit = customHabit.trim();
    const habits = current.habits ?? [];
    if (!habits.includes(habit)) {
      updateField('habits', [...habits, habit]);
    }
    setCustomHabit('');
  };

  const toggleMedicalAlert = (alert: string) => {
    if (disabled) return;
    const alerts = current.medical_alerts ?? [];
    if (alerts.includes(alert)) {
      updateField('medical_alerts', alerts.filter((a: string) => a !== alert));
    } else {
      updateField('medical_alerts', [...alerts, alert]);
    }
  };

  const addCustomAlert = () => {
    if (disabled || !customAlert.trim()) return;
    const alert = customAlert.trim();
    const alerts = current.medical_alerts ?? [];
    if (!alerts.includes(alert)) {
      updateField('medical_alerts', [...alerts, alert]);
    }
    setCustomAlert('');
  };

  const painInfo = getPainScaleInfo(current.pain_scale);
  const alertsList = current.medical_alerts ?? [];

  // Show consultation context if general CC, HPI, or Assessment exists
  const hasConsultationContext = Boolean(
    consultationChiefComplaint?.trim() ||
    consultationHpi?.trim() ||
    consultationAssessment?.trim()
  );

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          <i className="ph ph-heartbeat" style={{ color: '#2563eb' }} />
          Dental History &amp; Medical Risk Assessment
        </h3>
        {alertsList.length > 0 && (
          <span className={styles.statusBadgeDraft} style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}>
            <i className="ph ph-warning" />
            {alertsList.length} Medical Alert{alertsList.length > 1 ? 's' : ''} Active
          </span>
        )}
      </div>

      <div className={styles.cardContent}>
        {/* Critical Alerts Banner */}
        {alertsList.length > 0 && (
          <div className={styles.alertBanner}>
            <i className="ph ph-warning-octagon" style={{ fontSize: '1.25rem', color: '#dc2626', marginTop: '2px' }} />
            <div>
              <div className={styles.alertBannerTitle}>Active Medical Alerts / Precautions Required:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {alertsList.map((a: string) => (
                  <span
                    key={a}
                    style={{
                      background: '#ffffff',
                      color: '#991b1b',
                      border: '1px solid #fca5a5',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Read-only General Consultation Context — single source of truth */}
        {hasConsultationContext && (
          <div className={styles.consultationContext}>
            <div className={styles.consultationContextLabel}>
              <i className="ph ph-clipboard-text" />
              General Consultation (from Consultation tab — read only)
            </div>
            {consultationChiefComplaint?.trim() && (
              <div style={{ marginBottom: consultationHpi?.trim() || consultationAssessment?.trim() ? '8px' : 0 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>Chief Complaint: </span>
                <span className={styles.consultationContextText}>{consultationChiefComplaint}</span>
              </div>
            )}
            {consultationHpi?.trim() && (
              <div style={{ marginBottom: consultationAssessment?.trim() ? '8px' : 0 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>HPI: </span>
                <span className={styles.consultationContextText}>{consultationHpi}</span>
              </div>
            )}
            {consultationAssessment?.trim() && (
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>Active Diagnoses / Assessment: </span>
                <span className={styles.consultationContextText}>{consultationAssessment}</span>
              </div>
            )}
          </div>
        )}

        <div className={styles.formGrid2} style={{ marginTop: alertsList.length > 0 ? '16px' : 0 }}>
          {/* Dental-Specific Complaint */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Dental-Specific Complaint
            </label>
            <textarea
              className={styles.textarea}
              placeholder="Describe dental pain location, onset, duration, and triggers (hot, cold, biting, sweets, spontaneous)..."
              value={current.chief_complaint ?? ''}
              onChange={(e) => updateField('chief_complaint', e.target.value.trim() ? e.target.value : null)}
              disabled={disabled}
              rows={3}
            />
          </div>

          {/* Pain Scale (0-10) */}
          <div className={styles.formGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={styles.label}>Patient Pain Rating (0 &mdash; 10)</label>
              <span
                className={styles.painBadge}
                style={{ backgroundColor: painInfo.badgeBg, color: painInfo.color }}
              >
                {painInfo.label}
              </span>
            </div>

            <div className={styles.painContainer} style={{ marginTop: '10px' }}>
              <div className={styles.painSliderRow}>
                <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>0</span>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  className={styles.painSlider}
                  value={current.pain_scale ?? 0}
                  onChange={(e) => updateField('pain_scale', Number(e.target.value))}
                  disabled={disabled}
                />
                <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>10</span>
              </div>
              <div className={styles.painLabels}>
                <span>No Pain</span>
                <span>Mild (1-3)</span>
                <span>Moderate (4-6)</span>
                <span>Severe (7-10)</span>
              </div>
            </div>

            {/* Quick Symptoms Checkboxes */}
            <div className={styles.toggleRow}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={Boolean(current.bleeding_gums)}
                  onChange={(e) => updateField('bleeding_gums', e.target.checked)}
                  disabled={disabled}
                />
                Bleeding Gums
              </label>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={Boolean(current.sensitivity_hot_cold_sweet)}
                  onChange={(e) => updateField('sensitivity_hot_cold_sweet', e.target.checked)}
                  disabled={disabled}
                />
                Hot/Cold Sensitivity
              </label>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  className={styles.checkboxInput}
                  checked={Boolean(current.bruxism)}
                  onChange={(e) => updateField('bruxism', e.target.checked)}
                  disabled={disabled}
                />
                Teeth Grinding / Bruxism
              </label>
            </div>
          </div>
        </div>

        {/* Habits Row */}
        <div style={{ marginTop: '16px' }}>
          <label className={styles.label}>
            <i className="ph ph-activity" /> Dental &amp; Oral Habits
          </label>
          <div className={styles.chipContainer}>
            {COMMON_DENTAL_HABITS.map((habit: string) => {
              const selected = (current.habits ?? []).includes(habit);
              return (
                <button
                  key={habit}
                  type="button"
                  disabled={disabled}
                  className={`${styles.chip} ${selected ? styles.chipSelected : ''} ${disabled ? styles.chipDisabled : ''}`}
                  onClick={() => toggleHabit(habit)}
                >
                  {selected && <i className="ph ph-check" />}
                  {habit}
                </button>
              );
            })}
          </div>

          {!disabled && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', maxWidth: '380px' }}>
              <input
                type="text"
                placeholder="Add other oral habit..."
                className={styles.input}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                value={customHabit}
                onChange={(e) => setCustomHabit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomHabit();
                  }
                }}
              />
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ padding: '4px 12px', fontSize: '0.775rem' }}
                onClick={addCustomHabit}
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Medical Risk Alerts Row */}
        <div style={{ marginTop: '18px' }}>
          <label className={styles.label} style={{ color: '#991b1b' }}>
            <i className="ph ph-shield-warning" /> Medical Alerts &amp; Systemic Conditions (Impacts Treatment &amp; Anesthesia)
          </label>
          <div className={styles.chipContainer}>
            {COMMON_MEDICAL_ALERTS.map((alert: string) => {
              const selected = alertsList.includes(alert);
              return (
                <button
                  key={alert}
                  type="button"
                  disabled={disabled}
                  className={`${styles.chip} ${selected ? styles.chipAlertSelected : ''} ${disabled ? styles.chipDisabled : ''}`}
                  onClick={() => toggleMedicalAlert(alert)}
                >
                  {selected && <i className="ph ph-warning-circle" />}
                  {alert}
                </button>
              );
            })}
          </div>

          {!disabled && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', maxWidth: '380px' }}>
              <input
                type="text"
                placeholder="Add other medical alert/allergy..."
                className={styles.input}
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                value={customAlert}
                onChange={(e) => setCustomAlert(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomAlert();
                  }
                }}
              />
              <button
                type="button"
                className={styles.btnSecondary}
                style={{ padding: '4px 12px', fontSize: '0.775rem', color: '#991b1b', borderColor: '#fca5a5' }}
                onClick={addCustomAlert}
              >
                Add Alert
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
