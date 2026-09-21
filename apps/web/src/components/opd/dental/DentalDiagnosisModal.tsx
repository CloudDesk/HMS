import React, { useMemo, useState } from 'react';
import { ICD10_DIAGNOSES, type Icd10Diagnosis } from '../../../data/icd10-diagnoses';
import {
  PERMANENT_QUADRANTS,
  PRIMARY_QUADRANTS,
  TOOTH_NAMES,
} from '../../../pages/dental-utils';
import styles from './DentalExamination.module.css';

export interface DentalDiagnosisModalProps {
  open: boolean;
  onClose: () => void;
  selectedToothNumber: number | null;
  diagnoses: Icd10Diagnosis[];
  onAddDiagnosis?: (dx: Icd10Diagnosis) => void;
  onRemoveDiagnosis?: (code: string, toothNumber?: number | null) => void;
  canEdit: boolean;
  assessment?: string;
  onAssessmentChange?: (val: string) => void;
  showToast?: (message: string, tone?: 'success' | 'error') => void;
}

const COMMON_DENTAL_QUICK_DIAGNOSES = [
  { code: 'K02.9', name: 'Dental caries, unspecified', category: 'Dental & Oral Health' },
  { code: 'K04.0', name: 'Pulpitis (Reversible / Irreversible)', category: 'Dental & Oral Health' },
  { code: 'K04.7', name: 'Periapical abscess without sinus', category: 'Dental & Oral Health' },
  { code: 'K05.10', name: 'Chronic gingivitis, plaque induced', category: 'Dental & Oral Health' },
  { code: 'K05.3', name: 'Chronic periodontitis', category: 'Dental & Oral Health' },
  { code: 'K01.1', name: 'Impacted teeth', category: 'Dental & Oral Health' },
  { code: 'K08.1', name: 'Complete / partial loss of teeth', category: 'Dental & Oral Health' },
  { code: 'K07.4', name: 'Malocclusion, unspecified', category: 'Dental & Oral Health' },
];

export const DentalDiagnosisModal: React.FC<DentalDiagnosisModalProps> = ({
  open,
  onClose,
  selectedToothNumber,
  diagnoses = [],
  onAddDiagnosis,
  onRemoveDiagnosis,
  canEdit,
  assessment = '',
  onAssessmentChange,
  showToast,
}) => {
  const [targetTooth, setTargetTooth] = useState<number | null>(selectedToothNumber);
  const [searchTerm, setSearchTerm] = useState('');

  // Sync initial target tooth when modal opens or selectedToothNumber changes
  React.useEffect(() => {
    if (open) {
      setTargetTooth(selectedToothNumber);
      setSearchTerm('');
    }
  }, [open, selectedToothNumber]);

  const dentalDiagnosesList = useMemo(() => {
    if (!searchTerm.trim()) {
      return ICD10_DIAGNOSES.filter((d) => d.category === 'Dental & Oral Health');
    }
    const q = searchTerm.toLowerCase();
    return ICD10_DIAGNOSES.filter(
      (d) =>
        d.code.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q),
    ).sort((a, b) => {
      const aDental = a.category === 'Dental & Oral Health' ? 0 : 1;
      const bDental = b.category === 'Dental & Oral Health' ? 0 : 1;
      return aDental - bDental;
    });
  }, [searchTerm]);

  if (!open) return null;

  const handleAdd = (dx: Icd10Diagnosis) => {
    if (!canEdit || !onAddDiagnosis) return;
    onAddDiagnosis({
      ...dx,
      tooth_number: targetTooth,
    });
  };

  const handleAddCustom = () => {
    if (!canEdit || !onAddDiagnosis || !searchTerm.trim()) return;
    const customCode = `DX-${Date.now().toString().slice(-4)}`;
    onAddDiagnosis({
      code: customCode,
      name: searchTerm.trim(),
      category: 'Dental & Oral Health',
      tooth_number: targetTooth,
    });
    setSearchTerm('');
    showToast?.(`Custom diagnosis "${searchTerm.trim()}" added.`, 'success');
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="dental-dx-modal-title">
      <div className={styles.modalContent} style={{ maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 id="dental-dx-modal-title" className={styles.modalTitle} style={{ margin: 0, fontSize: '1.15rem' }}>
            <i className="ph ph-stethoscope" style={{ color: '#2563eb' }} />
            Dental Diagnosis &amp; ICD-10 Coding
          </h3>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onClose}
            style={{ padding: '4px 8px', borderRadius: '4px' }}
            aria-label="Close diagnosis dialog"
          >
            <i className="ph ph-x" aria-hidden="true" />
          </button>
        </div>

        {/* Tooth Association Selector */}
        <div
          style={{
            padding: '10px 14px',
            background: '#f0fdf4',
            borderRadius: '8px',
            border: '1px solid #bbf7d0',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <label
            htmlFor="modal-dx-tooth-select"
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="ph ph-tooth" style={{ fontSize: '1.1rem', color: '#15803d' }} />
            Target Tooth:
          </label>
          <select
            id="modal-dx-tooth-select"
            value={targetTooth ?? ''}
            onChange={(e) => setTargetTooth(e.target.value ? Number(e.target.value) : null)}
            disabled={!canEdit}
            style={{
              padding: '6px 12px',
              fontSize: '0.82rem',
              borderRadius: '6px',
              border: '1px solid #86efac',
              backgroundColor: '#ffffff',
              color: '#0f172a',
              fontWeight: 600,
              minWidth: '280px',
              cursor: canEdit ? 'pointer' : 'not-allowed',
            }}
          >
            <option value="">General / Full Mouth (No specific tooth)</option>
            <optgroup label="Permanent Upper Right (Q1: 18 – 11)">
              {PERMANENT_QUADRANTS.Q1_UPPER_RIGHT.map((num) => (
                <option key={num} value={num}>
                  Tooth #{num} - {TOOTH_NAMES[num]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Permanent Upper Left (Q2: 21 – 28)">
              {PERMANENT_QUADRANTS.Q2_UPPER_LEFT.map((num) => (
                <option key={num} value={num}>
                  Tooth #{num} - {TOOTH_NAMES[num]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Permanent Lower Left (Q3: 31 – 38)">
              {PERMANENT_QUADRANTS.Q3_LOWER_LEFT.map((num) => (
                <option key={num} value={num}>
                  Tooth #{num} - {TOOTH_NAMES[num]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Permanent Lower Right (Q4: 41 – 48)">
              {PERMANENT_QUADRANTS.Q4_LOWER_RIGHT.map((num) => (
                <option key={num} value={num}>
                  Tooth #{num} - {TOOTH_NAMES[num]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Primary / Pediatric Teeth (51 – 85)">
              {[
                ...PRIMARY_QUADRANTS.Q5_UPPER_RIGHT,
                ...PRIMARY_QUADRANTS.Q6_UPPER_LEFT,
                ...PRIMARY_QUADRANTS.Q7_LOWER_LEFT,
                ...PRIMARY_QUADRANTS.Q8_LOWER_RIGHT,
              ].map((num) => (
                <option key={num} value={num}>
                  Tooth #{num} - {TOOTH_NAMES[num] || `Primary Tooth ${num}`}
                </option>
              ))}
            </optgroup>
          </select>
          {targetTooth !== null ? (
            <span
              style={{
                fontSize: '0.75rem',
                color: '#15803d',
                background: '#dcfce7',
                border: '1px solid #86efac',
                padding: '3px 8px',
                borderRadius: '4px',
                fontWeight: 700,
              }}
            >
              FDI #{targetTooth}
            </span>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              (Applies to general dentition)
            </span>
          )}
        </div>

        {/* Quick-Add Common Dental Conditions */}
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>
            Frequent Dental Diagnoses:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {COMMON_DENTAL_QUICK_DIAGNOSES.map((d) => {
              const isAdded = diagnoses.some(
                (dx) =>
                  dx.code === d.code &&
                  (dx.tooth_number ?? null) === (targetTooth ?? null),
              );
              return (
                <button
                  key={d.code}
                  type="button"
                  disabled={!canEdit || isAdded}
                  onClick={() => handleAdd(d)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    border: isAdded ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                    background: isAdded ? '#f0fdf4' : '#ffffff',
                    color: isAdded ? '#16a34a' : '#334155',
                    cursor: canEdit && !isAdded ? 'pointer' : 'default',
                    fontWeight: isAdded ? 600 : 400,
                  }}
                >
                  {isAdded ? '✓ ' : '+ '}
                  <strong>{d.code}</strong> {d.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search ICD-10 Box */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label htmlFor="modal-icd-search" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
              Search Dental / ICD-10 Catalogue
            </label>
            {canEdit && searchTerm.trim().length > 1 && (
              <button
                type="button"
                onClick={handleAddCustom}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                + Add "{searchTerm}" as custom diagnosis
              </button>
            )}
          </div>
          <input
            id="modal-icd-search"
            type="text"
            className={styles.modalInput}
            placeholder="Search code or condition (e.g. K02, caries, pulpitis, impacted, fracture)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!canEdit}
          />

          {/* Search results list */}
          {searchTerm.trim().length > 0 && (
            <div
              style={{
                maxHeight: '160px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                marginTop: '4px',
                background: '#ffffff',
              }}
            >
              {dentalDiagnosesList.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
                  No diagnoses found for "{searchTerm}".
                  {canEdit && (
                    <div style={{ marginTop: '6px' }}>
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                        onClick={handleAddCustom}
                      >
                        Add "{searchTerm}" as custom diagnosis
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                dentalDiagnosesList.slice(0, 15).map((d) => {
                  const isAdded = diagnoses.some(
                    (dx) =>
                      dx.code === d.code &&
                      (dx.tooth_number ?? null) === (targetTooth ?? null),
                  );
                  return (
                    <div
                      key={d.code}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 12px',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, color: '#2563eb', marginRight: '6px' }}>{d.code}</span>
                        <span>{d.name}</span>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          disabled={isAdded}
                          onClick={() => handleAdd(d)}
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            background: isAdded ? '#f0fdf4' : '#2563eb',
                            color: isAdded ? '#16a34a' : '#ffffff',
                            cursor: isAdded ? 'default' : 'pointer',
                          }}
                        >
                          {isAdded ? 'Added' : 'Add'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Selected Diagnoses Chips */}
        <div style={{ marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
            Current Diagnoses ({diagnoses.length}):
          </span>
          {diagnoses.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
              No diagnoses recorded yet. Select diagnoses above to associate with teeth.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {diagnoses.map((dx, idx) => (
                <span
                  key={`${dx.code}-${dx.tooth_number ?? 'gen'}-${idx}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '16px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '0.78rem',
                  }}
                >
                  {dx.tooth_number ? (
                    <span
                      style={{
                        background: '#15803d',
                        color: '#ffffff',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      Tooth #{dx.tooth_number}
                    </span>
                  ) : (
                    <span
                      style={{
                        background: '#e2e8f0',
                        color: '#475569',
                        borderRadius: '4px',
                        padding: '1px 5px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                      }}
                    >
                      General
                    </span>
                  )}
                  <strong>{dx.code}</strong> • {dx.name}
                  {canEdit && onRemoveDiagnosis && (
                    <button
                      type="button"
                      onClick={() => onRemoveDiagnosis(dx.code, dx.tooth_number)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                      title="Remove diagnosis"
                    >
                      <i className="ph ph-x" style={{ fontSize: '0.85rem' }} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Diagnostic Reasoning / Assessment Text */}
        {onAssessmentChange && (
          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="modal-dx-notes" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Diagnostic Reasoning &amp; Clinical Notes
            </label>
            <textarea
              id="modal-dx-notes"
              rows={3}
              className={styles.modalInput}
              placeholder="Clinical reasoning, differential diagnoses, or diagnostic findings..."
              value={assessment}
              onChange={(e) => onAssessmentChange(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        )}

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
