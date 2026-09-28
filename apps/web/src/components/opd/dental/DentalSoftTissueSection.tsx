import React from 'react';
import type { SoftTissueExamination } from '../../../api/opd';
import { SOFT_TISSUE_OPTIONS } from '../../../pages/dental-utils';
import styles from './DentalExamination.module.css';

interface DentalSoftTissueSectionProps {
  softTissue: SoftTissueExamination | null | undefined;
  onChange: (softTissue: SoftTissueExamination) => void;
  disabled?: boolean;
  embedded?: boolean;
}

export const DentalSoftTissueSection: React.FC<DentalSoftTissueSectionProps> = ({
  softTissue,
  onChange,
  disabled = false,
  embedded = false,
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

  const renderField = (
    key: keyof SoftTissueExamination,
    label: string,
    icon: string,
    placeholder: string,
    options: string[],
  ) => (
    <div className={`${styles.formGroup} ${styles.oralExamField}`}>
      <label className={styles.label} htmlFor={`oral-exam-${key}`}>
        <i className={`ph ${icon} ${styles.oralExamFieldIcon}`} aria-hidden="true" />
        {label}
      </label>
      <select
        id={`oral-exam-${key}`}
        className={styles.select}
        value={current[key] ?? ''}
        onChange={(e) => updateField(key, e.target.value.trim() || null)}
        disabled={disabled}
      >
        <option value="">{placeholder}</option>
        {current[key] && !options.includes(current[key]!) && (
          <option value={current[key]!}>{current[key]}</option>
        )}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );

  const fields = (
    <div className={styles.oralExamGroups}>
      <section className={styles.oralExamGroup} aria-labelledby="oral-exam-soft-tissues">
        <div className={styles.oralExamGroupHeader}>
          <i className="ph ph-mouth" aria-hidden="true" />
          <div>
            <h4 id="oral-exam-soft-tissues">Soft tissues</h4>
            <p>Review periodontal and intra-oral tissue health.</p>
          </div>
        </div>
        <div className={styles.formGrid2}>
          {renderField('gingiva_condition', 'Gingiva / Periodontium', 'ph-tooth', 'Not recorded / Normal', SOFT_TISSUE_OPTIONS.gingiva)}
          {renderField('calculus_plaque', 'Calculus & Plaque', 'ph-sparkle', 'Not recorded / Nil', SOFT_TISSUE_OPTIONS.calculusPlaque)}
          {renderField('oral_mucosa', 'Oral Mucosa & Cheeks', 'ph-smiley', 'Normal mucosa', SOFT_TISSUE_OPTIONS.oralMucosa)}
          {renderField('tongue_palate_floor', 'Tongue, Palate & Floor', 'ph-mask-happy', 'Normal / Healthy', SOFT_TISSUE_OPTIONS.tonguePalate)}
        </div>
      </section>

      <section className={styles.oralExamGroup} aria-labelledby="oral-exam-function">
        <div className={styles.oralExamGroupHeader}>
          <i className="ph ph-arrows-out-cardinal" aria-hidden="true" />
          <div>
            <h4 id="oral-exam-function">Function &amp; bite</h4>
            <p>Record jaw movement and occlusion.</p>
          </div>
        </div>
        <div className={styles.formGrid2}>
          {renderField('tmj_evaluation', 'TMJ & Mandibular Movement', 'ph-arrows-out', 'Normal / Asymptomatic', SOFT_TISSUE_OPTIONS.tmj)}
          {renderField('occlusion_class', 'Dental Occlusion', 'ph-selection', 'Not recorded / Class I', SOFT_TISSUE_OPTIONS.occlusion)}
        </div>
      </section>
    </div>
  );

  if (embedded) {
    return <section className={styles.softTissueEmbedded} aria-label="Oral Examination">
      <h3><i className="ph ph-mask-happy" /> Oral Examination</h3>
      {fields}
    </section>;
  }

  return (
    <div className={`${styles.card} ${styles.softTissueCard}`}>
      <div className={styles.cardHeader}>
        <div className={styles.examinationHeading}>
          <span className={styles.examinationHeadingIcon} aria-hidden="true">
            <i className="ph ph-mask-happy" />
          </span>
          <div>
          <h3 className={styles.cardTitle}>
              Oral Examination
          </h3>
            <p className={styles.examinationSubtitle}>A concise whole-mouth assessment, separate from individual tooth findings.</p>
          </div>
        </div>
      </div>
      <div className={styles.cardContent}>
        {fields}
      </div>
    </div>
  );
};
