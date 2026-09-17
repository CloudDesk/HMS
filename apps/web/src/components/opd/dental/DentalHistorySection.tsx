import React, { useState } from 'react';
import type { DentalHistory } from '../../../api/opd';
import {
  COMMON_DENTAL_HABITS,
  COMMON_MEDICAL_ALERTS,
  COMMON_MEDICAL_ALERTS_GROUPED,
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
  const [isExpanded, setIsExpanded] = useState(true);
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
  const habitsList = current.habits ?? [];

  const customHabits = habitsList.filter(
    (habit: string) => !(COMMON_DENTAL_HABITS as readonly string[]).includes(habit),
  );

  const predefinedAlerts = new Set<string>(COMMON_MEDICAL_ALERTS);
  const customAlerts = alertsList.filter((alert: string) => !predefinedAlerts.has(alert));

  const isAllergyAlert = (alert: string) => /allerg/i.test(alert);
  const allergyAlerts = alertsList.filter(isAllergyAlert);
  const nonAllergyAlerts = alertsList.filter((a) => !isAllergyAlert(a));

  // Show consultation context if general CC, HPI, or Assessment exists
  const hasConsultationContext = Boolean(
    consultationChiefComplaint?.trim() ||
    consultationHpi?.trim() ||
    consultationAssessment?.trim()
  );

  return (
    <div className={styles.card}>
      <div
        className={`${styles.cardHeader} ${styles.cardHeaderCollapsible}`}
        style={{ padding: '10px 16px' }}
        onClick={() => {
          if (disabled) return;
          setIsExpanded(!isExpanded);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className={styles.collapseToggleBtn}
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              setIsExpanded(!isExpanded);
            }}
            disabled={disabled}
            aria-label={isExpanded ? 'Collapse Dental History' : 'Expand Dental History'}
          >
            <i className={`ph ph-caret-down ${styles.collapseChevron} ${isExpanded ? styles.collapseChevronExpanded : ''}`} />
          </button>
          <h3 className={styles.cardTitle} style={{ fontSize: '0.9rem' }}>
            <i className="ph ph-heartbeat" style={{ color: '#2563eb' }} />
            Dental History &amp; Medical Risk Assessment
          </h3>
        </div>
        {alertsList.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {allergyAlerts.length > 0 && (
              <span className={styles.activeAllergyBadge} title="Active allergies recorded">
                <i className="ph ph-warning-diamond-fill" />
                {allergyAlerts.length} Allergy Alert{allergyAlerts.length > 1 ? 's' : ''}
              </span>
            )}
            <span className={styles.statusBadgeDraft} style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fca5a5' }}>
              <i className="ph ph-warning" />
              {alertsList.length} Medical Alert{alertsList.length > 1 ? 's' : ''} Active
            </span>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className={styles.cardContent} style={{ padding: '14px 16px' }}>
        {/* Critical Alerts Banner */}
        {alertsList.length > 0 && (
          <div className={styles.alertBanner}>
            <i className="ph ph-warning-octagon" style={{ fontSize: '1.25rem', color: '#dc2626', marginTop: '2px' }} />
            <div>
              <div className={styles.alertBannerTitle}>Active Medical Alerts / Precautions Required:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                {allergyAlerts.map((a: string) => (
                  <span key={a} className={styles.activeAllergyBadge}>
                    <i className="ph ph-warning-diamond-fill" />
                    {a}
                  </span>
                ))}
                {nonAllergyAlerts.map((a: string) => (
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
              rows={2}
              style={{ minHeight: '56px' }}
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
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label className={styles.label}>
              <i className="ph ph-activity" /> Dental &amp; Oral Habits
              {habitsList.length === 0 && (
                <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '6px' }}>&mdash; None recorded</span>
              )}
            </label>
            {habitsList.length > 0 && disabled && (
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{habitsList.length} recorded</span>
            )}
          </div>
          <div className={styles.chipContainer}>
            {COMMON_DENTAL_HABITS.map((habit: string) => {
              const selected = habitsList.includes(habit);
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
            {customHabits.map((habit: string) => (
              <button
                key={habit}
                type="button"
                disabled={disabled}
                className={`${styles.chip} ${styles.chipSelected} ${disabled ? styles.chipDisabled : ''}`}
                onClick={() => toggleHabit(habit)}
                title="Click to remove habit"
              >
                <i className="ph ph-check" />
                {habit}
                {!disabled && (
                  <i
                    className="ph ph-x"
                    style={{ fontSize: '0.7rem', marginLeft: '3px', opacity: 0.7 }}
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
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

        {/* Medical Risk Alerts Row: Progressive Disclosure */}
        <div style={{ marginTop: '14px' }}>
          <label className={styles.label} style={{ color: alertsList.length > 0 ? '#991b1b' : '#334155' }}>
            <i className={alertsList.length > 0 ? "ph ph-warning-octagon" : "ph ph-shield-check"} style={{ color: alertsList.length > 0 ? '#dc2626' : '#2563eb' }} />
            Medical Alerts &amp; Systemic Conditions (Impacts Treatment &amp; Anesthesia)
            {alertsList.length === 0 && (
              <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '6px' }}>&mdash; No active dental treatment alerts (None recorded)</span>
            )}
          </label>

          <details
            className={styles.progressiveDisclosure}
            open={!disabled || alertsList.length > 0}
          >
            <summary className={styles.disclosureSummary}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <i className="ph ph-list-checks" style={{ color: alertsList.length > 0 ? '#dc2626' : '#2563eb' }} />
                <span>Medical Alerts Checklist {alertsList.length > 0 ? `(${alertsList.length} Active)` : ''}</span>
              </span>
              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                {disabled ? 'Review category checklist' : 'Toggle category checklist'}
              </span>
            </summary>

            <div className={styles.disclosureContent}>
              {COMMON_MEDICAL_ALERTS_GROUPED.map((group) => {
                let iconName = 'ph-heartbeat';
                let iconColor = '#2563eb';
                if (group.category === 'Bleeding / Medication Risks') {
                  iconName = 'ph-drop';
                  iconColor = '#dc2626';
                } else if (group.category === 'Allergies') {
                  iconName = 'ph-warning-octagon';
                  iconColor = '#d97706';
                }

                return (
                  <div key={group.category} className={styles.alertCategoryGroup}>
                    <div className={styles.alertCategoryTitle}>
                      <i className={`ph ${iconName}`} style={{ color: iconColor, fontSize: '0.85rem' }} />
                      {group.category}
                    </div>
                    <div className={styles.chipContainer}>
                      {group.alerts.map((alert: string) => {
                        const selected = alertsList.includes(alert);
                        const isAllergy = group.category === 'Allergies' || isAllergyAlert(alert);
                        const selectedClass = isAllergy ? styles.chipAllergySelected : styles.chipAlertSelected;
                        return (
                          <button
                            key={alert}
                            type="button"
                            disabled={disabled}
                            className={`${styles.chip} ${selected ? selectedClass : ''} ${disabled ? styles.chipDisabled : ''}`}
                            onClick={() => toggleMedicalAlert(alert)}
                          >
                            {selected && (
                              <i className={isAllergy ? 'ph ph-warning-diamond-fill' : 'ph ph-warning-circle'} />
                            )}
                            {alert}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {customAlerts.length > 0 && (
                <div className={styles.alertCategoryGroup}>
                  <div className={styles.alertCategoryTitle}>
                    <i className="ph ph-tag" style={{ color: '#64748b', fontSize: '0.85rem' }} />
                    Other / Custom Alerts
                  </div>
                  <div className={styles.chipContainer}>
                    {customAlerts.map((alert: string) => {
                      const isAllergy = isAllergyAlert(alert);
                      const selectedClass = isAllergy ? styles.chipAllergySelected : styles.chipAlertSelected;
                      return (
                        <button
                          key={alert}
                          type="button"
                          disabled={disabled}
                          className={`${styles.chip} ${selectedClass} ${disabled ? styles.chipDisabled : ''}`}
                          onClick={() => toggleMedicalAlert(alert)}
                          title="Click to remove alert"
                        >
                          <i className={isAllergy ? 'ph ph-warning-diamond-fill' : 'ph ph-warning-circle'} />
                          {alert}
                          {!disabled && (
                            <i
                              className="ph ph-x"
                              style={{ fontSize: '0.7rem', marginLeft: '3px', opacity: 0.7 }}
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!disabled && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', maxWidth: '380px' }}>
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
          </details>
        </div>
      </div>
      )}
    </div>
  );
};
