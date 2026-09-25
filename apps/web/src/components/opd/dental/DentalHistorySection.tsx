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
  const [customMedicalCondition, setCustomMedicalCondition] = useState('');
  const [customBleedingRisk, setCustomBleedingRisk] = useState('');
  const [customAllergy, setCustomAllergy] = useState('');

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

  const addCustomAlert = (value: string, clear: () => void) => {
    if (disabled || !value.trim()) return;
    const alert = value.trim();
    const alerts = current.medical_alerts ?? [];
    if (!alerts.includes(alert)) {
      updateField('medical_alerts', [...alerts, alert]);
    }
    clear();
  };

  const painInfo = getPainScaleInfo(current.pain_scale);
  const alertsList = current.medical_alerts ?? [];
  const habitsList = current.habits ?? [];

  const predefinedAlerts = new Set<string>(COMMON_MEDICAL_ALERTS);
  const customAlerts = alertsList.filter((alert: string) => !predefinedAlerts.has(alert));

  const medicalGroups = Object.fromEntries(
    COMMON_MEDICAL_ALERTS_GROUPED.map((group) => [group.category, group.alerts]),
  ) as Record<string, readonly string[]>;

  const isAllergyAlert = (alert: string) => /allerg/i.test(alert);
  const allergyAlerts = alertsList.filter(isAllergyAlert);

  // Show consultation context if general CC, HPI, or Assessment exists
  const hasConsultationContext = Boolean(
    consultationChiefComplaint?.trim() ||
    consultationHpi?.trim() ||
    consultationAssessment?.trim()
  );

  return (
    <div className={`${styles.card} ${styles.historyAssessmentCard}`}>
      <div
        className={`${styles.cardHeader} ${styles.cardHeaderCollapsible} ${styles.historyAssessmentHeader}`}
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
          <span className={styles.historyHeaderIcon}><i className="ph ph-tooth" /></span>
          <div>
            <h3 className={styles.cardTitle}>Dental History &amp; Medical Risk Assessment</h3>
            <p className={styles.historyHeaderSubtitle}>Assess patient's dental history, habits, and medical conditions to ensure safe treatment.</p>
          </div>
        </div>
        {alertsList.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flexShrink: 0 }}>
            {allergyAlerts.length > 0 && (
              <span className={styles.medicalAlertBadgeAllergy} title="Active allergies recorded">
                <i className="ph ph-warning-diamond-fill" />
                {allergyAlerts.length} Allergy Alert{allergyAlerts.length > 1 ? 's' : ''}
              </span>
            )}
            <span className={styles.medicalAlertBadge}>
              <i className="ph ph-warning" />
              {alertsList.length} Medical Alert{alertsList.length > 1 ? 's' : ''} Active
            </span>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className={`${styles.cardContent} ${styles.historyAssessmentContent}`}>
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
              onChange={(e) => updateField('chief_complaint', e.target.value)}
              rows={3}
              disabled={disabled}
            />
          </div>
        </div>

        <div className={styles.historyTopGrid}>
          {/* Pain Scale (0-10) */}
          <div className={styles.historyTopCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={styles.historyFieldTitle}><i className="ph ph-chart-line-up" /> Patient Pain Rating (0 &mdash; 10)</label>
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
                <span>No Pain<strong>0</strong></span>
                <span>Mild<strong>1 &ndash; 3</strong></span>
                <span>Moderate<strong>4 &ndash; 6</strong></span>
                <span>Severe<strong>7 &ndash; 10</strong></span>
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

        <div className={styles.riskCardGrid}>
          {[
            { key: 'Medical Conditions', title: 'Medical Conditions', subtitle: 'Select any medical conditions (multiple allowed)', icon: 'ph-heartbeat', tone: 'blue', items: medicalGroups['Medical Conditions'] ?? [], value: customMedicalCondition, setValue: setCustomMedicalCondition, placeholder: 'Add other medical condition...' },
            { key: 'Bleeding / Medication Risks', title: 'Bleeding / Medication Risks', subtitle: 'Select any bleeding or medication risks (multiple allowed)', icon: 'ph-drop', tone: 'red', items: medicalGroups['Bleeding / Medication Risks'] ?? [], value: customBleedingRisk, setValue: setCustomBleedingRisk, placeholder: 'Add other medication risk...' },
            { key: 'Allergies', title: 'Allergies', subtitle: 'Select any allergies (multiple allowed)', icon: 'ph-warning-octagon', tone: 'amber', items: medicalGroups.Allergies ?? [], value: customAllergy, setValue: setCustomAllergy, placeholder: 'Add other allergy...' },
          ].map((group) => {
            const selectedCount = group.items.filter((item) => alertsList.includes(item)).length;
            const defaultItems = group.items.slice(0, 3);
            const selectedExtraItems = group.items.slice(3).filter((item) => alertsList.includes(item));
            return <section key={group.key} className={`${styles.riskCategoryCard} ${styles[`riskTone${group.tone}`]}`}>
              <header className={styles.riskCategoryHeader}>
                <i className={`ph ${group.icon}`} />
                <div><strong>{group.title}</strong><span>{group.subtitle}</span></div>
                <em>{selectedCount ? `${selectedCount} selected` : 'None selected'}</em>
              </header>
              <div className={styles.riskCategoryBody}>
                <div className={styles.chipContainer}>
                  {[...defaultItems, ...selectedExtraItems].map((alert) => {
                    const selected = alertsList.includes(alert);
                    return <button key={alert} type="button" disabled={disabled} className={`${styles.chip} ${selected ? (group.tone === 'amber' ? styles.chipAllergySelected : styles.chipAlertSelected) : ''} ${disabled ? styles.chipDisabled : ''}`} onClick={() => toggleMedicalAlert(alert)}>
                      <i className={`ph ${group.icon}`} />{alert}
                    </button>;
                  })}
                  {group.key === 'Medical Conditions' && customAlerts.map((alert) => <button key={alert} type="button" disabled={disabled} className={`${styles.chip} ${styles.chipAlertSelected}`} onClick={() => toggleMedicalAlert(alert)}><i className="ph ph-tag" />{alert}</button>)}
                </div>
                {!disabled && <div className={styles.riskAddRow}>
                  <input className={styles.input} value={group.value} placeholder={group.placeholder} onChange={(event) => group.setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomAlert(group.value, () => group.setValue('')); } }} />
                  <button type="button" onClick={() => addCustomAlert(group.value, () => group.setValue(''))} aria-label={`Add ${group.title}`}><i className="ph ph-plus" /></button>
                </div>}
              </div>
            </section>;
          })}

          <section className={`${styles.riskCategoryCard} ${styles.riskTonegreen}`}>
            <header className={styles.riskCategoryHeader}>
              <i className="ph ph-tooth" />
              <div><strong>Dental &amp; Oral Habits</strong><span>Select patient's oral habits (multiple allowed)</span></div>
              <em>{habitsList.length ? `${habitsList.length} selected` : 'None selected'}</em>
            </header>
            <div className={styles.riskCategoryBody}>
              <div className={styles.chipContainer}>
                {COMMON_DENTAL_HABITS.slice(0, 3).map((habit) => <button key={habit} type="button" disabled={disabled} className={`${styles.chip} ${habitsList.includes(habit) ? styles.chipSelected : ''} ${disabled ? styles.chipDisabled : ''}`} onClick={() => toggleHabit(habit)}><i className="ph ph-tooth" />{habit}</button>)}
                {habitsList.filter((habit) => !COMMON_DENTAL_HABITS.slice(0, 3).includes(habit)).map((habit) => <button key={habit} type="button" disabled={disabled} className={`${styles.chip} ${styles.chipSelected}`} onClick={() => toggleHabit(habit)}><i className="ph ph-check" />{habit}</button>)}
              </div>
              {!disabled && <div className={styles.riskAddRow}>
                <input className={styles.input} value={customHabit} placeholder="Add other oral habit..." onChange={(event) => setCustomHabit(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomHabit(); } }} />
                <button type="button" onClick={addCustomHabit} aria-label="Add oral habit"><i className="ph ph-plus" /></button>
              </div>}
            </div>
          </section>
        </div>
      </div>
      )}
    </div>
  );
};
