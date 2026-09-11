import React from 'react';
import type { SoftTissueExamination } from '../../../api/opd';
import { SOFT_TISSUE_OPTIONS } from '../../../pages/dental-utils';
import styles from './DentalExamination.module.css';

interface DentalSoftTissueSectionProps {
  softTissue: SoftTissueExamination | null | undefined;
  onChange: (softTissue: SoftTissueExamination) => void;
  disabled?: boolean;
}

export const DentalSoftTissueSection: React.FC<DentalSoftTissueSectionProps> = ({
  softTissue,
  onChange,
  disabled = false,
}) => {
  const current: SoftTissueExamination = softTissue ?? {
    gingiva_condition: null,
    calculus_plaque: null,
    oral_mucosa: null,
    tongue_palate_floor: null,
    tmj_evaluation: null,
    occlusion_class: null,
  };

  const updateField = <K extends keyof SoftTissueExamination>(
    key: K,
    value: SoftTissueExamination[K],
  ) => {
    onChange({ ...current, [key]: value });
  };

  return (
    <div className={`${styles.card} ${styles.softTissueCard}`}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>
          <i className="ph ph-mask-happy" style={{ color: '#0d9488' }} />
          General Oral &amp; Soft Tissue Examination
        </h3>
      </div>

      <div className={styles.cardContent}>
        <div className={styles.formGrid3}>
          {/* Gingiva Condition */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Gingiva / Periodontium</label>
            <select
              className={styles.select}
              value={current.gingiva_condition ?? ''}
              onChange={(e) => updateField('gingiva_condition', e.target.value.trim() || null)}
              disabled={disabled}
            >
              <option value="">-- Not Recorded / Normal --</option>
              {SOFT_TISSUE_OPTIONS.gingiva.map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Calculus & Plaque */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Calculus &amp; Plaque Deposits</label>
            <select
              className={styles.select}
              value={current.calculus_plaque ?? ''}
              onChange={(e) => updateField('calculus_plaque', e.target.value.trim() || null)}
              disabled={disabled}
            >
              <option value="">-- Not Recorded / Nil --</option>
              {SOFT_TISSUE_OPTIONS.calculusPlaque.map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Oral Mucosa */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Oral Mucosa &amp; Cheeks</label>
            <select
              className={styles.select}
              value={current.oral_mucosa ?? ''}
              onChange={(e) => updateField('oral_mucosa', e.target.value.trim() || null)}
              disabled={disabled}
            >
              <option value="">-- Normal Mucosa --</option>
              {SOFT_TISSUE_OPTIONS.oralMucosa.map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Tongue & Palate */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Tongue, Palate &amp; Floor of Mouth</label>
            <select
              className={styles.select}
              value={current.tongue_palate_floor ?? ''}
              onChange={(e) => updateField('tongue_palate_floor', e.target.value.trim() || null)}
              disabled={disabled}
            >
              <option value="">-- Normal / Healthy --</option>
              {SOFT_TISSUE_OPTIONS.tonguePalate.map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* TMJ Evaluation */}
          <div className={styles.formGroup}>
            <label className={styles.label}>TMJ &amp; Mandibular Movement</label>
            <select
              className={styles.select}
              value={current.tmj_evaluation ?? ''}
              onChange={(e) => updateField('tmj_evaluation', e.target.value.trim() || null)}
              disabled={disabled}
            >
              <option value="">-- Normal / Asymptomatic --</option>
              {SOFT_TISSUE_OPTIONS.tmj.map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Occlusion Class */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Dental Occlusion Classification</label>
            <select
              className={styles.select}
              value={current.occlusion_class ?? ''}
              onChange={(e) => updateField('occlusion_class', e.target.value.trim() || null)}
              disabled={disabled}
            >
              <option value="">-- Not Recorded / Class I --</option>
              {SOFT_TISSUE_OPTIONS.occlusion.map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
